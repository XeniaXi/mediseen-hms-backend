import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const createLabOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { visitId, patientId, testType, sampleId } = req.body;

    if (!visitId || !patientId || !testType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check visit exists and hospital access
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });

    if (!visit) {
      res.status(404).json({ error: 'Visit not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && visit.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Create lab order
    const labOrder = await prisma.labOrder.create({
      data: {
        visitId,
        patientId,
        orderedBy: req.user.id,
        testType,
        sampleId,
        status: 'ORDERED',
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        orderedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: visit.hospitalId,
      action: 'CREATE_LAB_ORDER',
      entity: 'LAB_ORDER',
      entityId: labOrder.id,
      details: { testType, visitId },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ labOrder });
  } catch (error) {
    console.error('Create lab order error:', error);
    res.status(500).json({ error: 'Failed to create lab order' });
  }
};

export const updateLabOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { status, sampleId } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    // Check lab order exists
    const existingLabOrder = await prisma.labOrder.findUnique({
      where: { id },
      include: { visit: true, patient: true },
    });

    if (!existingLabOrder) {
      res.status(404).json({ error: 'Lab order not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && ((existingLabOrder as any).visit?.hospitalId || "") !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update lab order
    const updateData: Record<string, unknown> = { status };
    if (sampleId) {
      updateData.sampleId = sampleId;
    }
    if (status === 'PROCESSING') {
      updateData.processedBy = req.user.id;
    }

    const labOrder = await prisma.labOrder.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: ((existingLabOrder as any).visit?.hospitalId || ""),
      action: 'UPDATE_LAB_ORDER_STATUS',
      entity: 'LAB_ORDER',
      entityId: labOrder.id,
      details: { status, previousStatus: existingLabOrder.status },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ labOrder });
  } catch (error) {
    console.error('Update lab order status error:', error);
    res.status(500).json({ error: 'Failed to update lab order status' });
  }
};

export const enterLabResults = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { resultValue, normalRange, resultNotes } = req.body;

    if (!resultValue) {
      res.status(400).json({ error: 'Result value is required' });
      return;
    }

    // Check lab order exists
    const existingLabOrder = await prisma.labOrder.findUnique({
      where: { id },
      include: { visit: true, patient: true },
    });

    if (!existingLabOrder) {
      res.status(404).json({ error: 'Lab order not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && ((existingLabOrder as any).visit?.hospitalId || "") !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update lab order with results
    const labOrder = await prisma.labOrder.update({
      where: { id },
      data: {
        resultValue,
        normalRange,
        resultNotes,
        status: 'COMPLETED',
        completedAt: new Date(),
        processedBy: req.user.id,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: ((existingLabOrder as any).visit?.hospitalId || ""),
      action: 'ENTER_LAB_RESULTS',
      entity: 'LAB_ORDER',
      entityId: labOrder.id,
      details: { testType: labOrder.testType, resultValue },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ labOrder });
  } catch (error) {
    console.error('Enter lab results error:', error);
    res.status(500).json({ error: 'Failed to enter lab results' });
  }
};

export const getLabOrdersByPatient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { patientId } = req.params;

    // Check patient exists and hospital access
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && patient.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const labOrders = await prisma.labOrder.findMany({
      where: { patientId },
      include: {
        orderedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ labOrders });
  } catch (error) {
    console.error('Get lab orders by patient error:', error);
    res.status(500).json({ error: 'Failed to get lab orders' });
  }
};

export const getLabOrdersByVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { visitId } = req.params;

    // Check visit exists and hospital access
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });

    if (!visit) {
      res.status(404).json({ error: 'Visit not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && visit.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const labOrders = await prisma.labOrder.findMany({
      where: { visitId },
      include: {
        orderedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ labOrders });
  } catch (error) {
    console.error('Get lab orders by visit error:', error);
    res.status(500).json({ error: 'Failed to get lab orders' });
  }
};

export const getPendingLabOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Build filter
    const where: Record<string, unknown> = {
      status: { in: ['ORDERED', 'COLLECTED', 'PROCESSING'] },
    };

    // Scope by hospital through visit relation
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.visit = {
        hospitalId: req.user.hospitalId,
      };
    }

    const labOrders = await prisma.labOrder.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        orderedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        visit: {
          select: {
            id: true,
            checkInTime: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ labOrders });
  } catch (error) {
    console.error('Get pending lab orders error:', error);
    res.status(500).json({ error: 'Failed to get pending lab orders' });
  }
};
