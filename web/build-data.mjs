#!/usr/bin/env node
// Builds web/data.json for the landing page from every real (non-fake) run in results/.
// Run after any batch:  node web/build-data.mjs [resultsDir] [tasksDir]
// The page fetches data.json, so updating numbers = rebuilding this file, no page change.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectResults } from '../src/report.js';
import { loadTasks } from '../src/runner.js';

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = resolve(process.argv[2] || join(here, '..', 'results'));
const tasksDir = resolve(process.argv[3] || join(here, '..', 'tasks'));
const icons = JSON.parse(readFileSync(join(here, 'icons.json'), 'utf8'));

const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
// 95% Wilson score interval for k successes in n tries: honest ranges for small samples.
const wilson = (k, n, z = 1.96) => {
  if (!n) return null;
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [round(Math.max(0, c - h), 3), round(Math.min(1, c + h), 3)];
};
const notes = JSON.parse(readFileSync(join(here, '..', 'data', 'notes.json'), 'utf8'));

const tasks = loadTasks(tasksDir).filter((t) => t.kind !== 'live-fact'); // live-fact tasks are their own experiment
const allRuns = collectResults(resultsDir).filter((r) => r.agent !== 'fake');
const boardIds = new Set(tasks.map((t) => t.id));
const runs = allRuns.filter((r) => !r.variant && boardIds.has(r.task)); // the board: agents on their own
const withAddon = allRuns.filter((r) => r.variant === 'oneshot' || r.variant === 'firstshot'); // 'firstshot' = runs recorded before the rename

const rows = tasks.map((task) => {
  const rs = runs.filter((r) => r.task === task.id);
  const ok = rs.filter((r) => r.ok).length;
  const fails = {};
  for (const r of rs) if (!r.ok) fails[r.category] = (fails[r.category] || 0) + 1;
  const old = rs.filter((r) => r.category === 'outdated_major');
  return {
    id: task.id,
    name: task.name,
    package: task.package,
    currentMajor: task.currentMajor ?? null,
    icon: icons[task.package] || null,
    runs: rs.length,
    ok,
    old: old.length,
    oldVersions: [...new Set(old.map((r) => r.installedVersion).filter(Boolean))],
    fails,
    medianSec: round(median(rs.map((r) => r.durationSec)), 1),
    medianCost: round(median(rs.map((r) => r.costUsd))),
    passCI: wilson(ok, rs.length),
    oldCI: wilson(old.length, rs.length),
    notes: notes[task.package] || [],
    lastRun: rs.map((r) => r.finishedAt).sort().pop() || null,
  };
});

