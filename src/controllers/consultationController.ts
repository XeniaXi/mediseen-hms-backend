import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const createConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      visitId,
      patientId,
      chiefComplaint,
      vitalSigns,
      physicalExam,
      diagnosis,
      treatmentPlan,
      followUp,
    } = req.body;

    if (!visitId || !patientId || !chiefComplaint || !diagnosis) {
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

    // Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        visitId,
        patientId,
        doctorId: req.user.id,
        chiefComplaint,
        vitalSigns,
        physicalExam,
        diagnosis,
        treatmentPlan,
        followUp,
      },
      include: {
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

    // Update visit status
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: 'IN_PROGRESS' },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: visit.hospitalId,
      action: 'CREATE_CONSULTATION',
      entity: 'CONSULTATION',
      entityId: consultation.id,
      details: { visitId, diagnosis },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ consultation });
  } catch (error) {
    console.error('Create consultation error:', error);
    res.status(500).json({ error: 'Failed to create consultation' });
  }
};

export const updateConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const {
      chiefComplaint,
      vitalSigns,
      physicalExam,
      diagnosis,
      treatmentPlan,
      followUp,
    } = req.body;

    // Check consultation exists
    const existingConsultation = await prisma.consultation.findUnique({
      where: { id },
      include: { visit: true, patient: true },
    });

    if (!existingConsultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && ((existingConsultation as any).visit?.hospitalId || "") !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Only the doctor who created it or admin can update
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && existingConsultation.doctorId !== req.user.id) {
      res.status(403).json({ error: 'You can only update your own consultations' });
      return;
    }

    // Update consultation
    const consultation = await prisma.consultation.update({
      where: { id },
      data: {
        chiefComplaint,
        vitalSigns,
        physicalExam,
        diagnosis,
        treatmentPlan,
        followUp,
      },
      include: {
        doctor: {
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
      hospitalId: ((existingConsultation as any).visit?.hospitalId || ""),
      action: 'UPDATE_CONSULTATION',
      entity: 'CONSULTATION',
      entityId: consultation.id,
      details: { diagnosis },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ consultation });
  } catch (error) {
    console.error('Update consultation error:', error);
    res.status(500).json({ error: 'Failed to update consultation' });
  }
};

export const getConsultationsByVisit = async (req: Request, res: Response): Promise<void> => {
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

    const consultations = await prisma.consultation.findMany({
      where: { visitId },
      include: {
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

    res.json({ consultations });
  } catch (error) {
    console.error('Get consultations by visit error:', error);
    res.status(500).json({ error: 'Failed to get consultations' });
  }
};

export const getConsultationsByPatient = async (req: Request, res: Response): Promise<void> => {
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

    const consultations = await prisma.consultation.findMany({
      where: { patientId },
      include: {
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
      orderBy: { createdAt: 'desc' },
    });

    res.json({ consultations });
  } catch (error) {
    console.error('Get consultations by patient error:', error);
    res.status(500).json({ error: 'Failed to get consultations' });
  }
};
