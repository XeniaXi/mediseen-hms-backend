import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();

// Get all hospitals (platform admin only)
export const getHospitals = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only platform admins can view all hospitals' });
      return;
    }

    const hospitals = await prisma.hospital.findMany({
      include: {
        _count: {
          select: {
            users: true,
            patients: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(hospitals);
  } catch (error) {
    console.error('Get hospitals error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
};

// Create hospital with admin user (platform admin only)
export const createHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only platform admins can create hospitals' });
      return;
    }

    const {
      name,
      address,
      phone,
      email,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      adminPhone,
      settings,
    } = req.body;

    // Validate required fields
    if (!name || !email || !adminEmail || !adminPassword) {
      res.status(400).json({ error: 'Hospital name, email, admin email and password are required' });
      return;
    }

    // Check if hospital email already exists
    const existingHospital = await prisma.hospital.findUnique({ where: { email } });
    if (existingHospital) {
      res.status(400).json({ error: 'Hospital with this email already exists' });
      return;
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) {
      res.status(400).json({ error: 'User with this admin email already exists' });
      return;
    }

    // Create hospital and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create hospital
      const hospital = await tx.hospital.create({
        data: {
          name,
          address: address || '',
          phone: phone || '',
          email,
          settings: settings || {},
        }
      });

      // Create admin user for the hospital
      const hashedPassword = await hashPassword(adminPassword);
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: adminFirstName || 'Admin',
          lastName: adminLastName || '',
          phone: adminPhone || '',
          role: 'ADMIN',
          hospitalId: hospital.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        }
      });

      return { hospital, adminUser };
    });

    res.status(201).json({
      message: 'Hospital and admin user created successfully',
      hospital: result.hospital,
      adminUser: result.adminUser,
    });
  } catch (error) {
    console.error('Create hospital error:', error);
    res.status(500).json({ error: 'Failed to create hospital' });
  }
};

// Update hospital
export const updateHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Only platform admin or hospital admin can update
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.hospitalId !== id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const { name, address, phone, email, settings, active } = req.body;

    const hospital = await prisma.hospital.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(phone && { phone }),
        ...(email && { email }),
        ...(settings && { settings }),
        ...(typeof active === 'boolean' && { active }),
      }
    });

    res.json(hospital);
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({ error: 'Failed to update hospital' });
  }
};

// Delete/deactivate hospital (platform admin only)
export const deleteHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only platform admins can delete hospitals' });
      return;
    }

    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === 'true') {
      // Hard delete - use with caution
      await prisma.hospital.delete({ where: { id } });
      res.json({ message: 'Hospital permanently deleted' });
    } else {
      // Soft delete - deactivate
      await prisma.hospital.update({
        where: { id },
        data: { active: false }
      });
      res.json({ message: 'Hospital deactivated' });
    }
  } catch (error) {
    console.error('Delete hospital error:', error);
    res.status(500).json({ error: 'Failed to delete hospital' });
  }
};

// Get single hospital
export const getHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Only platform admin or hospital member can view
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.hospitalId !== id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            patients: true,
          }
        }
      }
    });

    if (!hospital) {
      res.status(404).json({ error: 'Hospital not found' });
      return;
    }

    res.json(hospital);
  } catch (error) {
    console.error('Get hospital error:', error);
    res.status(500).json({ error: 'Failed to fetch hospital' });
  }
};
