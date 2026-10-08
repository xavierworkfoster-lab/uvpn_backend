import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import {
  CreatePlanDto,
  CreateServerDto,
  UpdatePlanDto,
  UpdateServerDto,
  UserStatusDto,
} from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  users() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  payments() {
    return this.prisma.payment.findMany({
      select: {
        id: true,
        userId: true,
        planId: true,
        provider: true,
        priceAmount: true,
        priceCurrency: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  subscriptions() {
    return this.prisma.subscription.findMany({
      include: {
        user: { select: { id: true, email: true } },
        plan: { select: { id: true, name: true } },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  async createPlan(actorId: string, dto: CreatePlanDto) {
    const plan = await this.prisma.plan.create({ data: dto });
    await this.audit.record('admin.plan_created', 'plan', actorId, plan.id);
    return plan;
  }
  async updatePlan(actorId: string, id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.update({ where: { id }, data: dto });
    await this.audit.record('admin.plan_updated', 'plan', actorId, id);
    return plan;
  }
  async createServer(actorId: string, dto: CreateServerDto) {
    const server = await this.prisma.vpnServer.create({
      data: dto,
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        hostname: true,
        protocol: true,
        port: true,
        status: true,
      },
    });
    await this.audit.record(
      'admin.vpn_server_created',
      'vpn_server',
      actorId,
      server.id,
    );
    return server;
  }
  async updateServer(actorId: string, id: string, dto: UpdateServerDto) {
    const server = await this.prisma.vpnServer.update({
      where: { id },
      data: dto,
    });
    await this.audit.record(
      'admin.vpn_server_updated',
      'vpn_server',
      actorId,
      id,
    );
    return server;
  }
  async setUserStatus(actorId: string, id: string, dto: UserStatusDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, email: true, status: true },
    });
    if (dto.status !== 'ACTIVE')
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    await this.audit.record('admin.user_status_changed', 'user', actorId, id, {
      status: dto.status,
    });
    return user;
  }
}
