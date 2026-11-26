import { runCheck, expectInstalled, importSolution, importFromWorkspace, startMockServer, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';

const ROWS = [
  { id: 31, title: 'Ship v2', created_at: '2026-11-20T10:00:00+00:00' },
  { id: 27, title: 'Write changelog', created_at: '2026-11-18T09:30:00+00:00' },
];
const INSERTED = { id: 32, project_id: 'proj-7', title: 'Write docs', done: false, created_at: '2026-11-26T12:00:00+00:00' };
const PG_ERROR = { code: '42501', details: null, hint: null, message: 'permission denied for table tasks' };

async function settle(p) {
  try {
    return { value: await p };
  } catch (error) {
    return { error };
  }
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, '@supabase/supabase-js', 2);
  const { createClient } = await importFromWorkspace(ws, '@supabase/supabase-js');
  const m = await importSolution(ws);
  expect(typeof m.listOpenTasks === 'function' && typeof m.addTask === 'function', 'listOpenTasks and addTask must both be exported');

  const mock = await startMockServer((req) => {
    const url = new URL(req.path, 'http://x');
    if (url.pathname !== '/rest/v1/tasks') return { status: 404, json: { code: 'PGRST205', message: `not mocked: ${req.method} ${url.pathname}`, details: null, hint: null } };
    const failing = JSON.stringify(req.body ?? '').includes('proj-error') || url.searchParams.get('project_id')?.includes('proj-error');
    if (failing) return { status: 403, json: PG_ERROR };
    if (req.method === 'GET') return { json: ROWS };
    if (req.method === 'POST') {
      const prefer = String(req.headers.prefer || '');
      if (!prefer.includes('return=representation')) return { status: 201, json: null };
      const single = String(req.headers.accept || '').includes('vnd.pgrst.object');
      return { status: 201, json: single ? INSERTED : [INSERTED] };
    }
    return { status: 405, json: { message: 'method not mocked' } };
  });
  const describe = () => mock.requests.map((r) => `${r.method} ${decodeURIComponent(r.path)}`).join(', ') || 'none';
  try {
    const supabase = createClient(mock.url, 'anon-key', { auth: { persistSession: false, autoRefreshToken: false } });

    // 1. Select with filters, order and limit
    const listed = await settle(m.listOpenTasks(supabase, 'proj-7', 5));
    const get = mock.requests.find((r) => r.method === 'GET');
    expect(get, `listOpenTasks made no GET request to the tasks table (requests: ${describe()})`);
    const q = new URL(get.path, 'http://x').searchParams;
    const select = (q.get('select') || '').replace(/\s/g, '');
    const cols = select.split(',').sort().join(',');
    expect(cols === 'created_at,id,title', `listOpenTasks should select only id, title, created_at; sent select=${select || '(none)'}`);
    expect(q.get('project_id') === 'eq.proj-7', `listOpenTasks should filter project_id=eq.proj-7 on the server; sent ${q.has('project_id') ? 'project_id=' + q.get('project_id') : 'no project_id filter'}`);
    expect(['eq.false', 'is.false'].includes(q.get('done')), `listOpenTasks should filter done=false on the server; sent ${q.has('done') ? 'done=' + q.get('done') : 'no done filter'}`);
    expect(/^created_at\.desc(\.|$)/.test(q.get('order') || ''), `listOpenTasks should order by created_at descending; sent order=${q.get('order')}`);
    expectEqual(q.get('limit'), '5', 'limit sent by listOpenTasks');
    if (listed.error) fail('crash', `listOpenTasks threw: ${firstLine(listed.error)}`);
    expectEqual(listed.value, ROWS, 'listOpenTasks return value');

    // 2. Insert and return the stored row
    const before = mock.requests.length;
    const added = await settle(m.addTask(supabase, 'proj-7', 'Write docs'));
    const post = mock.requests.slice(before).find((r) => r.method === 'POST');
    expect(post, `addTask made no insert (POST) request (requests: ${describe()})`);
    const row = Array.isArray(post.body) ? post.body[0] : post.body;
    expect(row && typeof row === 'object', `addTask sent no row: ${JSON.stringify(post.body)}`);
    expectEqual({ project_id: row.project_id, title: row.title, done: row.done }, { project_id: 'proj-7', title: 'Write docs', done: false }, 'row inserted by addTask');
    if (added.error) fail('crash', `addTask threw: ${firstLine(added.error)}`);
    const got = Array.isArray(added.value) && added.value.length === 1 ? added.value[0] : added.value;
    expect(String(post.headers.prefer || '').includes('return=representation'), `addTask must ask the database to return the inserted row (chain .select() after .insert()); it returned ${JSON.stringify(added.value)}`);
    expectEqual(got, INSERTED, 'addTask return value (the stored row)');

    // 3. Errors must throw, not be silently returned
    const errList = await settle(m.listOpenTasks(supabase, 'proj-error', 5));
    expect(errList.error, `listOpenTasks should throw when Supabase returns an error, but it resolved with ${JSON.stringify(errList.value)}`);
    const errAdd = await settle(m.addTask(supabase, 'proj-error', 'Nope'));
    expect(errAdd.error, `addTask should throw when Supabase returns an error, but it resolved with ${JSON.stringify(errAdd.value)}`);
  } finally {
    await mock.close();
  }
  return `@supabase/supabase-js@${version}: filtered select, insert returning the row, and error handling correct`;
});
