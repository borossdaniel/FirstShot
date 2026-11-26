import assert from 'node:assert/strict';
import { appRouter, createCaller } from './solution.mjs';

async function expectCode(promise, code) {
  try {
    await promise;
    throw new Error(`expected rejection with code ${code}`);
  } catch (err) {
    assert.equal(err.code, code, `expected ${code}, got ${err.code} (${err.message})`);
  }
}

const anonCaller = createCaller({ user: null });
const aliceCaller = createCaller({ user: { id: 'alice' } });
const bobCaller = createCaller({ user: { id: 'bob' } });

// greeting.hello
assert.equal(await anonCaller.greeting.hello({ name: 'World' }), 'Hello, World!');
await expectCode(anonCaller.greeting.hello({ name: '' }), 'BAD_REQUEST');
await expectCode(anonCaller.greeting.hello({ name: 'x'.repeat(51) }), 'BAD_REQUEST');

// todo.* requires auth
await expectCode(anonCaller.todo.list(), 'UNAUTHORIZED');
await expectCode(anonCaller.todo.add({ title: 'test' }), 'UNAUTHORIZED');
await expectCode(anonCaller.todo.toggle({ id: 1 }), 'UNAUTHORIZED');

// todo.add defaults + validation
const t1 = await aliceCaller.todo.add({ title: '  Buy milk  ' });
assert.deepEqual(t1, { id: 1, title: 'Buy milk', priority: 'normal', done: false });

const t2 = await aliceCaller.todo.add({ title: 'Urgent task', priority: 'high' });
assert.deepEqual(t2, { id: 2, title: 'Urgent task', priority: 'high', done: false });

await expectCode(aliceCaller.todo.add({ title: '   ' }), 'BAD_REQUEST'); // trims to empty
await expectCode(aliceCaller.todo.add({ title: 'x'.repeat(101) }), 'BAD_REQUEST');
await expectCode(aliceCaller.todo.add({ title: 'ok', priority: 'urgent' }), 'BAD_REQUEST');

// cross-user id continuity: bob's ids continue from alice's
const t3 = await bobCaller.todo.add({ title: 'Bob task' });
assert.equal(t3.id, 3);

// todo.list scoping
const aliceList = await aliceCaller.todo.list();
assert.equal(aliceList.length, 2);
const bobList = await bobCaller.todo.list();
assert.equal(bobList.length, 1);

// todo.toggle
const toggled = await aliceCaller.todo.toggle({ id: 1 });
assert.equal(toggled.done, true);
const toggledBack = await aliceCaller.todo.toggle({ id: 1 });
assert.equal(toggledBack.done, false);

// toggle validation (id must be positive int)
await expectCode(aliceCaller.todo.toggle({ id: -1 }), 'BAD_REQUEST');
await expectCode(aliceCaller.todo.toggle({ id: 1.5 }), 'BAD_REQUEST');

// toggle nonexistent / other user's todo
await expectCode(aliceCaller.todo.toggle({ id: 999 }), 'NOT_FOUND');
await expectCode(aliceCaller.todo.toggle({ id: 3 }), 'NOT_FOUND'); // bob's todo
await expectCode(bobCaller.todo.toggle({ id: 1 }), 'NOT_FOUND'); // alice's todo

console.log('All checks passed. appRouter keys:', Object.keys(appRouter._def.procedures));
