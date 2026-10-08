import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateDeviceDto } from './device.dto';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async register(userId: string, dto: CreateDeviceDto) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
    if (!subscription)
      throw new ForbiddenException('An active subscription is required');
    const existing = await this.prisma.device.findUnique({
      where: { userId_deviceId: { userId, deviceId: dto.deviceId } },
    });
    const count = await this.prisma.device.count({
      where: { userId, status: 'ACTIVE' },
    });
    if (!existing && count >= subscription.plan.maxDevices)
      throw new ForbiddenException('Plan device limit reached');
    const device = await this.prisma.device.upsert({
      where: { userId_deviceId: { userId, deviceId: dto.deviceId } },
      create: { deviceId: dto.deviceId, deviceName: dto.deviceName, userId },
      update: {
        deviceName: dto.deviceName,
        status: 'ACTIVE',
        revokedAt: null,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    await this.audit.record('device.registered', 'device', userId, device.id);
    return device;
  }

  async revoke(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.device.updateMany({
        where: { id, userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      if (!result.count) throw new NotFoundException('Device not found');
      const sessions = await tx.vpnSession.findMany({
        where: { deviceId: id, status: 'ACTIVE' },
        select: { serverId: true },
      });
      await tx.vpnSession.updateMany({
        where: { deviceId: id, status: 'ACTIVE' },
        data: { status: 'CLOSED' },
      });
      const counts = new Map<string, number>();
      for (const session of sessions)
        counts.set(session.serverId, (counts.get(session.serverId) ?? 0) + 1);
      for (const [serverId, count] of counts)
        await tx.vpnServer.update({
          where: { id: serverId },
          data: { currentUsers: { decrement: count } },
        });
    });
    await this.audit.record('device.revoked', 'device', userId, id);
    return { success: true };
  }
}
