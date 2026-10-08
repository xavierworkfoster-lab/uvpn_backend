import { createHmac } from 'node:crypto';
import { NowPaymentsService } from './nowpayments.service';

describe('NowPaymentsService', () => {
  const service = new NowPaymentsService({
    getOrThrow: () => 'ipn-secret',
  } as never);
  it('accepts a valid sorted HMAC-SHA512 IPN signature', () => {
    const payload = {
      payment_status: 'finished',
      order_id: 'order-1',
      payment_id: 123,
    };
    const canonical = JSON.stringify({
      order_id: 'order-1',
      payment_id: 123,
      payment_status: 'finished',
    });
    const signature = createHmac('sha512', 'ipn-secret')
      .update(canonical)
      .digest('hex');
    expect(service.verifyIpn(payload, signature)).toBe(true);
    expect(service.verifyIpn(payload, '00'.repeat(64))).toBe(false);
  });
});
