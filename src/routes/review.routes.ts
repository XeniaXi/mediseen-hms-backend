import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  recordReview,
  getAllReviews,
  getReviewsByAdmission,
} from '../controllers/reviewController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List all reviews
router.get(
  '/',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  getAllReviews
);

// Record doctor review - DOCTOR records reviews
router.post(
  '/',
  authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  [
    body('admissionId').isUUID().withMessage('Valid admission ID is required'),
  ],
  recordReview
);

// Get reviews by admission - clinical roles can read
router.get(
  '/admission/:admissionId',
  authorize('NURSE', 'DOCTOR', 'ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  param('admissionId').isUUID().withMessage('Valid admission ID is required'),
  getReviewsByAdmission
);

export default router;
