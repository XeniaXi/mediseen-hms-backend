/**
 * WebSocket Server for Real-time Sync
 * 
 * Broadcasts data changes to all connected clients in the same hospital.
 * Uses Socket.IO for cross-browser compatibility.
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  hospitalId?: string;
  userRole?: string;
}

let io: Server | null = null;

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:3000',
        'https://app.mediseenhms.com',
        'https://mediseenhms.com',
        /\.vercel\.app$/,
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      socket.userId = decoded.userId;
      socket.hospitalId = decoded.hospitalId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket] User ${socket.userId} connected (Hospital: ${socket.hospitalId})`);
    
    // Join hospital room for targeted broadcasts
    if (socket.hospitalId) {
      socket.join(`hospital:${socket.hospitalId}`);
    }

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${socket.userId} disconnected: ${reason}`);
    });

    // Client can request full sync
    socket.on('request:sync', async (dataTypes: string[]) => {
      console.log(`[Socket] Sync requested by ${socket.userId}:`, dataTypes);
      // Client should use REST API for full sync
      socket.emit('sync:use-api', { message: 'Use REST API for full data sync' });
    });
  });

  console.log('[Socket] WebSocket server initialized');
  return io;
}

// Broadcast helpers for different data types
export function broadcastToHospital(hospitalId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`hospital:${hospitalId}`).emit(event, data);
}

export function broadcastPatientUpdate(hospitalId: string, action: 'created' | 'updated' | 'deleted', patient: any): void {
  broadcastToHospital(hospitalId, 'patient:change', { action, patient, timestamp: Date.now() });
}

export function broadcastVisitUpdate(hospitalId: string, action: 'created' | 'updated' | 'deleted', visit: any): void {
  broadcastToHospital(hospitalId, 'visit:change', { action, visit, timestamp: Date.now() });
}

export function broadcastBillingUpdate(hospitalId: string, action: 'created' | 'updated' | 'payment', bill: any): void {
  broadcastToHospital(hospitalId, 'billing:change', { action, bill, timestamp: Date.now() });
}

export function broadcastAdmissionUpdate(hospitalId: string, action: 'created' | 'updated' | 'discharged', admission: any): void {
  broadcastToHospital(hospitalId, 'admission:change', { action, admission, timestamp: Date.now() });
}

export function broadcastLabUpdate(hospitalId: string, action: 'created' | 'updated' | 'completed', labOrder: any): void {
  broadcastToHospital(hospitalId, 'lab:change', { action, labOrder, timestamp: Date.now() });
}

export function broadcastInventoryUpdate(hospitalId: string, action: 'updated' | 'low-stock', item: any): void {
  broadcastToHospital(hospitalId, 'inventory:change', { action, item, timestamp: Date.now() });
}

export function getIO(): Server | null {
  return io;
}

export default { initializeSocket, broadcastToHospital, getIO };
