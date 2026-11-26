import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.context().create();

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in first' });
  return next({ ctx: { user: ctx.user } });
});

const todos = [];
let nextId = 1;

export const appRouter = t.router({
  greeting: t.router({
    hello: t.procedure
      .input(z.object({ name: z.string().min(1).max(50) }))
      .query(({ input }) => `Hello, ${input.name}!`),
  }),
  todo: t.router({
    add: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(1).max(100),
        priority: z.enum(['low', 'normal', 'high']).default('normal'),
      }))
      .mutation(({ input, ctx }) => {
        const todo = { id: nextId++, title: input.title, priority: input.priority, done: false, owner: ctx.user.id };
        todos.push(todo);
        return todo;
      }),
    list: protectedProcedure.query(({ ctx }) => todos.filter((x) => x.owner === ctx.user.id)),
    toggle: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) => {
        const todo = todos.find((x) => x.id === input.id && x.owner === ctx.user.id);
        if (!todo) throw new TRPCError({ code: 'NOT_FOUND', message: `Todo ${input.id} not found` });
        todo.done = !todo.done;
        return todo;
      }),
  }),
});

export const createCaller = t.createCallerFactory(appRouter);
