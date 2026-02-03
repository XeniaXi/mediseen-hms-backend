import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  getAllVisits,
  checkIn,
  updateVisitStatus,
  getQueue,
  getTodayVisits,
  getVisitsByPatient,
  getVisitById,
} from '../controllers/visitController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List all visits
router.get('/', getAllVisits);

// Check-in: RECEPTIONIST, DOCTOR, NURSE, ADMIN, SUPER_ADMIN
router.post(
  '/check-in',
  authorize('RECEPTIONIST', 'DOCTOR', 'NURSE', 'ADMIN', 'SUPER_ADMIN'),
  [
    body('patientId').isUUID().withMessage('Valid patient ID required'),
    body('department').notEmpty().withMessage('Department is required'),
    body('reasonForVisit').notEmpty().withMessage('Reason for visit is required'),
  ],
  checkIn
);

// Update status: RECEPTIONIST, DOCTOR, NURSE, ADMIN, SUPER_ADMIN
router.patch(
  '/:id/status',
  authorize('RECEPTIONIST', 'DOCTOR', 'NURSE', 'ADMIN', 'SUPER_ADMIN'),
  [
    param('id').isUUID().withMessage('Valid visit ID required'),
    body('status').notEmpty().withMessage('Status is required'),
  ],
  updateVisitStatus
);

// Queue and visits: all authenticated users
router.get('/queue', getQueue);
router.get('/today', getTodayVisits);

router.get(
  '/patient/:patientId',
  param('patientId').isUUID().withMessage('Valid patient ID required'),
  getVisitsByPatient
);

router.get('/:id', param('id').isUUID().withMessage('Valid visit ID required'), getVisitById);

export default router;
