import React, { useState } from 'react';

export default function VotingScreen({ players, role, onSubmitVote, onSubmitImpostorGuess }) {
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [impostorWord, setImpostorWord] = useState('');
    const [hasVoted, setHasVoted] = useState(false);

    const handleVote = () => {
        if (selectedPlayer) {
            onSubmitVote(selectedPlayer);
            setHasVoted(true);
        }
    };

    const handleImpostorSubmit = () => {
        if (impostorWord.trim()) {
            onSubmitImpostorGuess(impostorWord);
        }
    };

    if (hasVoted && role !== 'IMPOSTOR') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center animate-fade-in">
                <h2 className="text-2xl font-bold mb-4">Voto enviado</h2>
                <p className="text-gray-400">Esperando a los demás jugadores...</p>
            </div>
        );
    }

    if (hasVoted && role === 'IMPOSTOR') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center animate-fade-in">
                <h2 className="text-2xl font-bold mb-4">¿Cuál es la palabra secreta?</h2>
                <p className="text-gray-400 mb-6">Si te descubren, adivinar la palabra puede salvarte.</p>

                <div className="w-full max-w-md space-y-4">
                    <input
                        type="text"
                        value={impostorWord}
                        onChange={(e) => setImpostorWord(e.target.value)}
                        placeholder="Escribe la palabra..."
                        className="input text-center text-xl"
                    />
                    <button
                        onClick={handleImpostorSubmit}
                        disabled={!impostorWord.trim()}
                        className="w-full btn btn-primary py-3"
                    >
                        Enviar Respuesta Final
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center min-h-screen p-4 pt-10 animate-fade-in">
            <h2 className="text-3xl font-bold mb-2">¿Quién es el Impostor?</h2>
            <p className="text-gray-400 mb-8">Selecciona a un jugador para votar</p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
                {players.map((player) => (
                    <button
                        key={player.id}
                        onClick={() => setSelectedPlayer(player.id)}
                        className={`p-4 rounded-xl border-2 transition-all ${selectedPlayer === player.id
                                ? 'border-danger bg-danger/10 scale-105'
                                : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                            }`}
                    >
                        <div className="w-12 h-12 rounded-full bg-gray-700 mx-auto mb-2 flex items-center justify-center font-bold text-lg">
                            {player.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium block truncate">{player.name}</span>
                    </button>
                ))}
            </div>

            <button
                onClick={handleVote}
                disabled={!selectedPlayer}
                className="w-full max-w-md btn btn-danger py-4 text-lg shadow-lg shadow-danger/20 disabled:opacity-50"
            >
                VOTAR
            </button>
        </div>
    );
}
