const socket = io();

// Elementos del DOM (Pantallas)
const screens = {
    login: document.getElementById('screen-login'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game'),
    results: document.getElementById('screen-results')
};

// Variables de estado local
let myUsername = '';
let currentRoom = '';
let isHost = false;

// --- FUNCIONES DE NAVEGACIÓN ---

function showScreen(screenName) {
    // Ocultar todas las pantallas
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    // Mostrar la solicitada
    screens[screenName].classList.remove('hidden');
}

function setupLobby() {
    showScreen('lobby');
    document.getElementById('lobby-code').textContent = currentRoom;
    
    // Controles específicos si eres el Host (creador de la sala)
    if (isHost) {
        document.getElementById('host-controls').classList.remove('hidden');
        document.getElementById('waiting-msg').classList.add('hidden');
    } else {
        document.getElementById('host-controls').classList.add('hidden');
        document.getElementById('waiting-msg').classList.remove('hidden');
    }
}

// --- EVENT LISTENERS (Botones) ---

// 1. Crear Sala
document.getElementById('btn-create').addEventListener('click', () => {
    myUsername = document.getElementById('username').value.trim();
    if(!myUsername) return alert('Por favor, escribe un nombre de agente.');
    socket.emit('createRoom', { username: myUsername });
});

// 2. Unirse a Sala
document.getElementById('btn-join').addEventListener('click', () => {
    myUsername = document.getElementById('username').value.trim();
    const code = document.getElementById('room-code-input').value.trim();
    if(!myUsername || !code) return alert('Faltan datos (Nombre o Código).');
    socket.emit('joinRoom', { username: myUsername, roomCode: code });
});

// 3. Iniciar Partida (Solo Host)
document.getElementById('btn-start').addEventListener('click', () => {
    const impostorCount = document.getElementById('impostor-count').value;
    socket.emit('startGame', { 
        roomCode: currentRoom, 
        settings: { impostorCount: parseInt(impostorCount), useHints: true } 
    });
});

// 4. Impostor intenta adivinar
document.getElementById('btn-guess').addEventListener('click', () => {
    const guess = document.getElementById('guess-input').value.trim();
    if(guess) {
        socket.emit('impostorGuess', { roomCode: currentRoom, guess });
    } else {
        alert("Escribe una palabra antes de adivinar.");
    }
});

// 5. Forzar fin de votación (Solo Host)
document.getElementById('btn-force-end').addEventListener('click', () => {
    if(confirm("¿Seguro que quieres terminar la votación ahora?")) {
        socket.emit('forceFinish', { roomCode: currentRoom });
    }
});

// 6. Volver al Lobby desde Resultados
document.getElementById('btn-back-lobby').addEventListener('click', () => {
    showScreen('lobby');
});


// --- EVENTOS DE SOCKET.IO ---

// Sala Creada con éxito
socket.on('roomCreated', (data) => {
    currentRoom = data.roomCode;
    isHost = true;
    setupLobby();
});

// Unido a sala con éxito
socket.on('roomJoined', (data) => {
    currentRoom = data.roomCode;
    isHost = false;
    setupLobby();
});

// Actualizar lista de jugadores (Con estilo Glassmorphism)
socket.on('updatePlayerList', (players) => {
    const list = document.getElementById('player-list');
    list.innerHTML = players.map(p => 
        `<li class="player-item-glass">
            <span class="font-medium tracking-wide">${p.username}</span>
            ${p.id === socket.id ? '<span class="text-[10px] font-bold bg-purple-500/80 text-white px-2 py-0.5 rounded shadow-[0_0_10px_rgba(168,85,247,0.5)]">TÚ</span>' : ''}
        </li>`
    ).join('');
});

// El juego ha comenzado
socket.on('gameStarted', (data) => {
    showScreen('game');
    
    // Resetear interfaz
    document.getElementById('game-category').textContent = data.category;
    document.getElementById('impostor-area').classList.add('hidden');
    document.getElementById('hint-box').classList.add('hidden');
    document.getElementById('guess-input').value = '';
    
    const wordDisplay = document.getElementById('secret-word-display');
    const roleDesc = document.getElementById('role-desc');
    const votingList = document.getElementById('voting-list');

    // Lógica visual según el Rol
    if (data.role === 'impostor') {
        // Estilo especial para Impostor
        wordDisplay.textContent = "ERES EL IMPOSTOR";
        wordDisplay.classList.add('text-red-400');
        wordDisplay.classList.remove('text-white');
        
        roleDesc.textContent = "Nadie sabe que eres tú. Engáñales o adivina la palabra.";
        document.getElementById('impostor-area').classList.remove('hidden');
        
        if(data.hint) {
            const hintBox = document.getElementById('hint-box');
            hintBox.textContent = "PISTA DE INTELIGENCIA: " + data.hint;
            hintBox.classList.remove('hidden');
        }
    } else {
        // Estilo para Civiles
        wordDisplay.textContent = data.word;
        wordDisplay.classList.add('text-white');
        wordDisplay.classList.remove('text-red-400');
        roleDesc.textContent = "Analiza las respuestas. Encuentra al espía.";
    }

    // Generar botones de votación con estilo Glassmorphism
    votingList.innerHTML = data.players.map(p => {
        if(p.id === socket.id) return ''; // No puedes votarte a ti mismo
        
        return `<button onclick="vote('${p.id}')" class="vote-btn-glass group">
            <span class="text-white/50 text-[10px] uppercase block mb-1">Sospechoso</span>
            <span class="text-lg font-bold group-hover:text-cyan-300 transition-colors">${p.username}</span>
        </button>`;
    }).join('');

    // Mostrar botón de forzar fin solo si es Host
    if(isHost) document.getElementById('btn-force-end').classList.remove('hidden');
    else document.getElementById('btn-force-end').classList.add('hidden');
});

// Actualización de Votos (Feedback visual simple)
socket.on('voteUpdate', (players) => {
    // Podrías añadir notificaciones aquí
    console.log("Se ha registrado un nuevo voto.");
});

// Fin del juego y Resultados
socket.on('gameEnded', (data) => {
    showScreen('results');
    
    // 1. Mostrar la palabra secreta
    document.getElementById('result-word').textContent = data.secretWord;
    
    // 2. Mostrar quiénes eran los impostores
    const impostorNames = data.players
        .filter(p => data.impostors.includes(p.id))
        .map(p => p.username)
        .join(', ');
    document.getElementById('result-impostor').textContent = impostorNames;

    // 3. Mostrar al más votado
    const votedPlayer = data.players.find(p => p.id === data.mostVotedId);
    document.getElementById('result-voted').textContent = votedPlayer ? votedPlayer.username : "Empate / Nadie";

    // 4. Detalles sobre si el impostor adivinó
    const guessInfo = document.getElementById('result-guess-info');
    if (data.impostorGuess) {
        guessInfo.innerHTML = `
            El impostor arriesgó con: <span class="text-white font-bold">"${data.impostorGuess}"</span><br>
            ${data.impostorWinByGuess 
                ? '<span class="text-green-400 font-bold block mt-2">¡MISIÓN CUMPLIDA POR EL IMPOSTOR! (Ganó)</span>' 
                : '<span class="text-red-400 font-bold block mt-2">INTENTO FALLIDO</span>'}
        `;
    } else {
        guessInfo.innerHTML = "El impostor optó por el sigilo y no intentó adivinar.";
    }
});

// Manejo de errores
socket.on('error', (msg) => {
    alert("ERROR DEL SISTEMA: " + msg);
});


// --- FUNCIÓN GLOBAL PARA VOTAR ---
// Necesaria porque los botones se crean dinámicamente con HTML string
window.vote = (id) => {
    if(confirm("¿Confirmas tu voto contra este agente? No se puede cambiar.")) {
        socket.emit('votePlayer', { roomCode: currentRoom, votedId: id });
        
        // Feedback visual: Deshabilitar botones de votación
        const buttons = document.querySelectorAll('#voting-list button');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        });
    }
};