import Fastify from 'fastify';

// Shorthand schemas (no type: object / properties) for params and querystring.
const publicUser = {
  type: 'object',
  properties: { id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' } },
};

export function buildApp() {
  const app = Fastify();
  const users = new Map();
  let nextId = 1;

  app.post('/users', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
      response: { 201: publicUser },
    },
  }, async (request, reply) => {
    const user = { id: nextId++, ...request.body };
    users.set(user.id, user);
    reply.code(201).send(user);
  });

  app.get('/users/:id', {
    schema: { params: { id: { type: 'integer', minimum: 1 } }, response: { 200: publicUser } },
  }, async (request, reply) => {
    const user = users.get(request.params.id);
    if (!user) return reply.code(404).send({ error: 'not found' });
    return user;
  });

  app.get('/users', {
    schema: { querystring: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 } } },
  }, async (request) => {
    const { limit } = request.query;
    return { limit, users: [...users.values()].slice(0, limit).map(({ password, ...u }) => u) };
  });

  return app;
}
