import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { preflight } from './agents.js';
import { adviseOne, checkProject, formatProjectReport, parseTarget } from './advisor.js';
import { init, stopHook } from './install.js';
import { startMcpServer } from './mcp.js';
import { currentFacts, formatFacts } from './livefacts.js';
import { writeReport } from './report.js';
import { AgentUnavailableError, loadTasks, runAll, runTrial, VERSION } from './runner.js';

const HELP = `oneshot-agent ${VERSION}: your AI agent, current on the first try

Usage (for your project):
  oneshot-agent check [package...] [--pypi]         Current version + known agent mistakes for packages
                                                      (npm by default; --pypi or pypi:<name> for Python);
                                                      with no names, check this project's package.json,
                                                      requirements.txt and pyproject.toml
  oneshot-agent init [--local] [--rules]            Add OneShot to this project (MCP tools, Claude Code
                                                      Stop hook, one line in CLAUDE.md)
  oneshot-agent facts [models|github-actions|runtimes]
                                                      Today's AI model names, GitHub Actions versions,
                                                      Node/Python LTS and Docker images
  oneshot-agent mcp                                 Run the MCP server (stdio)
  oneshot-agent hook                                Claude Code Stop hook (reads hook JSON on stdin)

Usage (benchmark):
  oneshot-agent run <task-or-tasks-dir> [options]   Run agents on tasks, save results
  oneshot-agent report <results-dir> [--out site]   Build the leaderboard page + badges
  oneshot-agent verify-tasks [tasks-dir] [ids...]   Prove each task's check accepts a known-good
                                                      solution and rejects known-bad ones (no AI used)

Run options:
  --agent <name>        claude | codex | gemini | fake        (default: claude)
  --model <name>        model passed to the agent, e.g. sonnet  (default: agent's default)
  --trials <n>          runs per task                           (default: 3)
  --out <dir>           where results go                        (default: results/<timestamp>)
  --max-budget-usd <n>  per-run spending cap (claude only)      (default: 2)
  --fixture <dir>       folder the fake agent copies in (tests only)
  --parallel <n>        trials to run at the same time         (default: 1)
  --with-oneshot      install the OneShot add-on in each workspace first (A/B test)
  --with-oneline        control: only a one-line 'install the latest' instruction in CLAUDE.md
  --keep                keep the temporary workspaces
  --json                print results as JSON

Re-running the same command with the same --out skips trials already saved.
Exit code: 0 all passed, 1 some failed, 3 stopped because the agent was unavailable.
`;

export async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === '--version' || cmd === '-v') {
    console.log(VERSION);
    return 0;
  }
  if (cmd === 'check') return cmdCheck(rest);
  if (cmd === 'facts') {
    const f = await currentFacts(rest.find((a) => !a.startsWith('--')) || 'all');
    console.log(rest.includes('--json') ? JSON.stringify(f, null, 2) : formatFacts(f));
    return 0;
  }
  if (cmd === 'init') {
    if (rest.includes('--rules')) {
      const { existsSync, writeFileSync } = await import('node:fs');
      const { RULES_TEMPLATE } = await import('./rules.js');
      if (existsSync('.oneshot.json')) console.log('.oneshot.json already exists; leaving it as is.');
      else {
        writeFileSync('.oneshot.json', JSON.stringify(RULES_TEMPLATE, null, 2) + '\n');
        console.log('Created .oneshot.json with example team rules. Edit it, commit it, and every agent and pull request will follow it.');
      }
      return 0;
    }
    const done = init(process.cwd(), { local: rest.includes('--local') });
    console.log(`OneShot added:\n${done.map((d) => `  - ${d}`).join('\n')}\nRestart your agent so it picks up the new tools.`);
    return 0;
  }
  if (cmd === 'mcp') {
    startMcpServer();
    return new Promise(() => {}); // keep running until stdin closes
  }
  if (cmd === 'hook') {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const r = await stopHook(Buffer.concat(chunks).toString('utf8'));
    if (r.message) process.stderr.write(r.message + '\n');
    return r.code;
  }
  if (cmd === 'run') return cmdRun(rest);
  if (cmd === 'report') return cmdReport(rest);
  if (cmd === 'verify-tasks') return cmdVerify(rest);
  console.error(`unknown command "${cmd}"\n`);
  process.stdout.write(HELP);
  return 2;
}

