import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { createSubscriptionCheckout } from './solution.mjs';

// Sanity check that the real stripe package is importable and instantiable
// without needing a live API key for this offline verification.
const realStripeClient = new Stripe('sk_test_dummy');
assert.equal(typeof realStripeClient.checkout.sessions.create, 'function');

// Mock client to verify createSubscriptionCheckout's call shape and return value.
let capturedArgs;
const mockStripe = {
  checkout: {
    sessions: {
      create: async (args) => {
        capturedArgs = args;
        return { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
      },
    },
  },
};

const url = await createSubscriptionCheckout(mockStripe, {
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
assert.match(capturedArgs.success_url, /\{CHECKOUT_SESSION_ID\}/);

console.log('All checks passed.');
