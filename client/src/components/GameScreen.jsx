import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameScreen({ role, word, category, onStartVoting, isHost }) {
    const [isRevealed, setIsRevealed] = useState(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <div className="mb-8">
                <span className="text-gray-400 uppercase tracking-widest text-sm">CATEGORÍA</span>
                <h2 className="text-3xl font-bold text-secondary mt-1">{category}</h2>
            </div>

            <div className="perspective-1000 w-full max-w-sm h-96 cursor-pointer" onClick={() => setIsRevealed(!isRevealed)}>
                <motion.div
                    className="relative w-full h-full preserve-3d transition-transform duration-500"
                    animate={{ rotateY: isRevealed ? 180 : 0 }}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {/* Front of Card */}
                    <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-gray-700 flex flex-col items-center justify-center shadow-2xl p-8">
                        <div className="text-6xl mb-4">🕵️</div>
                        <h3 className="text-2xl font-bold text-gray-300">Toca para revelar tu rol</h3>
                        <p className="text-gray-500 mt-4 text-sm">Mantén tu pantalla oculta de los demás</p>
                    </div>

                    {/* Back of Card */}
                    <div
                        className="absolute w-full h-full backface-hidden bg-gray-800 rounded-2xl border-2 border-primary flex flex-col items-center justify-center shadow-2xl p-8"
                        style={{ transform: 'rotateY(180deg)' }}
                    >
                        {role === 'IMPOSTOR' ? (
                            <>
                                <div className="text-6xl mb-6">😈</div>
                                <h2 className="text-4xl font-black text-danger mb-2">IMPOSTOR</h2>
                                <p className="text-gray-400">Engaña a los demás. No conoces la palabra secreta.</p>
                            </>
                        ) : (
                            <>
                                <div className="text-6xl mb-6">🤫</div>
                                <h2 className="text-xl font-medium text-gray-400 mb-2">La palabra es:</h2>
                                <h1 className="text-5xl font-black text-primary break-words">{word}</h1>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>

            <p className="mt-8 text-gray-500 text-sm">Toca la carta para ocultarla de nuevo</p>

            {isHost && (
                <button
                    onClick={onStartVoting}
                    className="mt-12 btn btn-danger py-3 px-8 rounded-full shadow-lg shadow-danger/20"
                >
                    Iniciar Votación
                </button>
            )}
        </div>
    );
}
