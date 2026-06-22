import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/auth.js';
import { config } from '../config/index.js';

interface OnlineUser {
  userId: string;
  username: string;
  avatarUrl?: string;
}

const onlineUsers = new Map<string, OnlineUser>();

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

    if (user) {
      onlineUsers.set(user.userId, {
        userId: user.userId,
        username: user.username,
      });
      io.emit('users:online', {
        count: onlineUsers.size,
        users: Array.from(onlineUsers.values()).slice(0, 20),
      });
    }

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

    socket.on('disconnect', () => {
      if (user) {
        onlineUsers.delete(user.userId);
        io.emit('users:online', {
          count: onlineUsers.size,
          users: Array.from(onlineUsers.values()).slice(0, 20),
        });
      }
    });
  });

  return io;
}

export function getOnlineUsers(): OnlineUser[] {
  return Array.from(onlineUsers.values());
}
