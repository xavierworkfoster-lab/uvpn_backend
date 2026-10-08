import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
@Controller('account')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('account')
export class AccountController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async account(@CurrentUser() user: AuthUser) {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        subscriptions: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
          orderBy: { expiresAt: 'desc' },
          take: 1,
          include: { plan: { select: { name: true } } },
        },
      },
    });
    const subscription = record.subscriptions[0];
    return {
      user: { id: record.id, email: record.email, role: record.role },
      subscription: subscription
        ? {
            active: true,
            plan: subscription.plan.name,
            expiresAt: subscription.expiresAt,
          }
        : { active: false, plan: null, expiresAt: null },
    };
  }
  @Get('subscription') async subscription(@CurrentUser() user: AuthUser) {
    const s = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: { plan: { select: { name: true } } },
      orderBy: { expiresAt: 'desc' },
    });
    return {
      active: Boolean(s),
      plan: s?.plan.name ?? null,
      expiresAt: s?.expiresAt ?? null,
    };
  }
  @Get('devices') async devices(@CurrentUser() user: AuthUser) {
    return this.prisma.device.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        revokedAt: true,
      },
    });
  }
}
