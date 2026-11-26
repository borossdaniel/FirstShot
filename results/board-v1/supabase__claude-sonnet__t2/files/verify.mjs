import assert from 'node:assert/strict';
import { listOpenTasks, addTask } from './solution.mjs';

// --- Mock 1: successful listOpenTasks chain ---
{
  const calls = [];
  const rows = [{ id: 1, title: 'a', created_at: '2026-01-01' }];
  const chain = {
    select(cols) { calls.push(['select', cols]); return chain; },
    eq(col, val) { calls.push(['eq', col, val]); return chain; },
    order(col, opts) { calls.push(['order', col, opts]); return chain; },
    limit(n) { calls.push(['limit', n]); return Promise.resolve({ data: rows, error: null }); },
  };
  const supabase = { from(table) { calls.push(['from', table]); return chain; } };

  const result = await listOpenTasks(supabase, 'proj-1', 5);
  assert.deepEqual(result, rows);
  assert.deepEqual(calls, [
    ['from', 'tasks'],
    ['select', 'id, title, created_at'],
    ['eq', 'project_id', 'proj-1'],
    ['eq', 'done', false],
    ['order', 'created_at', { ascending: false }],
    ['limit', 5],
  ]);
  console.log('listOpenTasks: success case OK');
}

// --- Mock 2: listOpenTasks throws on error ---
{
  const chain = {
    select() { return chain; },
    eq() { return chain; },
    order() { return chain; },
    limit() { return Promise.resolve({ data: null, error: new Error('boom') }); },
  };
  const supabase = { from() { return chain; } };

  await assert.rejects(() => listOpenTasks(supabase, 'proj-1', 5), /boom/);
  console.log('listOpenTasks: error case OK');
}

// --- Mock 3: successful addTask chain ---
{
  const calls = [];
  const inserted = { id: 42, project_id: 'proj-1', title: 'new task', done: false, created_at: '2026-11-26T00:00:00Z' };
  const chain = {
    insert(payload) { calls.push(['insert', payload]); return chain; },
    select() { calls.push(['select']); return chain; },
    single() { return Promise.resolve({ data: inserted, error: null }); },
  };
  const supabase = { from(table) { calls.push(['from', table]); return chain; } };

  const result = await addTask(supabase, 'proj-1', 'new task');
  assert.deepEqual(result, inserted);
  assert.deepEqual(calls, [
    ['from', 'tasks'],
    ['insert', { project_id: 'proj-1', title: 'new task', done: false }],
    ['select'],
  ]);
  console.log('addTask: success case OK');
}

// --- Mock 4: addTask throws on error ---
{
  const chain = {
    insert() { return chain; },
    select() { return chain; },
    single() { return Promise.resolve({ data: null, error: new Error('insert failed') }); },
  };
  const supabase = { from() { return chain; } };

  await assert.rejects(() => addTask(supabase, 'proj-1', 'x'), /insert failed/);
  console.log('addTask: error case OK');
}

console.log('All checks passed.');
