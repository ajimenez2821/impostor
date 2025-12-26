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
    lastChance: document.getElementById('screen-last-chance'), // NUEVA PANTALLA
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
    screens[screenName].classList.remove('animate-enter');
    void screens[screenName].offsetWidth; 
    screens[screenName].classList.add('animate-enter');
}

function showNotification(msg, type = 'error') {
    const area = document.getElementById('notification-area');
    const div = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-500/90' : 'bg-emerald-500/90';
    div.className = `${bgColor} backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl mb-3 animate-enter font-bold text-sm pointer-events-auto border border-white/10 flex items-center gap-3 min-w-[300px] justify-center`;
    const icon = type === 'error' ? '⚠️' : '✨';
    div.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    area.appendChild(div);
    setTimeout(() => {
        div.style.transition = 'all 0.5s ease';
        div.style.opacity = '0';
        div.style.transform = 'translateY(-20px)';
        setTimeout(() => div.remove(), 500);
    }, 3000);
}

const cardInner = document.getElementById('card-inner');
document.getElementById('card-container').addEventListener('click', () => {
    cardInner.classList.toggle('is-flipped');
});

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
        else showNotification("Máximo alcanzado");
    }
});

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

socket.on('connect', () => {
    const savedRoom = localStorage.getItem('impostor_room');
    const savedUser = localStorage.getItem('impostor_user');
    if (savedRoom && savedUser && sessionToken) {
        console.log("Reconectando...");
        socket.emit('attemptReconnect', { roomCode: savedRoom, sessionToken: sessionToken });
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
    showNotification("¡Sesión recuperada!", "success");
});

function updatePlayerListUI(players) {
    currentPlayers = players;
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    
    document.getElementById('player-count').innerText = `${players.length}/10`;

    const me = players.find(p => p.sessionToken === sessionToken);
    const startButton = document.getElementById('btn-start');
    
    if (me && me.isHost && document.getElementById('screen-lobby').classList.contains('hidden') === false) {
        document.getElementById('host-controls').classList.remove('hidden');
        document.getElementById('waiting-msg').classList.add('hidden');
        
        const allReady = players.every(p => p.isReady);
        const enoughPlayers = players.length >= 3;

        if (allReady && enoughPlayers) {
            startButton.disabled = false;
            startButton.innerText = "INICIAR PARTIDA";
            startButton.className = "w-full p-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-bold shadow-lg shadow-emerald-900/40 hover:brightness-110 transition transform active:scale-95";
        } else {
            startButton.disabled = true;
            startButton.className = "w-full p-4 bg-gray-700/50 rounded-xl font-bold text-gray-400 cursor-not-allowed border border-white/5";
            
            if (!enoughPlayers) {
                const missing = 3 - players.length;
                startButton.innerText = missing === 1 ? "FALTA 1 JUGADOR" : `FALTAN ${missing} JUGADORES`;
            } else {
                startButton.innerText = "ESPERANDO CONFIRMACIONES...";
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
        li.className = 'player-card p-3 rounded-2xl flex items-center justify-between group';
        
        const initial = p.username.charAt(0).toUpperCase();
        const isMe = p.sessionToken === sessionToken; 
        
        const gradients = [
            'from-pink-500 to-rose-500', 'from-purple-500 to-indigo-500', 
            'from-cyan-500 to-blue-500', 'from-emerald-500 to-green-500',
            'from-amber-500 to-orange-500'
        ];
        const gradIndex = p.username.length % gradients.length;
        const bgGradient = gradients[gradIndex];

        const readyTick = p.isReady 
            ? '<div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]">✓</div>' 
            : '<div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-gray-500 animate-pulse">⏳</div>';

        let kickButton = '';
        if (me && me.isHost && !isMe) {
            kickButton = `
                <button class="btn-kick ml-2 w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 transition flex items-center justify-center" data-id="${p.id}" title="Expulsar">
                    ✕
                </button>`;
        }

        li.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${bgGradient} flex items-center justify-center text-white font-bold shadow-lg">
                    ${initial}
                </div>
                <div class="flex flex-col">
                    <span class="font-bold text-sm ${isMe ? 'text-white' : 'text-gray-300'}">${p.username}</span>
                    ${p.isHost ? '<span class="text-[10px] uppercase font-bold text-yellow-500 tracking-wider">Líder</span>' : ''}
                </div>
            </div>
            <div class="flex items-center">
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

    document.querySelectorAll('.btn-kick').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = btn.getAttribute('data-id');
            if(confirm("¿Expulsar a este jugador?")) {
                socket.emit('kickPlayer', { roomCode: currentRoom, playerId });
            }
        });
    });
}

socket.on('updatePlayerList', updatePlayerListUI);
socket.on('error', (msg) => {
    showNotification(msg);
    if (msg.includes('restaurar') || msg.includes('Sala no encontrada')) {
        clearSession();
        showScreen('home');
    }
});

socket.on('kicked', () => {
    clearSession();
    currentRoom = '';
    currentPlayers = [];
    localImpostorCount = 1;
    document.getElementById('player-list').innerHTML = '';
    document.getElementById('lobby-code').innerText = '----';
    document.getElementById('host-controls').classList.add('hidden');
    document.getElementById('waiting-msg').classList.remove('hidden');
    showScreen('home');
    showNotification("¡Has sido expulsado de la partida!", "error");
});

