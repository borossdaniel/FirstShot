import assert from 'node:assert/strict';
import { createSubscriptionCheckout } from './solution.mjs';

const calls = [];
const mockStripe = {
  checkout: {
    sessions: {
      create: async (params) => {
        calls.push(params);
        return {
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        };
      },
    },
  },
};

const url = await createSubscriptionCheckout(mockStripe, {
  priceId: 'price_abc123',
  email: 'customer@example.com',
  baseUrl: 'https://example.com',
});

assert.equal(url, 'https://checkout.stripe.com/c/pay/cs_test_123');
assert.equal(calls.length, 1);
const params = calls[0];
assert.equal(params.mode, 'subscription');
assert.equal(params.customer_email, 'customer@example.com');
assert.deepEqual(params.line_items, [{ price: 'price_abc123', quantity: 1 }]);
assert.equal(params.success_url, 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}');
assert.equal(params.cancel_url, 'https://example.com/pricing');

console.log('All checks passed.');
