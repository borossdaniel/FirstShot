import assert from 'node:assert/strict';
import { createCaller } from './solution.mjs';

const callerAlice = createCaller({ user: { id: 'alice' } });
const callerBob = createCaller({ user: { id: 'bob' } });
const callerAnon = createCaller({ user: null });

// greeting.hello
assert.equal(await callerAlice.greeting.hello({ name: 'World' }), 'Hello, World!');
await assert.rejects(
  () => callerAlice.greeting.hello({ name: '' }),
  (err) => err.code === 'BAD_REQUEST'
);
await assert.rejects(
  () => callerAlice.greeting.hello({ name: 'x'.repeat(51) }),
  (err) => err.code === 'BAD_REQUEST'
);

// todo.add requires auth
await assert.rejects(
  () => callerAnon.todo.add({ title: 'test' }),
  (err) => err.code === 'UNAUTHORIZED'
);

// todo.list requires auth
await assert.rejects(
  () => callerAnon.todo.list(),
  (err) => err.code === 'UNAUTHORIZED'
);

// todo.toggle requires auth
await assert.rejects(
  () => callerAnon.todo.toggle({ id: 1 }),
  (err) => err.code === 'UNAUTHORIZED'
);

// todo.add - trimming and defaults
const t1 = await callerAlice.todo.add({ title: '  Buy milk  ' });
assert.equal(t1.title, 'Buy milk');
assert.equal(t1.priority, 'normal');
assert.equal(t1.done, false);
assert.equal(t1.id, 1);

// todo.add - explicit priority
const t2 = await callerAlice.todo.add({ title: 'Walk dog', priority: 'high' });
assert.equal(t2.priority, 'high');
assert.equal(t2.id, 2);

// ids increment across users
const t3 = await callerBob.todo.add({ title: 'Bob task' });
assert.equal(t3.id, 3);

// todo.add - invalid title (empty after trim)
await assert.rejects(
  () => callerAlice.todo.add({ title: '   ' }),
  (err) => err.code === 'BAD_REQUEST'
);

// todo.add - invalid title (too long)
await assert.rejects(
  () => callerAlice.todo.add({ title: 'x'.repeat(101) }),
  (err) => err.code === 'BAD_REQUEST'
);

// todo.add - invalid priority
await assert.rejects(
  () => callerAlice.todo.add({ title: 'ok', priority: 'urgent' }),
  (err) => err.code === 'BAD_REQUEST'
);

// todo.list - only current user's todos
const aliceList = await callerAlice.todo.list();
assert.equal(aliceList.length, 2);
assert.ok(aliceList.every((t) => t.id === 1 || t.id === 2));

const bobList = await callerBob.todo.list();
assert.equal(bobList.length, 1);
assert.equal(bobList[0].id, 3);

// todo.toggle - flips done
const toggled = await callerAlice.todo.toggle({ id: 1 });
assert.equal(toggled.done, true);
const toggledBack = await callerAlice.todo.toggle({ id: 1 });
assert.equal(toggledBack.done, false);

// todo.toggle - not found (nonexistent id)
await assert.rejects(
  () => callerAlice.todo.toggle({ id: 9999 }),
  (err) => err.code === 'NOT_FOUND'
);

// todo.toggle - not found (belongs to another user)
await assert.rejects(
  () => callerAlice.todo.toggle({ id: 3 }),
  (err) => err.code === 'NOT_FOUND'
);

// todo.toggle - invalid input (not positive int)
await assert.rejects(
  () => callerAlice.todo.toggle({ id: -1 }),
  (err) => err.code === 'BAD_REQUEST'
);
await assert.rejects(
  () => callerAlice.todo.toggle({ id: 1.5 }),
  (err) => err.code === 'BAD_REQUEST'
);

console.log('All tests passed.');
