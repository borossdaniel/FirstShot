import assert from 'node:assert/strict';
import { listOpenTasks, addTask } from './solution.mjs';

// Minimal mock of the supabase-js query builder chain used by solution.mjs.
// Each builder method returns `this`; the builder resolves (is awaited) via `.then`.
function makeSelectBuilder(result) {
  const calls = [];
  const builder = {
    eq(col, val) { calls.push(['eq', col, val]); return builder; },
    order(col, opts) { calls.push(['order', col, opts]); return builder; },
    limit(n) { calls.push(['limit', n]); return builder; },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  builder._calls = calls;
  return builder;
}

function makeInsertBuilder(result) {
  const builder = {
    select() { return builder; },
    single() { return Promise.resolve(result); },
  };
  return builder;
}

function makeClient({ selectResult, insertResult, captureInsert }) {
  return {
    from(table) {
      assert.equal(table, 'tasks');
      return {
        select(cols) {
          this._lastSelectCols = cols;
          return makeSelectBuilder(selectResult);
        },
        insert(row) {
          if (captureInsert) captureInsert(row);
          return makeInsertBuilder(insertResult);
        },
      };
    },
  };
}

// Test 1: listOpenTasks happy path
{
  const rows = [
    { id: 2, title: 'second', created_at: '2026-01-02T00:00:00Z' },
    { id: 1, title: 'first', created_at: '2026-01-01T00:00:00Z' },
  ];
  const supabase = makeClient({ selectResult: { data: rows, error: null } });
  const result = await listOpenTasks(supabase, 'proj-1', 10);
  assert.deepEqual(result, rows);
  console.log('PASS: listOpenTasks returns data');
}

// Test 2: listOpenTasks throws on error
{
  const supabase = makeClient({
    selectResult: { data: null, error: new Error('boom') },
  });
  let threw = false;
  try {
    await listOpenTasks(supabase, 'proj-1', 10);
  } catch (e) {
    threw = true;
    assert.equal(e.message, 'boom');
  }
  assert.ok(threw, 'expected listOpenTasks to throw on error');
  console.log('PASS: listOpenTasks throws on error');
}

// Test 3: addTask happy path and insert payload shape
{
  let insertedRow;
  const insertedResultRow = {
    id: 42,
    project_id: 'proj-1',
    title: 'new task',
    done: false,
    created_at: '2026-11-26T00:00:00Z',
  };
  const supabase = makeClient({
    insertResult: { data: insertedResultRow, error: null },
    captureInsert: (row) => { insertedRow = row; },
  });
  const result = await addTask(supabase, 'proj-1', 'new task');
  assert.deepEqual(insertedRow, { project_id: 'proj-1', title: 'new task', done: false });
  assert.deepEqual(result, insertedResultRow);
  console.log('PASS: addTask inserts correct payload and returns stored row');
}

// Test 4: addTask throws on error
{
  const supabase = makeClient({
    insertResult: { data: null, error: new Error('insert failed') },
  });
  let threw = false;
  try {
    await addTask(supabase, 'proj-1', 'new task');
  } catch (e) {
    threw = true;
    assert.equal(e.message, 'insert failed');
  }
  assert.ok(threw, 'expected addTask to throw on error');
  console.log('PASS: addTask throws on error');
}

console.log('All tests passed.');
