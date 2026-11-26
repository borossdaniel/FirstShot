import { Hono } from 'hono';

export const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));
app.post('/echo', async (c) => c.json(await c.req.json(), 201));
app.use('/users/*', async (c, next) => {
  if (c.req.header('x-api-key') !== 'secret') return c.json({ error: 'unauthorized' }, 401);
  await next();
});
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
