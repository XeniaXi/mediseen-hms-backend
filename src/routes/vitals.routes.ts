import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  recordVitals,
  getAllVitals,
  getVitalsByVisit,
  getVitalsByPatient,
  getTriageQueue,
} from '../controllers/vitalsController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List all vitals
router.get(
  '/',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  getAllVitals
);

// Record vitals - NURSE, DOCTOR can record
router.post(
  '/',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  [
    body('patientId').isUUID().withMessage('Valid patient ID is required'),
    body('visitId').optional().isUUID().withMessage('Valid visit ID required'),
  ],
  recordVitals
);

// Get vitals by visit - all clinical roles can read
router.get(
  '/visit/:visitId',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  param('visitId').isUUID().withMessage('Valid visit ID is required'),
  getVitalsByVisit
);

// Get vitals by patient - all clinical roles can read
router.get(
  '/patient/:patientId',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  param('patientId').isUUID().withMessage('Valid patient ID is required'),
  getVitalsByPatient
);

// Get triage queue - all clinical roles can read
router.get(
  '/triage/queue',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  getTriageQueue
);

export default router;
