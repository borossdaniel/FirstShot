export async function createSubscriptionCheckout(stripe, { priceId, email, baseUrl }) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    success_url: `${baseUrl}/success`,
    cancel_url: `${baseUrl}/pricing`,
  });
  return session.url;
}
