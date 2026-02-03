import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const recordVitals = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      visitId,
      patientId,
      bloodPressure,
      heartRate,
      temperature,
      weight,
      height,
      respiratoryRate,
      oxygenSaturation,
      bloodSugar,
      painLevel,
      notes,
      triageCategory,
    } = req.body;

    // Validate required fields
    if (!patientId) {
      res.status(400).json({ error: 'Patient ID is required' });
      return;
    }

    // Determine hospital ID
    const hospitalId = req.user.role === 'SUPER_ADMIN' 
      ? req.body.hospitalId 
      : req.user.hospitalId;

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID is required' });
      return;
    }

    // Verify patient exists and belongs to hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // If visitId provided, verify it exists and belongs to patient
    if (visitId) {
      const visit = await prisma.visit.findFirst({
        where: { id: visitId, patientId, hospitalId },
      });

      if (!visit) {
        res.status(404).json({ error: 'Visit not found' });
        return;
      }
    }

    // Create vital signs record
    const vitalSigns = await prisma.vitalSigns.create({
      data: {
        hospitalId,
        patientId,
        visitId,
        recordedBy: req.user.id,
        bloodPressure,
        heartRate,
        temperature,
        weight,
        height,
        respiratoryRate,
        oxygenSaturation,
        bloodSugar,
        painLevel,
        notes,
        triageCategory,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        recordedByUser: {
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
      hospitalId,
      action: 'RECORD_VITALS',
      entity: 'VITAL_SIGNS',
      entityId: vitalSigns.id,
      details: { 
        patientId,
        visitId,
        triageCategory,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ vitalSigns });
  } catch (error) {
    console.error('Record vitals error:', error);
    res.status(500).json({ error: 'Failed to record vital signs' });
  }
};

export const getAllVitals = async (req: Request, res: Response): Promise<void> => {
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

    const vitalSigns = await prisma.vitalSigns.findMany({
      where: { hospitalId },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        visit: {
          select: { id: true, checkInTime: true, department: true, status: true },
        },
        recordedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ vitalSigns });
  } catch (error) {
    console.error('Get all vitals error:', error);
    res.status(500).json({ error: 'Failed to get vital signs' });
  }
};

export const getVitalsByVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { visitId } = req.params;

    // Build filter
    const where: Record<string, unknown> = { visitId };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const vitalSigns = await prisma.vitalSigns.findMany({
      where,
      include: {
        recordedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ vitalSigns });
  } catch (error) {
    console.error('Get vitals by visit error:', error);
    res.status(500).json({ error: 'Failed to get vital signs' });
  }
};

export const getVitalsByPatient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { patientId } = req.params;
    const { limit = '50' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    // Build filter
    const where: Record<string, unknown> = { patientId };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const vitalSigns = await prisma.vitalSigns.findMany({
      where,
      include: {
        visit: {
          select: {
            id: true,
            checkInTime: true,
            department: true,
          },
        },
        recordedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ vitalSigns });
  } catch (error) {
    console.error('Get vitals by patient error:', error);
    res.status(500).json({ error: 'Failed to get vital signs' });
  }
};

export const getTriageQueue = async (req: Request, res: Response): Promise<void> => {
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

    // Get patients with vitals recorded but visit not completed
    // and triage category is set
    const triageQueue = await prisma.vitalSigns.findMany({
      where: {
        hospitalId,
        triageCategory: { not: null },
        visit: {
          status: { in: ['CHECKED_IN', 'WAITING'] },
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        visit: {
          select: {
            id: true,
            checkInTime: true,
            department: true,
            reasonForVisit: true,
            status: true,
          },
        },
        recordedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { triageCategory: 'asc' }, // EMERGENCY first, then URGENT, etc.
        { createdAt: 'asc' },      // Older first within same priority
      ],
    });

    res.json({ triageQueue });
  } catch (error) {
    console.error('Get triage queue error:', error);
    res.status(500).json({ error: 'Failed to get triage queue' });
  }
};
