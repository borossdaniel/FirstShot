import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadTasks, runTrial } from '../src/runner.js';
import { writeReport } from '../src/report.js';
import { badge, color } from '../src/badge.js';

const fx = (p) => new URL(`./fixtures/${p}`, import.meta.url).pathname;
const [addTask] = loadTasks(fx('task-add'));
const [slowTask] = loadTasks(fx('task-slow'));
const tmp = () => mkdtempSync(join(tmpdir(), 'firstshot-test-'));

test('a correct solution passes and the run is saved for auditing', async () => {
  const out = tmp();
  const r = await runTrial({ task: addTask, agent: 'fake', trial: 1, outDir: out, fixture: fx('agent-good') });
  assert.equal(r.ok, true);
  assert.equal(r.category, 'pass');
  const dir = join(out, 'add__fake-fake__t1');
  assert.ok(existsSync(join(dir, 'result.json')));
  assert.ok(existsSync(join(dir, 'transcript.txt')));
  assert.ok(existsSync(join(dir, 'files', 'solution.mjs')), 'agent files are kept');
});

test('a solution that does the wrong thing fails as wrong_behavior', async () => {
  const r = await runTrial({ task: addTask, agent: 'fake', trial: 1, outDir: tmp(), fixture: fx('agent-wrong') });
  assert.equal(r.ok, false);
  assert.equal(r.category, 'wrong_behavior');
  assert.match(r.detail, /add\(2, 3\): expected 5, got "23"/);
});

test('an agent that exits with an error and writes nothing is agent_error', async () => {
  const r = await runTrial({ task: addTask, agent: 'fake', trial: 1, outDir: tmp(), fixture: fx('agent-crashes') });
  assert.equal(r.category, 'agent_error');
});

test('an agent that runs past the time limit is agent_timeout', async () => {
  const r = await runTrial({ task: slowTask, agent: 'fake', trial: 1, outDir: tmp(), fixture: fx('agent-sleeps') });
  assert.equal(r.category, 'agent_timeout');
});

test('unknown agents are rejected clearly', async () => {
  await assert.rejects(runTrial({ task: addTask, agent: 'nope', trial: 1, outDir: tmp() }), /unknown agent "nope"/);
});

test('report builds a leaderboard, badges and data.json from results', async () => {
  const results = tmp();
  await runTrial({ task: addTask, agent: 'fake', trial: 1, outDir: results, fixture: fx('agent-good') });
  await runTrial({ task: addTask, agent: 'fake', trial: 2, outDir: results, fixture: fx('agent-wrong') });
  const site = tmp();
  const { rows } = writeReport({ resultsDir: results, outDir: site, excludeAgents: [] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].passes, 1);
  assert.equal(rows[0].trials, 2);
  assert.deepEqual(rows[0].fails, { wrong_behavior: 1 });
  const html = readFileSync(join(site, 'index.html'), 'utf8');
  assert.match(html, /Add \(test task\)/);
  assert.match(html, /1\/2/);
  assert.match(readFileSync(join(site, 'badges', 'add.svg'), 'utf8'), /agents first try: 1\/2/);
  const data = JSON.parse(readFileSync(join(site, 'data.json'), 'utf8'));
  assert.equal(data.rows[0].runs.length, 2);
  assert.ok(existsSync(join(site, data.rows[0].runs[0]._link, 'transcript.txt')), 'transcripts are published with the site');
});

test('fake-agent results are left off the public board by default', () => {
  const results = tmp();
  return runTrial({ task: addTask, agent: 'fake', trial: 1, outDir: results, fixture: fx('agent-good') }).then(() => {
    const { rows } = writeReport({ resultsDir: results, outDir: tmp() });
    assert.equal(rows.length, 0);
  });
});

test('badge shows score and colour by success rate', () => {
  assert.match(badge({ passes: 3, trials: 3 }), /3\/3/);
  assert.equal(color(1), '#2e9e44');
  assert.equal(color(0.1), '#d0453a');
  assert.match(badge({ passes: 0, trials: 0 }), /untested/);
});

test('CLI: run exits 1 when a run fails and 0 when all pass', () => {
  const bin = new URL('../bin/firstshot.js', import.meta.url).pathname;
  const ok = spawnSync(process.execPath, [bin, 'run', fx('task-add'), '--agent', 'fake', '--fixture', fx('agent-good'), '--trials', '2', '--out', tmp()], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /2\/2 runs worked/);
  const bad = spawnSync(process.execPath, [bin, 'run', fx('task-add'), '--agent', 'fake', '--fixture', fx('agent-wrong'), '--trials', '1', '--out', tmp()], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
});

test('a batch resumes: trials already saved are skipped', async () => {
  const out = tmp();
  const { runAll } = await import('../src/runner.js');
  const first = await runAll({ tasks: [addTask], agent: 'fake', trials: 2, outDir: out, fixture: fx('agent-good') });
  assert.equal(first.length, 2);
  const again = await runAll({ tasks: [addTask], agent: 'fake', trials: 3, outDir: out, fixture: fx('agent-good') });
  assert.equal(again.length, 1, 'only the missing third trial runs');
  assert.equal(again[0].trial, 3);
});

test('parallel runs produce every trial once', async () => {
  const out = tmp();
  const { runAll } = await import('../src/runner.js');
  const r = await runAll({ tasks: [addTask], agent: 'fake', trials: 4, outDir: out, fixture: fx('agent-good'), parallel: 3 });
  assert.deepEqual(r.map((x) => x.trial).sort(), [1, 2, 3, 4]);
});

test('a usage limit stops the batch and records nothing for that trial', async () => {
  const out = tmp();
  const { runAll, AgentUnavailableError } = await import('../src/runner.js');
  await assert.rejects(
    runAll({ tasks: [addTask], agent: 'fake', trials: 3, outDir: out, fixture: fx('agent-limit') }),
    (err) => err instanceof AgentUnavailableError && err.results.length === 0 && err.remaining === 3,
  );
  const { collectResults } = await import('../src/report.js');
  assert.equal(collectResults(out).length, 0, 'no fake failures were written');
});
