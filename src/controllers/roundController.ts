import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const recordRound = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      admissionId,
      roundType,
      vitalSignsId,
      medicationGiven,
      observations,
      patientCondition,
      nextRoundDue,
    } = req.body;

    // Validate required fields
    if (!admissionId || !roundType || !patientCondition) {
      res.status(400).json({ error: 'Admission ID, round type, and patient condition are required' });
      return;
    }

    // Verify admission exists
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
    });

    if (!admission) {
      res.status(404).json({ error: 'Admission not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && 
        admission.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // If vitalSignsId provided, verify it exists
    if (vitalSignsId) {
      const vitalSigns = await prisma.vitalSigns.findUnique({
        where: { id: vitalSignsId },
      });

      if (!vitalSigns) {
        res.status(404).json({ error: 'Vital signs record not found' });
        return;
      }
    }

    // Create nursing round
    const round = await prisma.nursingRound.create({
      data: {
        admissionId,
        patientId: admission.patientId,
        performedBy: req.user.id,
        roundType,
        vitalSignsId,
        medicationGiven,
        observations,
        patientCondition,
        nextRoundDue: nextRoundDue ? new Date(nextRoundDue) : undefined,
      },
      include: {
        admission: {
          select: {
            id: true,
            diagnosis: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        performedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        vitalSigns: true,
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: admission.hospitalId,
      action: 'RECORD_NURSING_ROUND',
      entity: 'NURSING_ROUND',
      entityId: round.id,
      details: { 
        admissionId,
        roundType,
        patientCondition,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ round });
  } catch (error) {
    console.error('Record round error:', error);
    res.status(500).json({ error: 'Failed to record nursing round' });
  }
};

export const getAllRounds = async (req: Request, res: Response): Promise<void> => {
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

    const rounds = await prisma.nursingRound.findMany({
      where: {
        admission: {
          hospitalId,
        },
      },
      include: {
        admission: {
          select: {
            id: true,
            diagnosis: true,
            status: true,
            ward: { select: { id: true, name: true } },
            room: { select: { id: true, roomNumber: true } },
            bed: { select: { id: true, bedNumber: true } },
          },
        },
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        performedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        vitalSigns: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ rounds });
  } catch (error) {
    console.error('Get all rounds error:', error);
    res.status(500).json({ error: 'Failed to get nursing rounds' });
  }
};

export const getRoundsByAdmission = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { admissionId } = req.params;

    // Verify admission exists and check access
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
    });

    if (!admission) {
      res.status(404).json({ error: 'Admission not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && 
        admission.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const rounds = await prisma.nursingRound.findMany({
      where: { admissionId },
      include: {
        performedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        vitalSigns: {
          select: {
            id: true,
            bloodPressure: true,
            heartRate: true,
            temperature: true,
            oxygenSaturation: true,
            painLevel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ rounds });
  } catch (error) {
    console.error('Get rounds by admission error:', error);
    res.status(500).json({ error: 'Failed to get nursing rounds' });
  }
};

export const getDueRounds = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Scope by hospital
    const hospitalId = req.user.role === 'SUPER_ADMIN' 
      ? (req.query.hospitalId as string)
      : req.user.hospitalId;

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID is required' });
      return;
    }

    const now = new Date();

    // Get rounds that are due or overdue for active admissions
    const rounds = await prisma.nursingRound.findMany({
      where: {
        nextRoundDue: {
          lte: now,
        },
        admission: {
          hospitalId,
          status: 'ADMITTED',
        },
      },
      include: {
        admission: {
          select: {
            id: true,
            diagnosis: true,
            ward: {
              select: {
                id: true,
                name: true,
              },
            },
            room: {
              select: {
                id: true,
                roomNumber: true,
              },
            },
            bed: {
              select: {
                id: true,
                bedNumber: true,
              },
            },
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        performedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { nextRoundDue: 'asc' },
    });

    res.json({ rounds });
  } catch (error) {
    console.error('Get due rounds error:', error);
    res.status(500).json({ error: 'Failed to get due rounds' });
  }
};
