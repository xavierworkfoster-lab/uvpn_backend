import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { VpnService } from './vpn.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';

describe('VpnService', () => {
  const subscriptionFind = jest.fn();
  const deviceFind = jest.fn();
  const serverFind = jest.fn();
  const sessionCount = jest.fn();
  const serverCapacity = jest.fn();
  const sessionCreate = jest.fn();
  const tx = {
    vpnSession: { count: sessionCount, create: sessionCreate },
    vpnServer: { updateMany: serverCapacity },
  };
  const prisma = {
    subscription: { findFirst: subscriptionFind },
    device: { findFirst: deviceFind },
    vpnServer: { findFirst: serverFind },
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  } as unknown as PrismaService;
  const audit = {
    record: jest.fn().mockResolvedValue({}),
  } as unknown as AuditService;
  const service = new VpnService(prisma, audit);
  const dto = { deviceId: 'device-uuid', serverId: 'server-uuid' };

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionFind.mockResolvedValue({
      expiresAt: new Date(Date.now() + 86_400_000),
      plan: { maxDevices: 2 },
    });
    deviceFind.mockResolvedValue({ id: dto.deviceId });
    serverFind.mockResolvedValue({
      id: dto.serverId,
      hostname: 'vpn.example',
      protocol: 'OPENVPN',
      port: 1194,
      maxUsers: 50,
    });
    sessionCount.mockResolvedValue(0);
    serverCapacity.mockResolvedValue({ count: 1 });
    sessionCreate.mockResolvedValue({
      id: 'session-1',
      startedAt: new Date(),
      expiresAt: new Date(),
    });
  });

  it('rejects users without active subscriptions', async () => {
    subscriptionFind.mockResolvedValue(null);
    await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects revoked devices and offline servers', async () => {
    deviceFind.mockResolvedValue(null);
    await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    deviceFind.mockResolvedValue({ id: dto.deviceId });
    serverFind.mockResolvedValue(null);
    await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('enforces session and server limits, then creates an authorized session', async () => {
    sessionCount.mockResolvedValue(2);
    await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    sessionCount.mockResolvedValue(0);
    serverCapacity.mockResolvedValue({ count: 0 });
    await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    serverCapacity.mockResolvedValue({ count: 1 });
    const result = await service.create('user-1', dto);
    expect(result.server.hostname).toBe('vpn.example');
    expect(sessionCreate).toHaveBeenCalledTimes(1);
  });
});
