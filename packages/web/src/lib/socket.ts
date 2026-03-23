import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api.js';

let socket: Socket | null = null;
let keepaliveWorker: Worker | null = null;

function startKeepalive() {
  if (keepaliveWorker) return;
  try {
    const blob = new Blob(
      ['setInterval(()=>postMessage(1),25000)'],
      { type: 'application/javascript' },
    );
    keepaliveWorker = new Worker(URL.createObjectURL(blob));
    keepaliveWorker.onmessage = () => {
      if (socket?.connected) {
        socket.emit('presence:heartbeat');
      }
    };
  } catch {
    // Web Worker not available (CSP or unsupported) — rely on increased server timeout
  }
}

function stopKeepalive() {
  if (keepaliveWorker) {
    keepaliveWorker.terminate();
    keepaliveWorker = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  // Return existing socket if it exists (even if still connecting)
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io('/', {
    auth: (cb) => cb({ token: getAccessToken() }),
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    startKeepalive();
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
}

export function disconnectSocket() {
  stopKeepalive();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function reconnectSocket(): void {
  disconnectSocket();
  connectSocket();
}
