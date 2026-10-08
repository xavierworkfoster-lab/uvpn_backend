import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';
import { NowPaymentsService } from '../nowpayments/nowpayments.service';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('webhooks/nowpayments')
export class WebhooksController {
  constructor(
    private readonly nowpayments: NowPaymentsService,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}
  @Post()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() body: Record<string, unknown>,
    @Headers('x-nowpayments-sig') signature?: string,
  ) {
    if (!signature || !this.nowpayments.verifyIpn(body, signature))
      throw new UnauthorizedException('Invalid webhook signature');
    const orderId = body.order_id;
    const paymentId = body.payment_id;
    const status = body.payment_status;
    if (
      typeof orderId !== 'string' ||
      (typeof paymentId !== 'string' && typeof paymentId !== 'number') ||
      typeof status !== 'string'
    )
      throw new UnauthorizedException('Invalid webhook payload');
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (
      !payment ||
      (payment.providerPaymentId &&
        payment.providerPaymentId !== String(paymentId))
    )
      throw new UnauthorizedException('Unknown payment');
    const paymentIdOwner = await this.prisma.payment.findUnique({
      where: { providerPaymentId: String(paymentId) },
      select: { id: true },
    });
    if (paymentIdOwner && paymentIdOwner.id !== payment.id)
      throw new UnauthorizedException('Payment ID does not match order');
    const amount =
      typeof body.price_amount === 'string' ||
      typeof body.price_amount === 'number'
        ? Number(body.price_amount)
        : Number.NaN;
    if (
      !Number.isFinite(amount) ||
      Math.round(amount * 100) !==
        Math.round(Number(payment.priceAmount) * 100) ||
      typeof body.price_currency !== 'string' ||
      body.price_currency.toUpperCase() !== payment.priceCurrency.toUpperCase()
    )
      throw new UnauthorizedException('Payment details do not match');
    const eventKey = createHash('sha256')
      .update(this.stableJson(body))
      .digest('hex');
    const mapped = this.mapStatus(status);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            eventType: status,
            eventKey,
            payload: JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'payment.webhook_received',
            targetType: 'payment',
            targetId: payment.id,
            metadata: { status },
          },
        });
        if (mapped === 'FINISHED') {
          const claim = await tx.payment.updateMany({
            where: {
              id: payment.id,
              processedAt: null,
              status: { not: 'FINISHED' },
            },
            data: {
              providerPaymentId: String(paymentId),
              status: 'FINISHED',
              paidAt: new Date(),
              processedAt: new Date(),
              payCurrency:
                typeof body.pay_currency === 'string'
                  ? body.pay_currency
                  : payment.payCurrency,
              payAmount:
                typeof body.pay_amount === 'number'
                  ? body.pay_amount
                  : payment.payAmount,
            },
          });
          if (claim.count) {
            await this.subscriptions.applyPaidPlan(
              tx,
              payment.userId,
              payment.planId,
            );
            await tx.auditLog.create({
              data: {
                action: 'subscription.payment_applied',
                targetType: 'payment',
                targetId: payment.id,
                actorUserId: payment.userId,
                metadata: { planId: payment.planId },
              },
            });
          }
        } else {
          await tx.payment.updateMany({
            where: { id: payment.id, processedAt: null },
            data: {
              status: mapped,
              providerPaymentId: String(paymentId),
              payCurrency:
                typeof body.pay_currency === 'string'
                  ? body.pay_currency
                  : payment.payCurrency,
              payAmount:
                typeof body.pay_amount === 'number'
                  ? body.pay_amount
                  : payment.payAmount,
            },
          });
        }
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        return { received: true };
      throw error;
    }
    return { received: true };
  }
  private stableJson(value: unknown): string {
    if (Array.isArray(value))
      return `[${value.map((entry) => this.stableJson(entry)).join(',')}]`;
    if (value && typeof value === 'object')
      return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([key, entry]) => `${JSON.stringify(key)}:${this.stableJson(entry)}`,
        )
        .join(',')}}`;
    return JSON.stringify(value);
  }
  private mapStatus(
    status: string,
  ): 'WAITING' | 'CONFIRMING' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'FINISHED' {
    switch (status.toLowerCase()) {
      case 'confirming':
      case 'confirmed':
      case 'sending':
        return 'CONFIRMING';
      case 'finished':
        return 'FINISHED';
      case 'failed':
      case 'partially_paid':
      case 'wrong_amount':
        return 'FAILED';
      case 'expired':
        return 'EXPIRED';
      case 'refunded':
        return 'REFUNDED';
      default:
        return 'WAITING';
    }
  }
}
