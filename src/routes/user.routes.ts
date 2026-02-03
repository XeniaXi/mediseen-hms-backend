import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deactivateUser,
  resetUserPassword,
} from '../controllers/userController';

const router = Router();

// All routes require authentication and SUPER_ADMIN or ADMIN role
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'ADMIN'));

router.post(
  '/',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('role').notEmpty().withMessage('Role is required'),
  ],
  createUser
);

router.get('/', getUsers);

router.get('/:id', param('id').isUUID().withMessage('Valid user ID required'), getUserById);

router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Valid user ID required'),
  ],
  updateUser
);

router.patch(
  '/:id/deactivate',
  param('id').isUUID().withMessage('Valid user ID required'),
  deactivateUser
);

router.post(
  '/:id/reset-password',
  [
    param('id').isUUID().withMessage('Valid user ID required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  resetUserPassword
);

export default router;
