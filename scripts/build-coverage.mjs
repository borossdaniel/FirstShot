#!/usr/bin/env node
// Builds data/coverage.json: release facts and agent-risk for the most-used npm and PyPI packages.
//   node scripts/build-coverage.mjs [npmCount=1000] [pypiCount=500]
// npm list: npm-high-impact's "top dependents" (what projects add directly); PyPI list: top downloads
// from hugovk.github.io/top-pypi-packages. Facts come from deps.dev. Re-run daily to stay current.

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageFacts } from '../src/facts.js';

const here = dirname(fileURLToPath(import.meta.url));
const npmCount = Number(process.argv[2] || 1000);
const pypiCount = Number(process.argv[3] || 500);

async function npmList() {
  const { npmTopDependents } = await import('npm-high-impact').catch(() => {
    throw new Error('run `npm i --no-save npm-high-impact` first (build-time only)');
  });
  return npmTopDependents.filter((n) => !n.startsWith('@types/')).slice(0, npmCount);
}

async function pypiList() {
  const res = await fetch('https://hugovk.github.io/top-pypi-packages/top-pypi-packages.min.json', { signal: AbortSignal.timeout(30_000) });
  const doc = await res.json();
  return doc.rows.slice(0, pypiCount).map((r) => r.project);
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++;
      try {
        out[k] = await fn(items[k], k);
      } catch (err) {
        out[k] = { error: err.message };
      }
    }
  }));
  return out;
}

const board = JSON.parse(readFileSync(join(here, '..', 'data', 'board.json'), 'utf8'));
const lists = [['npm', await npmList()], ['pypi', pypiCount ? await pypiList() : []]];
const rows = [];
for (const [system, names] of lists) {
  let done = 0;
  const facts = await pool(names, 8, async (name) => {
    const f = await packageFacts(name, system);
    if (++done % 100 === 0) process.stderr.write(`${system}: ${done}/${names.length}\n`);
    return f;
  });
  facts.forEach((f, rank) => {
    if (!f || f.error || !f.exists || !f.latest) return;
    rows.push({
      s: system === 'npm' ? 'n' : 'p',
      n: f.name,
      r: rank + 1,
      v: f.latest,
      m: f.major,
      d: f.majorSince,
      a: f.majorAgeMonths,
      pv: f.previous,
      k: f.risk,
      t: system === 'npm' && board[f.name] ? 1 : 0,
      x: f.deprecated ? String(f.deprecated).slice(0, 140) : undefined,
    });
  });
}
const summary = rows.reduce((acc, r) => ((acc[r.k] = (acc[r.k] || 0) + 1), acc), {});
const out = { builtAt: new Date().toISOString(), source: 'deps.dev; npm-high-impact; top-pypi-packages', count: rows.length, summary, rows };
writeFileSync(join(here, '..', 'data', 'coverage.json'), JSON.stringify(out) + '\n');
console.log(`coverage.json: ${rows.length} packages`, summary);
