import { createCaller } from './solution.mjs';

const assert = (cond, msg) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok -', msg);
};

const callerAnon = createCaller({ user: null });
const callerAlice = createCaller({ user: { id: 'alice' } });
const callerBob = createCaller({ user: { id: 'bob' } });

// greeting.hello
assert(
  (await callerAnon.greeting.hello({ name: 'World' })) === 'Hello, World!',
  'hello works without auth'
);

try {
  await callerAnon.greeting.hello({ name: '' });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'BAD_REQUEST', 'empty name rejected: ' + e.code);
}

try {
  await callerAnon.greeting.hello({ name: 'x'.repeat(51) });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'BAD_REQUEST', 'too-long name rejected: ' + e.code);
}

// unauthorized todo access
try {
  await callerAnon.todo.list();
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'UNAUTHORIZED', 'todo.list requires auth: ' + e.code);
}

try {
  await callerAnon.todo.add({ title: 'test' });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'UNAUTHORIZED', 'todo.add requires auth: ' + e.code);
}

try {
  await callerAnon.todo.toggle({ id: 1 });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'UNAUTHORIZED', 'todo.toggle requires auth: ' + e.code);
}

// todo.add defaults and trimming
const t1 = await callerAlice.todo.add({ title: '  Buy milk  ' });
assert(t1.title === 'Buy milk', 'title trimmed: ' + t1.title);
assert(t1.priority === 'normal', 'default priority normal: ' + t1.priority);
assert(t1.done === false, 'new todo not done');
assert(typeof t1.id === 'number', 'has numeric id');

const t2 = await callerAlice.todo.add({ title: 'Urgent', priority: 'high' });
assert(t2.priority === 'high', 'explicit priority high');
assert(t2.id === t1.id + 1, 'ids increment: ' + t2.id);

// invalid title: empty after trim
try {
  await callerAlice.todo.add({ title: '   ' });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'BAD_REQUEST', 'blank title rejected: ' + e.code);
}

// invalid title: too long after trim
try {
  await callerAlice.todo.add({ title: 'x'.repeat(101) });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'BAD_REQUEST', 'too-long title rejected: ' + e.code);
}

// invalid priority
try {
  await callerAlice.todo.add({ title: 'ok', priority: 'urgent' });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'BAD_REQUEST', 'invalid priority rejected: ' + e.code);
}

// todo.list scoping - bob has no todos yet
const bobList = await callerBob.todo.list();
assert(bobList.length === 0, 'bob has no todos: ' + bobList.length);

const bobTodo = await callerBob.todo.add({ title: 'Bob task' });
const aliceList = await callerAlice.todo.list();
assert(
  aliceList.every((x) => x.id !== bobTodo.id),
  "alice's list excludes bob's todo"
);
assert(aliceList.length === 2, 'alice has 2 todos: ' + aliceList.length);

// todo.toggle
const toggled = await callerAlice.todo.toggle({ id: t1.id });
assert(toggled.done === true, 'toggle flips done to true');
const toggledAgain = await callerAlice.todo.toggle({ id: t1.id });
assert(toggledAgain.done === false, 'toggle flips done back to false');

// toggle nonexistent
try {
  await callerAlice.todo.toggle({ id: 9999 });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'NOT_FOUND', 'nonexistent todo not found: ' + e.code);
}

// toggle someone else's todo
try {
  await callerAlice.todo.toggle({ id: bobTodo.id });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'NOT_FOUND', "toggling bob's todo as alice -> not found: " + e.code);
}

// invalid id for toggle (not positive int)
try {
  await callerAlice.todo.toggle({ id: -1 });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'BAD_REQUEST', 'negative id rejected: ' + e.code);
}
try {
  await callerAlice.todo.toggle({ id: 1.5 });
  throw new Error('should have thrown');
} catch (e) {
  assert(e.code === 'BAD_REQUEST', 'non-integer id rejected: ' + e.code);
}

console.log('\nAll tests passed.');
