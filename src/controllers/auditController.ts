import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { 
      page = '1', 
      limit = '50', 
      userId, 
      entity, 
      action,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: Record<string, unknown> = {};

    // Scope by hospital (ADMIN can only see their hospital's logs)
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (entity) {
      where.entity = entity;
    }

    if (action) {
      where.action = { contains: action as string };
    }

    if (startDate || endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate as string);
      }
      where.createdAt = dateFilter;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          hospital: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
};

export const getAuditLogsByEntity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { entity, entityId } = req.params;

    if (!entity || !entityId) {
      res.status(400).json({ error: 'Entity and entityId are required' });
      return;
    }

    // Build filter
    const where: Record<string, unknown> = {
      entity,
      entityId,
    };

    // Scope by hospital (ADMIN can only see their hospital's logs)
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ logs });
  } catch (error) {
    console.error('Get audit logs by entity error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
};
