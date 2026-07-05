import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Always connect to the same origin the page is served from.
 * In production that's the Vercel URL — Socket.IO traffic is proxied
 * to Render via the /socket.io/* rewrite in vercel.json.
 * In dev, NEXT_PUBLIC_API_URL points directly at localhost:4000.
 */
function getSocketOrigin(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  // Production: same origin, Vercel rewrite handles the proxy
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function getSocket(token?: string): Socket {
  if (!socket) {
    socket = io(getSocketOrigin(), {
      auth: { token },
      autoConnect: false,
      // Use polling first — Vercel rewrites work reliably with polling.
      // WebSocket upgrades through Vercel's proxy are not guaranteed.
      transports: ['polling', 'websocket'],
    });
  }
  return socket;
}

export function connectSocket(token?: string): Socket {
  const s = getSocket(token);
  if (!s.connected) {
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
