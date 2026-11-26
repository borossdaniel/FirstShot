import { rest } from 'msw';
import { setupServer } from 'msw/node';

// MSW 1.x style handlers (rest + res(ctx...)).
const API = 'https://api.shop.test';
let orderCount = 0;

export const handlers = [
  rest.get(`${API}/products/:id`, (req, res, ctx) => {
    if (req.params.id === '0') return res(ctx.status(404), ctx.json({ error: 'not found' }));
    return res(ctx.json({ id: req.params.id, name: `Product ${req.params.id}` }));
  }),
  rest.get(`${API}/search`, (req, res, ctx) => res(ctx.json({ query: req.url.searchParams.get('q'), results: [] }))),
  rest.post(`${API}/orders`, async (req, res, ctx) => {
    const { productId, quantity } = await req.json();
    if (!Number.isInteger(quantity) || quantity < 1) return res(ctx.status(400), ctx.json({ error: 'invalid quantity' }));
    orderCount += 1;
    return res(ctx.status(201), ctx.json({ orderId: `ord_${orderCount}`, productId, quantity }));
  }),
  rest.get(`${API}/health`, (req, res) => res.networkError('down')),
];

export function startMocking() {
  const server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: 'error' });
  return server;
}
