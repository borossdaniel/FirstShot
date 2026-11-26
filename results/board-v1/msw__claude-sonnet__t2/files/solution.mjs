import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export function startMocking() {
  let orderCount = 0;

  const handlers = [
    http.get('https://api.shop.test/products/:id', ({ params }) => {
      const { id } = params;
      if (id === '0') {
        return HttpResponse.json({ error: 'not found' }, { status: 404 });
      }
      return HttpResponse.json({ id, name: `Product ${id}` });
    }),

    http.get('https://api.shop.test/search', ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q');
      return HttpResponse.json({ query, results: [] });
    }),

    http.post('https://api.shop.test/orders', async ({ request }) => {
      const { productId, quantity } = await request.json();
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return HttpResponse.json({ error: 'invalid quantity' }, { status: 400 });
      }
      orderCount += 1;
      return HttpResponse.json(
        { orderId: `ord_${orderCount}`, productId, quantity },
        { status: 201 }
      );
    }),

    http.get('https://api.shop.test/health', () => {
      return HttpResponse.error();
    }),
  ];

  const server = setupServer(...handlers);
  server.listen({ onUnhandledFrame: 'error' });
  return server;
}
