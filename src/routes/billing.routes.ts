import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  createBill,
  addPayment,
  getBillByVisit,
  getOutstandingBills,
  getBillsByPatient,
} from '../controllers/billingController';

const router = Router();

// All routes require authentication and BILLING_OFFICER, ADMIN, or SUPER_ADMIN role
router.use(authenticate);
router.use(authorize('BILLING_OFFICER', 'ADMIN', 'SUPER_ADMIN'));

router.post(
  '/',
  [
    body('visitId').isUUID().withMessage('Valid visit ID required'),
    body('patientId').isUUID().withMessage('Valid patient ID required'),
    body('items').isArray({ min: 1 }).withMessage('At least one billing item is required'),
  ],
  createBill
);

router.post(
  '/payment',
  [
    body('billingRecordId').isUUID().withMessage('Valid billing record ID required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Valid payment amount is required'),
    body('method').notEmpty().withMessage('Payment method is required'),
  ],
  addPayment
);

router.get('/outstanding', getOutstandingBills);

router.get(
  '/visit/:visitId',
  param('visitId').isUUID().withMessage('Valid visit ID required'),
  getBillByVisit
);

router.get(
  '/patient/:patientId',
  param('patientId').isUUID().withMessage('Valid patient ID required'),
  getBillsByPatient
);

export default router;
