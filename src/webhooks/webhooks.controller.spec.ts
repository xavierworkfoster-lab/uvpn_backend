import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NowPaymentsService } from '../nowpayments/nowpayments.service';
import { WebhooksController } from './webhooks.controller';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('WebhooksController', () => {
  const payment = {
    id: 'payment-1',
    userId: 'user-1',
    planId: 'plan-1',
    orderId: 'order-1',
    providerPaymentId: null,
    priceAmount: '12.50',
    priceCurrency: 'USD',
    payCurrency: null,
    payAmount: null,
    processedAt: null,
  };
  const eventCreate = jest.fn();
  const paymentUpdate = jest.fn().mockResolvedValue({ count: 1 });
  const subscriptionFind = jest.fn().mockResolvedValue(null);
  const subscriptionCreate = jest.fn().mockResolvedValue({});
  const tx = {
    paymentEvent: { create: eventCreate },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    payment: { updateMany: paymentUpdate },
    subscription: { findFirst: subscriptionFind, create: subscriptionCreate },
    plan: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ durationDays: 30 }),
    },
  };
  const prisma = {
    payment: {
      findUnique: jest.fn(
        async (args: {
          where: { orderId?: string; providerPaymentId?: string };
        }) => (args.where.orderId ? payment : null),
      ),
    },
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  } as unknown as PrismaService;
  const nowpayments = { verifyIpn: jest.fn() } as unknown as NowPaymentsService;
  let controller: WebhooksController;

  beforeEach(() => {
    jest.clearAllMocks();
    eventCreate.mockResolvedValue({});
    paymentUpdate.mockResolvedValue({ count: 1 });
    subscriptionFind.mockResolvedValue(null);
    (prisma.payment.findUnique as jest.Mock).mockImplementation(
      async (args: {
        where: { orderId?: string; providerPaymentId?: string };
      }) => (args.where.orderId ? payment : null),
    );
    controller = new WebhooksController(
      nowpayments,
      prisma,
      new SubscriptionsService(),
    );
  });

  const body = {
    payment_id: 123,
    payment_status: 'finished',
    order_id: 'order-1',
    price_amount: 12.5,
    price_currency: 'usd',
  };

  it('rejects IPNs with invalid signatures', async () => {
    (nowpayments.verifyIpn as jest.Mock).mockReturnValue(false);
    await expect(
      controller.receive(body, 'bad-signature'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('applies a successful payment once and acknowledges duplicate notifications', async () => {
    (nowpayments.verifyIpn as jest.Mock).mockReturnValue(true);
    await expect(controller.receive(body, 'valid-signature')).resolves.toEqual({
      received: true,
    });
    expect(subscriptionCreate).toHaveBeenCalledTimes(1);
    eventCreate.mockRejectedValueOnce({ code: 'P2002' });
    await expect(controller.receive(body, 'valid-signature')).resolves.toEqual({
      received: true,
    });
    expect(subscriptionCreate).toHaveBeenCalledTimes(1);
  });
});
