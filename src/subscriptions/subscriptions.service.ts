import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  async applyPaidPlan(
    tx: Prisma.TransactionClient,
    userId: string,
    planId: string,
    now = new Date(),
  ) {
    const [current, plan] = await Promise.all([
      tx.subscription.findFirst({
        where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
        orderBy: { expiresAt: 'desc' },
      }),
      tx.plan.findUniqueOrThrow({ where: { id: planId } }),
    ]);
    const expiresAt = new Date(
      Math.max(now.getTime(), current?.expiresAt.getTime() ?? 0) +
        plan.durationDays * 86_400_000,
    );
    if (current)
      return tx.subscription.update({
        where: { id: current.id },
        data: { expiresAt, planId: plan.id },
      });
    return tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        startedAt: now,
        expiresAt,
      },
    });
  }
}
