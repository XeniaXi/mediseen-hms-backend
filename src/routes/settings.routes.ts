import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSettings,
  updateSettings,
  getDepartments,
  updateBranding,
} from '../controllers/settingsController';

const router = Router();

// Public route - can be accessed without authentication (returns only branding)
router.get('/', getSettings);

// Protected routes - require authentication
router.put('/', authenticate, updateSettings);
router.get('/departments', authenticate, getDepartments);
router.put('/branding', authenticate, updateBranding);

export default router;
