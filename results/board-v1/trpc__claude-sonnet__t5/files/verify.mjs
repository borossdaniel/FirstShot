import { createCaller } from './solution.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('OK:', msg);
}

async function expectError(promise, code, msg) {
  try {
    await promise;
    throw new Error('FAIL: ' + msg + ' (did not throw)');
  } catch (e) {
    assert(e.code === code, `${msg} (expected ${code}, got ${e.code}: ${e.message})`);
  }
}

const anon = createCaller({ user: null });
const alice = createCaller({ user: { id: 'alice' } });
const bob = createCaller({ user: { id: 'bob' } });

// 1. greeting.hello
assert((await anon.greeting.hello({ name: 'World' })) === 'Hello, World!', 'hello basic');
await expectError(anon.greeting.hello({ name: '' }), 'BAD_REQUEST', 'hello empty name rejected');
await expectError(anon.greeting.hello({ name: 'x'.repeat(51) }), 'BAD_REQUEST', 'hello too long rejected');
assert((await anon.greeting.hello({ name: 'x'.repeat(50) })) === `Hello, ${'x'.repeat(50)}!`, 'hello max length ok');

// Unauthorized checks
await expectError(anon.todo.add({ title: 'test' }), 'UNAUTHORIZED', 'todo.add requires auth');
await expectError(anon.todo.list(), 'UNAUTHORIZED', 'todo.list requires auth');
await expectError(anon.todo.toggle({ id: 1 }), 'UNAUTHORIZED', 'todo.toggle requires auth');

// 2. todo.add
const t1 = await alice.todo.add({ title: '  Buy milk  ' });
assert(t1.id === 1, 'first todo id is 1');
assert(t1.title === 'Buy milk', 'title trimmed');
assert(t1.priority === 'normal', 'default priority normal');
assert(t1.done === false, 'new todo not done');

const t2 = await alice.todo.add({ title: 'Urgent task', priority: 'high' });
assert(t2.id === 2, 'second todo id is 2 (alice)');
assert(t2.priority === 'high', 'explicit priority high');

const tBob = await bob.todo.add({ title: 'Bob task' });
assert(tBob.id === 3, 'ids shared across users (global counter)');

// validation failures
await expectError(alice.todo.add({ title: '   ' }), 'BAD_REQUEST', 'whitespace-only title rejected after trim');
await expectError(alice.todo.add({ title: 'x'.repeat(101) }), 'BAD_REQUEST', 'title too long rejected');
await expectError(alice.todo.add({ title: 'ok', priority: 'urgent' }), 'BAD_REQUEST', 'invalid priority rejected');
await expectError(alice.todo.add({}), 'BAD_REQUEST', 'missing title rejected');

// 3. todo.list — scoped per user
const aliceList = await alice.todo.list();
assert(aliceList.length === 2, 'alice sees only her 2 todos');
assert(aliceList.every((t) => t.id === 1 || t.id === 2), 'alice todos are correct ids');

const bobList = await bob.todo.list();
assert(bobList.length === 1 && bobList[0].id === 3, 'bob sees only his 1 todo');

// 4. todo.toggle
const toggled = await alice.todo.toggle({ id: 1 });
assert(toggled.done === true, 'toggle flips done to true');
const toggledBack = await alice.todo.toggle({ id: 1 });
assert(toggledBack.done === false, 'toggle flips done back to false');

// toggle not found / wrong owner
await expectError(alice.todo.toggle({ id: 999 }), 'NOT_FOUND', 'toggle nonexistent id -> NOT_FOUND');
await expectError(bob.todo.toggle({ id: 1 }), 'NOT_FOUND', "toggle other user's todo -> NOT_FOUND");

// toggle input validation
await expectError(alice.todo.toggle({ id: 0 }), 'BAD_REQUEST', 'toggle id must be positive');
await expectError(alice.todo.toggle({ id: -1 }), 'BAD_REQUEST', 'toggle id must be positive');
await expectError(alice.todo.toggle({ id: 1.5 }), 'BAD_REQUEST', 'toggle id must be integer');
await expectError(alice.todo.toggle({ id: 'abc' }), 'BAD_REQUEST', 'toggle id must be number');

console.log('\nALL CHECKS PASSED');
