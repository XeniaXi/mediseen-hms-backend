import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth';
import {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  searchPatients,
} from '../controllers/patientController';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post(
  '/',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
    body('gender').notEmpty().withMessage('Gender is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
  ],
  createPatient
);

router.get('/', getPatients);

router.get('/search', searchPatients);

router.get('/:id', param('id').isUUID().withMessage('Valid patient ID required'), getPatientById);

router.put(
  '/:id',
  param('id').isUUID().withMessage('Valid patient ID required'),
  updatePatient
);

router.delete(
  '/:id',
  param('id').isUUID().withMessage('Valid patient ID required'),
  deletePatient
);

export default router;
