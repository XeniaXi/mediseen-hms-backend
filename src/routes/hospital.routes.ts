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

// Delete/deactivate hospital
router.delete('/:id', deleteHospital);

export default router;
