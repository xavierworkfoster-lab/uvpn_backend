import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../database/prisma.service';
import { NowPaymentsService } from '../nowpayments/nowpayments.service';
import { AuditService } from '../common/audit/audit.service';

describe('PaymentsService', () => {
  const payment = {
    id: 'payment-1',
    status: 'WAITING',
    priceAmount: new Prisma.Decimal('12.50'),
    priceCurrency: 'USD',
  };
  const paymentCreateMock = jest.fn();
  const prisma = {
    plan: { findFirst: jest.fn() },
    payment: { create: paymentCreateMock, update: jest.fn() },
  } as unknown as PrismaService;
  const createInvoiceMock = jest.fn().mockResolvedValue({
    id: 'invoice-1',
    invoice_url: 'https://pay.example/invoice',
  });
  const provider = {
    createInvoice: createInvoiceMock,
  } as unknown as NowPaymentsService;
  const config = {
    get: jest.fn((key: string) =>
      key === 'PUBLIC_API_URL' ? 'https://api.example' : undefined,
    ),
  } as never;
  const audit = {
    record: jest.fn().mockResolvedValue({}),
  } as unknown as AuditService;
  const service = new PaymentsService(prisma, provider, config, audit);

  beforeEach(() => jest.clearAllMocks());

  it('uses the database plan price and returns the hosted invoice link', async () => {
    (prisma.plan.findFirst as jest.Mock).mockResolvedValue({
      id: 'plan-1',
      name: 'Monthly',
      priceUsd: new Prisma.Decimal('12.50'),
      isActive: true,
    });
    (prisma.payment.create as jest.Mock).mockResolvedValue(payment);
    (prisma.payment.update as jest.Mock).mockResolvedValue(payment);
    const result = await service.create('user-1', 'plan-1');
    expect(createInvoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ price_amount: 12.5, price_currency: 'usd' }),
    );
    expect(result.paymentUrl).toBe('https://pay.example/invoice');
    expect(result).not.toHaveProperty('clientPrice');
  });

  it('rejects a missing or inactive plan', async () => {
    (prisma.plan.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.create('user-1', 'missing-plan'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(paymentCreateMock).not.toHaveBeenCalled();
  });
});
