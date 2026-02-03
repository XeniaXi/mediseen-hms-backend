import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build hospital filter
    const hospitalFilter = req.user.role === 'SUPER_ADMIN' 
      ? {} 
      : { hospitalId: req.user.hospitalId || undefined };

    // Get hospital settings
    let hospitalSettings = null;
    let hospitalBranding = null;
    if (req.user.hospitalId) {
      const hospital = await prisma.hospital.findUnique({
        where: { id: req.user.hospitalId },
        select: { settings: true, name: true },
      });
      if (hospital && hospital.settings) {
        hospitalSettings = hospital.settings as Record<string, unknown>;
        hospitalBranding = hospitalSettings.branding as Record<string, unknown> || {
          hospitalName: hospital.name,
          primaryColor: '#0D7C66',
          secondaryColor: '#F5A623',
        };
      }
    }

    // Today's visits
    const todayVisits = await prisma.visit.count({
      where: {
        ...hospitalFilter,
        checkInTime: { gte: today, lt: tomorrow },
      },
    });

    // Queue (waiting/in-progress)
    const queueCount = await prisma.visit.count({
      where: {
        ...hospitalFilter,
        status: { in: ['CHECKED_IN', 'WAITING', 'IN_PROGRESS'] },
      },
    });

    // Total patients registered
    const totalPatients = await prisma.patient.count({
      where: hospitalFilter,
    });

    // Today's revenue
    const todayBilling = await prisma.billingRecord.aggregate({
      where: {
        ...hospitalFilter,
        createdAt: { gte: today, lt: tomorrow },
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
    });

    const todayRevenue = todayBilling._sum.paidAmount || 0;
    const todayBilled = todayBilling._sum.totalAmount || 0;

    // Outstanding bills
    const outstandingBills = await prisma.billingRecord.aggregate({
      where: {
        ...hospitalFilter,
        status: { in: ['PENDING', 'PARTIAL'] },
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
      _count: true,
    });

    const outstandingAmount = (outstandingBills._sum.totalAmount || 0) - (outstandingBills._sum.paidAmount || 0);

    // Pending prescriptions
    const pendingPrescriptions = await prisma.prescription.count({
      where: {
        status: 'PENDING',
        ...(req.user.role === 'SUPER_ADMIN' ? {} : { visit: { hospitalId: req.user.hospitalId || undefined } }),
      },
    });

    // Pending lab orders
    const pendingLabOrders = await prisma.labOrder.count({
      where: {
        status: { in: ['ORDERED', 'COLLECTED', 'PROCESSING'] },
        ...(req.user.role === 'SUPER_ADMIN' ? {} : { visit: { hospitalId: req.user.hospitalId || undefined } }),
      },
    });

    // Low stock items
    const allInventoryItems = await prisma.inventoryItem.findMany({
      where: hospitalFilter,
      select: {
        stock: true,
        reorderLevel: true,
      },
    });
    const lowStockCount = allInventoryItems.filter(item => item.stock <= item.reorderLevel).length;

    // Department breakdown (today's visits)
    const departmentStats = await prisma.visit.groupBy({
      by: ['department'],
      where: {
        ...hospitalFilter,
        checkInTime: { gte: today, lt: tomorrow },
      },
      _count: {
        id: true,
      },
    });

    const departmentBreakdown = departmentStats.map(stat => ({
      department: stat.department,
      count: stat._count.id,
    }));

    // Status breakdown (today's visits)
    const statusStats = await prisma.visit.groupBy({
      by: ['status'],
      where: {
        ...hospitalFilter,
        checkInTime: { gte: today, lt: tomorrow },
      },
      _count: {
        id: true,
      },
    });

    const statusBreakdown = statusStats.map(stat => ({
      status: stat.status,
      count: stat._count.id,
    }));

    // Recent activity (last 10 visits)
    const recentVisits = await prisma.visit.findMany({
      where: hospitalFilter,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
      take: 10,
    });

    // Bed occupancy
    let bedOccupancy = null;
    if (req.user.hospitalId) {
      const totalBeds = await prisma.bed.count({
        where: {
          room: {
            ward: {
              hospitalId: req.user.hospitalId,
            },
          },
        },
      });

      const occupiedBeds = await prisma.bed.count({
        where: {
          room: {
            ward: {
              hospitalId: req.user.hospitalId,
            },
          },
          status: 'OCCUPIED',
        },
      });

      bedOccupancy = {
        total: totalBeds,
        occupied: occupiedBeds,
        available: totalBeds - occupiedBeds,
        occupancyPercentage: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      };
    }

    res.json({
      settings: hospitalSettings ? {
        currency: hospitalSettings.currency || 'NGN',
        currencySymbol: hospitalSettings.currencySymbol || '₦',
        locale: hospitalSettings.locale || 'en-NG',
        timezone: hospitalSettings.timezone || 'Africa/Lagos',
      } : null,
      branding: hospitalBranding,
      stats: {
        todayVisits,
        queueCount,
        totalPatients,
        todayRevenue,
        todayBilled,
        outstandingAmount,
        outstandingBillsCount: outstandingBills._count,
        pendingPrescriptions,
        pendingLabOrders,
        lowStockCount,
      },
      bedOccupancy,
      breakdowns: {
        byDepartment: departmentBreakdown,
        byStatus: statusBreakdown,
      },
      recentActivity: recentVisits,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard statistics' });
  }
};
