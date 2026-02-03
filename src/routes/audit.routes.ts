import { Router } from 'express';
import { param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { getAuditLogs, getAuditLogsByEntity } from '../controllers/auditController';

const router = Router();

// All routes require authentication and ADMIN or SUPER_ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/', getAuditLogs);

router.get(
  '/:entity/:entityId',
  [
    param('entity').notEmpty().withMessage('Entity is required'),
    param('entityId').notEmpty().withMessage('Entity ID is required'),
  ],
  getAuditLogsByEntity
);

export default router;
