import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const createAdmission = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      patientId,
      visitId,
      diagnosis,
      admissionNotes,
    } = req.body;

    // Validate required fields
    if (!patientId || !diagnosis) {
      res.status(400).json({ error: 'Patient ID and diagnosis are required' });
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

    // If visitId provided, verify it exists
    if (visitId) {
      const visit = await prisma.visit.findFirst({
        where: { id: visitId, patientId, hospitalId },
      });

      if (!visit) {
        res.status(404).json({ error: 'Visit not found' });
        return;
      }
    }

    // Create admission
    const admission = await prisma.admission.create({
      data: {
        hospitalId,
        patientId,
        visitId,
        admittedBy: req.user.id,
        diagnosis,
        admissionNotes,
        status: 'PENDING',
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            bloodGroup: true,
          },
        },
        admittedByUser: {
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
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId,
      action: 'CREATE_ADMISSION',
      entity: 'ADMISSION',
      entityId: admission.id,
      details: { 
        patientId,
        diagnosis,
        status: 'PENDING',
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ admission });
  } catch (error) {
    console.error('Create admission error:', error);
    res.status(500).json({ error: 'Failed to create admission' });
  }
};

export const getAdmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { page = '1', limit = '50', status, wardId, patientId } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: Record<string, unknown> = {};

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    if (status) where.status = status;
    if (wardId) where.wardId = wardId;
    if (patientId) where.patientId = patientId;

    const [admissions, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
              bloodGroup: true,
            },
          },
          ward: {
            select: {
              id: true,
              name: true,
              type: true,
              floor: true,
            },
          },
          room: {
            select: {
              id: true,
              roomNumber: true,
              type: true,
            },
          },
          bed: {
            select: {
              id: true,
              bedNumber: true,
              status: true,
            },
          },
          admittedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          assignedWardManagerUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              nursingRounds: true,
              doctorReviews: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { admissionDate: 'desc' },
      }),
      prisma.admission.count({ where }),
    ]);

    res.json({
      admissions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get admissions error:', error);
    res.status(500).json({ error: 'Failed to get admissions' });
  }
};

export const assignBed = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { bedId } = req.body;

    if (!bedId) {
      res.status(400).json({ error: 'Bed ID is required' });
      return;
    }

    // Get admission
    const existingAdmission = await prisma.admission.findUnique({
      where: { id },
    });

    if (!existingAdmission) {
      res.status(404).json({ error: 'Admission not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && 
        existingAdmission.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get bed and verify it's available
    const bed = await prisma.bed.findUnique({
      where: { id: bedId },
      include: {
        room: {
          include: {
            ward: true,
          },
        },
      },
    });

    if (!bed) {
      res.status(404).json({ error: 'Bed not found' });
      return;
    }

    // Verify bed is in the same hospital
    if (bed.room.ward.hospitalId !== existingAdmission.hospitalId) {
      res.status(400).json({ error: 'Bed does not belong to the same hospital' });
      return;
    }

    if (bed.status !== 'AVAILABLE') {
      res.status(400).json({ error: 'Bed is not available' });
      return;
    }

    // If admission already has a bed, free it first
    if (existingAdmission.bedId) {
      await prisma.bed.update({
        where: { id: existingAdmission.bedId },
        data: {
          status: 'AVAILABLE',
          currentPatientId: null,
          currentAdmissionId: null,
        },
      });
    }

    // Update admission and bed in a transaction
    const [admission] = await prisma.$transaction([
      prisma.admission.update({
        where: { id },
        data: {
          wardId: bed.room.wardId,
          roomId: bed.roomId,
          bedId: bed.id,
          assignedWardManager: req.user.id,
          status: 'ADMITTED',
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
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
      }),
      prisma.bed.update({
        where: { id: bedId },
        data: {
          status: 'OCCUPIED',
          currentPatientId: existingAdmission.patientId,
          currentAdmissionId: id,
        },
      }),
    ]);

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingAdmission.hospitalId,
      action: 'ASSIGN_BED',
      entity: 'ADMISSION',
      entityId: admission.id,
      details: { 
        bedId,
        wardId: bed.room.wardId,
        roomId: bed.roomId,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ admission });
  } catch (error) {
    console.error('Assign bed error:', error);
    res.status(500).json({ error: 'Failed to assign bed' });
  }
};

export const dischargePatient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { dischargeNotes, dischargeSummary } = req.body;

    // Get admission
    const existingAdmission = await prisma.admission.findUnique({
      where: { id },
    });

    if (!existingAdmission) {
      res.status(404).json({ error: 'Admission not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && 
        existingAdmission.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (existingAdmission.status === 'DISCHARGED') {
      res.status(400).json({ error: 'Patient already discharged' });
      return;
    }

    // Update admission and free bed in a transaction
    const updates = [
      prisma.admission.update({
        where: { id },
        data: {
          status: 'DISCHARGED',
          dischargeDate: new Date(),
          dischargeNotes,
          dischargeSummary,
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ];

    // Free the bed if assigned
    if (existingAdmission.bedId) {
      updates.push(
        prisma.bed.update({
          where: { id: existingAdmission.bedId },
          data: {
            status: 'AVAILABLE',
            currentPatientId: null,
            currentAdmissionId: null,
          },
        }) as any
      );
    }

    const [admission] = await prisma.$transaction(updates);

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingAdmission.hospitalId,
      action: 'DISCHARGE_PATIENT',
      entity: 'ADMISSION',
      entityId: admission.id,
      details: { 
        patientId: existingAdmission.patientId,
        dischargeDate: new Date(),
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ admission });
  } catch (error) {
    console.error('Discharge patient error:', error);
    res.status(500).json({ error: 'Failed to discharge patient' });
  }
};

export const getActiveAdmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Build filter
    const where: Record<string, unknown> = {
      status: 'ADMITTED',
    };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const { wardId } = req.query;
    if (wardId) where.wardId = wardId;

    const admissions = await prisma.admission.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            bloodGroup: true,
          },
        },
        ward: {
          select: {
            id: true,
            name: true,
            type: true,
            floor: true,
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
        admittedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { admissionDate: 'desc' },
    });

    res.json({ admissions });
  } catch (error) {
    console.error('Get active admissions error:', error);
    res.status(500).json({ error: 'Failed to get active admissions' });
  }
};
