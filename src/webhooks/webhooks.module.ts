import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentsModule } from '../payments/payments.module';
import { NowPaymentsModule } from '../nowpayments/nowpayments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
@Module({
  imports: [PaymentsModule, NowPaymentsModule, SubscriptionsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
