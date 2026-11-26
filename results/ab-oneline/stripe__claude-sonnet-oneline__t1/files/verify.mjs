import assert from 'node:assert/strict';
import { createSubscriptionCheckout } from './solution.mjs';

const fakeStripe = {
  checkout: {
    sessions: {
      create: async (params) => {
        fakeStripe._lastParams = params;
        return { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
      },
    },
  },
};

const result = await createSubscriptionCheckout(fakeStripe, {
  priceId: 'price_abc123',
  email: 'customer@example.com',
  baseUrl: 'https://example.com',
});

const params = fakeStripe._lastParams;

assert.equal(params.mode, 'subscription');
assert.equal(params.line_items.length, 1);
assert.equal(params.line_items[0].price, 'price_abc123');
assert.equal(params.line_items[0].quantity, 1);
assert.equal(params.customer_email, 'customer@example.com');
assert.equal(params.cancel_url, 'https://example.com/pricing');
assert.ok(params.success_url.startsWith('https://example.com/success'));
assert.ok(params.success_url.includes('{CHECKOUT_SESSION_ID}'));
assert.equal(result, 'https://checkout.stripe.com/c/pay/cs_test_123');

console.log('All checks passed.');
console.log('Returned URL:', result);
console.log('success_url template:', params.success_url);
