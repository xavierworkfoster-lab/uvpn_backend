import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateSessionDto } from './create-session.dto';

@Injectable()
export class VpnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  servers() {
    return this.prisma.vpnServer.findMany({
      where: { status: 'ONLINE' },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        hostname: true,
        protocol: true,
        port: true,
      },
      orderBy: [{ country: 'asc' }, { city: 'asc' }],
    });
  }

  sessions(userId: string) {
    return this.prisma.vpnSession.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        deviceId: true,
        serverId: true,
        startedAt: true,
        expiresAt: true,
        server: {
          select: { name: true, hostname: true, protocol: true, port: true },
        },
      },
    });
  }

  async create(userId: string, dto: CreateSessionDto) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
    if (!subscription)
      throw new ForbiddenException('An active subscription is required');
    const [device, server] = await Promise.all([
      this.prisma.device.findFirst({
        where: { id: dto.deviceId, userId, status: 'ACTIVE' },
      }),
      this.prisma.vpnServer.findFirst({
        where: { id: dto.serverId, status: 'ONLINE' },
      }),
    ]);
    if (!device) throw new ForbiddenException('Active device required');
    if (!server) throw new NotFoundException('VPN server is unavailable');
    const session = await this.prisma.$transaction(
      async (tx) => {
        const active = await tx.vpnSession.count({
          where: {
            userId,
            status: 'ACTIVE',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        });
        if (active >= subscription.plan.maxDevices)
          throw new ConflictException('Plan session limit reached');
        const capacity = await tx.vpnServer.updateMany({
          where: {
            id: server.id,
            status: 'ONLINE',
            currentUsers: { lt: server.maxUsers },
          },
          data: { currentUsers: { increment: 1 } },
        });
        if (!capacity.count)
          throw new ConflictException('VPN server is at capacity');
        return tx.vpnSession.create({
          data: {
            userId,
            deviceId: device.id,
            serverId: server.id,
            expiresAt: subscription.expiresAt,
          },
          select: { id: true, startedAt: true, expiresAt: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    await this.audit.record(
      'vpn.session_created',
      'vpn_session',
      userId,
      session.id,
      { serverId: server.id, deviceId: device.id },
    );
    return {
      ...session,
      server: {
        id: server.id,
        hostname: server.hostname,
        protocol: server.protocol,
        port: server.port,
      },
    };
  }

  async close(userId: string, id: string) {
    const session = await this.prisma.vpnSession.findFirst({
      where: { id, userId, status: 'ACTIVE' },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.vpnSession.updateMany({
        where: { id, userId, status: 'ACTIVE' },
        data: { status: 'CLOSED' },
      });
      if (!claimed.count) throw new NotFoundException('Session not found');
      await tx.vpnServer.update({
        where: { id: session.serverId },
        data: { currentUsers: { decrement: 1 } },
      });
    });
    await this.audit.record('vpn.session_closed', 'vpn_session', userId, id);
    return { success: true };
  }
}
