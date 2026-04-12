import { io } from 'socket.io-client';
import { BASE_URL } from '@/services/api';

let socketInstance = null;
let activeToken = null;

function getSocketUrl() {
  return BASE_URL.replace(/\/api\/?$/, '');
}

export function connectSocket(token) {
  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      auth: token ? { token } : undefined,
    });
  }

  if (token && token !== activeToken) {
    activeToken = token;
    socketInstance.auth = { token };
  }

  return socketInstance;
}

export function getSocket() {
  return socketInstance;
}

export function disconnectSocket() {
  if (!socketInstance) return;

  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
  activeToken = null;
}
