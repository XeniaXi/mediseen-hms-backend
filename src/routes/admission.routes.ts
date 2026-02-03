import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  createAdmission,
  getAdmissions,
  assignBed,
  dischargePatient,
  getActiveAdmissions,
} from '../controllers/admissionController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create admission - DOCTOR creates
router.post(
  '/',
  authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  [
    body('patientId').isUUID().withMessage('Valid patient ID is required'),
    body('diagnosis').notEmpty().withMessage('Diagnosis is required'),
    body('visitId').optional().isUUID().withMessage('Valid visit ID required'),
  ],
  createAdmission
);

// Get admissions - all clinical roles can read
router.get(
  '/',
  authorize('DOCTOR', 'NURSE', 'ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  getAdmissions
);

// Get active admissions - all clinical roles can read
router.get(
  '/active',
  authorize('DOCTOR', 'NURSE', 'ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  getActiveAdmissions
);

// Assign bed - WARD_MANAGER assigns beds
router.put(
  '/:id/assign-bed',
  authorize('WARD_MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  [
    param('id').isUUID().withMessage('Valid admission ID is required'),
    body('bedId').isUUID().withMessage('Valid bed ID is required'),
  ],
  assignBed
);

// Discharge patient - DOCTOR discharges
router.put(
  '/:id/discharge',
  authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  param('id').isUUID().withMessage('Valid admission ID is required'),
  dischargePatient
);

export default router;