const tested = rows.filter((r) => r.runs > 0);
const data = {
  updatedAt: new Date().toISOString(),
  agent: 'Claude Code · Sonnet',
  totals: {
    libraries: tasks.length,
    librariesTested: tested.length,
    runs: runs.length,
    passed: runs.filter((r) => r.ok).length,
    oldInstalls: runs.filter((r) => r.category === 'outdated_major').length,
    librariesWithOldInstalls: tested.filter((r) => r.old > 0).length,
    medianSec: round(median(runs.map((r) => r.durationSec)), 1),
    medianCost: round(median(runs.map((r) => r.costUsd))),
    totalCost: round(runs.reduce((a, r) => a + (r.costUsd || 0), 0)),
    oldCI: wilson(runs.filter((r) => r.category === 'outdated_major').length, runs.length),
    passCI: wilson(runs.filter((r) => r.ok).length, runs.length),
  },
  rows,
  // Live facts: model names, GitHub Actions, Docker/runtime versions. Three setups, same tasks.
  live: (() => {
    // live-v2: 6 tasks × 10 runs × 3 setups (Nov 2026). live-v1 (3 tasks × 5) stays in results/ for reference.
    const lr = allRuns.filter((r) => /[\\/]live-v2[\\/]/.test(r._dir));
    if (!lr.length) return null;
    const pick = (v) => lr.filter((r) => (v === 'oneshot' ? r.variant === 'oneshot' || r.variant === 'firstshot' : (r.variant || null) === v));
    const side = (rs) => ({ runs: rs.length, correct: rs.filter((r) => r.ok).length, medianSec: round(median(rs.map((r) => r.durationSec)), 1), medianCost: round(median(rs.map((r) => r.costUsd))) });
    const names = { 'live-claude-model': 'Newest Claude model', 'live-openai-model': 'Newest OpenAI model', 'live-gh-actions': 'GitHub Actions CI', 'live-py-ci': 'Python CI', 'live-dockerfile': 'Node.js Dockerfile', 'live-py-dockerfile': 'Python Dockerfile' };
    const arms = { none: pick(null), line: pick('oneline-all'), oneshot: pick('oneshot') };
    const examples = [];
    for (const r of arms.none) {
      if (r.ok) continue;
      const m = String(r.detail).match(/asked for "([^"]+)"|outdated: ([^;(]+)|outdated base image: (\S+)/);
      const wrote = m && (m[1] || m[2] || m[3]);
      if (wrote) examples.push({ task: names[r.task] || r.task, wrote: wrote.trim() });
    }
    const counts = {};
    for (const e of examples) { const k = e.task + '|' + e.wrote; counts[k] = (counts[k] || 0) + 1; }
    return {
      tasks: Object.keys(names).map((id) => ({ id, name: names[id], none: side(arms.none.filter((r) => r.task === id)), line: side(arms.line.filter((r) => r.task === id)), oneshot: side(arms.oneshot.filter((r) => r.task === id)) })),
      none: side(arms.none), line: side(arms.line), oneshot: side(arms.oneshot),
      examples: Object.entries(counts).map(([k, n]) => ({ task: k.split('|')[0], wrote: k.split('|')[1], count: n })).sort((a, b) => b.count - a.count),
    };
  })(),
  // Before/after: the same libraries with and without the OneShot add-on installed.
  ab: (() => {
    const libs = [...new Set(withAddon.map((r) => r.task))];
    if (!libs.length) return null;
    const side = (rs) => ({ runs: rs.length, passed: rs.filter((r) => r.ok).length, oldInstalls: rs.filter((r) => r.category === 'outdated_major').length, medianSec: round(median(rs.map((r) => r.durationSec)), 1), medianCost: round(median(rs.map((r) => r.costUsd))) });
    return {
      libraries: libs,
      // same batch, same model, same week: the board run is the 'without' side
      without: side(runs.filter((r) => libs.includes(r.task) && /[\\/]board-v1[\\/]/.test(r._dir))),
      with: side(withAddon),
      perLibrary: libs.map((id) => ({ id, without: side(runs.filter((r) => r.task === id && /[\\/]board-v1[\\/]/.test(r._dir))), with: side(withAddon.filter((r) => r.task === id)) })),
    };
  })(),
};
const out = join(here, 'data.json');
writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(`data.json: ${data.totals.runs} runs, ${tested.length}/${tasks.length} libraries tested → ${out}`);

// Also bake the numbers into landing.html, so the page is complete before data.json loads.
const page = join(here, 'landing.html');
try {
  const html = readFileSync(page, 'utf8');
  const re = /(<script type="application\/json" id="seed">)[\s\S]*?(<\/script>)/;
  if (re.test(html)) {
    const safe = JSON.stringify(data).replace(/</g, '\\u003c');
    let next = html.replace(re, (_, a, b) => a + safe + b);
    const cov = readFileSync(join(here, '..', 'data', 'coverage.json'), 'utf8').trim().replace(/</g, '\\u003c');
    next = next.replace(/(<script type="application\/json" id="coverage">)[\s\S]*?(<\/script>)/, (_, a, b) => a + cov + b);
    writeFileSync(page, next);
    console.log('landing.html seed updated');
  }
} catch {
  /* page not present: fine */
}

// Board stats the advisor quotes to agents ("4 of 5 runs installed v12").
const board = {};
for (const r of rows) if (r.runs && r.package) board[r.package] = { runs: r.runs, ok: r.ok, old: r.old, oldVersions: r.oldVersions };
writeFileSync(join(here, '..', 'data', 'board.json'), JSON.stringify(board, null, 1) + '\n');
console.log(`data/board.json: ${Object.keys(board).length} packages`);
