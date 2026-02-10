import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import {
  login,
  refreshTokenHandler,
  logout,
  changePassword,
  getMe,
  initialSetup,
} from '../controllers/authController';

const router = Router();

// Public routes
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  refreshTokenHandler
);

// First-time setup - only works when no users exist
router.post(
  '/setup',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
  ],
  initialSetup
);

// Protected routes
router.post('/logout', authenticate, logout);

router.post(
  '/change-password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('Old password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  changePassword
);

router.get('/me', authenticate, getMe);

export default router;
