const socket = io();

// --- GESTIÓN DE SESIÓN ---
let sessionToken = localStorage.getItem('impostor_token');
if (!sessionToken) {
    sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('impostor_token', sessionToken);
}

// Elementos del DOM
const screens = {
    home: document.getElementById('screen-home'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game'),
    voting: document.getElementById('screen-voting'),
    results: document.getElementById('screen-results')
};

let myUsername = '';
let currentRoom = '';
let currentPlayers = [];
let localImpostorCount = 1;

function saveSession(roomCode, username) {
    localStorage.setItem('impostor_room', roomCode);
    localStorage.setItem('impostor_user', username);
}

function clearSession() {
    localStorage.removeItem('impostor_room');
    localStorage.removeItem('impostor_user');
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('animate-fade-in');
}

function showNotification(msg, type = 'error') {
    const area = document.getElementById('notification-area');
    const div = document.createElement('div');
    const color = type === 'error' ? 'bg-red-600' : 'bg-green-600';
    div.className = `${color} text-white px-6 py-3 rounded-full shadow-xl mb-2 animate-fade-in font-bold text-sm pointer-events-auto`;
    div.innerText = msg;
    area.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 500);
    }, 3000);
}

// Tarjeta 3D
const cardInner = document.getElementById('card-inner');
document.getElementById('card-container').addEventListener('click', () => {
    cardInner.classList.toggle('is-flipped');
});

// --- CONTROLES DE IMPOSTORES ---
const impDisplay = document.getElementById('imp-count-display');

document.getElementById('btn-imp-minus').addEventListener('click', () => {
    if (localImpostorCount > 1) {
        localImpostorCount--;
        impDisplay.innerText = localImpostorCount;
    }
});

document.getElementById('btn-imp-plus').addEventListener('click', () => {
    const maxImpostors = Math.max(1, currentPlayers.length - 1);
    if (localImpostorCount < maxImpostors && localImpostorCount < 4) {
        localImpostorCount++;
        impDisplay.innerText = localImpostorCount;
    } else {
        if(currentPlayers.length <= 2) showNotification("Se necesitan más jugadores");
        else showNotification("Máximo de impostores alcanzado");
    }
});


// --- EVENTOS DE UI (HOME) ---

document.getElementById('btn-create').addEventListener('click', () => {
    const username = document.getElementById('username').value;
    if (!username) return showNotification('Escribe un nombre');
    myUsername = username;
    socket.emit('createRoom', { username, sessionToken });
});

document.getElementById('btn-join').addEventListener('click', () => {
    const username = document.getElementById('username').value;
    const roomCode = document.getElementById('room-code-input').value;
    if (!username || !roomCode) return showNotification('Faltan datos');
    myUsername = username;
    socket.emit('joinRoom', { username, roomCode, sessionToken });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    socket.emit('leaveRoom'); 
    clearSession();
    
    currentRoom = '';
    currentPlayers = [];
    localImpostorCount = 1;
    
    document.getElementById('player-list').innerHTML = '';
    document.getElementById('host-controls').classList.add('hidden');
    document.getElementById('waiting-msg').classList.remove('hidden');
    document.getElementById('imp-count-display').innerText = '1';
    document.getElementById('room-code-input').value = '';

    showScreen('home');
});


// --- EVENTOS DE SOCKET & RECONEXIÓN ---

socket.on('connect', () => {
    const savedRoom = localStorage.getItem('impostor_room');
    const savedUser = localStorage.getItem('impostor_user');
    
    if (savedRoom && savedUser && sessionToken) {
        console.log("Intentando reconectar...");
        socket.emit('attemptReconnect', { 
            roomCode: savedRoom, 
            sessionToken: sessionToken 
        });
    }
});

socket.on('roomCreated', ({ roomCode }) => {
    currentRoom = roomCode;
    saveSession(roomCode, myUsername);
    document.getElementById('lobby-code').innerText = roomCode;
    showScreen('lobby');
});

socket.on('roomJoined', ({ roomCode }) => {
    currentRoom = roomCode;
    saveSession(roomCode, myUsername);
    document.getElementById('lobby-code').innerText = roomCode;
    showScreen('lobby');
});

socket.on('reconnectSuccess', (data) => {
    currentRoom = data.roomCode;
    myUsername = data.username;
    
    document.getElementById('lobby-code').innerText = currentRoom;
    saveSession(currentRoom, myUsername);

    if (data.gameState === 'lobby') {
        if (!data.isReady && data.lastGameResults) {
            handleGameEnded(data.lastGameResults);
        } else {
            showScreen('lobby');
        }
    } else if (data.gameState === 'playing') {
        handleGameStarted(data.gameData);
    } 
    
    updatePlayerListUI(data.players);
    showNotification("Sesión restaurada", "success");
});

