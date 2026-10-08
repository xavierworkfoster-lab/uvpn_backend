import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PlansModule } from './plans/plans.module';
import { AccountModule } from './account/account.module';
import { DevicesModule } from './devices/devices.module';
import { PaymentsModule } from './payments/payments.module';
import { NowPaymentsModule } from './nowpayments/nowpayments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { VpnModule } from './vpn/vpn.module';
import { AdminModule } from './admin/admin.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './common/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, string | undefined>) => {
        for (const key of [
          'DATABASE_URL',
          'JWT_ACCESS_SECRET',
          'JWT_REFRESH_SECRET',
        ]) {
          if (!env[key])
            throw new Error(`Missing required environment variable: ${key}`);
        }
        if (
          env.JWT_ACCESS_SECRET!.length < 32 ||
          env.JWT_REFRESH_SECRET!.length < 32 ||
          env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET
        )
          throw new Error(
            'JWT secrets must be distinct values of at least 32 characters',
          );
        if (
          env.JWT_ACCESS_SECRET!.startsWith('replace-with-') ||
          env.JWT_REFRESH_SECRET!.startsWith('replace-with-')
        )
          throw new Error(
            'Replace the JWT placeholder secrets before starting the API',
          );
        if (
          env.NODE_ENV === 'production' &&
          env.PUBLIC_API_URL &&
          !env.PUBLIC_API_URL.startsWith('https://')
        )
          throw new Error('PUBLIC_API_URL must use HTTPS in production');
        return env;
      },
    }),

    DatabaseModule,
    AuditModule,

    UsersModule,

    AuthModule,
    HealthModule,
    PlansModule,
    AccountModule,
    DevicesModule,
    PaymentsModule,
    NowPaymentsModule,
    WebhooksModule,
    VpnModule,
    AdminModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
