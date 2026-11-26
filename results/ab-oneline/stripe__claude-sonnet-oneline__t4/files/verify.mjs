import assert from 'node:assert/strict';
import { createSubscriptionCheckout } from './solution.mjs';

let receivedArgs;
const fakeStripe = {
  checkout: {
    sessions: {
      create: async (args) => {
        receivedArgs = args;
        return { url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
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
assert.equal(receivedArgs.mode, 'subscription');
assert.deepEqual(receivedArgs.line_items, [{ price: 'price_123', quantity: 1 }]);
assert.equal(receivedArgs.customer_email, 'customer@example.com');
assert.equal(receivedArgs.success_url, 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}');
assert.equal(receivedArgs.cancel_url, 'https://example.com/pricing');

console.log('All checks passed.');
