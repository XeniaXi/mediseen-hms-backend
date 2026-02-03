import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const auditMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // Only log certain methods (mutations)
  const methodsToLog = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (!methodsToLog.includes(req.method)) {
    next();
    return;
  }

  // Skip auth endpoints to avoid logging passwords
  if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
    next();
    return;
  }

  // Log the request
  if (req.user) {
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: req.user.hospitalId || undefined,
      action: `${req.method} ${req.path}`,
      entity: 'API_REQUEST',
      details: {
        method: req.method,
        path: req.path,
        query: req.query,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  next();
};
