import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const getAllVisits = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hospitalId = req.user.role === 'SUPER_ADMIN'
      ? (req.query.hospitalId as string)
      : req.user.hospitalId;

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID is required' });
      return;
    }

    const { status, department } = req.query;
    const where: Record<string, unknown> = { hospitalId };
    if (status) where.status = status;
    if (department) where.department = department;

    const visits = await prisma.visit.findMany({
      where,
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, gender: true, dateOfBirth: true },
        },
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { checkInTime: 'desc' },
      take: 100,
    });

    res.json({ visits });
  } catch (error) {
    console.error('Get all visits error:', error);
    res.status(500).json({ error: 'Failed to get visits' });
  }
};

export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id: clientId, patientId, department, reasonForVisit, assignedTo } = req.body;

    if (!patientId || !department || !reasonForVisit) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get patient to determine hospital
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && patient.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Create visit (use client ID if provided for offline sync)
    const visit = await prisma.visit.create({
      data: {
        ...(clientId && { id: clientId }),  // Use client ID if provided
        hospitalId: patient.hospitalId,
        patientId,
        department,
        reasonForVisit,
        status: 'CHECKED_IN',
        assignedTo,
        createdBy: req.user.id,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            phone: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: patient.hospitalId,
      action: 'CHECK_IN',
      entity: 'VISIT',
      entityId: visit.id,
      details: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        department,
        reasonForVisit,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ visit });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({ error: 'Failed to check in patient' });
  }
};

export const updateVisitStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { status, assignedTo } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    // Check visit exists
    const existingVisit = await prisma.visit.findUnique({ where: { id } });

    if (!existingVisit) {
      res.status(404).json({ error: 'Visit not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && existingVisit.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update visit
    const updateData: Record<string, unknown> = { status };
    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }
    if (status === 'COMPLETED') {
      updateData.completedTime = new Date();
    }

    const visit = await prisma.visit.update({
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
        assignedUser: {
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
      hospitalId: existingVisit.hospitalId,
      action: 'UPDATE_VISIT_STATUS',
      entity: 'VISIT',
      entityId: visit.id,
      details: { status, previousStatus: existingVisit.status },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ visit });
  } catch (error) {
    console.error('Update visit status error:', error);
    res.status(500).json({ error: 'Failed to update visit status' });
  }
};

export const getQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { department } = req.query;

    // Build filter
    const where: Record<string, unknown> = {
      status: { in: ['CHECKED_IN', 'WAITING', 'IN_PROGRESS'] },
    };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    if (department) {
      where.department = department;
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            phone: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { checkInTime: 'asc' },
    });

    res.json({ visits });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ error: 'Failed to get queue' });
  }
};

export const getTodayVisits = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build filter
    const where: Record<string, unknown> = {
      checkInTime: { gte: today },
    };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
    });

    res.json({ visits });
  } catch (error) {
    console.error('Get today visits error:', error);
    res.status(500).json({ error: 'Failed to get today visits' });
  }
};

export const getVisitsByPatient = async (req: Request, res: Response): Promise<void> => {
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

    const visits = await prisma.visit.findMany({
      where: { patientId },
      include: {
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
    });

    res.json({ visits });
  } catch (error) {
    console.error('Get visits by patient error:', error);
    res.status(500).json({ error: 'Failed to get patient visits' });
  }
};

export const getVisitById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        patient: true,
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        consultations: {
          include: {
            doctor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        prescriptions: {
          include: {
            items: true,
          },
        },
        labOrders: true,
        billingRecords: {
          include: {
            items: true,
            payments: true,
          },
        },
      },
    });

    if (!visit) {
      res.status(404).json({ error: 'Visit not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && visit.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ visit });
  } catch (error) {
    console.error('Get visit error:', error);
    res.status(500).json({ error: 'Failed to get visit' });
  }
};
