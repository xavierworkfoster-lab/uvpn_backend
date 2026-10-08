import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ApiTags } from '@nestjs/swagger';
@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
  }
}
