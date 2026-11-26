import { createSubscriptionCheckout } from './solution.mjs';
import assert from 'node:assert';

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

assert.strictEqual(url, 'https://checkout.stripe.com/c/pay/cs_test_123');
assert.strictEqual(capturedArgs.mode, 'subscription');
assert.deepStrictEqual(capturedArgs.line_items, [{ price: 'price_123', quantity: 1 }]);
assert.strictEqual(capturedArgs.customer_email, 'customer@example.com');
assert.strictEqual(capturedArgs.success_url, 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}');
assert.strictEqual(capturedArgs.cancel_url, 'https://example.com/pricing');

console.log('OK:', url);
