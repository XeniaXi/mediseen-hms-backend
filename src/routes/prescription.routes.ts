import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  createPrescription,
  dispensePrescription,
  getPrescriptionsByPatient,
  getPrescriptionsByVisit,
  getPendingPrescriptions,
} from '../controllers/prescriptionController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create prescription: DOCTOR, ADMIN, SUPER_ADMIN
router.post(
  '/',
  authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  [
    body('patientId').isUUID().withMessage('Valid patient ID required'),
    body('visitId').isUUID().withMessage('Valid visit ID required'),
    body('items').isArray({ min: 1 }).withMessage('At least one prescription item is required'),
  ],
  createPrescription
);

// Dispense prescription: PHARMACIST, ADMIN, SUPER_ADMIN
router.patch(
  '/:id/dispense',
  authorize('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'),
  param('id').isUUID().withMessage('Valid prescription ID required'),
  dispensePrescription
);

// Get prescriptions: DOCTOR, PHARMACIST, ADMIN, SUPER_ADMIN
router.get(
  '/pending',
  authorize('DOCTOR', 'PHARMACIST', 'ADMIN', 'SUPER_ADMIN'),
  getPendingPrescriptions
);

router.get(
  '/patient/:patientId',
  authorize('DOCTOR', 'PHARMACIST', 'ADMIN', 'SUPER_ADMIN'),
  param('patientId').isUUID().withMessage('Valid patient ID required'),
  getPrescriptionsByPatient
);

router.get(
  '/visit/:visitId',
  authorize('DOCTOR', 'PHARMACIST', 'ADMIN', 'SUPER_ADMIN'),
  param('visitId').isUUID().withMessage('Valid visit ID required'),
  getPrescriptionsByVisit
);

export default router;
