import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const createPatient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      id: clientId,  // Accept client-generated ID for offline sync
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      bloodGroup,
      allergies,
      currentMedications,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !gender || !phone) {
      res.status(400).json({ error: 'Missing required fields' });
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

    // Create patient (use client ID if provided for offline sync support)
    const patient = await prisma.patient.create({
      data: {
        ...(clientId && { id: clientId }),  // Use client ID if provided
        hospitalId,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        phone,
        email,
        address,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
        bloodGroup,
        allergies: allergies || [],
        currentMedications: currentMedications || [],
        createdBy: req.user.id,
      },
      include: {
        hospital: {
          select: { id: true, name: true },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId,
      action: 'CREATE_PATIENT',
      entity: 'PATIENT',
      entityId: patient.id,
      details: { name: `${patient.firstName} ${patient.lastName}`, phone: patient.phone },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ patient });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

export const getPatients = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { page = '1', limit = '50', search } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: Record<string, unknown> = {};

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search as string } },
        { lastName: { contains: search as string } },
        { phone: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          phone: true,
          email: true,
          bloodGroup: true,
          createdAt: true,
          hospital: {
            select: { id: true, name: true },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patient.count({ where }),
    ]);

    res.json({
      patients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Failed to get patients' });
  }
};

export const getPatientById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        hospital: {
          select: { id: true, name: true },
        },
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && patient.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ patient });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to get patient' });
  }
};

export const updatePatient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      bloodGroup,
      allergies,
      currentMedications,
      medicalHistory,
    } = req.body;

    // Check patient exists
    const existingPatient = await prisma.patient.findUnique({ where: { id } });

    if (!existingPatient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && existingPatient.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update patient
    const patient = await prisma.patient.update({
      where: { id },
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        phone,
        email,
        address,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
        bloodGroup,
        allergies,
        currentMedications,
        medicalHistory,
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingPatient.hospitalId,
      action: 'UPDATE_PATIENT',
      entity: 'PATIENT',
      entityId: patient.id,
      details: { name: `${patient.firstName} ${patient.lastName}` },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ patient });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
};

export const deletePatient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Check patient exists
    const existingPatient = await prisma.patient.findUnique({ where: { id } });

    if (!existingPatient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && existingPatient.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Delete patient (cascade will handle related records)
    await prisma.patient.delete({ where: { id } });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingPatient.hospitalId,
      action: 'DELETE_PATIENT',
      entity: 'PATIENT',
      entityId: id,
      details: { 
        name: `${existingPatient.firstName} ${existingPatient.lastName}`,
        phone: existingPatient.phone,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
};

export const searchPatients = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { q } = req.query;

    if (!q) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    // Build filter
    const where: Record<string, unknown> = {
      OR: [
        { firstName: { contains: q as string } },
        { lastName: { contains: q as string } },
        { phone: { contains: q as string } },
        { email: { contains: q as string } },
      ],
    };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const patients = await prisma.patient.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        phone: true,
        email: true,
        bloodGroup: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ patients });
  } catch (error) {
    console.error('Search patients error:', error);
    res.status(500).json({ error: 'Failed to search patients' });
  }
};
