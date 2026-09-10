import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { setupSocket } from './socket';

const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
});

setupSocket(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 DMC Backend running on http://localhost:${PORT}`);
});

export { io };