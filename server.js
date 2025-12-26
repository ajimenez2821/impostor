const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const wordsData = JSON.parse(fs.readFileSync('./words.json', 'utf8'));
const rooms = {};
const pendingDisconnects = {}; 

const avatarColors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 
    'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 
    'bg-pink-500', 'bg-rose-500'
];

function generateRoomCode() {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function getRandomColor() {
    return avatarColors[Math.floor(Math.random() * avatarColors.length)];
}

function finalizePlayerRemoval(socketId, roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const index = room.players.findIndex(p => p.id === socketId);
    if (index !== -1) {
        const removedPlayer = room.players[index];
        room.players.splice(index, 1);
        
        io.to(roomCode).emit('updatePlayerList', room.players);
        
        if (room.players.length === 0) {
            delete rooms[roomCode];
            console.log(`Sala ${roomCode} cerrada definitivamente (está vacía).`);
        } else {
            console.log(`Jugador ${removedPlayer.username} salió. La sala ${roomCode} permanece abierta.`);
        }
    }
}

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Crear Sala
    socket.on('createRoom', ({ username, sessionToken }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            creatorToken: sessionToken,
            players: [{ 
                id: socket.id, 
                username, 
                score: 0, 
                isHost: true,
                avatarColor: getRandomColor(),
                sessionToken: sessionToken,
                isReady: true 
            }],
            gameState: 'lobby',
            settings: { impostorCount: 1, useHint: false },
            currentWord: '',
            currentCategory: '',
            impostorIds: [],
            votes: {},
            impostorGuess: null,
            lastGameResults: null 
        };

        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, isHost: true });
        io.to(roomCode).emit('updatePlayerList', rooms[roomCode].players);
    });

    // Unirse a Sala
    socket.on('joinRoom', ({ username, roomCode, sessionToken }) => {
        const room = rooms[roomCode.toUpperCase()];
        if (room && room.gameState === 'lobby') {
            const isOriginalHost = room.creatorToken === sessionToken;
            room.players.push({ 
                id: socket.id, 
                username, 
                score: 0, 
                isHost: isOriginalHost, 
                avatarColor: getRandomColor(),
                sessionToken: sessionToken,
                isReady: true 
            });
            socket.join(roomCode.toUpperCase());
            socket.emit('roomJoined', { roomCode: roomCode.toUpperCase() });
            io.to(roomCode.toUpperCase()).emit('updatePlayerList', room.players);
        } else {
            socket.emit('error', 'Sala no encontrada o juego ya iniciado.');
        }
    });

    // Reconexión
    socket.on('attemptReconnect', ({ roomCode, sessionToken }) => {
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('error', 'Sala no encontrada.');
            return;
        }

        const playerIndex = room.players.findIndex(p => p.sessionToken === sessionToken);
        
        if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            const oldSocketId = player.id;

            if (pendingDisconnects[oldSocketId]) {
                clearTimeout(pendingDisconnects[oldSocketId].timeout);
                delete pendingDisconnects[oldSocketId];
            }

            player.id = socket.id;
            socket.join(roomCode);

            let gameData = null;
            if (room.gameState === 'playing') {
                const isImpostor = room.impostorIds.includes(player.id) || room.impostorIds.includes(oldSocketId);
                if(room.impostorIds.includes(oldSocketId)) {
                   room.impostorIds = room.impostorIds.map(id => id === oldSocketId ? socket.id : id);
                }
                
                const showHint = isImpostor && room.settings.useHint;
                gameData = {
                    role: isImpostor ? 'impostor' : 'civilian',
                    word: isImpostor ? null : room.currentWord
                };
                if (showHint) gameData.hint = `Categoría: ${room.currentCategory}`;
            }

            socket.emit('reconnectSuccess', {
                roomCode,
                username: player.username,
                players: room.players,
                gameState: room.gameState,
                gameData,
                lastGameResults: room.lastGameResults,
                isReady: player.isReady
            });

            io.to(roomCode).emit('updatePlayerList', room.players);

        } else {
            socket.emit('error', 'No se pudo restaurar la sesión.');
        }
    });

    socket.on('updateSettings', ({ roomCode, impostorCount, useHint }) => {
        if (rooms[roomCode]) {
            rooms[roomCode].settings = { impostorCount, useHint };
            io.to(roomCode).emit('settingsUpdated', rooms[roomCode].settings);
        }
    });

    socket.on('startGame', ({ roomCode, impostorCount }) => {
        const room = rooms[roomCode];
        if (!room) return;
        
        if (room.players.length < 3) {
            socket.emit('error', 'Se necesitan mínimo 3 jugadores para iniciar.');
            return;
        }

        const allReady = room.players.every(p => p.isReady);
        if (!allReady) {
            socket.emit('error', 'Todos los jugadores deben volver al lobby.');
            return;
        }

        let validImpostors = impostorCount || room.settings.impostorCount;
        if (validImpostors >= room.players.length) validImpostors = 1;
        room.settings.impostorCount = validImpostors;
        room.votes = {};
        room.impostorGuess = null;
        room.lastGameResults = null;
        room.gameState = 'playing';

        room.players.forEach(p => p.isReady = false);

        const randomCat = wordsData[Math.floor(Math.random() * wordsData.length)];
        const randomWord = randomCat.words[Math.floor(Math.random() * randomCat.words.length)];
        room.currentCategory = randomCat.category;
        room.currentWord = randomWord;

        const playerIds = room.players.map(p => p.id);
        const impostors = [];
        while (impostors.length < room.settings.impostorCount && impostors.length < playerIds.length) {
            const randomIndex = Math.floor(Math.random() * playerIds.length);
            const selectedId = playerIds[randomIndex];
            if (!impostors.includes(selectedId)) impostors.push(selectedId);
        }
        room.impostorIds = impostors;

        room.players.forEach(player => {
            const isImpostor = impostors.includes(player.id);
            const showHint = isImpostor && room.settings.useHint;

            const data = {
                role: isImpostor ? 'impostor' : 'civilian',
                word: isImpostor ? null : room.currentWord
            };

            if (showHint) {
                data.hint = `Categoría: ${room.currentCategory}`;
            }

            io.to(player.id).emit('gameStarted', data);
        });
        
        io.to(roomCode).emit('updatePlayerList', room.players);
    });

    socket.on('submitVote', ({ roomCode, votedId }) => {
        const room = rooms[roomCode];
        if (!room) return;
        room.votes[socket.id] = votedId;
        if (Object.keys(room.votes).length === room.players.length) {
            calculateResults(roomCode);
        } else {
            io.to(roomCode).emit('voteUpdate', { 
                votesCount: Object.keys(room.votes).length, 
                totalPlayers: room.players.length 
            });
        }
    });

    socket.on('impostorGuess', ({ roomCode, word }) => {
        const room = rooms[roomCode];
        if (room && room.impostorIds.includes(socket.id)) {
            room.impostorGuess = word;
            io.to(roomCode).emit('notification', 'El impostor ha anotado una palabra posible.');
        }
    });

    socket.on('markReady', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.isReady = true;
                io.to(roomCode).emit('updatePlayerList', room.players);
            }
        }
    });

    // --- CORRECCIÓN: EXPULSAR JUGADOR ---
    socket.on('kickPlayer', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Verificar que el que pide es HOST
        const requester = room.players.find(p => p.id === socket.id);
        if (!requester || !requester.isHost) return;

        // No auto-expulsión
        if (requester.id === playerId) return;

        const targetIndex = room.players.findIndex(p => p.id === playerId);
        if (targetIndex !== -1) {
            // 1. PRIMERO: Avisar al jugador expulsado (Directamente a su socket)
            io.to(playerId).emit('kicked');
            
            // 2. SEGUNDO: Sacarlo del canal de Socket.io (ya no recibirá updates)
            const targetSocket = io.sockets.sockets.get(playerId);
            if (targetSocket) {
                targetSocket.leave(roomCode);
            }

            // 3. TERCERO: Borrarlo de la lista de datos
            room.players.splice(targetIndex, 1);
            
            // 4. CUARTO: Actualizar a los supervivientes
            io.to(roomCode).emit('updatePlayerList', room.players);
        }
    });

    socket.on('leaveRoom', () => {
        let foundRoomCode = null;
        for (const code in rooms) {
            const p = rooms[code].players.find(p => p.id === socket.id);
            if (p) { foundRoomCode = code; break; }
        }

        if (foundRoomCode) {
            if(pendingDisconnects[socket.id]) {
                clearTimeout(pendingDisconnects[socket.id].timeout);
                delete pendingDisconnects[socket.id];
            }
            socket.leave(foundRoomCode);
            finalizePlayerRemoval(socket.id, foundRoomCode);
        }
    });

    socket.on('disconnect', () => {
        let foundRoomCode = null;
        for (const code in rooms) {
            if (rooms[code].players.find(p => p.id === socket.id)) {
                foundRoomCode = code;
                break;
            }
        }

        if (foundRoomCode) {
            const timeout = setTimeout(() => {
                finalizePlayerRemoval(socket.id, foundRoomCode);
                delete pendingDisconnects[socket.id];
            }, 15000); 

            pendingDisconnects[socket.id] = { timeout, roomCode: foundRoomCode };
        }
    });
});

