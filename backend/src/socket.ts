import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

export function setupSocket(io: Server) {
  // Officer namespace
  const officerNs = io.of('/officer');
  officerNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });
  officerNs.on('connection', (socket) => {
    console.log(`Officer connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`Officer disconnected: ${socket.id}`));
  });

  // Citizen namespace
  const citizenNs = io.of('/citizen');
  citizenNs.on('connection', (socket) => {
    const district = socket.handshake.query?.district as string;
    if (district) socket.join(`district:${district}`);
    console.log(`Citizen connected: ${socket.id}`);
  });
}

// Helper to emit to officer namespace from anywhere
export function emitToOfficers(io: Server, event: string, data: unknown) {
  io.of('/officer').emit(event, data);
}

export function emitToDistrict(io: Server, district: string, event: string, data: unknown) {
  io.of('/citizen').to(`district:${district}`).emit(event, data);
}