import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/auth.js';
import { config } from '../config/index.js';

export function setupSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      socket.data.user = null;
      next();
      return;
    }
    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;

    socket.on('thread:join', (postId: string) => {
      socket.join(`thread:${postId}`);
    });

    socket.on('thread:leave', (postId: string) => {
      socket.leave(`thread:${postId}`);
    });

    socket.on('typing:start', ({ postId }: { postId: string }) => {
      if (!user) return;
      socket.to(`thread:${postId}`).emit('typing:start', {
        postId,
        userId: user.userId,
        username: user.username,
      });
    });

    socket.on('typing:stop', ({ postId }: { postId: string }) => {
      if (!user) return;
      socket.to(`thread:${postId}`).emit('typing:stop', {
        postId,
        userId: user.userId,
      });
    });
  });

  return io;
}
