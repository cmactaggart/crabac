import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { JwtPayload } from '../modules/auth/auth.middleware.js';
import { registerHandlers } from './handlers.js';

export let io: Server;

export function createSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Redis adapter for horizontal scaling
  const pubClient = new Redis({ host: config.redis.host, port: config.redis.port });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.data.userId})`);
    registerHandlers(io, socket);
  });

  return io;
}
