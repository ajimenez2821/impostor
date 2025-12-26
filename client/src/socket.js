import io from 'socket.io-client';

// In production (Render), the URL will be inferred. In dev, we might need localhost if not proxying.
// Vite proxy handles /socket.io -> localhost:3000
const socket = io('https://impostor-9ju9.onrender.com', {
    transports: ['websocket'],
    autoConnect: true
});

export default socket;
