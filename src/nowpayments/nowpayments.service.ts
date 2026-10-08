import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
type CreateInvoiceInput = {
  price_amount: number;
  price_currency: string;
  order_id: string;
  order_description: string;
  ipn_callback_url?: string;
  success_url?: string;
  cancel_url?: string;
};
export type ProviderInvoice = {
  id: string | number;
  invoice_url: string;
  order_id?: string;
};
@Injectable()
export class NowPaymentsService {
  constructor(private readonly config: ConfigService) {}
  async createInvoice(input: CreateInvoiceInput): Promise<ProviderInvoice> {
    const response = await fetch(
      `${this.config.get('NOWPAYMENTS_API_URL', 'https://api.nowpayments.io')}/v1/invoice`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.getOrThrow<string>('NOWPAYMENTS_API_KEY'),
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Payment provider is temporarily unavailable',
      );
    return (await response.json()) as ProviderInvoice;
  }
  verifyIpn(payload: Record<string, unknown>, signature: string): boolean {
    const secret = this.config.getOrThrow<string>('NOWPAYMENTS_IPN_SECRET');
    const canonical = JSON.stringify(this.sort(payload));
    const expected = createHmac('sha512', secret)
      .update(canonical)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
  private sort(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.sort(entry));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, this.sort(entry)]),
      );
    return value;
  }
}
