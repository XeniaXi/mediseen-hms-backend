import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  createInventoryItem,
  getInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  updateStock,
  getLowStock,
  deleteInventoryItem,
} from '../controllers/inventoryController';

const router = Router();

// All routes require authentication and PHARMACIST, ADMIN, or SUPER_ADMIN role
router.use(authenticate);
router.use(authorize('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'));

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity is required'),
    body('reorderLevel').isInt({ min: 0 }).withMessage('Valid reorder level is required'),
    body('unitPrice').isFloat({ gt: 0 }).withMessage('Valid unit price is required'),
  ],
  createInventoryItem
);

router.get('/', getInventoryItems);

router.get('/low-stock', getLowStock);

router.get(
  '/:id',
  param('id').isUUID().withMessage('Valid inventory item ID required'),
  getInventoryItemById
);

router.put(
  '/:id',
  param('id').isUUID().withMessage('Valid inventory item ID required'),
  updateInventoryItem
);

router.patch(
  '/:id/stock',
  [
    param('id').isUUID().withMessage('Valid inventory item ID required'),
    body('adjustment').isInt().withMessage('Valid adjustment value is required'),
    body('type').isIn(['ADD', 'SUBTRACT', 'SET']).withMessage('Valid type is required (ADD, SUBTRACT, SET)'),
  ],
  updateStock
);

router.delete(
  '/:id',
  param('id').isUUID().withMessage('Valid inventory item ID required'),
  deleteInventoryItem
);

export default router;