function updatePlayerListUI(players) {
    currentPlayers = players;
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    
    const me = players.find(p => p.sessionToken === sessionToken);
    const startButton = document.getElementById('btn-start');
    
    // --- LÓGICA DE VISIBILIDAD DE CONTROLES HOST ---
    if (me && me.isHost && document.getElementById('screen-lobby').classList.contains('hidden') === false) {
        document.getElementById('host-controls').classList.remove('hidden');
        document.getElementById('waiting-msg').classList.add('hidden');
        
        const allReady = players.every(p => p.isReady);
        const enoughPlayers = players.length >= 3;

        if (allReady && enoughPlayers) {
            startButton.disabled = false;
            startButton.classList.remove('opacity-50', 'cursor-not-allowed', 'shadow-none');
            startButton.classList.add('hover:bg-green-700', 'transform', 'active:scale-95', 'shadow-lg');
            startButton.innerText = "INICIAR JUEGO";
            startButton.className = "w-full mt-2 p-3 bg-green-600 rounded-xl font-bold hover:bg-green-700 transition transform active:scale-95 shadow-lg shadow-green-900/50";
        } else {
            startButton.disabled = true;
            startButton.classList.add('opacity-50', 'cursor-not-allowed', 'shadow-none');
            startButton.classList.remove('hover:bg-green-700', 'transform', 'active:scale-95', 'shadow-lg');
            
            if (!enoughPlayers) {
                const missing = 3 - players.length;
                if (missing === 1) {
                    startButton.innerText = "FALTA 1 JUGADOR";
                } else {
                    startButton.innerText = `FALTAN ${missing} JUGADORES`;
                }
            } else {
                startButton.innerText = "ESPERANDO A QUE TODOS VUELVAN...";
            }
        }

    } else {
        document.getElementById('host-controls').classList.add('hidden');
        if(!document.getElementById('screen-lobby').classList.contains('hidden')){
            document.getElementById('waiting-msg').classList.remove('hidden');
        }
    }

    players.forEach(p => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-700';
        const initial = p.username.charAt(0).toUpperCase();
        const isMe = p.sessionToken === sessionToken; 

        const readyTick = p.isReady 
            ? '<span class="text-green-500 font-bold text-xl ml-2">✅</span>' 
            : '<span class="text-gray-600 text-xl ml-2">⏳</span>';

        // --- BOTÓN DE EXPULSAR (Solo para el Host) ---
        let kickButton = '';
        if (me && me.isHost && !isMe) {
            // Añadimos el botón con un atributo data-id para identificar a quién expulsar
            kickButton = `<button class="btn-kick text-red-500 hover:text-red-700 font-bold ml-3 px-2 py-1 bg-red-900/30 rounded border border-red-800/50 hover:bg-red-900/50 transition" data-id="${p.id}" title="Expulsar jugador">✕</button>`;
        }

        const avatarHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 rounded-full ${p.avatarColor || 'bg-gray-600'} flex items-center justify-center text-white font-bold text-sm shadow-md">
                    ${initial}
                </div>
                <span class="font-bold ${isMe ? 'text-purple-400' : 'text-gray-300'}">
                    ${p.username}
                </span>
            </div>
        `;
        li.innerHTML = `
            ${avatarHTML}
            <div class="flex items-center">
                ${p.isHost ? '<span class="text-xs bg-yellow-600 px-2 py-1 rounded text-white font-bold mr-2">HOST</span>' : ''}
                ${readyTick}
                ${kickButton}
            </div>
        `;
        list.appendChild(li);
    });

    if (localImpostorCount >= players.length && players.length > 1) {
        localImpostorCount = players.length - 1;
        impDisplay.innerText = localImpostorCount;
    }

    // --- ACTIVAR LOS BOTONES DE EXPULSIÓN ---
    document.querySelectorAll('.btn-kick').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const playerId = btn.getAttribute('data-id');
            if(confirm("¿Seguro que quieres expulsar a este jugador?")) {
                socket.emit('kickPlayer', { roomCode: currentRoom, playerId });
            }
        });
    });
}

socket.on('updatePlayerList', (players) => {
    updatePlayerListUI(players);
});

socket.on('error', (msg) => {
    showNotification(msg);
    if (msg.includes('No se pudo restaurar') || msg.includes('Sala no encontrada')) {
        clearSession();
        showScreen('home');
    }
});

// --- NUEVO LISTENER: AL SER EXPULSADO ---
socket.on('kicked', () => {
    clearSession();
    currentRoom = '';
    currentPlayers = [];
    localImpostorCount = 1;
    
    // Limpieza UI
    document.getElementById('player-list').innerHTML = '';
    document.getElementById('lobby-code').innerText = '----';
    document.getElementById('host-controls').classList.add('hidden');
    document.getElementById('waiting-msg').classList.remove('hidden');
    
    showScreen('home');
    showNotification("¡Has sido expulsado de la sala!", "error");
});

document.getElementById('btn-start').addEventListener('click', () => {
    const useHint = document.getElementById('setting-hint').checked;
    if (currentPlayers.length < 3) {
        return showNotification('Se necesitan mínimo 3 jugadores');
    }
    if (!currentPlayers.every(p => p.isReady)) {
        return showNotification('Espera a que todos confirmen');
    }
    socket.emit('updateSettings', { roomCode: currentRoom, impostorCount: localImpostorCount, useHint });
    socket.emit('startGame', { roomCode: currentRoom, impostorCount: localImpostorCount });
});

// --- JUEGO ---

function handleGameStarted({ role, word, hint }) {
    showScreen('game');
    cardInner.classList.remove('is-flipped');
    
    const secretWordEl = document.getElementById('secret-word');
    const categoryHintEl = document.getElementById('category-hint'); 
    const roleTitle = document.getElementById('role-title');
    const impostorInputDiv = document.getElementById('impostor-input-area');
    const impostorGuessInput = document.getElementById('impostor-guess');

    impostorGuessInput.value = "";

    if (role === 'impostor') {
        roleTitle.innerText = 'ERES EL IMPOSTOR';
        roleTitle.className = 'text-xl text-red-500 uppercase tracking-widest mb-2';
        secretWordEl.innerText = "🕵️"; 
        
        categoryHintEl.classList.remove('hidden');
        categoryHintEl.style.display = ''; 

        if (hint) {
            categoryHintEl.innerText = hint; 
        } else {
            categoryHintEl.innerText = "Intenta pasar desapercibido";
        }
        
        impostorInputDiv.classList.remove('hidden');

    } else {
        roleTitle.innerText = 'CIVIL'; 
        roleTitle.className = 'text-xl text-green-400 uppercase tracking-widest mb-2';
        secretWordEl.innerText = word;
        
        categoryHintEl.innerText = "";
        categoryHintEl.classList.add('hidden');
        categoryHintEl.style.display = 'none';
        
        impostorInputDiv.classList.add('hidden');
    }
}

socket.on('gameStarted', (data) => {
    handleGameStarted(data);
});

document.getElementById('btn-impostor-submit').addEventListener('click', () => {
    const guess = document.getElementById('impostor-guess').value;
    if (guess) {
        socket.emit('impostorGuess', { roomCode: currentRoom, word: guess });
        showNotification('Intento enviado', 'success');
        document.getElementById('impostor-input-area').classList.add('hidden');
    }
});

document.getElementById('btn-goto-vote').addEventListener('click', () => {
    showScreen('voting');
    generateVotingButtons(); 
});

function generateVotingButtons() {
    const container = document.getElementById('voting-list');
    container.innerHTML = '';
    
    currentPlayers.forEach(p => {
        if (p.sessionToken === sessionToken) return; 

        const btn = document.createElement('button');
        btn.className = 'p-3 bg-gray-800 border border-gray-600 rounded-xl hover:bg-red-900/50 transition flex items-center space-x-3';
        
        const initial = p.username.charAt(0).toUpperCase();
        
        btn.innerHTML = `
            <div class="w-8 h-8 rounded-full ${p.avatarColor || 'bg-gray-600'} flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                ${initial}
            </div>
            <span class="font-bold text-white truncate text-left flex-1">${p.username}</span>
        `;

        btn.onclick = () => {
            Array.from(container.children).forEach(b => b.disabled = true);
            btn.classList.add('bg-red-600', 'border-red-400');
            socket.emit('submitVote', { roomCode: currentRoom, votedId: p.id });
            document.getElementById('vote-status').innerText = `Votaste a ${p.username}. Esperando al resto...`;
        };
        container.appendChild(btn);
    });
}

socket.on('voteUpdate', ({ votesCount, totalPlayers }) => {
    document.getElementById('vote-status').innerText = `Votos: ${votesCount}/${totalPlayers}`;
});

function handleGameEnded(data) {
    showScreen('results');
    
    const resultTitle = document.getElementById('result-title');
    const resultMsg = document.getElementById('result-message');
    const resultIcon = document.getElementById('result-icon');

    if (data.winner === 'impostor') {
        resultIcon.innerText = "😈";
        resultTitle.innerText = "GANA EL IMPOSTOR";
        resultTitle.className = "text-3xl font-bold text-red-500";
    } else {
        resultIcon.innerText = "😇";
        resultTitle.innerText = "GANAN LOS CIVILES"; 
        resultTitle.className = "text-3xl font-bold text-green-500";
    }

    resultMsg.innerText = data.message;
    document.getElementById('res-real-word').innerText = data.realWord;
    document.getElementById('res-impostor-name').innerText = data.impostors.join(', ');
    document.getElementById('res-impostor-guess').innerText = data.impostorGuess || "Ninguno";
}

socket.on('gameEnded', (data) => {
    handleGameEnded(data);
});

document.getElementById('btn-restart').addEventListener('click', () => {
    socket.emit('markReady', { roomCode: currentRoom });
    showScreen('lobby');
    
    const cardInner = document.getElementById('card-inner');
    cardInner.classList.remove('is-flipped');
    document.getElementById('secret-word').innerText = "...";
    document.getElementById('role-title').innerText = "ROL";
    document.getElementById('impostor-guess').value = "";
    document.getElementById('vote-status').innerText = "Esperando votos...";
    document.getElementById('voting-list').innerHTML = "";
    document.getElementById('result-title').className = "text-3xl font-bold";
});

socket.on('navigateToLobby', () => {});