function calculateResults(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    const voteCounts = {};
    Object.values(room.votes).forEach(votedId => { voteCounts[votedId] = (voteCounts[votedId] || 0) + 1; });

    let maxVotes = 0;
    let mostVotedId = null;
    for (const [id, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) { maxVotes = count; mostVotedId = id; }
    }

    const impostorCaught = room.impostorIds.includes(mostVotedId);
    const impostorGuessedCorrectly = room.impostorGuess && room.impostorGuess.toLowerCase().trim() === room.currentWord.toLowerCase().trim();

    let winner = 'impostor';
    let message = '';

    if (impostorCaught && !impostorGuessedCorrectly) {
        winner = 'civilians'; 
        message = '¡Los civiles ganan! Atraparon al impostor.';
    } else if (impostorGuessedCorrectly) {
        winner = 'impostor'; 
        message = `¡El impostor gana! Adivinó la palabra secreta: ${room.currentWord}`;
    } else {
        message = '¡El impostor escapó!';
    }

    const impostorNames = room.players.filter(p => room.impostorIds.includes(p.id)).map(p => p.username);
    
    const resultsData = { 
        winner, 
        message, 
        impostors: impostorNames, 
        realWord: room.currentWord, 
        impostorGuess: room.impostorGuess 
    };
    
    room.lastGameResults = resultsData; 
    room.gameState = 'lobby'; 
    room.players.forEach(p => p.isReady = false);
    
    io.to(roomCode).emit('gameEnded', resultsData);
    io.to(roomCode).emit('updatePlayerList', room.players);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));