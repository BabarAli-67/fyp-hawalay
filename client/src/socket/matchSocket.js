import { io } from 'socket.io-client';

let socket = null;
let activeToken = null;

function notifyReconnect() {
  window.dispatchEvent(new CustomEvent('hawalay:socket-reconnected'));
}

/**
 * Connect to Express Socket.io for match notifications + chat.
 * JWT is verified on the server; room join uses userId from the token only.
 */
export function connectMatchSocket(token) {
  if (!token || typeof token !== 'string') return null;

  const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  if (!base) return null;

  if (socket) {
    if (activeToken !== token) {
      socket.auth = { token };
      activeToken = token;
      if (socket.connected) {
        socket.disconnect();
      }
      socket.connect();
    }
    return socket;
  }

  activeToken = token;
  socket = io(base, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.info('[socket] connected');
    notifyReconnect();
  });

  socket.io.on('reconnect', () => {
    console.info('[socket] reconnected');
    notifyReconnect();
  });

  socket.on('match:found', (payload) => {
    window.dispatchEvent(new CustomEvent('hawalay:match-found', { detail: payload }));
  });

  socket.on('chat:notify', (payload) => {
    window.dispatchEvent(new CustomEvent('hawalay:chat-notify', { detail: payload }));
  });

  return socket;
}

export function disconnectMatchSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    activeToken = null;
  }
}

export function getMatchSocket() {
  return socket;
}
