import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const createWard = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { name, type, floor, capacity } = req.body;

    // Validate required fields
    if (!name || !type || !capacity) {
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

    // Create ward
    const ward = await prisma.ward.create({
      data: {
        hospitalId,
        name,
        type,
        floor,
        capacity,
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
      action: 'CREATE_WARD',
      entity: 'WARD',
      entityId: ward.id,
      details: { name, type },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ ward });
  } catch (error) {
    console.error('Create ward error:', error);
    res.status(500).json({ error: 'Failed to create ward' });
  }
};

export const getWards = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Build filter
    const where: Record<string, unknown> = {};

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const { type, active } = req.query;
    if (type) where.type = type;
    if (active !== undefined) where.active = active === 'true';

    const wards = await prisma.ward.findMany({
      where,
      include: {
        rooms: {
          include: {
            beds: {
              select: {
                id: true,
                bedNumber: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            rooms: true,
            admissions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate occupancy for each ward
    const wardsWithOccupancy = wards.map(ward => {
      const totalBeds = ward.rooms.reduce((sum, room) => sum + room.beds.length, 0);
      const occupiedBeds = ward.rooms.reduce(
        (sum, room) => sum + room.beds.filter(bed => bed.status === 'OCCUPIED').length,
        0
      );
      const availableBeds = ward.rooms.reduce(
        (sum, room) => sum + room.beds.filter(bed => bed.status === 'AVAILABLE').length,
        0
      );

      return {
        ...ward,
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate: totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0,
      };
    });

    res.json({ wards: wardsWithOccupancy });
  } catch (error) {
    console.error('Get wards error:', error);
    res.status(500).json({ error: 'Failed to get wards' });
  }
};

export const getWardBeds = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Build ward filter
    const where: Record<string, unknown> = { id };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const ward = await prisma.ward.findFirst({
      where,
      include: {
        rooms: {
          include: {
            beds: {
              include: {
                currentPatient: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    dateOfBirth: true,
                    gender: true,
                  },
                },
                currentAdmission: {
                  select: {
                    id: true,
                    admissionDate: true,
                    diagnosis: true,
                  },
                },
              },
            },
          },
          orderBy: { roomNumber: 'asc' },
        },
      },
    });

    if (!ward) {
      res.status(404).json({ error: 'Ward not found' });
      return;
    }

    res.json({ ward });
  } catch (error) {
    console.error('Get ward beds error:', error);
    res.status(500).json({ error: 'Failed to get ward beds' });
  }
};

export const updateBedStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    // Get bed with room and ward info for hospital scoping
    const existingBed = await prisma.bed.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            ward: true,
          },
        },
      },
    });

    if (!existingBed) {
      res.status(404).json({ error: 'Bed not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && 
        existingBed.room.ward.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update bed status
    const bed = await prisma.bed.update({
      where: { id },
      data: { status },
      include: {
        room: {
          include: {
            ward: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingBed.room.ward.hospitalId,
      action: 'UPDATE_BED_STATUS',
      entity: 'BED',
      entityId: bed.id,
      details: { 
        bedNumber: bed.bedNumber,
        status,
        wardId: bed.room.wardId,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ bed });
  } catch (error) {
    console.error('Update bed status error:', error);
    res.status(500).json({ error: 'Failed to update bed status' });
  }
};

export const getAvailableBeds = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { wardType, roomType } = req.query;

    // Build filter for wards
    const wardWhere: Record<string, unknown> = {
      active: true,
    };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      wardWhere.hospitalId = req.user.hospitalId;
    }

    if (wardType) {
      wardWhere.type = wardType;
    }

    // Build filter for rooms
    const roomWhere: Record<string, unknown> = {};
    if (roomType) {
      roomWhere.type = roomType;
    }

    const beds = await prisma.bed.findMany({
      where: {
        status: 'AVAILABLE',
        room: {
          ...roomWhere,
          ward: wardWhere,
        },
      },
      include: {
        room: {
          include: {
            ward: {
              select: {
                id: true,
                name: true,
                type: true,
                floor: true,
              },
            },
          },
        },
      },
      orderBy: [
        { room: { ward: { name: 'asc' } } },
        { room: { roomNumber: 'asc' } },
        { bedNumber: 'asc' },
      ],
    });

    res.json({ beds });
  } catch (error) {
    console.error('Get available beds error:', error);
    res.status(500).json({ error: 'Failed to get available beds' });
  }
};

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { wardId, roomNumber, type, capacity } = req.body;

    // Validate required fields
    if (!wardId || !roomNumber || !type || !capacity) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Verify ward exists and check hospital access
    const ward = await prisma.ward.findUnique({
      where: { id: wardId },
    });

    if (!ward) {
      res.status(404).json({ error: 'Ward not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && ward.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Create room
    const room = await prisma.room.create({
      data: {
        wardId,
        roomNumber,
        type,
        capacity,
      },
      include: {
        ward: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: ward.hospitalId,
      action: 'CREATE_ROOM',
      entity: 'ROOM',
      entityId: room.id,
      details: { roomNumber, wardId },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ room });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

export const createBed = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { roomId, bedNumber } = req.body;

    // Validate required fields
    if (!roomId || !bedNumber) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Verify room exists and check hospital access
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        ward: true,
      },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && 
        room.ward.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Create bed
    const bed = await prisma.bed.create({
      data: {
        roomId,
        bedNumber,
        status: 'AVAILABLE',
      },
      include: {
        room: {
          include: {
            ward: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: room.ward.hospitalId,
      action: 'CREATE_BED',
      entity: 'BED',
      entityId: bed.id,
      details: { bedNumber, roomId },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ bed });
  } catch (error) {
    console.error('Create bed error:', error);
    res.status(500).json({ error: 'Failed to create bed' });
  }
};
