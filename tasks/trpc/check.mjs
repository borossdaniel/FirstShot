import { runCheck, expectInstalled, importSolution, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';

const pick = (o) => (o && typeof o === 'object' ? { id: o.id, title: o.title, priority: o.priority, done: o.done } : o);

async function ok(fn, what) {
  try {
    return await fn();
  } catch (e) {
    fail('wrong_behavior', `${what} threw: ${e?.code ? e.code + ' ' : ''}${String(e?.message || e).split('\n')[0].slice(0, 200)}`);
  }
}

async function rejects(fn, code, what) {
  let err = null;
  let value;
  try {
    value = await fn();
  } catch (e) {
    err = e;
  }
  expect(err, `${what} should fail with ${code}, but it returned ${JSON.stringify(value)?.slice(0, 120)}`);
  expect(err.code === code, `${what} should fail with tRPC error code ${code}, got ${err.code ?? err.name}: ${String(err.message).split('\n')[0].slice(0, 120)}`);
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, '@trpc/server', 11);
  expectInstalled(ws, 'zod');
  const m = await importSolution(ws);
  expect(m.appRouter, '`appRouter` is not exported');
  expect(typeof m.createCaller === 'function', '`createCaller` is not exported');

  let anon, ada, bob;
  try {
    anon = await m.createCaller({ user: null });
    ada = await m.createCaller({ user: { id: 'ada' } });
    bob = await m.createCaller({ user: { id: 'bob' } });
  } catch (e) {
    fail('crash', `createCaller(ctx) threw: ${firstLine(e)}`);
  }
  expect(typeof anon?.greeting?.hello === 'function', 'createCaller(ctx) did not return a caller with greeting.hello');

  expectEqual(await ok(() => anon.greeting.hello({ name: 'Ada' }), 'greeting.hello({ name: "Ada" })'), 'Hello, Ada!', 'greeting.hello({ name: "Ada" })');
  await rejects(() => anon.greeting.hello({ name: '' }), 'BAD_REQUEST', 'greeting.hello({ name: "" })');
  await rejects(() => anon.greeting.hello({}), 'BAD_REQUEST', 'greeting.hello({})');

  await rejects(() => anon.todo.add({ title: 'Buy milk' }), 'UNAUTHORIZED', 'todo.add without a user');
  await rejects(() => anon.todo.list(), 'UNAUTHORIZED', 'todo.list without a user');

  let t = await ok(() => ada.todo.add({ title: '  Buy milk  ' }), 'todo.add({ title: "  Buy milk  " })');
  expectEqual(pick(t), { id: 1, title: 'Buy milk', priority: 'normal', done: false }, 'todo.add({ title: "  Buy milk  " })');
  t = await ok(() => ada.todo.add({ title: 'Ship it', priority: 'high' }), 'todo.add with priority high');
  expectEqual(pick(t), { id: 2, title: 'Ship it', priority: 'high', done: false }, 'todo.add({ title: "Ship it", priority: "high" })');
  await rejects(() => ada.todo.add({ title: '   ' }), 'BAD_REQUEST', 'todo.add with a blank title');
  await rejects(() => ada.todo.add({ title: 'x'.repeat(101) }), 'BAD_REQUEST', 'todo.add with a 101-character title');
  await rejects(() => ada.todo.add({ title: 'Panic', priority: 'urgent' }), 'BAD_REQUEST', 'todo.add with priority "urgent"');
  t = await ok(() => bob.todo.add({ title: 'Bob task' }), "bob's todo.add");
  expectEqual(pick(t), { id: 3, title: 'Bob task', priority: 'normal', done: false }, "bob's todo.add");

  const list = await ok(() => ada.todo.list(), 'todo.list');
  expect(Array.isArray(list), `todo.list should return an array, got ${JSON.stringify(list)?.slice(0, 120)}`);
  expectEqual(list.map(pick), [
    { id: 1, title: 'Buy milk', priority: 'normal', done: false },
    { id: 2, title: 'Ship it', priority: 'high', done: false },
  ], "ada's todo.list (only her own todos)");

  t = await ok(() => ada.todo.toggle({ id: 1 }), 'todo.toggle({ id: 1 })');
  expectEqual(pick(t), { id: 1, title: 'Buy milk', priority: 'normal', done: true }, 'todo.toggle({ id: 1 })');
  await rejects(() => bob.todo.toggle({ id: 1 }), 'NOT_FOUND', "bob toggling ada's todo");
  await rejects(() => ada.todo.toggle({ id: 99 }), 'NOT_FOUND', 'todo.toggle({ id: 99 })');
  await rejects(() => ada.todo.toggle({ id: 'one' }), 'BAD_REQUEST', 'todo.toggle({ id: "one" })');
  return `@trpc/server@${version}: procedures, Zod validation, auth middleware and error codes correct`;
});
