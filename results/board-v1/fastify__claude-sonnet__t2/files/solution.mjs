import Fastify from 'fastify';

const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string' },
  },
  required: ['id', 'name', 'email'],
};

export function buildApp() {
  const app = Fastify();

  const users = [];
  let nextId = 1;

  app.post('/users', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
        required: ['name', 'email', 'password'],
        additionalProperties: false,
      },
      response: {
        201: userResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { name, email, password } = request.body;
    const user = { id: nextId++, name, email, password };
    users.push(user);
    reply.code(201);
    return user;
  });

  app.get('/users/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', minimum: 1 },
        },
        required: ['id'],
      },
      response: {
        200: userResponseSchema,
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
          required: ['error'],
        },
      },
    },
  }, async (request, reply) => {
    const user = users.find((u) => u.id === request.params.id);
    if (!user) {
      reply.code(404);
      return { error: 'not found' };
    }
    return user;
  });

  app.get('/users', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            users: { type: 'array', items: userResponseSchema },
          },
          required: ['limit', 'users'],
        },
      },
    },
  }, async (request) => {
    const { limit } = request.query;
    return { limit, users: users.slice(0, limit) };
  });

  return app;
}
