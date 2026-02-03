import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  createLabOrder,
  updateLabOrderStatus,
  enterLabResults,
  getLabOrdersByPatient,
  getLabOrdersByVisit,
  getPendingLabOrders,
} from '../controllers/labController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create lab order: DOCTOR, ADMIN, SUPER_ADMIN
router.post(
  '/',
  authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  [
    body('visitId').isUUID().withMessage('Valid visit ID required'),
    body('patientId').isUUID().withMessage('Valid patient ID required'),
    body('testType').notEmpty().withMessage('Test type is required'),
  ],
  createLabOrder
);

// Update status: LAB_TECH, ADMIN, SUPER_ADMIN
router.patch(
  '/:id/status',
  authorize('LAB_TECH', 'ADMIN', 'SUPER_ADMIN'),
  [
    param('id').isUUID().withMessage('Valid lab order ID required'),
    body('status').notEmpty().withMessage('Status is required'),
  ],
  updateLabOrderStatus
);

// Enter results: LAB_TECH, ADMIN, SUPER_ADMIN
router.patch(
  '/:id/results',
  authorize('LAB_TECH', 'ADMIN', 'SUPER_ADMIN'),
  [
    param('id').isUUID().withMessage('Valid lab order ID required'),
    body('resultValue').notEmpty().withMessage('Result value is required'),
  ],
  enterLabResults
);

// Get lab orders: DOCTOR, LAB_TECH, ADMIN, SUPER_ADMIN
router.get(
  '/pending',
  authorize('DOCTOR', 'LAB_TECH', 'ADMIN', 'SUPER_ADMIN'),
  getPendingLabOrders
);

router.get(
  '/patient/:patientId',
  authorize('DOCTOR', 'LAB_TECH', 'ADMIN', 'SUPER_ADMIN'),
  param('patientId').isUUID().withMessage('Valid patient ID required'),
  getLabOrdersByPatient
);

router.get(
  '/visit/:visitId',
  authorize('DOCTOR', 'LAB_TECH', 'ADMIN', 'SUPER_ADMIN'),
  param('visitId').isUUID().withMessage('Valid visit ID required'),
  getLabOrdersByVisit
);

export default router;
