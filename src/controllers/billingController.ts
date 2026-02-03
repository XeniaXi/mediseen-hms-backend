import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const createBill = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { visitId, patientId, items, insuranceProvider, insurancePolicyNumber, insuranceCoverage } = req.body;

    if (!visitId || !patientId || !items || items.length === 0) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check visit exists and hospital access
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });

    if (!visit) {
      res.status(404).json({ error: 'Visit not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && visit.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum: number, item: { amount: number; quantity: number }) => {
      return sum + (item.amount * item.quantity);
    }, 0);

    // Create billing record with items and optional insurance info
    const billingRecord = await prisma.billingRecord.create({
      data: {
        visitId,
        patientId,
        hospitalId: visit.hospitalId,
        status: 'PENDING',
        totalAmount,
        paidAmount: 0,
        insuranceProvider: insuranceProvider || undefined,
        insurancePolicyNumber: insurancePolicyNumber || undefined,
        insuranceCoverage: insuranceCoverage ? parseFloat(insuranceCoverage) : undefined,
        createdBy: req.user.id,
        items: {
          create: items.map((item: {
            description: string;
            category: string;
            amount: number;
            quantity?: number;
          }) => ({
            description: item.description,
            category: item.category,
            amount: item.amount,
            quantity: item.quantity || 1,
          })),
        },
      },
      include: {
        items: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: visit.hospitalId,
      action: 'CREATE_BILL',
      entity: 'BILLING_RECORD',
      entityId: billingRecord.id,
      details: { 
        visitId, 
        totalAmount, 
        itemsCount: items.length,
        hasInsurance: !!insuranceProvider,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ billingRecord });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ error: 'Failed to create bill' });
  }
};

export const addPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { billingRecordId, amount, method, reference } = req.body;

    if (!billingRecordId || !amount || !method) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check billing record exists
    const existingBilling = await prisma.billingRecord.findUnique({
      where: { id: billingRecordId },
    });

    if (!existingBilling) {
      res.status(404).json({ error: 'Billing record not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && existingBilling.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        billingRecordId,
        amount,
        method,
        reference,
        receivedBy: req.user.id,
      },
    });

    // Update billing record
    const newPaidAmount = existingBilling.paidAmount + amount;
    let newStatus = existingBilling.status;

    if (newPaidAmount >= existingBilling.totalAmount) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIAL';
    }

    const billingRecord = await prisma.billingRecord.update({
      where: { id: billingRecordId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
      include: {
        items: true,
        payments: {
          include: {
            receivedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog(prisma, {
      userId: req.user.id,
      hospitalId: existingBilling.hospitalId,
      action: 'ADD_PAYMENT',
      entity: 'PAYMENT',
      entityId: payment.id,
      details: { billingRecordId, amount, method, newStatus },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ payment, billingRecord });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
};

export const getBillByVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { visitId } = req.params;

    // Check visit exists and hospital access
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });

    if (!visit) {
      res.status(404).json({ error: 'Visit not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && visit.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const billingRecords = await prisma.billingRecord.findMany({
      where: { visitId },
      include: {
        items: true,
        payments: {
          include: {
            receivedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ billingRecords });
  } catch (error) {
    console.error('Get bill by visit error:', error);
    res.status(500).json({ error: 'Failed to get billing records' });
  }
};

export const getOutstandingBills = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Build filter
    const where: Record<string, unknown> = {
      status: { in: ['PENDING', 'PARTIAL'] },
    };

    // Scope by hospital
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId) {
      where.hospitalId = req.user.hospitalId;
    }

    const billingRecords = await prisma.billingRecord.findMany({
      where,
      include: {
        items: true,
        payments: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        visit: {
          select: {
            id: true,
            checkInTime: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ billingRecords });
  } catch (error) {
    console.error('Get outstanding bills error:', error);
    res.status(500).json({ error: 'Failed to get outstanding bills' });
  }
};

export const getBillsByPatient = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { patientId } = req.params;

    // Check patient exists and hospital access
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    if (req.user.role !== 'SUPER_ADMIN' && patient.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const billingRecords = await prisma.billingRecord.findMany({
      where: { patientId },
      include: {
        items: true,
        payments: {
          include: {
            receivedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        visit: {
          select: {
            id: true,
            checkInTime: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ billingRecords });
  } catch (error) {
    console.error('Get bills by patient error:', error);
    res.status(500).json({ error: 'Failed to get patient billing records' });
  }
};
