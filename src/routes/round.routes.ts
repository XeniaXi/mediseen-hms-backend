import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  recordRound,
  getAllRounds,
  getRoundsByAdmission,
  getDueRounds,
} from '../controllers/roundController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List all rounds
router.get(
  '/',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  getAllRounds
);

// Record nursing round - NURSE records rounds
router.post(
  '/',
  authorize('NURSE', 'ADMIN', 'SUPER_ADMIN'),
  [
    body('admissionId').isUUID().withMessage('Valid admission ID is required'),
    body('roundType').notEmpty().withMessage('Round type is required'),
    body('patientCondition').notEmpty().withMessage('Patient condition is required'),
    body('vitalSignsId').optional().isUUID().withMessage('Valid vital signs ID required'),
  ],
  recordRound
);

// Get rounds by admission - clinical roles can read
router.get(
  '/admission/:admissionId',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  param('admissionId').isUUID().withMessage('Valid admission ID is required'),
  getRoundsByAdmission
);

// Get due rounds - NURSE can read
router.get(
  '/due',
  authorize('NURSE', 'ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  getDueRounds
);

export default router;