async function cmdCheck(args) {
  const json = args.includes('--json');
  const names = args.filter((a) => !a.startsWith('--'));
  if (!names.length) {
    const dir = args.find((a) => a.startsWith('--path='))?.slice(7) || process.cwd();
    const rep = await checkProject(dir);
    const facts = rep.facts || [];
    const errors = facts.filter((f) => f.level === 'error').length;
    const warnings = facts.length - errors + rep.outdated.length;
    if (json) console.log(JSON.stringify(rep, null, 2));
    else if (args.includes('--format=github')) {
      // GitHub wants paths from the repository root, so prefix the scanned folder.
      const { existsSync, readFileSync } = await import('node:fs');
      const { join, relative, resolve } = await import('node:path');
      const base = relative(process.cwd(), resolve(dir)).split('\\').join('/');
      const at = (file) => (base && !base.startsWith('..') ? `${base}/${file}` : file);
      const lineOf = (file, needle) => {
        try {
          const i = readFileSync(join(dir, file), 'utf8').split('\n').findIndex((l) => l.includes(needle));
          return i >= 0 ? i + 1 : null;
        } catch {
          return null;
        }
      };
      const clean = (t) => String(t).replace(/\r?\n/g, ' ').replace(/%/g, '%25');
      for (const f of facts) console.log(`::${f.level === 'error' ? 'error' : 'warning'} file=${at(f.file)}${f.line ? `,line=${f.line}` : ''},title=OneShot::${clean(f.message || `${f.found} → ${f.fix}`)}`);
      for (const o of rep.outdated) {
        const file = o.system === 'pypi' ? (existsSync(join(dir, 'pyproject.toml')) && !existsSync(join(dir, 'requirements.txt')) ? 'pyproject.toml' : 'requirements.txt') : 'package.json';
        const line = lineOf(file, o.system === 'pypi' ? o.name : `"${o.name}"`);
        console.log(`::warning file=${at(file)}${line ? `,line=${line}` : ''},title=OneShot::${clean(`${o.name} "${o.range}" is ${o.behind} major${o.behind > 1 ? 's' : ''} behind (current ${o.latest})`)}`);
      }
      console.log(formatProjectReport(rep));
      if (process.env.GITHUB_STEP_SUMMARY) {
        const { appendFileSync } = await import('node:fs');
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## OneShot\n\n\`\`\`\n${formatProjectReport(rep)}\n\`\`\`\n`);
      }
    } else console.log(formatProjectReport(rep));
    // Errors (retired or soon-retired models, end-of-life runtimes) fail the run; --strict also fails on warnings.
    return errors || (args.includes('--strict') && warnings) ? 1 : 0;
  }
  const system = args.includes('--pypi') || args.includes('--python') ? 'pypi' : 'npm';
  const out = await Promise.all(names.map((n) => adviseOne(...parseTarget(n, system).reverse())));
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(out.map((o) => o.advice).join('\n\n'));
  return out.every((o) => o.exists) ? 0 : 1;
}

async function cmdRun(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      agent: { type: 'string', default: 'claude' },
      model: { type: 'string' },
      trials: { type: 'string', default: '3' },
      out: { type: 'string' },
      'max-budget-usd': { type: 'string', default: '2' },
      fixture: { type: 'string' },
      keep: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      parallel: { type: 'string', default: '1' },
      'with-oneshot': { type: 'boolean', default: false },
      'with-oneline': { type: 'boolean', default: false },
      'with-oneline-all': { type: 'boolean', default: false },
    },
  });
  if (!positionals[0]) throw new Error('run: give a task folder or a folder of tasks');
  const tasks = loadTasks(positionals[0]);
  if (!tasks.length) throw new Error(`no tasks found in ${positionals[0]}`);
  const outDir = resolve(values.out || join('results', new Date().toISOString().replace(/[:.]/g, '-')));
  const log = values.json ? () => {} : (m) => console.log(m);
  const notReady = await preflight(values.agent);
  if (notReady) throw new Error(notReady);
  log(`OneShot ${VERSION}: ${tasks.length} task(s) × ${values.trials} trial(s) with ${values.agent}${values.model ? `/${values.model}` : ''} → ${outDir}`);
  let results;
  try {
    results = await runAll({
      tasks,
      agent: values.agent,
      model: values.model,
      trials: Number(values.trials),
      outDir,
      fixture: values.fixture && resolve(values.fixture),
      maxBudgetUsd: Number(values['max-budget-usd']) || undefined,
      keep: values.keep,
      log,
      parallel: Number(values.parallel) || 1,
      variant: values['with-oneshot'] ? 'oneshot' : values['with-oneline'] ? 'oneline' : values['with-oneline-all'] ? 'oneline-all' : null,
    });
  } catch (err) {
    if (!(err instanceof AgentUnavailableError)) throw err;
    console.error(`\nStopped: ${err.message}\n${err.results.length} trial(s) saved, ${err.remaining} not run. Run the same command again later to continue.`);
    return 3;
  }
  const passes = results.filter((r) => r.ok).length;
  if (values.json) console.log(JSON.stringify(results, null, 2));
  else console.log(`\n${passes}/${results.length} runs worked. Results in ${outDir}`);
  return passes === results.length ? 0 : 1;
}

async function cmdReport(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: 'string', default: 'site' }, 'include-fake': { type: 'boolean', default: false } },
  });
  const resultsDir = positionals[0] || 'results';
  const outDir = resolve(values.out);
  const { rows, results } = writeReport({ resultsDir, outDir, excludeAgents: values['include-fake'] ? [] : ['fake'] });
  console.log(`Leaderboard: ${rows.length} row(s) from ${results.length} run(s) → ${join(outDir, 'index.html')}`);
  return 0;
}

/**
 * For each task with a reference/ folder: reference/good must pass, and every
 * reference/bad-<category> must fail with exactly <category>. Uses the fake agent.
 */
async function cmdVerify(args) {
  const tasksDir = args[0] || 'tasks';
  const only = args.slice(1);
  const tasks = loadTasks(tasksDir).filter((t) => !only.length || only.includes(t.id));
  const outDir = mkdtempSync(join(tmpdir(), 'oneshot-verify-'));
  let bad = 0;
  let total = 0;
  for (const task of tasks) {
    const refDir = join(task.dir, 'reference');
    if (!existsSync(refDir)) {
      console.log(`- ${task.id}: no reference/ folder, skipped`);
      continue;
    }
    for (const name of readdirSync(refDir).sort()) {
      const want = name === 'good' ? 'pass' : name.replace(/^bad-/, '');
      const r = await runTrial({ task, agent: 'fake', trial: name, outDir, fixture: join(refDir, name) });
      total++;
      const okay = r.category === want;
      if (!okay) bad++;
      console.log(`${okay ? '✓' : '✗'} ${task.id}/${name}: expected ${want}, got ${r.category}${okay ? '' : ` — ${r.detail}`}`);
    }
  }
  rmSync(outDir, { recursive: true, force: true });
  console.log(`\n${total - bad}/${total} reference checks behaved as expected.`);
  return bad ? 1 : 0;
}
