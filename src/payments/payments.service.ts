import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { NowPaymentsService } from '../nowpayments/nowpayments.service';
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: NowPaymentsService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}
  async create(userId: string, planId: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    const orderId = randomUUID();
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId,
        provider: 'NOWPAYMENTS',
        orderId,
        priceAmount: plan.priceUsd,
        priceCurrency: 'USD',
      },
    });
    await this.audit.record('payment.created', 'payment', userId, payment.id, {
      planId,
    });
    try {
      const publicApiUrl = this.config.get<string>('PUBLIC_API_URL');
      const external = await this.provider.createInvoice({
        price_amount: Number(plan.priceUsd),
        price_currency: 'usd',
        order_id: orderId,
        order_description: `${plan.name} subscription`,
        ...(publicApiUrl
          ? {
              ipn_callback_url: `${publicApiUrl.replace(/\/$/, '')}/api/v1/webhooks/nowpayments`,
            }
          : {}),
      });
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerInvoiceId: String(external.id) },
      });
      return {
        id: updated.id,
        status: updated.status,
        priceAmount: updated.priceAmount,
        priceCurrency: updated.priceCurrency,
        paymentUrl: external.invoice_url,
        orderId,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Could not create payment with provider',
      );
    }
  }
  async get(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, userId },
      select: {
        id: true,
        planId: true,
        provider: true,
        orderId: true,
        priceAmount: true,
        priceCurrency: true,
        payCurrency: true,
        payAmount: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
  history(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      select: {
        id: true,
        planId: true,
        priceAmount: true,
        priceCurrency: true,
        status: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
