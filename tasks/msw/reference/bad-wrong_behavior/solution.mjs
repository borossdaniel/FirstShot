import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const API = 'https://api.shop.test';
let orderCount = 0;

export const handlers = [
  http.get(`${API}/products/:id`, ({ params }) => {
    if (params.id === '0') return HttpResponse.json({ error: 'not found' }, { status: 404 });
    return HttpResponse.json({ id: params.id, name: `Product ${params.id}` });
  }),

  http.get(`${API}/search`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q');
    return HttpResponse.json({ query: q, results: [] });
  }),

  http.post(`${API}/orders`, async ({ request }) => {
    const { productId, quantity } = await request.json();
    if (!Number.isInteger(quantity) || quantity < 1) {
      return HttpResponse.json({ error: 'invalid quantity' }, { status: 400 });
    }
    orderCount += 1;
    return HttpResponse.json({ orderId: `ord_${orderCount}`, productId, quantity }, { status: 201 });
  }),

  http.get(`${API}/health`, () => HttpResponse.error()),
];

export function startMocking() {
  const server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: 'error' });
  return server;
}
