import io from 'socket.io-client';

// In production (Render), the URL will be inferred (same origin).
// In dev with Vite proxy, it also works via relative path '/'.
const socket = io('/', {
    transports: ['websocket'],
    autoConnect: true
});

export default socket;
