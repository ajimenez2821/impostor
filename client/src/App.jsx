import React, { useState, useEffect } from 'react';
import socket from './socket';
import JoinScreen from './components/JoinScreen';
import Lobby from './components/Lobby';
import GameScreen from './components/GameScreen';
import VotingScreen from './components/VotingScreen';
import ResultsScreen from './components/ResultsScreen';

function App() {
    const [view, setView] = useState('JOIN'); // JOIN, LOBBY, GAME, VOTING, RESULTS
    const [roomCode, setRoomCode] = useState('');
    const [players, setPlayers] = useState([]);
    const [me, setMe] = useState({ id: null, name: '', isHost: false });
    const [gameData, setGameData] = useState({ role: null, word: null, category: null });
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to server');
        });

        socket.on('roomCreated', ({ roomCode, playerId }) => {
            setRoomCode(roomCode);
            setMe(prev => ({ ...prev, id: playerId, isHost: true }));
            setView('LOBBY');
        });

        socket.on('joinedRoom', ({ roomCode, playerId }) => {
            setRoomCode(roomCode);
            setMe(prev => ({ ...prev, id: playerId, isHost: false }));
            setView('LOBBY');
        });

        socket.on('updateLobby', (updatedPlayers) => {
            setPlayers(updatedPlayers);
            const myPlayer = updatedPlayers.find(p => p.id === socket.id);
            if (myPlayer) {
                setMe(prev => ({ ...prev, isHost: myPlayer.isHost }));
            }
        });

        socket.on('gameStarted', ({ role, word, category }) => {
            setGameData({ role, word, category });
            setView('GAME');
        });

        socket.on('gameStateChanged', (newState) => {
            if (newState === 'LOBBY') setView('LOBBY');
            if (newState === 'PLAYING') setView('GAME');
            if (newState === 'VOTING') setView('VOTING');
            if (newState === 'RESULTS') setView('RESULTS');
        });

        socket.on('gameEnded', (gameResults) => {
            setResults(gameResults);
            setView('RESULTS');
        });

        socket.on('error', (msg) => {
            setError(msg);
            setTimeout(() => setError(null), 3000);
        });

        return () => {
            socket.off('connect');
            socket.off('roomCreated');
            socket.off('joinedRoom');
            socket.off('updateLobby');
            socket.off('gameStarted');
            socket.off('gameStateChanged');
            socket.off('gameEnded');
            socket.off('error');
        };
    }, []);

    const handleCreateRoom = (name) => {
        setMe(prev => ({ ...prev, name }));
        socket.emit('createRoom', { playerName: name });
    };

    const handleJoinRoom = (name, code) => {
        setMe(prev => ({ ...prev, name }));
        socket.emit('joinRoom', { roomCode: code, playerName: name });
    };

    const handleStartGame = () => {
        socket.emit('startGame', { roomCode });
    };

    const handleStartVoting = () => {
        socket.emit('startVoting', { roomCode });
    };

    const handleSubmitVote = (votedPlayerId) => {
        socket.emit('submitVote', { roomCode, votedPlayerId });
    };

    const handleSubmitImpostorGuess = (guess) => {
        socket.emit('submitImpostorGuess', { roomCode, guess });
    };

    const handlePlayAgain = () => {
        socket.emit('playAgain', { roomCode });
    };

    return (
        <div className="min-h-screen bg-dark text-white font-sans selection:bg-primary selection:text-white">
            {error && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-danger text-white px-6 py-3 rounded-full shadow-lg z-50 animate-fade-in">
                    {error}
                </div>
            )}

            {view === 'JOIN' && (
                <JoinScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
            )}

            {view === 'LOBBY' && (
                <Lobby
                    roomCode={roomCode}
                    players={players}
                    isHost={me.isHost}
                    onStartGame={handleStartGame}
                />
            )}

            {view === 'GAME' && (
                <GameScreen
                    role={gameData.role}
                    word={gameData.word}
                    category={gameData.category}
                    isHost={me.isHost}
                    onStartVoting={handleStartVoting}
                />
            )}

            {view === 'VOTING' && (
                <VotingScreen
                    players={players}
                    role={gameData.role}
                    onSubmitVote={handleSubmitVote}
                    onSubmitImpostorGuess={handleSubmitImpostorGuess}
                />
            )}

            {view === 'RESULTS' && results && (
                <ResultsScreen
                    results={results}
                    isHost={me.isHost}
                    onPlayAgain={handlePlayAgain}
                />
            )}
        </div>
    );
}

export default App;
