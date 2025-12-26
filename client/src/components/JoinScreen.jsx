import React, { useState } from 'react';

export default function JoinScreen({ onCreateRoom, onJoinRoom }) {
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [mode, setMode] = useState('menu'); // menu, join, create

    const handleCreate = (e) => {
        e.preventDefault();
        if (name.trim()) onCreateRoom(name);
    };

    const handleJoin = (e) => {
        e.preventDefault();
        if (name.trim() && roomCode.trim()) onJoinRoom(name, roomCode.toUpperCase());
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-8 animate-fade-in">
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                IMPOSTOR
            </h1>

            <div className="w-full max-w-md p-8 bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700 shadow-2xl">
                {mode === 'menu' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setMode('create')}
                            className="w-full btn btn-primary py-4 text-lg"
                        >
                            Crear Sala
                        </button>
                        <button
                            onClick={() => setMode('join')}
                            className="w-full btn btn-secondary py-4 text-lg"
                        >
                            Unirse a Sala
                        </button>
                    </div>
                )}

                {mode === 'create' && (
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Tu Nombre</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="input text-center text-xl"
                                placeholder="Ej: Alex"
                                maxLength={12}
                                autoFocus
                            />
                        </div>
                        <div className="flex space-x-3">
                            <button type="button" onClick={() => setMode('menu')} className="flex-1 btn bg-gray-700 hover:bg-gray-600">
                                Atrás
                            </button>
                            <button type="submit" className="flex-1 btn btn-primary" disabled={!name.trim()}>
                                Crear
                            </button>
                        </div>
                    </form>
                )}

                {mode === 'join' && (
                    <form onSubmit={handleJoin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Tu Nombre</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="input text-center text-xl mb-4"
                                placeholder="Ej: Alex"
                                maxLength={12}
                            />
                            <label className="block text-sm font-medium text-gray-400 mb-2">Código de Sala</label>
                            <input
                                type="text"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                className="input text-center text-2xl tracking-widest uppercase"
                                placeholder="ABCD"
                                maxLength={4}
                            />
                        </div>
                        <div className="flex space-x-3">
                            <button type="button" onClick={() => setMode('menu')} className="flex-1 btn bg-gray-700 hover:bg-gray-600">
                                Atrás
                            </button>
                            <button type="submit" className="flex-1 btn btn-secondary" disabled={!name.trim() || roomCode.length !== 4}>
                                Unirse
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
