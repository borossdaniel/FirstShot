import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.post('/echo', async (c) => {
  const body = await c.req.json()
  return c.json(body, 201)
})

app.use('/users/:id', async (c, next) => {
  if (c.req.header('x-api-key') !== 'secret') {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
})

app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }))

app.notFound((c) => c.json({ error: 'not found' }, 404))

export { app }
