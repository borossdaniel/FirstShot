import assert from 'node:assert/strict';
import { createCaller } from './solution.mjs';

const alice = createCaller({ user: { id: 'alice' } });
const bob = createCaller({ user: { id: 'bob' } });
const anon = createCaller({ user: null });

// 1. greeting.hello
assert.equal(await alice.greeting.hello({ name: 'World' }), 'Hello, World!');
await assert.rejects(
  () => alice.greeting.hello({ name: '' }),
  (e) => e.code === 'BAD_REQUEST'
);
await assert.rejects(
  () => alice.greeting.hello({ name: 'x'.repeat(51) }),
  (e) => e.code === 'BAD_REQUEST'
);
// no auth required for greeting
assert.equal(await anon.greeting.hello({ name: 'Anon' }), 'Hello, Anon!');

// unauthorized access to todo.* for anon user
await assert.rejects(
  () => anon.todo.list(),
  (e) => e.code === 'UNAUTHORIZED'
);
await assert.rejects(
  () => anon.todo.add({ title: 'test' }),
  (e) => e.code === 'UNAUTHORIZED'
);
await assert.rejects(
  () => anon.todo.toggle({ id: 1 }),
  (e) => e.code === 'UNAUTHORIZED'
);

// 2. todo.add - defaults and trimming
const t1 = await alice.todo.add({ title: '  Buy milk  ' });
assert.equal(t1.id, 1);
assert.equal(t1.title, 'Buy milk');
assert.equal(t1.priority, 'normal');
assert.equal(t1.done, false);

const t2 = await alice.todo.add({ title: 'Write report', priority: 'high' });
assert.equal(t2.id, 2);
assert.equal(t2.priority, 'high');

// ids continue across users
const t3 = await bob.todo.add({ title: 'Bob task' });
assert.equal(t3.id, 3);

// invalid title: empty after trim
await assert.rejects(
  () => alice.todo.add({ title: '   ' }),
  (e) => e.code === 'BAD_REQUEST'
);
// invalid title: too long after trim
await assert.rejects(
  () => alice.todo.add({ title: 'x'.repeat(101) }),
  (e) => e.code === 'BAD_REQUEST'
);
// invalid priority
await assert.rejects(
  () => alice.todo.add({ title: 'ok', priority: 'urgent' }),
  (e) => e.code === 'BAD_REQUEST'
);

// 3. todo.list - only current user's todos
const aliceTodos = await alice.todo.list();
assert.equal(aliceTodos.length, 2);
assert.deepEqual(aliceTodos.map((t) => t.id), [1, 2]);

const bobTodos = await bob.todo.list();
assert.equal(bobTodos.length, 1);
assert.equal(bobTodos[0].id, 3);

// 4. todo.toggle
const toggled = await alice.todo.toggle({ id: 1 });
assert.equal(toggled.done, true);
const toggledBack = await alice.todo.toggle({ id: 1 });
assert.equal(toggledBack.done, false);

// invalid id (not positive integer)
await assert.rejects(
  () => alice.todo.toggle({ id: 0 }),
  (e) => e.code === 'BAD_REQUEST'
);
await assert.rejects(
  () => alice.todo.toggle({ id: -1 }),
  (e) => e.code === 'BAD_REQUEST'
);
await assert.rejects(
  () => alice.todo.toggle({ id: 1.5 }),
  (e) => e.code === 'BAD_REQUEST'
);

// toggle non-existent id -> NOT_FOUND
await assert.rejects(
  () => alice.todo.toggle({ id: 999 }),
  (e) => e.code === 'NOT_FOUND'
);

// toggle someone else's todo -> NOT_FOUND
await assert.rejects(
  () => alice.todo.toggle({ id: 3 }), // belongs to bob
  (e) => e.code === 'NOT_FOUND'
);

console.log('All tests passed.');
