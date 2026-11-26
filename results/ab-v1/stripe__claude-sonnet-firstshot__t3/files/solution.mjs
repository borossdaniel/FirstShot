/**
 * Creates a Stripe Checkout Session for a monthly subscription to `priceId`.
 *
 * @param {import('stripe').Stripe} stripe - an already-configured Stripe client
 * @param {{ priceId: string, email: string, baseUrl: string }} options
 * @returns {Promise<string>} the URL to redirect the customer to
 */
export async function createSubscriptionCheckout(stripe, { priceId, email, baseUrl }) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
  });

  return session.url;
}
