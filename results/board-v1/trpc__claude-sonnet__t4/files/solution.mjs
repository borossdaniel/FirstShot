import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.context().create();

const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const authedProcedure = t.procedure.use(requireUser);

let nextId = 1;
const todos = [];

const greetingRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string().min(1).max(50) }))
    .query(({ input }) => `Hello, ${input.name}!`),
});

const todoRouter = t.router({
  add: authedProcedure
    .input(
      z.object({
        title: z
          .string()
          .trim()
          .min(1)
          .max(100),
        priority: z.enum(['low', 'normal', 'high']).default('normal'),
      })
    )
    .mutation(({ input, ctx }) => {
      const todo = {
        id: nextId++,
        title: input.title,
        priority: input.priority,
        done: false,
        userId: ctx.user.id,
      };
      todos.push(todo);
      const { userId, ...rest } = todo;
      return rest;
    }),

  list: authedProcedure.query(({ ctx }) => {
    return todos
      .filter((todo) => todo.userId === ctx.user.id)
      .map(({ userId, ...rest }) => rest);
  }),

  toggle: authedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input, ctx }) => {
      const todo = todos.find(
        (t) => t.id === input.id && t.userId === ctx.user.id
      );
      if (!todo) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      todo.done = !todo.done;
      const { userId, ...rest } = todo;
      return rest;
    }),
});

export const appRouter = t.router({
  greeting: greetingRouter,
  todo: todoRouter,
});

export const createCaller = t.createCallerFactory(appRouter);
