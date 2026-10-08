import { Prisma } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const service = new SubscriptionsService();

  it('creates a subscription for a new purchase', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'new-subscription' });
    const tx = {
      subscription: { findFirst: jest.fn().mockResolvedValue(null), create },
      plan: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'monthly', durationDays: 30 }),
      },
    } as unknown as Prisma.TransactionClient;
    await service.applyPaidPlan(tx, 'user-1', 'monthly', now);
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        planId: 'monthly',
        status: 'ACTIVE',
        startedAt: now,
        expiresAt: new Date('2026-01-31T00:00:00.000Z'),
      },
    });
  });

  it('extends an unexpired subscription from its existing expiration date', async () => {
    const current = {
      id: 'existing',
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const update = jest.fn().mockResolvedValue({ id: 'existing' });
    const tx = {
      subscription: { findFirst: jest.fn().mockResolvedValue(current), update },
      plan: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'yearly', durationDays: 365 }),
      },
    } as unknown as Prisma.TransactionClient;
    await service.applyPaidPlan(tx, 'user-1', 'yearly', now);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'existing' },
      data: {
        planId: 'yearly',
        expiresAt: new Date('2027-01-02T00:00:00.000Z'),
      },
    });
  });

  it('starts a new period from now when the previous subscription expired', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'new-subscription' });
    const tx = {
      subscription: { findFirst: jest.fn().mockResolvedValue(null), create },
      plan: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'monthly', durationDays: 30 }),
      },
    } as unknown as Prisma.TransactionClient;
    await service.applyPaidPlan(tx, 'user-1', 'monthly', now);
    expect(create.mock.calls[0]?.[0].data.expiresAt).toEqual(
      new Date('2026-01-31T00:00:00.000Z'),
    );
  });
});
