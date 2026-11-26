import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { agents } from './agents.js';
import { init } from './install.js';
import { RESULT_PREFIX } from './check-helpers.js';
import { run } from './proc.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Load one task folder, or every task folder inside a directory. */
export function loadTasks(path) {
  const abs = resolve(path);
  if (existsSync(join(abs, 'task.json'))) return [loadTask(abs)];
  return readdirSync(abs)
    .map((n) => join(abs, n))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, 'task.json')))
    .sort()
    .map(loadTask);
}

function loadTask(dir) {
  const task = JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'));
  for (const k of ['id', 'name', 'prompt']) if (!task[k]) throw new Error(`${dir}/task.json: missing "${k}"`);
  if (!existsSync(join(dir, 'check.mjs'))) throw new Error(`${dir}: missing check.mjs`);
  return { ...task, dir, timeoutSec: task.timeoutSec ?? 600 };
}

/** Run the hidden check against a workspace. Returns { ok, category, detail }. */
export async function runCheck(task, ws) {
  const r = await run(process.execPath, [join(task.dir, 'check.mjs'), ws], { cwd: ws, timeoutMs: (task.checkTimeoutSec ?? 60) * 1000 });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith(RESULT_PREFIX));
  if (!line) {
    return {
      ok: false,
      category: 'crash',
      detail: r.timedOut ? 'check timed out' : `check produced no result: ${(r.stderr || r.stdout).slice(0, 300)}`,
    };
  }
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

/**
 * One trial: fresh empty folder -> agent -> hidden check -> result record.
 * Files the agent produced are copied next to the result so anyone can audit it.
 */
