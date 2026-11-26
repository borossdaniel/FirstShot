import assert from 'node:assert/strict';
import { createSubscriptionCheckout } from './solution.mjs';

let capturedArgs;
const fakeStripe = {
  checkout: {
    sessions: {
      create: async (args) => {
        capturedArgs = args;
        return { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
      },
    },
  },
};

const url = await createSubscriptionCheckout(fakeStripe, {
  priceId: 'price_123',
  email: 'customer@example.com',
  baseUrl: 'https://example.com',
});

assert.equal(url, 'https://checkout.stripe.com/c/pay/cs_test_123');
assert.equal(capturedArgs.mode, 'subscription');
assert.deepEqual(capturedArgs.line_items, [{ price: 'price_123', quantity: 1 }]);
assert.equal(capturedArgs.customer_email, 'customer@example.com');
assert.equal(capturedArgs.success_url, 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}');
assert.equal(capturedArgs.cancel_url, 'https://example.com/pricing');
assert.ok(capturedArgs.success_url.includes('{CHECKOUT_SESSION_ID}'), 'success_url must let the success page recover the Checkout Session id');

console.log('All checks passed.');
console.log('Redirect URL:', url);
