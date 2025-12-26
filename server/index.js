const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { categories } = require('./words');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in dev/render
        methods: ["GET", "POST"]
    }
});

// State Management
const rooms = new Map();

// Helper: Generate 4-letter code
function generateRoomCode() {
    let code = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
    } while (rooms.has(code));
    return code;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', ({ playerName }) => {
        const roomCode = generateRoomCode();
        const newRoom = {
            code: roomCode,
            players: [{ id: socket.id, name: playerName, isHost: true, score: 0 }],
            gameState: 'LOBBY', // LOBBY, PLAYING, VOTING, RESULTS
            category: null,
            secretWord: null,
            impostorId: null,
            votes: {},
            impostorGuess: null
        };
        rooms.set(roomCode, newRoom);
        socket.join(roomCode);

        socket.emit('roomCreated', { roomCode, playerId: socket.id });
        io.to(roomCode).emit('updateLobby', newRoom.players);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('error', 'Sala no encontrada');
            return;
        }
        if (room.gameState !== 'LOBBY') {
            socket.emit('error', 'El juego ya ha comenzado');
            return;
        }

        const existingPlayer = room.players.find(p => p.name === playerName);
        if (existingPlayer) {
            socket.emit('error', 'Nombre ya en uso en esta sala');
            return;
        }

        room.players.push({ id: socket.id, name: playerName, isHost: false, score: 0 });
        socket.join(roomCode);

        socket.emit('joinedRoom', { roomCode, playerId: socket.id });
        io.to(roomCode).emit('updateLobby', room.players);
    });

    socket.on('startGame', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        // 1. Select Category and Word
        const categoryKeys = Object.keys(categories);
        const randomCategory = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
        const words = categories[randomCategory];
        const randomWord = words[Math.floor(Math.random() * words.length)];

        // 2. Assign Impostor
        const impostorIndex = Math.floor(Math.random() * room.players.length);
        const impostorId = room.players[impostorIndex].id;

        room.gameState = 'PLAYING';
        room.category = randomCategory;
        room.secretWord = randomWord;
        room.impostorId = impostorId;
        room.votes = {};
        room.impostorGuess = null;

        // 3. Notify players
        room.players.forEach(player => {
            const isImpostor = player.id === impostorId;
            io.to(player.id).emit('gameStarted', {
                role: isImpostor ? 'IMPOSTOR' : 'CIVIL',
                word: isImpostor ? null : randomWord,
                category: randomCategory
            });
        });

        io.to(roomCode).emit('gameStateChanged', 'PLAYING');
    });

    socket.on('startVoting', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (room) {
            room.gameState = 'VOTING';
            io.to(roomCode).emit('gameStateChanged', 'VOTING');
        }
    });

    socket.on('submitVote', ({ roomCode, votedPlayerId }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        room.votes[socket.id] = votedPlayerId;

        // Check if all players have voted
        if (Object.keys(room.votes).length === room.players.length) {
            // If impostor hasn't guessed yet, wait (or handle parallel). 
            // For simplicity, we can reveal results now if we assume impostor guess happens simultaneously or before.
            // But per requirements: "El impostor debajo siempre tendra un cuadrado para escribir la palabra."
            // Let's check if we have the impostor guess if needed.
            checkEndGame(roomCode);
        }
    });

    socket.on('submitImpostorGuess', ({ roomCode, guess }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        // Only impostor can submit
        if (socket.id !== room.impostorId) return;

        room.impostorGuess = guess;
        checkEndGame(roomCode);
    });

    function checkEndGame(roomCode) {
        const room = rooms.get(roomCode);
        if (!room) return;

        const allVoted = Object.keys(room.votes).length === room.players.length;
        const impostorGuessed = room.impostorGuess !== null;

        if (allVoted && impostorGuessed) {
            finishGame(roomCode);
        }
    }

    function finishGame(roomCode) {
        const room = rooms.get(roomCode);
        room.gameState = 'RESULTS';

        // Calculate most voted
        const voteCounts = {};
        Object.values(room.votes).forEach(votedId => {
            voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
        });

        let maxVotes = 0;
        let mostVotedId = null;
        for (const [id, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                mostVotedId = id;
            }
        }

        const impostorCaught = mostVotedId === room.impostorId;
        const wordGuessed = room.impostorGuess.toLowerCase().trim() === room.secretWord.toLowerCase().trim();

        const results = {
            impostorId: room.impostorId,
            secretWord: room.secretWord,
            impostorGuess: room.impostorGuess,
            impostorCaught,
            wordGuessed,
            players: room.players
        };

        io.to(roomCode).emit('gameEnded', results);
    }

    socket.on('playAgain', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (room) {
            room.gameState = 'LOBBY';
            room.category = null;
            room.secretWord = null;
            room.impostorId = null;
            room.votes = {};
            room.impostorGuess = null;
            io.to(roomCode).emit('gameStateChanged', 'LOBBY');
            io.to(roomCode).emit('updateLobby', room.players);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Handle cleanup if needed, remove player from room
        rooms.forEach((room, code) => {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.players.length === 0) {
                    rooms.delete(code);
                } else {
                    io.to(code).emit('updateLobby', room.players);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
