import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  createWard,
  getWards,
  getWardBeds,
  updateBedStatus,
  getAvailableBeds,
  createRoom,
  createBed,
} from '../controllers/wardController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create ward - ADMIN, WARD_MANAGER can manage
router.post(
  '/',
  authorize('ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  [
    body('name').notEmpty().withMessage('Ward name is required'),
    body('type').notEmpty().withMessage('Ward type is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Valid capacity is required'),
  ],
  createWard
);

// Get all wards - all can read
router.get('/', getWards);

// Get ward beds - all can read
router.get(
  '/:id/beds',
  param('id').isUUID().withMessage('Valid ward ID is required'),
  getWardBeds
);

// Update bed status - ADMIN, WARD_MANAGER, NURSE can update
router.put(
  '/beds/:id/status',
  authorize('ADMIN', 'WARD_MANAGER', 'NURSE', 'SUPER_ADMIN'),
  [
    param('id').isUUID().withMessage('Valid bed ID is required'),
    body('status').notEmpty().withMessage('Status is required'),
  ],
  updateBedStatus
);

// Get available beds - all can read
router.get('/beds/available', getAvailableBeds);

// Create room - ADMIN, WARD_MANAGER can manage
router.post(
  '/rooms',
  authorize('ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  [
    body('wardId').isUUID().withMessage('Valid ward ID is required'),
    body('roomNumber').notEmpty().withMessage('Room number is required'),
    body('type').notEmpty().withMessage('Room type is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Valid capacity is required'),
  ],
  createRoom
);

// Create bed - ADMIN, WARD_MANAGER can manage
router.post(
  '/beds',
  authorize('ADMIN', 'WARD_MANAGER', 'SUPER_ADMIN'),
  [
    body('roomId').isUUID().withMessage('Valid room ID is required'),
    body('bedNumber').notEmpty().withMessage('Bed number is required'),
  ],
  createBed
);

export default router;
