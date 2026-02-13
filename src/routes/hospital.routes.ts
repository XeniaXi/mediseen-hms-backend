import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import {
  getHospitals,
  getHospital,
  createHospital,
  updateHospital,
  deleteHospital,
} from '../controllers/hospitalController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all hospitals (platform admin only)
router.get('/', getHospitals);

// Get hospital by slug (for patient portal - no auth required)
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { prisma } = require('../db');
    
    // Find hospital by name slug (lowercase, hyphenated)
    const hospitals = await prisma.hospital.findMany({
      where: { active: true },
      select: { id: true, name: true, logo: true, email: true },
    });
    
    const hospital = hospitals.find((h: any) => 
      h.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
    );
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    res.json({ hospital });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hospital' });
  }
});

// Get single hospital
router.get('/:id', getHospital);

// Create hospital with admin user
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Hospital name is required'),
    body('email').isEmail().withMessage('Valid hospital email is required'),
    body('adminEmail').isEmail().withMessage('Valid admin email is required'),
    body('adminPassword').isLength({ min: 8 }).withMessage('Admin password must be at least 8 characters'),
  ],
  createHospital
);

// Update hospital
router.put('/:id', updateHospital);

// Mark hospital onboarding complete
router.post('/:id/onboarding-complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { prisma } = require('../db');
    
    // Only allow if user belongs to this hospital
    if (req.user?.hospitalId !== id && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const hospital = await prisma.hospital.update({
      where: { id },
      data: { isOnboarded: true },
    });
    
    res.json({ success: true, hospital });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// Delete/deactivate hospital
router.delete('/:id', deleteHospital);

export default router;
