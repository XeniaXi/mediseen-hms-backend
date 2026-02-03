import { PrismaClient } from '@prisma/client';

interface AuditLogData {
  userId?: string;
  hospitalId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export const createAuditLog = async (
  prisma: PrismaClient,
  data: AuditLogData
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        hospitalId: data.hospitalId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        details: data.details ? JSON.parse(JSON.stringify(data.details)) : undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logs shouldn't break the main flow
    console.error('Failed to create audit log:', error);
  }
};
