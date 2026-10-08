import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  record(
    action: string,
    targetType: string,
    actorUserId?: string,
    targetId?: string,
    metadata?: Record<string, string | number | boolean | null>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        action,
        targetType,
        actorUserId,
        targetId,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonObject } : {}),
      },
    });
  }
}
