import { runCheck, expectInstalled, importSolution, importFromWorkspace, startMockServer, expect, expectEqual } from '../../src/check-helpers.js';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'stripe', 23);
  const mod = await importFromWorkspace(ws, 'stripe');
  const Stripe = mod.default ?? mod.Stripe;
  const m = await importSolution(ws);
  expect(typeof m.createSubscriptionCheckout === 'function', 'createSubscriptionCheckout is not exported');

  const mock = await startMockServer((req) => {
    if (req.method === 'POST' && req.path.startsWith('/v1/checkout/sessions')) {
      return { json: { id: 'cs_test_123', object: 'checkout.session', url: 'https://checkout.stripe.com/c/pay/cs_test_123', mode: req.body.mode } };
    }
    return { status: 404, json: { error: { type: 'invalid_request_error', message: `Unrecognized request URL (${req.method}: ${req.path})` } } };
  });
  try {
    const stripe = new Stripe('sk_test_123', { host: '127.0.0.1', port: mock.port, protocol: 'http', maxNetworkRetries: 0 });
    const url = await m.createSubscriptionCheckout(stripe, { priceId: 'price_123', email: 'ada@example.com', baseUrl: 'https://shop.test' });
    const req = mock.requests.find((r) => r.path.startsWith('/v1/checkout/sessions'));
    expect(req, `no Checkout Session was created (requests: ${mock.requests.map((r) => r.method + ' ' + r.path).join(', ') || 'none'})`);
    const b = req.body;
    expectEqual(b.mode, 'subscription', 'mode');
    expectEqual(b['line_items[0][price]'], 'price_123', 'line_items[0][price]');
    expectEqual(b['line_items[0][quantity]'], '1', 'line_items[0][quantity]');
    expectEqual(b.customer_email, 'ada@example.com', 'customer_email');
    expect((b.success_url || '').startsWith('https://shop.test/success'), `success_url should start with https://shop.test/success, got ${b.success_url}`);
    expect((b.success_url || '').includes('{CHECKOUT_SESSION_ID}'), `success_url must carry the session id so the success page can look it up (Stripe's {CHECKOUT_SESSION_ID} template); got ${b.success_url}`);
    expectEqual(b.cancel_url, 'https://shop.test/pricing', 'cancel_url');
    expectEqual(url, 'https://checkout.stripe.com/c/pay/cs_test_123', 'returned redirect URL');
  } finally {
    await mock.close();
  }
  return `stripe@${version}: subscription Checkout Session correct`;
});
