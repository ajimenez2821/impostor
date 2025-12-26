const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Cargar palabras
const wordsData = JSON.parse(fs.readFileSync('words.json', 'utf8'));

app.use(express.static(path.join(__dirname, 'public')));

// Estado del juego (En memoria)
// Estructura: { roomCode: { players: [], gameState: 'lobby', settings: {}, gameData: {} } }
const rooms = {};

// Utilidad para generar código de 4 letras
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Crear Sala
    socket.on('createRoom', ({ username }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            host: socket.id,
            players: [{ id: socket.id, username, score: 0, role: null, votedFor: null }],
            gameState: 'lobby',
            settings: { impostorCount: 1, useHints: false },
            gameData: {}
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, isHost: true });
        io.to(roomCode).emit('updatePlayerList', rooms[roomCode].players);
    });

    // Unirse a Sala
    socket.on('joinRoom', ({ username, roomCode }) => {
        const room = rooms[roomCode.toUpperCase()];
        if (room && room.gameState === 'lobby') {
            room.players.push({ id: socket.id, username, score: 0, role: null, votedFor: null });
            socket.join(roomCode.toUpperCase());
            socket.emit('roomJoined', { roomCode: roomCode.toUpperCase(), isHost: false });
            io.to(roomCode.toUpperCase()).emit('updatePlayerList', room.players);
        } else {
            socket.emit('error', 'Sala no encontrada o juego ya iniciado');
        }
    });

    // Iniciar Juego
    socket.on('startGame', ({ roomCode, settings }) => {
        const room = rooms[roomCode];
        if (!room || room.host !== socket.id) return;

        // Configuración
        room.settings = settings;
        room.gameState = 'playing';

        // Elegir palabra
        const categories = Object.keys(wordsData);
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const words = wordsData[randomCategory];
        const secretWord = words[Math.floor(Math.random() * words.length)];

        // Asignar roles
        let players = room.players;
        // Reiniciar votos
        players.forEach(p => p.votedFor = null);
        
        // Mezclar jugadores para asignar impostor
        const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
        const impostorCount = Math.min(settings.impostorCount, players.length - 1);
        
        const impostorIds = [];
        for (let i = 0; i < impostorCount; i++) {
            impostorIds.push(shuffledPlayers[i].id);
        }

        room.gameData = {
            category: randomCategory,
            secretWord: secretWord,
            impostors: impostorIds,
            impostorGuess: null
        };

        // Enviar información a cada jugador individualmente
        players.forEach(player => {
            const isImpostor = impostorIds.includes(player.id);
            io.to(player.id).emit('gameStarted', {
                role: isImpostor ? 'impostor' : 'civilian',
                category: randomCategory,
                word: isImpostor ? null : secretWord,
                hint: (isImpostor && settings.useHints) ? `La palabra tiene ${secretWord.length} letras` : null,
                players: room.players
            });
        });
    });

    // Votar
    socket.on('votePlayer', ({ roomCode, votedId }) => {
        const room = rooms[roomCode];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) player.votedFor = votedId;

        // Notificar que alguien votó (sin decir quién para mantener tensión o actualizar UI)
        io.to(roomCode).emit('voteUpdate', room.players);
    });

    // Impostor adivina palabra
    socket.on('impostorGuess', ({ roomCode, guess }) => {
        const room = rooms[roomCode];
        if (!room) return;
        
        room.gameData.impostorGuess = guess;
        finishGame(roomCode);
    });

    // Finalizar juego manualmente (Host)
    socket.on('forceFinish', ({ roomCode }) => {
        finishGame(roomCode);
    });

    function finishGame(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;

        room.gameState = 'results';
        
        // Contar votos
        const voteCounts = {};
        room.players.forEach(p => {
            if (p.votedFor) {
                voteCounts[p.votedFor] = (voteCounts[p.votedFor] || 0) + 1;
            }
        });

        // Determinar el más votado
        let mostVotedId = null;
        let maxVotes = -1;
        for (const [id, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                mostVotedId = id;
            }
        }

        const impostorWinByGuess = room.gameData.impostorGuess && 
            room.gameData.impostorGuess.toLowerCase() === room.gameData.secretWord.toLowerCase();

        io.to(roomCode).emit('gameEnded', {
            secretWord: room.gameData.secretWord,
            impostors: room.gameData.impostors,
            mostVotedId: mostVotedId,
            impostorGuess: room.gameData.impostorGuess,
            impostorWinByGuess: impostorWinByGuess,
            players: room.players
        });
        
        // Resetear estado a lobby
        room.gameState = 'lobby';
    }

    // Desconexión
    socket.on('disconnect', () => {
        // Lógica simple de limpieza
        for (const code in rooms) {
            rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
            io.to(code).emit('updatePlayerList', rooms[code].players);
            if (rooms[code].players.length === 0) {
                delete rooms[code];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));