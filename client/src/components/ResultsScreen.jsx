import React from 'react';

export default function ResultsScreen({ results, onPlayAgain, isHost }) {
    const { impostorCaught, wordGuessed, impostorId, secretWord, impostorGuess, players } = results;

    const impostorName = players.find(p => p.id === impostorId)?.name || 'Desconocido';

    // Determine winner
    // Civilians win if (Impostor Caught AND !Word Guessed)
    // Impostor wins if (!Impostor Caught OR Word Guessed)
    const civiliansWin = impostorCaught && !wordGuessed;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center animate-fade-in">
            <div className="mb-8">
                <h1 className={`text-5xl font-black mb-2 ${civiliansWin ? 'text-primary' : 'text-danger'}`}>
                    {civiliansWin ? '¡CIVILES GANAN!' : '¡IMPOSTOR GANA!'}
                </h1>
                <p className="text-gray-400 text-lg">
                    {civiliansWin
                        ? 'El impostor fue descubierto y no adivinó la palabra.'
                        : (impostorCaught ? 'El impostor fue descubierto pero... ¡adivinó la palabra!' : 'El impostor escapó sin ser descubierto.')}
                </p>
            </div>

            <div className="w-full max-w-md bg-gray-800/50 rounded-2xl p-8 border border-gray-700 mb-8 space-y-6">
                <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">EL IMPOSTOR ERA</p>
                    <div className="text-3xl font-bold text-danger">{impostorName}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-700/30 p-4 rounded-xl">
                        <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">PALABRA SECRETA</p>
                        <div className="text-xl font-bold text-primary">{secretWord}</div>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-xl">
                        <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">IMPOSTOR ESCRIBIÓ</p>
                        <div className={`text-xl font-bold ${wordGuessed ? 'text-green-400' : 'text-gray-400'}`}>
                            {impostorGuess || '-'}
                        </div>
                    </div>
                </div>
            </div>

            {isHost && (
                <button
                    onClick={onPlayAgain}
                    className="btn btn-primary py-3 px-10 rounded-full shadow-lg shadow-primary/20"
                >
                    Jugar Otra Vez
                </button>
            )}
            {!isHost && (
                <p className="text-gray-500 animate-pulse">Esperando al anfitrión...</p>
            )}
        </div>
    );
}
