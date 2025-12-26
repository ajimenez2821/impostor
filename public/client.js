const socket = io();

// Elementos DOM
const screens = {
    login: document.getElementById('screen-login'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game'),
    results: document.getElementById('screen-results')
};

let myUsername = '';
let currentRoom = '';
let isHost = false;

// Navegación
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

// Event Listeners LOGIN
document.getElementById('btn-create').addEventListener('click', () => {
    myUsername = document.getElementById('username').value;
    if(!myUsername) return alert('Pon tu nombre');
    socket.emit('createRoom', { username: myUsername });
});

document.getElementById('btn-join').addEventListener('click', () => {
    myUsername = document.getElementById('username').value;
    const code = document.getElementById('room-code-input').value;
    if(!myUsername || !code) return alert('Faltan datos');
    socket.emit('joinRoom', { username: myUsername, roomCode: code });
});

// Event Listeners LOBBY
document.getElementById('btn-start').addEventListener('click', () => {
    const impostorCount = document.getElementById('impostor-count').value;
    socket.emit('startGame', { 
        roomCode: currentRoom, 
        settings: { impostorCount: parseInt(impostorCount), useHints: true } 
    });
});

// Event Listeners GAME
document.getElementById('btn-guess').addEventListener('click', () => {
    const guess = document.getElementById('guess-input').value;
    if(guess) socket.emit('impostorGuess', { roomCode: currentRoom, guess });
});

document.getElementById('btn-force-end').addEventListener('click', () => {
    socket.emit('forceFinish', { roomCode: currentRoom });
});

document.getElementById('btn-back-lobby').addEventListener('click', () => {
    showScreen('lobby');
});

// --- SOCKET EVENTS ---

socket.on('roomCreated', (data) => {
    currentRoom = data.roomCode;
    isHost = true;
    setupLobby();
});

socket.on('roomJoined', (data) => {
    currentRoom = data.roomCode;
    isHost = false;
    setupLobby();
});

socket.on('updatePlayerList', (players) => {
    const list = document.getElementById('player-list');
    list.innerHTML = players.map(p => 
        `<li class="bg-slate-700/50 p-2 rounded flex justify-between">
            <span>${p.username}</span>
            ${p.id === socket.id ? '<span class="text-xs bg-purple-500 px-1 rounded">TÚ</span>' : ''}
        </li>`
    ).join('');
});

socket.on('gameStarted', (data) => {
    showScreen('game');
    
    // Resetear UI
    document.getElementById('game-category').textContent = data.category;
    document.getElementById('impostor-area').classList.add('hidden');
    document.getElementById('hint-box').classList.add('hidden');
    document.getElementById('guess-input').value = '';
    
    const wordDisplay = document.getElementById('secret-word-display');
    const roleDesc = document.getElementById('role-desc');
    const votingList = document.getElementById('voting-list');

    // Configurar vista según rol
    if (data.role === 'impostor') {
        wordDisplay.textContent = "ERES EL IMPOSTOR";
        wordDisplay.classList.replace('text-white', 'text-red-500');
        roleDesc.textContent = "Nadie sabe que eres tú. Engáñales.";
        document.getElementById('impostor-area').classList.remove('hidden');
        
        if(data.hint) {
            const hintBox = document.getElementById('hint-box');
            hintBox.textContent = "PISTA: " + data.hint;
            hintBox.classList.remove('hidden');
        }
    } else {
        wordDisplay.textContent = data.word;
        wordDisplay.classList.replace('text-red-500', 'text-white');
        roleDesc.textContent = "Descubre al impostor sin revelar la palabra.";
    }

    // Configurar botones de votación
    votingList.innerHTML = data.players.map(p => {
        if(p.id === socket.id) return ''; // No votarse a sí mismo
        return `<button onclick="vote('${p.id}')" class="bg-slate-700 p-3 rounded hover:bg-slate-600 transition text-sm">
            Votar a ${p.username}
        </button>`;
    }).join('');

    // Mostrar botón de forzar fin si es host
    if(isHost) document.getElementById('btn-force-end').classList.remove('hidden');
    else document.getElementById('btn-force-end').classList.add('hidden');
});

socket.on('voteUpdate', (players) => {
    // Aquí podrías mostrar quién ya ha votado visualmente
    // Por simplicidad, solo mostramos un toast o log
    console.log("Alguien ha votado");
});

socket.on('gameEnded', (data) => {
    showScreen('results');
    document.getElementById('result-word').textContent = data.secretWord;
    
    const impostorNames = data.players.filter(p => data.impostors.includes(p.id)).map(p => p.username).join(', ');
    document.getElementById('result-impostor').textContent = impostorNames;

    const votedPlayer = data.players.find(p => p.id === data.mostVotedId);
    document.getElementById('result-voted').textContent = votedPlayer ? votedPlayer.username : "Nadie / Empate";

    const guessInfo = document.getElementById('result-guess-info');
    if (data.impostorGuess) {
        guessInfo.innerHTML = `El impostor escribió: <span class="text-white font-bold">"${data.impostorGuess}"</span> <br> 
        ${data.impostorWinByGuess ? '<span class="text-green-400">¡Y ACERTÓ! (Gana Impostor)</span>' : '<span class="text-red-400">Y FALLÓ</span>'}`;
    } else {
        guessInfo.innerHTML = "El impostor no intentó adivinar.";
    }
});

socket.on('error', (msg) => alert(msg));

// Helper Functions
function setupLobby() {
    showScreen('lobby');
    document.getElementById('lobby-code').textContent = currentRoom;
    if (isHost) {
        document.getElementById('host-controls').classList.remove('hidden');
        document.getElementById('waiting-msg').classList.add('hidden');
    } else {
        document.getElementById('host-controls').classList.add('hidden');
        document.getElementById('waiting-msg').classList.remove('hidden');
    }
}

// Función global para el onclick del HTML generado dinámicamente
window.vote = (id) => {
    socket.emit('votePlayer', { roomCode: currentRoom, votedId: id });
    alert("Voto registrado");
    // Deshabilitar botones visualmente si quieres
};