document.getElementById('btn-start').addEventListener('click', () => {
    const useHint = document.getElementById('setting-hint').checked;
    if (currentPlayers.length < 3) return showNotification('Faltan jugadores');
    if (!currentPlayers.every(p => p.isReady)) return showNotification('Jugadores no listos');
    socket.emit('updateSettings', { roomCode: currentRoom, impostorCount: localImpostorCount, useHint });
    socket.emit('startGame', { roomCode: currentRoom, impostorCount: localImpostorCount });
});

function handleGameStarted({ role, word, hint }) {
    showScreen('game');
    cardInner.classList.remove('is-flipped');
    
    const secretWordEl = document.getElementById('secret-word');
    const categoryHintEl = document.getElementById('category-hint');
    const roleTitle = document.getElementById('role-title');

    if (role === 'impostor') {
        roleTitle.innerText = 'ERES EL IMPOSTOR';
        roleTitle.className = 'text-sm font-black uppercase tracking-[0.2em] mb-4 text-red-500 z-10 animate-pulse';
        secretWordEl.innerText = "🕵️"; 
        
        categoryHintEl.classList.remove('hidden');
        categoryHintEl.style.display = ''; 
        categoryHintEl.innerText = hint ? hint : "Infiltrate sin ser detectado";
    } else {
        roleTitle.innerText = 'CIVIL';
        roleTitle.className = 'text-sm font-black uppercase tracking-[0.2em] mb-4 text-emerald-400 z-10';
        secretWordEl.innerText = word;
        
        categoryHintEl.innerText = "";
        categoryHintEl.classList.add('hidden');
        categoryHintEl.style.display = 'none';
    }
}

socket.on('gameStarted', handleGameStarted);

// --- LÓGICA DE ÚLTIMA OPORTUNIDAD (LAST CHANCE) ---

socket.on('startLastChance', ({ impostorName, isYou }) => {
    showScreen('lastChance');
    
    const waitingView = document.getElementById('lc-waiting-view');
    const impostorView = document.getElementById('lc-impostor-view');
    const nameDisplay = document.getElementById('lc-impostor-name');
    const guessInput = document.getElementById('lc-guess-input');

    if (isYou) {
        // Eres el impostor atrapado
        waitingView.classList.add('hidden');
        impostorView.classList.remove('hidden');
        guessInput.value = "";
        guessInput.focus();
    } else {
        // Eres civil o otro impostor (si hay varios)
        impostorView.classList.add('hidden');
        waitingView.classList.remove('hidden');
        nameDisplay.innerText = impostorName;
    }
});

document.getElementById('btn-lc-submit').addEventListener('click', () => {
    const guess = document.getElementById('lc-guess-input').value;
    if (guess) {
        socket.emit('impostorFinalGuess', { roomCode: currentRoom, word: guess });
    } else {
        showNotification("Escribe una palabra");
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
        btn.className = 'w-full glass-panel p-4 rounded-2xl flex items-center space-x-4 hover:bg-white/10 transition group border-transparent hover:border-white/20';
        
        const initial = p.username.charAt(0).toUpperCase();
        
        btn.innerHTML = `
            <div class="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center text-white font-bold text-lg shadow-inner group-hover:scale-110 transition">
                ${initial}
            </div>
            <div class="text-left flex-1">
                <span class="block font-bold text-white text-lg group-hover:text-purple-300 transition">${p.username}</span>
                <span class="text-xs text-gray-500 uppercase tracking-widest">Sospechoso</span>
            </div>
            <div class="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-red-400">
                ⚡
            </div>
        `;

        btn.onclick = () => {
            Array.from(container.children).forEach(b => {
                b.disabled = true;
                b.classList.add('opacity-50', 'grayscale');
            });
            btn.classList.remove('opacity-50', 'grayscale');
            btn.classList.add('border-red-500/50', 'bg-red-500/10');
            
            socket.emit('submitVote', { roomCode: currentRoom, votedId: p.id });
            document.getElementById('vote-status').innerText = `Has votado a ${p.username}.`;
        };
        container.appendChild(btn);
    });
}

socket.on('voteUpdate', ({ votesCount, totalPlayers }) => {
    document.getElementById('vote-status').innerText = `Votos registrados: ${votesCount}/${totalPlayers}`;
});

function handleGameEnded(data) {
    showScreen('results');
    
    const resultTitle = document.getElementById('result-title');
    const resultMsg = document.getElementById('result-message');
    const resultIcon = document.getElementById('result-icon');

    if (data.winner === 'impostor') {
        resultIcon.innerText = "😈";
        resultTitle.innerText = "VICTORIA IMPOSTORA";
        resultTitle.className = "text-4xl font-black mb-2 uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500";
    } else {
        resultIcon.innerText = "🛡️";
        resultTitle.innerText = "VICTORIA CIVIL"; 
        resultTitle.className = "text-4xl font-black mb-2 uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400";
    }

    resultMsg.innerText = data.message;
    document.getElementById('res-real-word').innerText = data.realWord;
    document.getElementById('res-impostor-name').innerText = data.impostors.join(', ');
    document.getElementById('res-impostor-guess').innerText = data.impostorGuess || "-";
}

socket.on('gameEnded', handleGameEnded);

document.getElementById('btn-restart').addEventListener('click', () => {
    socket.emit('markReady', { roomCode: currentRoom });
    showScreen('lobby');
    
    const cardInner = document.getElementById('card-inner');
    cardInner.classList.remove('is-flipped');
    document.getElementById('secret-word').innerText = "...";
    document.getElementById('role-title').innerText = "ROL";
    // Limpieza de estados anteriores
    document.getElementById('lc-guess-input').value = "";
    document.getElementById('vote-status').innerText = "Esperando votos...";
    document.getElementById('voting-list').innerHTML = "";
});

socket.on('navigateToLobby', () => {});