import { Server } from 'http';
import { Server as SocketIO } from 'socket.io';
import { logger } from './lib/logger.js';

let io: SocketIO;

export function initSocket(httpServer: Server): SocketIO {
  io = new SocketIO(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') ?? [
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('join:user', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.info(`Socket ${socket.id} joined room user:${userId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIO {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
