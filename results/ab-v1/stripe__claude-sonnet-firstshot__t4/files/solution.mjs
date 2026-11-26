/**
 * Creates a Stripe Checkout Session for a monthly subscription.
 *
 * @param {import('stripe').Stripe} stripe - An already-configured Stripe client.
 * @param {{ priceId: string, email: string, baseUrl: string }} params
 * @returns {Promise<string>} The URL the customer should be redirected to.
 */
export async function createSubscriptionCheckout(stripe, { priceId, email, baseUrl }) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer_email: email,
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
  });

  return session.url;
}
