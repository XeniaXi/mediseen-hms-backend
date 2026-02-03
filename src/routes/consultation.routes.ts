import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  createConsultation,
  updateConsultation,
  getConsultationsByVisit,
  getConsultationsByPatient,
} from '../controllers/consultationController';

const router = Router();

// All routes require authentication and DOCTOR, ADMIN, or SUPER_ADMIN role
router.use(authenticate);
router.use(authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'));

router.post(
  '/',
  [
    body('visitId').isUUID().withMessage('Valid visit ID required'),
    body('patientId').isUUID().withMessage('Valid patient ID required'),
    body('chiefComplaint').notEmpty().withMessage('Chief complaint is required'),
    body('diagnosis').notEmpty().withMessage('Diagnosis is required'),
  ],
  createConsultation
);

router.put(
  '/:id',
  param('id').isUUID().withMessage('Valid consultation ID required'),
  updateConsultation
);

router.get(
  '/visit/:visitId',
  param('visitId').isUUID().withMessage('Valid visit ID required'),
  getConsultationsByVisit
);

router.get(
  '/patient/:patientId',
  param('patientId').isUUID().withMessage('Valid patient ID required'),
  getConsultationsByPatient
);

export default router;
