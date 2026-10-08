import { ForbiddenException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';

describe('DevicesService', () => {
  const subscriptionFind = jest.fn();
  const prisma = {
    subscription: { findFirst: subscriptionFind },
  } as unknown as PrismaService;
  const audit = { record: jest.fn() } as unknown as AuditService;
  const service = new DevicesService(prisma, audit);

  beforeEach(() => jest.clearAllMocks());

  it('requires an active subscription before registering a device', async () => {
    subscriptionFind.mockResolvedValue(null);
    await expect(
      service.register('user-1', {
        deviceId: 'device-123456',
        deviceName: 'PC',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
