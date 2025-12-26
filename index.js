import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion,
  increment
} from 'firebase/firestore';
import { Users, User, Crown, Skull, Play, Fingerprint, Eye, EyeOff, Check, X, ArrowRight, Copy } from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE (NO TOCAR) ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- DICCIONARIO DE PALABRAS ---
const CATEGORIES = {
  'Frutas': ['Manzana', 'Plátano', 'Uva', 'Sandía', 'Cereza', 'Limón', 'Piña', 'Fresa'],
  'Lugares': ['Hospital', 'Escuela', 'Playa', 'Cine', 'Biblioteca', 'Gimnasio', 'Aeropuerto', 'Parque'],
  'Profesiones': ['Doctor', 'Bombero', 'Policía', 'Profesor', 'Ingeniero', 'Cocinero', 'Astronauta', 'Pintor'],
  'Animales': ['Perro', 'Gato', 'Elefante', 'León', 'Jirafa', 'Delfín', 'Águila', 'Tiburón'],
  'Objetos': ['Silla', 'Mesa', 'Ordenador', 'Teléfono', 'Reloj', 'Lápiz', 'Libro', 'Gafas']
};

export default function ImpostorGame() {
  // Estado de Usuario y App
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  
  // Estado del Juego (Sincronizado con Firebase)
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados Locales UI
  const [showRole, setShowRole] = useState(false);
  const [impostorGuessWord, setImpostorGuessWord] = useState('');
  const [hasVoted, setHasVoted] = useState(false);

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- SINCRONIZACIÓN TIEMPO REAL ---
  useEffect(() => {
    if (!user || !roomCode) return;

    // Escuchar cambios en la sala pública
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', `room_${roomCode.toUpperCase()}`);
    
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
        
        // Resetear estados locales si cambia la fase
        if (data.phase === 'lobby') {
            setHasVoted(false);
            setImpostorGuessWord('');
            setShowRole(false);
        }
      } else {
        // Si la sala no existe y estábamos dentro, resetear
        if (roomData) {
            setRoomData(null);
            setError('La sala ha sido cerrada.');
        }
      }
    }, (err) => {
      console.error("Error sync:", err);
      setError("Error de conexión");
    });

    return () => unsubscribe();
  }, [user, roomCode]);

  // --- ACCIONES ---

  const createRoom = async () => {
    if (!playerName.trim()) return setError('Escribe un nombre');
    setLoading(true);
    
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newRoomData = {
      code,
      hostId: user.uid,
      phase: 'lobby', // lobby, game, voting, results
      settings: {
        impostorCount: 1,
        category: 'Aleatorio'
      },
      players: [{
        uid: user.uid,
        name: playerName,
        score: 0,
        isReady: true,
        avatarId: Math.floor(Math.random() * 6)
      }],
      currentWord: '',
      currentCategory: '',
      impostorIds: [],
      votes: {}, // { targetUid: count }
      impostorGuess: null, // { uid: string, word: string }
      winner: null // 'impostors' | 'citizens'
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `room_${code}`), newRoomData);
      setRoomCode(code);
      setError('');
    } catch (e) {
      setError('Error al crear sala');
    }
    setLoading(false);
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return setError('Completa los campos');
    setLoading(true);
    const code = roomCode.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', `room_${code}`);

    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setError('Sala no encontrada');
        setLoading(false);
        return;
      }

      const data = snap.data();
      if (data.phase !== 'lobby') {
        setError('El juego ya ha comenzado');
        setLoading(false);
        return;
      }

      const isAlreadyIn = data.players.some(p => p.uid === user.uid);
      if (!isAlreadyIn) {
        const newPlayer = {
          uid: user.uid,
          name: playerName,
          score: 0,
          isReady: true,
          avatarId: Math.floor(Math.random() * 6)
        };
        await updateDoc(roomRef, {
          players: arrayUnion(newPlayer)
        });
      }
      setRoomCode(code);
    } catch (e) {
      setError('Error al unirse');
    }
    setLoading(false);
  };

  const startGame = async () => {
    if (roomData.players.length < 3) return setError('Mínimo 3 jugadores');
    
    // 1. Elegir Categoría y Palabra
    const cats = Object.keys(CATEGORIES);
    const selectedCat = roomData.settings.category === 'Aleatorio' 
      ? cats[Math.floor(Math.random() * cats.length)]
      : roomData.settings.category;
    
    const words = CATEGORIES[selectedCat];
    const secretWord = words[Math.floor(Math.random() * words.length)];

    // 2. Elegir Impostores
    const playerIds = roomData.players.map(p => p.uid);
    const impostorCount = Math.min(roomData.settings.impostorCount, Math.floor(playerIds.length / 2));
    
    // Shuffle
    const shuffledIds = [...playerIds].sort(() => 0.5 - Math.random());
    const selectedImpostors = shuffledIds.slice(0, impostorCount);

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `room_${roomCode}`), {
      phase: 'game',
      currentCategory: selectedCat,
      currentWord: secretWord,
      impostorIds: selectedImpostors,
      votes: {},
      impostorGuess: null,
      winner: null
    });
  };

  const submitVote = async (targetUid) => {
    if (hasVoted) return;
    
    // Estructura de votos simplificada: sumamos en un objeto
    // Nota: En una app real de prod, usaríamos una subcolección para evitar race conditions, 
    // pero para este prototipo actualizamos el objeto entero.
    
    const newVotes = { ...roomData.votes };
    newVotes[targetUid] = (newVotes[targetUid] || 0) + 1;
    
    const totalVotes = Object.values(newVotes).reduce((a, b) => a + b, 0);
    const totalPlayers = roomData.players.length;

    let updates = { votes: newVotes };
    
    // Si todos han votado, finalizar juego
    if (totalVotes >= totalPlayers) {
       calculateResults(newVotes);
       return; 
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `room_${roomCode}`), updates);
    setHasVoted(true);
  };

  const submitImpostorGuess = async () => {
    if(!impostorGuessWord.trim()) return;

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `room_${roomCode}`), {
      impostorGuess: { uid: user.uid, word: impostorGuessWord }
    });
    
    // Al adivinar, se termina el juego inmediatamente
    calculateResults(roomData.votes, { uid: user.uid, word: impostorGuessWord });
  };

  const calculateResults = async (finalVotes, instantGuess = null) => {
    // Lógica básica de resultados
    let winner = 'citizens'; // Por defecto
    
    const imps = roomData.impostorIds;
    
    if (instantGuess) {
      // Si el impostor adivinó la palabra exacta (ignorando mayúsculas)
      if (instantGuess.word.toLowerCase().trim() === roomData.currentWord.toLowerCase().trim()) {
        winner = 'impostors';
      } else {
        winner = 'citizens';
      }
    } else {
      // Lógica de votación
      // Quién tuvo más votos?
      let maxVotes = 0;
      let mostVotedUid = null;
      
      Object.entries(finalVotes).forEach(([uid, count]) => {
         if (count > maxVotes) {
           maxVotes = count;
           mostVotedUid = uid;
         }
      });

      // Si el más votado es un impostor, ganan ciudadanos
      if (imps.includes(mostVotedUid)) {
        winner = 'citizens';
      } else {
        winner = 'impostors';
      }
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `room_${roomCode}`), {
      phase: 'results',
      winner: winner
    });
  };
  
  const backToLobby = async () => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `room_${roomCode}`), {
      phase: 'lobby',
      votes: {},
      impostorGuess: null,
      currentWord: '',
      impostorIds: []
    });
  };

  // --- RENDERERS ---

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;

  // 1. PANTALLA DE INICIO
  if (!roomData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Fingerprint size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter">EL IMPOSTOR</h1>
            <p className="text-slate-400">Descubre quién miente entre nosotros</p>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm text-center">{error}</div>}
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tu Nombre</label>
              <input 
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-lg focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Ej. Agente 007"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button 
                onClick={createRoom}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all p-4 rounded-xl font-bold text-center flex flex-col items-center gap-2"
              >
                <Crown size={24} />
                <span>Crear Sala</span>
              </button>
              
              <div className="space-y-2">
                 <input 
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  maxLength={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center font-mono text-lg uppercase focus:border-emerald-500 transition-colors"
                />
                <button 
                  onClick={joinRoom}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all p-3 rounded-xl font-bold text-sm"
                >
                  Unirse
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lógica común para derivar estado
  const isHost = roomData.hostId === user.uid;
  const isImpostor = roomData.impostorIds?.includes(user.uid);

  // 2. LOBBY
  if (roomData.phase === 'lobby') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-xs text-slate-500 uppercase font-bold">Sala</h2>
            <div className="text-3xl font-mono font-bold text-indigo-400 tracking-widest flex items-center gap-2">
                {roomData.code}
                <button onClick={() => navigator.clipboard.writeText(roomData.code)} className="text-slate-600 hover:text-white"><Copy size={16}/></button>
            </div>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-full text-sm font-bold border border-slate-800">
            {roomData.players.length} Jugadores
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {roomData.players.map((p) => (
            <div key={p.uid} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                 ${p.uid === roomData.hostId ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                 {p.name[0].toUpperCase()}
               </div>
               <div className="flex-1 font-medium">{p.name}</div>
               {p.uid === roomData.hostId && <Crown size={16} className="text-yellow-500" />}
            </div>
          ))}
          {roomData.players.length < 3 && (
              <p className="text-center text-slate-600 text-sm mt-4">Esperando a más jugadores (Mín. 3)...</p>
          )}
        </div>

        {isHost ? (
          <div className="mt-6 space-y-4">
             <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Categoría</label>
                <div className="flex flex-wrap gap-2">
                    {['Aleatorio', ...Object.keys(CATEGORIES)].map(cat => (
                        <button 
                           key={cat}
                           onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `room_${roomCode}`), { 'settings.category': cat })}
                           className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                               roomData.settings?.category === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                           }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
             </div>
             <button 
                onClick={startGame}
                disabled={roomData.players.length < 3}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Play size={20} fill="currentColor" /> Comenzar Partida
              </button>
          </div>
        ) : (
          <div className="mt-6 text-center text-slate-500 animate-pulse">
            Esperando al anfitrión...
          </div>
        )}
      </div>
    );
  }

  // 3. JUEGO (REVELACIÓN DE ROL)
  if (roomData.phase === 'game') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Fondo animado sutil */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-slate-950"></div>

        <div className="z-10 w-full max-w-md text-center space-y-8">
            <div className="space-y-2">
                <h3 className="text-slate-500 text-sm font-bold uppercase tracking-widest">Categoría</h3>
                <div className="inline-block px-4 py-1 bg-slate-900 rounded-full border border-slate-800 text-indigo-300 font-medium">
                    {roomData.currentCategory}
                </div>
            </div>

            <div 
                className="perspective-1000 cursor-pointer group"
                onClick={() => setShowRole(!showRole)}
            >
                <div className={`relative w-full aspect-[3/4] bg-slate-900 rounded-3xl border-2 border-slate-800 shadow-2xl transition-all duration-500 flex flex-col items-center justify-center p-8
                    ${showRole ? 'border-indigo-500/50 shadow-indigo-500/20' : 'hover:border-slate-700'}`}>
                    
                    {!showRole ? (
                        <div className="space-y-4 animate-bounce-slow">
                            <Fingerprint size={64} className="mx-auto text-slate-700" />
                            <p className="text-slate-400 font-medium">Toca para revelar tu identidad</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                            {isImpostor ? (
                                <>
                                    <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                                        <Skull size={48} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-red-500 mb-2">ERES EL IMPOSTOR</h2>
                                        <p className="text-red-400/80 text-sm">Nadie sabe que eres tú. Engaña a todos y adivina la palabra.</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                                        <Check size={48} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white mb-2">{roomData.currentWord}</h2>
                                        <p className="text-emerald-400/80 text-sm">Eres un Ciudadano. Encuentra al impostor.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    <div className="absolute bottom-6 right-6 text-slate-700">
                        {showRole ? <EyeOff size={20} /> : <Eye size={20} />}
                    </div>
                </div>
            </div>

            <button 
                onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `room_${roomCode}`), { phase: 'voting' })}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
                Ir a Votación <ArrowRight size={20} />
            </button>
        </div>
      </div>
    );
  }

  // 4. VOTACIÓN
  if (roomData.phase === 'voting') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-2 text-center">Fase de Votación</h2>
        <p className="text-slate-400 text-center mb-8 text-sm">Vota por quién crees que es el impostor</p>

        <div className="flex-1 space-y-3 overflow-y-auto">
            {roomData.players.map(p => {
                if (p.uid === user.uid) return null; // No te puedes votar a ti mismo
                const votesReceived = roomData.votes ? roomData.votes[p.uid] || 0 : 0;
                
                return (
                    <button
                        key={p.uid}
                        onClick={() => submitVote(p.uid)}
                        disabled={hasVoted}
                        className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all
                            ${hasVoted 
                                ? 'bg-slate-900 border-slate-800 opacity-50' 
                                : 'bg-slate-900 border-slate-700 hover:border-indigo-500 hover:bg-slate-800 active:scale-98'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-sm font-bold">
                                {p.name[0]}
                            </div>
                            <span className="font-medium">{p.name}</span>
                        </div>
                        {hasVoted && votesReceived > 0 && (
                            <div className="text-xs font-bold text-slate-500">{votesReceived} votos</div>
                        )}
                    </button>
                );
            })}
        </div>

        {/* INPUT DEL IMPOSTOR */}
        {isImpostor && (
             <div className="mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl animate-in slide-in-from-bottom duration-500">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                    <Skull size={16} />
                    <span className="text-xs font-bold uppercase">Oportunidad del Impostor</span>
                </div>
                <p className="text-xs text-red-300/70 mb-3">Si adivinas la palabra secreta, ganas automáticamente.</p>
                <div className="flex gap-2">
                    <input 
                        value={impostorGuessWord}
                        onChange={e => setImpostorGuessWord(e.target.value)}
                        placeholder="Adivina la palabra..."
                        className="flex-1 bg-slate-950 border border-red-900/50 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    />
                    <button 
                        onClick={submitImpostorGuess}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
                    >
                        Apostar
                    </button>
                </div>
             </div>
        )}

        <div className="mt-4 text-center text-xs text-slate-600">
            {hasVoted ? "Esperando a los demás..." : "Toca un jugador para votar"}
        </div>
      </div>
    );
  }

  // 5. RESULTADOS
  if (roomData.phase === 'results') {
      const impostorsWon = roomData.winner === 'impostors';
      
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 
                ${impostorsWon ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                {impostorsWon ? <Skull size={48} /> : <Crown size={48} />}
            </div>
            
            <h2 className="text-4xl font-black mb-2 uppercase tracking-tight">
                {impostorsWon ? 'Gana el Impostor' : 'Ganan los Ciudadanos'}
            </h2>
            
            <p className="text-slate-400 mb-8 max-w-xs mx-auto">
                {impostorsWon 
                    ? `El impostor se ha salido con la suya o adivinó la palabra.` 
                    : `El impostor ha sido descubierto y eliminado.`}
            </p>

            <div className="bg-slate-900 w-full max-w-sm rounded-2xl p-6 border border-slate-800 space-y-4 mb-8">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                    <span className="text-slate-500 text-sm">Palabra Secreta</span>
                    <span className="text-xl font-bold text-white">{roomData.currentWord}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">Impostor(es)</span>
                    <div className="text-right">
                        {roomData.impostorIds.map(uid => {
                            const p = roomData.players.find(pl => pl.uid === uid);
                            return <div key={uid} className="font-bold text-red-400">{p?.name || 'Desconocido'}</div>
                        })}
                    </div>
                </div>
                {roomData.impostorGuess && (
                    <div className="pt-4 bg-slate-950/50 p-3 rounded-lg text-sm">
                        <span className="text-slate-500 block mb-1">Apuesta del Impostor:</span>
                        <span className="text-white font-mono">"{roomData.impostorGuess.word}"</span>
                    </div>
                )}
            </div>

            {isHost && (
                <button 
                    onClick={backToLobby}
                    className="bg-white text-slate-950 hover:bg-slate-200 px-8 py-4 rounded-xl font-bold text-lg w-full max-w-sm transition-colors"
                >
                    Jugar Otra Vez
                </button>
            )}
            {!isHost && <p className="text-slate-500 animate-pulse">Esperando al anfitrión...</p>}
        </div>
      );
  }

  return null;
}