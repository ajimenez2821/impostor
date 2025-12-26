const socket = io();

// Variables de estado
let miCodigo = "";
let soyHost = false;
let configActual = { impostores: 1, pistas: true };

// Navegación
function mostrarPantalla(id) {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById(id).classList.add('activa');
}

// 1. INICIO
function crearSala() {
    const nombre = document.getElementById('nombre-jugador').value || "Host";
    socket.emit('crearSala', nombre);
}

function unirseSala() {
    const nombre = document.getElementById('nombre-jugador').value || "Invitado";
    const codigo = document.getElementById('codigo-input').value.toUpperCase();
    if (codigo.length !== 4) return alert("Código incorrecto");
    socket.emit('unirseSala', { codigo, nombre });
}

// RESPUESTAS DEL SERVER
socket.on('salaUnida', (data) => {
    miCodigo = data.codigo;
    soyHost = data.esHost;
    
    mostrarPantalla('pantalla-lobby');
    document.getElementById('display-codigo').innerText = miCodigo;
    actualizarLista(data.jugadores);

    if (soyHost) {
        document.getElementById('controles-host').classList.remove('oculto');
    } else {
        document.getElementById('mensaje-espera').classList.remove('oculto');
    }
});

socket.on('error', (msg) => alert(msg));

// 2. LOBBY Y CONFIGURACIÓN
socket.on('actualizarJugadores', (lista) => actualizarLista(lista));

function actualizarLista(lista) {
    const div = document.getElementById('lista-jugadores');
    div.innerHTML = '';
    lista.forEach(p => {
        const el = document.createElement('div');
        el.className = 'chip';
        el.innerText = p.nombre + (p.esHost ? ' 👑' : '');
        div.appendChild(el);
    });
}

// Lógica de configuración (Solo Host)
function cambiarImpostores(delta) {
    if (!soyHost) return;
    let nuevoValor = configActual.impostores + delta;
    if (nuevoValor < 1) nuevoValor = 1;
    // Emitimos cambio
    socket.emit('actualizarConfig', { 
        codigo: miCodigo, 
        nuevaConfig: { impostores: nuevoValor } 
    });
}

function enviarConfig() {
    if (!soyHost) return;
    const pistas = document.getElementById('check-pistas').checked;
    socket.emit('actualizarConfig', { 
        codigo: miCodigo, 
        nuevaConfig: { pistas: pistas } 
    });
}

socket.on('configActualizada', (conf) => {
    configActual = conf;
    document.getElementById('val-impostores').innerText = conf.impostores;
    document.getElementById('check-pistas').checked = conf.pistas;
});

function empezarJuego() {
    socket.emit('iniciarPartida', miCodigo);
}

// 3. JUEGO
socket.on('juegoIniciado', (datos) => {
    mostrarPantalla('pantalla-juego');
    
    const titulo = document.getElementById('rol-titulo');
    const desc = document.getElementById('rol-desc');
    const tapa = document.getElementById('tapa');

    // Resetear visualización
    tapa.classList.remove('revelada');

    if (datos.esImpostor) {
        titulo.innerText = "😈 IMPOSTOR";
        titulo.style.color = "#ff4b4b";
        desc.innerText = datos.pista ? ("Pista: " + datos.pista) : "Engaña a todos";
    } else {
        titulo.innerText = "😇 CIVIL";
        titulo.style.color = "#4bff4b";
        desc.innerText = "Palabra secreta: " + datos.palabra;
    }
});

// INTERACCIÓN CARTA
function revelarCarta() {
    document.getElementById('tapa').classList.add('revelada');
}

function ocultarCarta(e) {
    e.stopPropagation(); // Evitar que el click se propague al contenedor
    document.getElementById('tapa').classList.remove('revelada');
}