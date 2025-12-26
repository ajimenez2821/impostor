import React from 'react';

export default function Lobby({ roomCode, players, isHost, onStartGame }) {
    return (
        <div className="flex flex-col items-center min-h-screen p-4 animate-fade-in">
            <div className="w-full max-w-md mt-10">
                <div className="text-center mb-8">
                    <p className="text-gray-400 uppercase tracking-widest text-sm">CÓDIGO DE SALA</p>
                    <h2 className="text-6xl font-black text-white tracking-widest my-2">{roomCode}</h2>
                    <p className="text-gray-500 text-sm">Comparte este código con tus amigos</p>
                </div>

                <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-8">
                    <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
                        Jugadores <span className="text-primary">{players.length}</span>
                    </h3>
                    <div className="space-y-3">
                        {players.map((player) => (
                            <div key={player.id} className="flex items-center bg-gray-700/50 p-3 rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center font-bold text-sm mr-3">
                                    {player.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium">{player.name}</span>
                                {player.isHost && <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">HOST</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {isHost ? (
                    <button
                        onClick={onStartGame}
                        disabled={players.length < 3}
                        className="w-full btn btn-primary py-4 text-lg shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {players.length < 3 ? 'Esperando jugadores (min 3)...' : 'COMENZAR PARTIDA'}
                    </button>
                ) : (
                    <div className="text-center text-gray-400 animate-pulse">
                        Esperando a que el anfitrión inicie...
                    </div>
                )}
            </div>
        </div>
    );
}
