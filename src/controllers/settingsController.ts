import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    // For unauthenticated requests, return only public branding info
    if (!req.user) {
      // Get first active hospital for public branding
      const hospital = await prisma.hospital.findFirst({
        where: { active: true },
        select: {
          id: true,
          name: true,
          logo: true,
          settings: true,
        },
      });

      if (!hospital || !hospital.settings) {
        res.json({
          branding: {
            hospitalName: 'Hospital Management System',
            primaryColor: '#0D7C66',
            secondaryColor: '#F5A623',
            logoUrl: '',
            tagline: 'Quality Healthcare for All',
          },
        });
        return;
      }

      const settings = hospital.settings as Record<string, unknown>;
      const branding = settings.branding as Record<string, unknown> || {};

      res.json({
        branding: {
          hospitalName: branding.hospitalName || hospital.name,
          primaryColor: branding.primaryColor || '#0D7C66',
          secondaryColor: branding.secondaryColor || '#F5A623',
          logoUrl: branding.logoUrl || hospital.logo || '',
          tagline: branding.tagline || 'Quality Healthcare for All',
        },
      });
      return;
    }

    // For authenticated users, return full settings for their hospital
    let hospitalId = req.user.hospitalId;

    // Super admins can query any hospital
    if (req.user.role === 'SUPER_ADMIN' && req.query.hospitalId) {
      hospitalId = req.query.hospitalId as string;
    }

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID required' });
      return;
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        settings: true,
      },
    });

    if (!hospital) {
      res.status(404).json({ error: 'Hospital not found' });
      return;
    }

    res.json({
      hospital: {
        id: hospital.id,
        name: hospital.name,
        address: hospital.address,
        phone: hospital.phone,
        email: hospital.email,
        logo: hospital.logo,
      },
      settings: hospital.settings || {},
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only ADMIN and SUPER_ADMIN can update settings
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    let hospitalId = req.user.hospitalId;

    // Super admins can update any hospital
    if (req.user.role === 'SUPER_ADMIN' && req.body.hospitalId) {
      hospitalId = req.body.hospitalId;
    }

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID required' });
      return;
    }

    const { settings } = req.body;

    if (!settings) {
      res.status(400).json({ error: 'Settings required' });
      return;
    }

    // Get existing settings
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { settings: true },
    });

    if (!hospital) {
      res.status(404).json({ error: 'Hospital not found' });
      return;
    }

    // Merge with existing settings (don't replace completely)
    const existingSettings = (hospital.settings as Record<string, unknown>) || {};
    const updatedSettings = { ...existingSettings, ...settings };

    // Update hospital settings
    const updatedHospital = await prisma.hospital.update({
      where: { id: hospitalId },
      data: { settings: updatedSettings },
      select: {
        id: true,
        name: true,
        settings: true,
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId,
      action: 'UPDATE_SETTINGS',
      entity: 'HOSPITAL',
      entityId: hospitalId,
      details: { updatedFields: Object.keys(settings) },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({
      message: 'Settings updated successfully',
      settings: updatedHospital.settings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

export const getDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    let hospitalId = req.user.hospitalId;

    if (req.user.role === 'SUPER_ADMIN' && req.query.hospitalId) {
      hospitalId = req.query.hospitalId as string;
    }

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID required' });
      return;
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { settings: true },
    });

    if (!hospital) {
      res.status(404).json({ error: 'Hospital not found' });
      return;
    }

    const settings = (hospital.settings as Record<string, unknown>) || {};
    const departments = (settings.departments as string[]) || [
      'General Medicine',
      'Emergency',
      'Surgery',
      'Pediatrics',
      'Obstetrics',
    ];

    res.json({ departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Failed to get departments' });
  }
};

export const updateBranding = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only ADMIN and SUPER_ADMIN can update branding
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    let hospitalId = req.user.hospitalId;

    if (req.user.role === 'SUPER_ADMIN' && req.body.hospitalId) {
      hospitalId = req.body.hospitalId;
    }

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID required' });
      return;
    }

    const { primaryColor, secondaryColor, logoUrl, hospitalName, tagline } = req.body;

    // Get existing settings
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { settings: true },
    });

    if (!hospital) {
      res.status(404).json({ error: 'Hospital not found' });
      return;
    }

    const settings = (hospital.settings as Record<string, unknown>) || {};
    const existingBranding = (settings.branding as Record<string, unknown>) || {};

    // Update branding within settings
    const updatedBranding = {
      ...existingBranding,
      ...(primaryColor && { primaryColor }),
      ...(secondaryColor && { secondaryColor }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(hospitalName && { hospitalName }),
      ...(tagline && { tagline }),
    };

    const updatedSettings = {
      ...settings,
      branding: updatedBranding,
    };

    // Update hospital
    const updatedHospital = await prisma.hospital.update({
      where: { id: hospitalId },
      data: { settings: updatedSettings },
      select: {
        id: true,
        name: true,
        settings: true,
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId,
      action: 'UPDATE_BRANDING',
      entity: 'HOSPITAL',
      entityId: hospitalId,
      details: { updatedBranding },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({
      message: 'Branding updated successfully',
      branding: (updatedHospital.settings as Record<string, unknown>).branding,
    });
  } catch (error) {
    console.error('Update branding error:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
};
