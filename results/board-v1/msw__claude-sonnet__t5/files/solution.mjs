import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const BASE_URL = 'https://api.shop.test';

export function startMocking() {
  let orderCount = 0;

  const handlers = [
    http.get(`${BASE_URL}/products/:id`, ({ params }) => {
      const { id } = params;

      if (id === '0') {
        return HttpResponse.json({ error: 'not found' }, { status: 404 });
      }

      return HttpResponse.json({ id, name: `Product ${id}` });
    }),

    http.get(`${BASE_URL}/search`, ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';

      return HttpResponse.json({ query, results: [] });
    }),

    http.post(`${BASE_URL}/orders`, async ({ request }) => {
      const { productId, quantity } = await request.json();

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return HttpResponse.json({ error: 'invalid quantity' }, { status: 400 });
      }

      orderCount += 1;

      return HttpResponse.json(
        { orderId: `ord_${orderCount}`, productId, quantity },
        { status: 201 },
      );
    }),

    http.get(`${BASE_URL}/health`, () => {
      return HttpResponse.error();
    }),
  ];

  const server = setupServer(...handlers);

  server.listen({ onUnhandledFrame: 'error' });

  return server;
}
