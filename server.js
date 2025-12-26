const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs'); // Importante: Módulo para leer archivos

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos temporal de salas
let salas = {};

// --- CARGAR LISTA DE PALABRAS DESDE JSON ---
let packs = {};

try {
    // Leemos el archivo words.json de forma síncrona al iniciar
    const data = fs.readFileSync(path.join(__dirname, 'words.json'), 'utf8');
    packs = JSON.parse(data);
    console.log(`✅ Base de datos de palabras cargada: ${packs.mix.length} palabras disponibles.`);
} catch (err) {
    console.error("❌ Error cargando words.json:", err);
    // Fallback básico por si falla el archivo
    packs = {
        mix: [{ palabra: "Error", pista: "No se cargó el archivo de palabras" }]
    };
}

function generarCodigo() {
    // Genera un código de 5 números (entre 10000 y 99999)
    return Math.floor(10000 + Math.random() * 90000).toString();
}

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // 1. CREAR SALA
    socket.on('crearSala', (nombreHost) => {
        const codigo = generarCodigo();
        salas[codigo] = {
            jugadores: [{ id: socket.id, nombre: nombreHost, esHost: true }],
            config: { impostores: 1, pistas: true },
            juegoIniciado: false
        };
        
        socket.join(codigo);
        socket.emit('salaUnida', { codigo, esHost: true, jugadores: salas[codigo].jugadores });
    });

    // 2. UNIRSE A SALA
    socket.on('unirseSala', ({ codigo, nombre }) => {
        const sala = salas[codigo];
        
        if (sala && !sala.juegoIniciado) {
            socket.join(codigo);
            sala.jugadores.push({ id: socket.id, nombre: nombre, esHost: false });
            
            // Avisar al usuario que entró
            socket.emit('salaUnida', { codigo, esHost: false, jugadores: sala.jugadores });
            // Avisar a todos en la sala para actualizar lista
            io.to(codigo).emit('actualizarJugadores', sala.jugadores);
            // Sincronizar configuración actual con el nuevo
            socket.emit('configActualizada', sala.config);
        } else {
            socket.emit('error', 'Sala no encontrada o juego ya iniciado');
        }
    });

    // 3. ACTUALIZAR CONFIGURACIÓN (Solo Host)
    socket.on('actualizarConfig', ({ codigo, nuevaConfig }) => {
        if (salas[codigo]) {
            salas[codigo].config = { ...salas[codigo].config, ...nuevaConfig };
            // Validar que no haya más impostores que jugadores - 1
            const maxImpostores = Math.max(1, salas[codigo].jugadores.length - 1);
            if (salas[codigo].config.impostores > maxImpostores) {
                salas[codigo].config.impostores = maxImpostores;
            }
            io.to(codigo).emit('configActualizada', salas[codigo].config);
        }
    });

    // 4. INICIAR PARTIDA
    socket.on('iniciarPartida', (codigo) => {
        const sala = salas[codigo];
        if (!sala) return;

        // Selección de palabra (AQUÍ ES DONDE USAMOS LA LISTA CARGADA DEL JSON)
        const pack = packs.mix;
        const itemJuego = pack[Math.floor(Math.random() * pack.length)];

        // Selección de impostores
        let indices = sala.jugadores.map((_, i) => i);
        indices.sort(() => Math.random() - 0.5); // Barajar
        
        const numImpostores = sala.config.impostores;
        const indicesImpostores = indices.slice(0, numImpostores);

        // Repartir roles
        sala.jugadores.forEach((jugador, index) => {
            const esImpostor = indicesImpostores.includes(index);
            const datos = {
                esImpostor,
                palabra: esImpostor ? "IMPOSTOR" : itemJuego.palabra,
                pista: (esImpostor && sala.config.pistas) ? itemJuego.pista : null
            };
            io.to(jugador.id).emit('juegoIniciado', datos);
        });

        sala.juegoIniciado = true;
    });

    // 5. DESCONEXIÓN
    socket.on('disconnect', () => {
        for (const codigo in salas) {
            const sala = salas[codigo];
            const index = sala.jugadores.findIndex(j => j.id === socket.id);
            if (index !== -1) {
                sala.jugadores.splice(index, 1);
                io.to(codigo).emit('actualizarJugadores', sala.jugadores);
                if (sala.jugadores.length === 0) delete salas[codigo];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});