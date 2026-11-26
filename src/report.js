// Aggregate result.json files into a static leaderboard site + badges + data.json.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { badge, color } from './badge.js';
import { slug } from './runner.js';

export const CATEGORY_TEXT = {
  pass: 'Worked',
  no_solution: 'Gave up / file missing',
  not_installed: 'Library not installed (often a made-up package name)',
  outdated_major: 'Installed an old major version',
  outdated_fact: 'Wrote an outdated value from memory (model, action, runtime)',
  crash: 'Code crashed',
  wrong_behavior: 'Ran, but did the wrong thing',
  agent_timeout: 'Agent ran out of time',
  agent_error: 'Agent stopped with an error',
};

export function collectResults(dir) {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (n === 'files' || n === 'node_modules') continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (n === 'result.json') out.push({ ...JSON.parse(readFileSync(p, 'utf8')), _dir: d });
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

/** Group by task × agent/model. */
export function aggregate(results) {
  const groups = new Map();
  for (const r of results) {
    const key = `${r.task}|${r.agent}|${r.model}`;
    if (!groups.has(key)) groups.set(key, { task: r.task, taskName: r.taskName, package: r.package, agent: r.agent, model: r.model, runs: [] });
    groups.get(key).runs.push(r);
  }
  return [...groups.values()].map((g) => {
    const passes = g.runs.filter((r) => r.ok).length;
    const fails = {};
    for (const r of g.runs) if (!r.ok) fails[r.category] = (fails[r.category] || 0) + 1;
    const costs = g.runs.map((r) => r.costUsd).filter((c) => typeof c === 'number');
    const durs = g.runs.map((r) => r.durationSec).sort((a, b) => a - b);
    return {
      ...g,
      trials: g.runs.length,
      passes,
      rate: passes / g.runs.length,
      fails,
      medianSec: durs[Math.floor(durs.length / 2)],
      avgCostUsd: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
    };
  }).sort((a, b) => b.rate - a.rate || a.taskName.localeCompare(b.taskName));
}

export function writeReport({ resultsDir, outDir, title = 'Can AI agents use it on the first try?', excludeAgents = ['fake'] }) {
  const all = collectResults(resolve(resultsDir));
  const results = all.filter((r) => !excludeAgents.includes(r.agent));
  const rows = aggregate(results);
  mkdirSync(join(outDir, 'badges'), { recursive: true });
  mkdirSync(join(outDir, 'runs'), { recursive: true });

  // Per task badge: across all agents shown on the board.
  const byTask = new Map();
  for (const r of rows) {
    const t = byTask.get(r.task) || { passes: 0, trials: 0 };
    t.passes += r.passes;
    t.trials += r.trials;
    byTask.set(r.task, t);
    writeFileSync(join(outDir, 'badges', `${r.task}-${r.agent}-${slug(r.model)}.svg`), badge(r));
  }
  for (const [task, t] of byTask) writeFileSync(join(outDir, 'badges', `${task}.svg`), badge(t));

  // Copy each run (result, transcript, agent files) so the site is self-contained and auditable.
  for (const r of results) {
    const name = relative(resolve(resultsDir), r._dir).replace(/[\\/]/g, '__');
    cpSync(r._dir, join(outDir, 'runs', name), { recursive: true });
    r._link = `runs/${name}`;
  }

  const data = {
    generatedAt: new Date().toISOString(),
    rows: rows.map(({ runs, ...rest }) => ({
      ...rest,
      runs: runs.map(({ _dir, ...r }) => r),
    })),
  };
  writeFileSync(join(outDir, 'data.json'), JSON.stringify(data, null, 2) + '\n');
  writeFileSync(join(outDir, 'index.html'), html(rows, title, data.generatedAt));
  return { rows, results };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function html(rows, title, generatedAt) {
  const total = rows.reduce((a, r) => a + r.trials, 0);
  const passes = rows.reduce((a, r) => a + r.passes, 0);
  const allFails = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.fails)) allFails[k] = (allFails[k] || 0) + v;
  const failList = Object.entries(allFails).sort((a, b) => b[1] - a[1]);

  const tr = rows.map((r) => {
    const pct = Math.round(r.rate * 100);
    const why = Object.entries(r.fails).map(([k, v]) => `${esc(CATEGORY_TEXT[k] || k)} ×${v}`).join('<br>') || '—';
    const runs = r.runs.map((x) => `<a class="run ${x.ok ? 'ok' : 'bad'}" href="${esc(x._link)}/transcript.txt" title="${esc(x.detail)}">${x.ok ? '✓' : '✗'}</a>`).join('');
    return `<tr>
  <td><strong>${esc(r.taskName)}</strong><div class="sub">${esc(r.package || '')}</div></td>
  <td>${esc(r.agent)}<div class="sub">${esc(r.model)}</div></td>
  <td><div class="bar"><span style="width:${pct}%;background:${color(r.rate)}"></span></div><div class="score">${r.passes}/${r.trials}</div></td>
  <td class="why">${why}</td>
  <td class="num">${r.medianSec ?? '—'}s</td>
  <td class="num">${r.avgCostUsd != null ? '$' + r.avgCostUsd.toFixed(2) : '—'}</td>
  <td class="runs">${runs}</td>
</tr>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OneShot leaderboard</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--muted:#6b6a65;--line:#e4e1d9;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#eceae4;--muted:#9b998f;--line:#2c2b28;--card:#1c1c1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}
main{max-width:1080px;margin:0 auto;padding:40px 16px 80px}
h1{font-size:30px;line-height:1.2;margin:0 0 8px;letter-spacing:-.01em}
.lede{color:var(--muted);max-width:720px;margin:0 0 28px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:150px}
.stat b{display:block;font-size:22px}.stat span{color:var(--muted);font-size:13px}
.wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;min-width:760px}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
tr:last-child td{border-bottom:0}.sub{color:var(--muted);font-size:13px}
.bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden;width:120px}.bar span{display:block;height:100%}
.score{font-variant-numeric:tabular-nums;margin-top:4px;font-weight:600}
.why{font-size:13px}.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.runs a{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:4px;margin:0 3px 3px 0;text-decoration:none;font-size:13px;color:#fff}
.run.ok{background:#2e9e44}.run.bad{background:#d0453a}
h2{font-size:18px;margin:36px 0 10px}ul{padding-left:20px}li{margin:4px 0}
code{background:var(--line);padding:1px 5px;border-radius:4px;font-size:13px}
footer{color:var(--muted);font-size:13px;margin-top:40px}
</style></head>
<body><main>
<h1>${esc(title)}</h1>
<p class="lede">Each row is a real coding agent given a plain quickstart task for one library, in an empty folder, with nobody to help. Afterwards a hidden test runs the code. An AI never grades the work. Click a ✓ or ✗ to read exactly what the agent did.</p>
<div class="stats">
  <div class="stat"><b>${passes}/${total}</b><span>runs that worked</span></div>
  <div class="stat"><b>${new Set(rows.map((r) => r.task)).size}</b><span>libraries tested</span></div>
  <div class="stat"><b>${new Set(rows.map((r) => r.agent + r.model)).size}</b><span>agent setups</span></div>
</div>
<div class="wrap"><table>
<thead><tr><th>Library</th><th>Agent</th><th>First try</th><th>What went wrong</th><th>Median time</th><th>Avg cost</th><th>Runs</th></tr></thead>
<tbody>
${tr || '<tr><td colspan="7">No results yet. Run <code>oneshot run tasks --agent claude</code>.</td></tr>'}
</tbody></table></div>
<h2>Most common failures</h2>
<ul>${failList.map(([k, v]) => `<li>${esc(CATEGORY_TEXT[k] || k)}: ${v}</li>`).join('') || '<li>None yet.</li>'}</ul>
<h2>Add your library</h2>
<p>A task is one folder with a <code>task.json</code> (the prompt a developer would type) and a <code>check.mjs</code> (a real test). Run <code>npx oneshot-agent run ./my-task --agent claude --trials 5</code> and add the badge to your README.</p>
<footer>Generated ${esc(generatedAt)} by OneShot. Small samples. Read the transcripts before drawing conclusions.</footer>
</main></body></html>
`;
}
