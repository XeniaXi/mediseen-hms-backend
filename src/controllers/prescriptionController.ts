import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const createPrescription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { consultationId, patientId, visitId, items } = req.body;

    if (!patientId || !visitId || !items || items.length === 0) {
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

    // Create prescription with items
    const prescription = await prisma.prescription.create({
      data: {
        consultationId,
        patientId,
        visitId,
        doctorId: req.user.id,
        status: 'PENDING',
        items: {
          create: items.map((item: {
            medicationName: string;
            dosage: string;
            frequency: string;
            duration: string;
            instructions?: string;
          }) => ({
            medicationName: item.medicationName,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.instructions,
          })),
        },
      },
      include: {
        items: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        patient: {
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
      action: 'CREATE_PRESCRIPTION',
      entity: 'PRESCRIPTION',
      entityId: prescription.id,
      details: { visitId, itemsCount: items.length },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ prescription });
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
};

export const dispensePrescription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Check prescription exists
    const existingPrescription = await prisma.prescription.findUnique({
      where: { id },
      include: { visit: true, patient: true },
    });

    if (!existingPrescription) {
      res.status(404).json({ error: 'Prescription not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && ((existingPrescription as any).visit?.hospitalId || "") !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (existingPrescription.status === 'DISPENSED') {
      res.status(400).json({ error: 'Prescription already dispensed' });
      return;
    }

    // Update prescription status
    const prescription = await prisma.prescription.update({
      where: { id },
      data: { status: 'DISPENSED' },
      include: {
        items: true,
        patient: {
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
      hospitalId: ((existingPrescription as any).visit?.hospitalId || ""),
      action: 'DISPENSE_PRESCRIPTION',
      entity: 'PRESCRIPTION',
      entityId: prescription.id,
      details: { patientId: prescription.patientId },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ prescription });
  } catch (error) {
    console.error('Dispense prescription error:', error);
    res.status(500).json({ error: 'Failed to dispense prescription' });
  }
};

export const getPrescriptionsByPatient = async (req: Request, res: Response): Promise<void> => {
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

    const prescriptions = await prisma.prescription.findMany({
      where: { patientId },
      include: {
        items: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ prescriptions });
  } catch (error) {
    console.error('Get prescriptions by patient error:', error);
    res.status(500).json({ error: 'Failed to get prescriptions' });
  }
};

export const getPrescriptionsByVisit = async (req: Request, res: Response): Promise<void> => {
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

    const prescriptions = await prisma.prescription.findMany({
      where: { visitId },
      include: {
        items: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ prescriptions });
  } catch (error) {
    console.error('Get prescriptions by visit error:', error);
    res.status(500).json({ error: 'Failed to get prescriptions' });
  }
};

export const getPendingPrescriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Build filter
    const where: Record<string, unknown> = {
      status: 'PENDING',
    };

    // Scope by hospital through visit relation
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.visit = {
        hospitalId: req.user.hospitalId,
      };
    }

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        items: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        doctor: {
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

    res.json({ prescriptions });
  } catch (error) {
    console.error('Get pending prescriptions error:', error);
    res.status(500).json({ error: 'Failed to get pending prescriptions' });
  }
};
