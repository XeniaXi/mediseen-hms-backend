import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const createInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      name,
      category,
      stock,
      reorderLevel,
      unitPrice,
      expiryDate,
      batchNumber,
      supplier,
    } = req.body;

    if (!name || !category || stock === undefined || !reorderLevel || !unitPrice) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Determine hospital ID
    const hospitalId = req.user.role === 'SUPER_ADMIN' 
      ? req.body.hospitalId 
      : req.user.hospitalId;

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID is required' });
      return;
    }

    // Create inventory item
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        hospitalId,
        name,
        category,
        stock,
        reorderLevel,
        unitPrice,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        batchNumber,
        supplier,
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId,
      action: 'CREATE_INVENTORY_ITEM',
      entity: 'INVENTORY_ITEM',
      entityId: inventoryItem.id,
      details: { name, category, stock },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ inventoryItem });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
};

export const getInventoryItems = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { page = '1', limit = '50', category, search } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: Record<string, unknown> = {};

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { supplier: { contains: search as string } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({ error: 'Failed to get inventory items' });
  }
};

export const getInventoryItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!inventoryItem) {
      res.status(404).json({ error: 'Inventory item not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && inventoryItem.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ inventoryItem });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ error: 'Failed to get inventory item' });
  }
};

export const updateInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const {
      name,
      category,
      reorderLevel,
      unitPrice,
      expiryDate,
      batchNumber,
      supplier,
    } = req.body;

    // Check item exists
    const existingItem = await prisma.inventoryItem.findUnique({ where: { id } });

    if (!existingItem) {
      res.status(404).json({ error: 'Inventory item not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && existingItem.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update item
    const inventoryItem = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name,
        category,
        reorderLevel,
        unitPrice,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        batchNumber,
        supplier,
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingItem.hospitalId,
      action: 'UPDATE_INVENTORY_ITEM',
      entity: 'INVENTORY_ITEM',
      entityId: inventoryItem.id,
      details: { name: inventoryItem.name },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ inventoryItem });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
};

export const updateStock = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { adjustment, type } = req.body;

    if (adjustment === undefined || !type) {
      res.status(400).json({ error: 'Adjustment and type are required' });
      return;
    }

    // Check item exists
    const existingItem = await prisma.inventoryItem.findUnique({ where: { id } });

    if (!existingItem) {
      res.status(404).json({ error: 'Inventory item not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && existingItem.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Calculate new stock
    let newStock = existingItem.stock;
    if (type === 'ADD') {
      newStock += adjustment;
    } else if (type === 'SUBTRACT') {
      newStock -= adjustment;
      if (newStock < 0) {
        res.status(400).json({ error: 'Insufficient stock' });
        return;
      }
    } else if (type === 'SET') {
      newStock = adjustment;
    }

    // Update stock
    const inventoryItem = await prisma.inventoryItem.update({
      where: { id },
      data: { stock: newStock },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingItem.hospitalId,
      action: 'UPDATE_STOCK',
      entity: 'INVENTORY_ITEM',
      entityId: inventoryItem.id,
      details: { 
        name: inventoryItem.name,
        type,
        adjustment,
        previousStock: existingItem.stock,
        newStock,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ inventoryItem });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
};

export const getLowStock = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Build filter
    const where: Record<string, unknown> = {};

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    // Find items where stock <= reorderLevel
    const items = await prisma.inventoryItem.findMany({
      where: {
        ...where,
        stock: { lte: prisma.inventoryItem.fields.reorderLevel },
      },
      orderBy: { stock: 'asc' },
    });

    // Manual filtering (Prisma doesn't support comparing two fields directly in all cases)
    const lowStockItems = items.filter(item => item.stock <= item.reorderLevel);

    res.json({ items: lowStockItems });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to get low stock items' });
  }
};

export const deleteInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Check item exists
    const existingItem = await prisma.inventoryItem.findUnique({ where: { id } });

    if (!existingItem) {
      res.status(404).json({ error: 'Inventory item not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && existingItem.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Delete item
    await prisma.inventoryItem.delete({ where: { id } });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingItem.hospitalId,
      action: 'DELETE_INVENTORY_ITEM',
      entity: 'INVENTORY_ITEM',
      entityId: id,
      details: { name: existingItem.name, category: existingItem.category },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
};
