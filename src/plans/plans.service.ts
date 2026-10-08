import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        priceUsd: true,
        durationDays: true,
        maxDevices: true,
      },
      orderBy: { priceUsd: 'asc' },
    });
  }
}
