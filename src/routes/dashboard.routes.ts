import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardStats } from '../controllers/dashboardController';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/stats', getDashboardStats);

export default router;
