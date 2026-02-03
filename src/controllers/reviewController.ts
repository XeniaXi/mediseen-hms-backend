import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

const prisma = new PrismaClient();

export const recordReview = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      admissionId,
      findings,
      treatmentPlanUpdate,
      ordersGiven,
      dischargeRecommendation,
      nextReviewDue,
    } = req.body;

    // Validate required fields
    if (!admissionId) {
      res.status(400).json({ error: 'Admission ID is required' });
      return;
    }

    // Verify admission exists
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
    });

    if (!admission) {
      res.status(404).json({ error: 'Admission not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && 
        admission.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Create doctor review
    const review = await prisma.doctorReview.create({
      data: {
        admissionId,
        patientId: admission.patientId,
        reviewedBy: req.user.id,
        findings,
        treatmentPlanUpdate,
        ordersGiven,
        dischargeRecommendation: dischargeRecommendation || false,
        nextReviewDue: nextReviewDue ? new Date(nextReviewDue) : undefined,
      },
      include: {
        admission: {
          select: {
            id: true,
            diagnosis: true,
            admissionDate: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewedByUser: {
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
      hospitalId: admission.hospitalId,
      action: 'RECORD_DOCTOR_REVIEW',
      entity: 'DOCTOR_REVIEW',
      entityId: review.id,
      details: { 
        admissionId,
        dischargeRecommendation,
      },
      ipAddress: String(req.ip || req.socket.remoteAddress || ''),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    res.status(201).json({ review });
  } catch (error) {
    console.error('Record review error:', error);
    res.status(500).json({ error: 'Failed to record doctor review' });
  }
};

export const getAllReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hospitalId = req.user.role === 'SUPER_ADMIN'
      ? (req.query.hospitalId as string)
      : req.user.hospitalId;

    if (!hospitalId) {
      res.status(400).json({ error: 'Hospital ID is required' });
      return;
    }

    const reviews = await prisma.doctorReview.findMany({
      where: {
        admission: {
          hospitalId,
        },
      },
      include: {
        admission: {
          select: {
            id: true,
            diagnosis: true,
            status: true,
            ward: { select: { id: true, name: true } },
            room: { select: { id: true, roomNumber: true } },
            bed: { select: { id: true, bedNumber: true } },
          },
        },
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        reviewedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reviews });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({ error: 'Failed to get doctor reviews' });
  }
};

export const getReviewsByAdmission = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { admissionId } = req.params;

    // Verify admission exists and check access
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
    });

    if (!admission) {
      res.status(404).json({ error: 'Admission not found' });
      return;
    }

    // Check hospital access
    if (req.user.role !== 'SUPER_ADMIN' && 
        admission.hospitalId !== req.user.hospitalId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const reviews = await prisma.doctorReview.findMany({
      where: { admissionId },
      include: {
        reviewedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reviews });
  } catch (error) {
    console.error('Get reviews by admission error:', error);
    res.status(500).json({ error: 'Failed to get doctor reviews' });
  }
};