export async function runTrial({ task, agent, model, trial, outDir, fixture, maxBudgetUsd, keep = false, log = () => {}, variant = null }) {
  const adapter = agents[agent];
  if (!adapter) throw new Error(`unknown agent "${agent}" (known: ${Object.keys(agents).join(', ')})`);
  const ws = mkdtempSync(join(tmpdir(), `oneshot-${task.id}-`));
  const label = `${task.id} · ${agent}${model ? `/${model}` : ''}${variant ? ` +${variant}` : ''} · trial ${trial}`;
  log(`▶ ${label}`);
  if (variant === 'oneshot') init(ws, { local: true }); // the add-on, installed the way a developer would
  // Control: just the one-line instruction a developer might put in CLAUDE.md, no tools, no hook.
  if (variant === 'oneline') writeFileSync(join(ws, 'CLAUDE.md'), ONE_LINE + '\n');
  if (variant === 'oneline-all') writeFileSync(join(ws, 'CLAUDE.md'), ONE_LINE_ALL + '\n');

  let a;
  try {
    a = await adapter({ prompt: task.prompt, ws, timeoutMs: task.timeoutSec * 1000, model, fixture, maxBudgetUsd, variant });
  } catch (err) {
    a = { exitCode: 127, timedOut: false, durationMs: 0, transcript: String(err), costUsd: null, turns: null, agentError: 'adapter_failed', model };
  }
  const check = await runCheck(task, ws);

  // The agent could not work at all (plan usage limit, rate limit, logged out). That says
  // nothing about the library, so record nothing and stop the batch.
  if (!check.ok && (a.exitCode !== 0 || a.agentError) && UNAVAILABLE.test(`${a.agentError || ''} ${String(a.transcript || '').slice(0, 2000)}`)) {
    rmSync(ws, { recursive: true, force: true });
    throw new AgentUnavailableError(`${label}: agent unavailable: ${String(a.agentError || a.transcript || '').trim().split('\n')[0].slice(0, 200)}`);
  }

  // If the code works, it counts — however the agent exited. If it doesn't work and
  // the agent itself died, blame the agent run, not the library.
  let category = check.category;
  let detail = check.detail;
  if (!check.ok && a.timedOut) {
    category = 'agent_timeout';
  } else if (!check.ok && (a.exitCode !== 0 || a.agentError)) {
    category = 'agent_error';
    detail = `agent stopped with an error: ${String(a.transcript || '').trim().split('\n')[0].slice(0, 200)} (check: ${check.detail})`;
  }

  const result = {
    oneshot: VERSION,
    task: task.id,
    taskName: task.name,
    package: task.package ?? null,
    agent,
    model: `${a.model ?? model ?? 'default'}${variant ? `+${variant}` : ''}`,
    variant,
    trial,
    ok: check.ok,
    category: check.ok ? 'pass' : category,
    detail: check.ok ? check.detail : detail,
    agentExitCode: a.exitCode,
    agentTimedOut: a.timedOut,
    agentError: a.agentError ?? null,
    durationSec: Math.round(a.durationMs / 100) / 10,
    costUsd: a.costUsd,
    turns: a.turns,
    installedVersion: readInstalledVersion(ws, task.package),
    finishedAt: new Date().toISOString(),
  };

  const trialDir = join(outDir, trialDirName(task, agent, model, trial, variant));
  mkdirSync(trialDir, { recursive: true });
  // Results get published: never leak the runner's home folder or temp paths.
  writeFileSync(join(trialDir, 'transcript.txt'), scrub(String(a.transcript ?? ''), ws));
  result.detail = scrub(result.detail, ws);
  writeFileSync(join(trialDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  saveAgentFiles(ws, join(trialDir, 'files'));
  if (!keep) rmSync(ws, { recursive: true, force: true });
  else result.workspace = ws;

  log(`  ${result.ok ? '✅ pass' : `❌ ${result.category}`} — ${result.detail} (${result.durationSec}s${result.costUsd != null ? `, $${result.costUsd.toFixed(3)}` : ''})`);
  return result;
}

export const ONE_LINE =
  'Always install the latest version of every dependency (for example `npm install <package>@latest`). Never write dependency versions from memory.';

export const ONE_LINE_ALL =
  'Always use the newest versions of everything: packages, AI model names, GitHub Actions, Docker base images and runtimes. Never write versions or model names from memory; check what is current.';

export const UNAVAILABLE = /usage limit|rate.?limit|limit reached|resets? at|overloaded|\b429\b|failed to authenticate|not logged in|credit balance/i;

export class AgentUnavailableError extends Error {}

export function trialDirName(task, agent, model, trial, variant = null) {
  const modelLabel = (agent === 'fake' ? 'fake' : model || 'default') + (variant ? `-${variant}` : '');
  return `${task.id}__${agent}-${slug(modelLabel)}__t${trial}`;
}

/**
 * Run every task × trial. Trials already saved in outDir are skipped (so a batch can be
 * resumed after a usage limit). `parallel` trials run at once. If the agent becomes
 * unavailable, no new trials start, running ones finish, and the error is thrown.
 */
export async function runAll({ tasks, agent, model, trials, outDir, fixture, maxBudgetUsd, keep, log = () => {}, parallel = 1, variant = null }) {
  const jobs = [];
  let skipped = 0;
  for (const task of tasks) {
    for (let t = 1; t <= trials; t++) {
      if (existsSync(join(outDir, trialDirName(task, agent, model, t, variant), 'result.json'))) skipped++;
      else jobs.push({ task, trial: t });
    }
  }
  if (skipped) log(`(skipping ${skipped} trial(s) already in ${outDir})`);
  const results = [];
  let stop = null;
  let next = 0;
  async function worker() {
    while (!stop && next < jobs.length) {
      const { task, trial } = jobs[next++];
      try {
        results.push(await runTrial({ task, agent, model, trial, outDir, fixture, maxBudgetUsd, keep, log, variant }));
      } catch (err) {
        if (err instanceof AgentUnavailableError) stop = err;
        else throw err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  if (stop) {
    stop.results = results;
    stop.remaining = jobs.length - results.length;
    throw stop;
  }
  return results;
}

function readInstalledVersion(ws, pkg) {
  if (!pkg) return null;
  const pj = join(ws, 'node_modules', ...pkg.split('/'), 'package.json');
  try {
    return JSON.parse(readFileSync(pj, 'utf8')).version;
  } catch {
    return null;
  }
}

/** Copy what the agent wrote (not node_modules) so results can be audited. */
function saveAgentFiles(ws, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(ws, dest, {
    recursive: true,
    // Skip installs, and the files OneShot itself put there (they contain local paths).
    filter: (src) => !/node_modules|\.git(\/|$)|package-lock\.json$|\/(\.next|dist|build|\.vite|\.turbo|coverage|\.cache)(\/|$)|\.(db|sqlite|sqlite3)(-journal|-wal|-shm)?$|\/\.mcp\.json$|\/\.claude(\/|$)|\/CLAUDE\.md$|\/\.oneshot-import-/.test(src.slice(ws.length)),
  });
}

export function scrub(text, ws) {
  let out = String(text);
  if (ws) out = out.split(ws).join('<workspace>');
  const home = homedir();
  if (home && home.length > 1) out = out.split(home).join('~');
  return out;
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
}
