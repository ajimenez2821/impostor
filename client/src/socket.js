import io from 'socket.io-client';

// In production (Render), the URL will be inferred. In dev, we might need localhost if not proxying.
// Vite proxy handles /socket.io -> localhost:3000
const socket = io('/', {
    transports: ['websocket'],
    autoConnect: true
});

export default socket;
