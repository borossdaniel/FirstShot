import assert from 'node:assert/strict';
import { listOpenTasks, addTask } from './solution.mjs';

// --- Mock Supabase client mimicking the query-builder chain ---
function makeMockClient({ selectResult, insertResult }) {
  const calls = [];
  const selectChain = {
    eq(col, val) { calls.push(['eq', col, val]); return selectChain; },
    order(col, opts) { calls.push(['order', col, opts]); return selectChain; },
    limit(n) { calls.push(['limit', n]); return Promise.resolve(selectResult); },
  };
  const insertChain = {
    select() { calls.push(['select']); return insertChain; },
    single() { calls.push(['single']); return Promise.resolve(insertResult); },
  };
  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return {
        select(cols) {
          calls.push(['select', cols]);
          return selectChain;
        },
        insert(row) {
          calls.push(['insert', row]);
          return insertChain;
        },
      };
    },
  };
}

// Test 1: listOpenTasks happy path
{
  const rows = [
    { id: 2, title: 'b', created_at: '2026-11-26T10:00:00Z' },
    { id: 1, title: 'a', created_at: '2026-11-25T10:00:00Z' },
  ];
  const client = makeMockClient({ selectResult: { data: rows, error: null } });
  const result = await listOpenTasks(client, 'proj1', 5);
  assert.deepEqual(result, rows);
  assert.deepEqual(client.calls, [
    ['from', 'tasks'],
    ['select', 'id, title, created_at'],
    ['eq', 'project_id', 'proj1'],
    ['eq', 'done', false],
    ['order', 'created_at', { ascending: false }],
    ['limit', 5],
  ]);
  console.log('PASS: listOpenTasks happy path');
}

// Test 2: listOpenTasks throws on error
{
  const client = makeMockClient({ selectResult: { data: null, error: new Error('boom') } });
  await assert.rejects(() => listOpenTasks(client, 'proj1', 5), /boom/);
  console.log('PASS: listOpenTasks throws on error');
}

// Test 3: addTask happy path
{
  const inserted = { id: 42, project_id: 'proj1', title: 'new task', done: false, created_at: '2026-11-26T12:00:00Z' };
  const client = makeMockClient({ insertResult: { data: inserted, error: null } });
  const result = await addTask(client, 'proj1', 'new task');
  assert.deepEqual(result, inserted);
  assert.deepEqual(client.calls, [
    ['from', 'tasks'],
    ['insert', { project_id: 'proj1', title: 'new task', done: false }],
    ['select'],
    ['single'],
  ]);
  console.log('PASS: addTask happy path');
}

// Test 4: addTask throws on error
{
  const client = makeMockClient({ insertResult: { data: null, error: new Error('insert failed') } });
  await assert.rejects(() => addTask(client, 'proj1', 'x'), /insert failed/);
  console.log('PASS: addTask throws on error');
}

console.log('All tests passed.');
