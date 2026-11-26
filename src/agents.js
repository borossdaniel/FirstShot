// Agent adapters. Each adapter runs one agent, headless, inside a fresh workspace,
// and returns { exitCode, timedOut, durationMs, transcript, costUsd, turns, model }.
//
// Adding an agent = adding one function here.

import { cpSync, existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { run } from './proc.js';

// Tools the agent may use without asking. Everything else is denied, so an
// unattended run can never hang on a permission prompt.
const CLAUDE_ALLOWED_TOOLS = [
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'Bash(npm *)', 'Bash(npx *)', 'Bash(node *)', 'Bash(ls *)', 'Bash(cat *)',
  'Bash(mkdir *)', 'Bash(pwd)', 'Bash(curl *)',
];

const SYSTEM_NOTE =
  'You are working unattended in an empty folder. Nobody will answer questions. ' +
  'Finish the task completely, install what you need, and verify it runs before you stop.';

/**
 * Cheap check that the agent CLI exists and is logged in, so a batch never
 * records "failures" that are really a missing login. Returns null or an error string.
 */
export async function preflight(agent) {
  const cmd = { claude: 'claude', codex: 'codex', gemini: 'gemini' }[agent];
  if (!cmd) return null;
  const which = await run('sh', ['-c', `command -v ${cmd}`], { timeoutMs: 10_000 });
  if (which.code !== 0) return `"${cmd}" is not installed or not on PATH`;
  if (agent !== 'claude') return null;
  const r = await run('claude', ['-p', 'Reply with the single word OK.', '--output-format', 'json', '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence', '--model', 'haiku'], { timeoutMs: 120_000 });
  try {
    const j = JSON.parse(r.stdout.trim().split('\n').pop());
    if (j.is_error) return `Claude Code is not ready: ${j.result}. Run \`claude\` in a terminal and use /login.`;
    return null;
  } catch {
    return `Claude Code did not answer: ${(r.stderr || r.stdout).slice(0, 200)}`;
  }
}

export const agents = {
  /** Claude Code CLI (`claude -p`). Uses whatever login the machine already has. */
  async claude({ prompt, ws, timeoutMs, model, maxBudgetUsd, variant }) {
    const args = [
      '-p', `${prompt}\n\n${SYSTEM_NOTE}`,
      '--output-format', 'json',
      '--permission-mode', 'dontAsk',
      '--allowedTools', ...CLAUDE_ALLOWED_TOOLS,
      // Only project settings: the user's own plugins, hooks and MCP servers
      // must not help (or hurt) the agent. Keeps runs comparable across machines.
      '--setting-sources', 'project',
      '--strict-mcp-config',
      '--no-session-persistence',
    ];
    if (model) args.push('--model', model);
    if (maxBudgetUsd) args.push('--max-budget-usd', String(maxBudgetUsd));
    if (variant === 'firstshot' && existsSync(join(ws, '.mcp.json'))) {
      // Exactly what `firstshot init` set up in the project: its MCP tools (plus its Stop hook,
      // which loads from the project's .claude/settings.json).
      args.push('--mcp-config', join(ws, '.mcp.json'));
      const i = args.indexOf('--allowedTools');
      args.splice(i + 1, 0, 'mcp__firstshot__check_package', 'mcp__firstshot__check_project');
    }
    const r = await run('claude', args, { cwd: ws, timeoutMs });
    let parsed = null;
    try {
      parsed = JSON.parse(r.stdout.trim().split('\n').pop());
    } catch {
      /* not JSON: crashed or timed out */
    }
    return {
      exitCode: r.code,
      timedOut: r.timedOut,
      durationMs: r.durationMs,
      transcript: parsed?.result ?? (r.stdout + r.stderr),
      costUsd: typeof parsed?.total_cost_usd === 'number' ? parsed.total_cost_usd : null,
      turns: parsed?.num_turns ?? null,
      agentError: parsed?.is_error ? String(parsed?.result || parsed?.subtype || 'error').slice(0, 200) : null,
      model: model || 'default',
    };
  },

  /** OpenAI Codex CLI. Experimental: not yet run by us. */
  async codex({ prompt, ws, timeoutMs, model }) {
    const args = ['exec', '--full-auto', '--skip-git-repo-check'];
    if (model) args.push('--model', model);
    args.push(`${prompt}\n\n${SYSTEM_NOTE}`);
    const r = await run('codex', args, { cwd: ws, timeoutMs });
    return plain(r, model);
  },

  /** Google Gemini CLI. Experimental: not yet run by us. */
  async gemini({ prompt, ws, timeoutMs, model }) {
    const args = ['-p', `${prompt}\n\n${SYSTEM_NOTE}`, '--yolo'];
    if (model) args.push('--model', model);
    const r = await run('gemini', args, { cwd: ws, timeoutMs });
    return plain(r, model);
  },

  /**
   * Fake agent for tests and for verifying tasks: copies a fixture folder into the
   * workspace, then runs `npm install` if the fixture has dependencies.
   * Use as --agent fake --fixture <dir>. A fixture may contain `fake-agent.json`
   * with { "exitCode": 1 } or { "sleepMs": 5000 } to simulate failures.
   */
  async fake({ ws, timeoutMs, fixture }) {
    const started = Date.now();
    if (!fixture || !existsSync(fixture)) throw new Error(`fake agent: fixture not found: ${fixture}`);
    const ctlPath = join(fixture, 'fake-agent.json');
    const ctl = existsSync(ctlPath) ? JSON.parse(readFileSync(ctlPath, 'utf8')) : {};
    if (ctl.sleepMs) {
      const r = await run(process.execPath, ['-e', `setTimeout(()=>{}, ${ctl.sleepMs})`], { cwd: ws, timeoutMs });
      if (r.timedOut) return { ...plain(r, 'fake'), transcript: 'fake agent slept past the timeout' };
    }
    cpSync(fixture, ws, { recursive: true, filter: (src) => !src.endsWith('fake-agent.json') });
    let log = `fake agent copied fixture "${basename(fixture)}"\n`;
    const pj = join(ws, 'package.json');
    if (existsSync(pj)) {
      const pkg = JSON.parse(readFileSync(pj, 'utf8'));
      if (Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length) {
        const r = await run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: ws, timeoutMs });
        log += r.stdout + r.stderr;
      }
    }
    return {
      exitCode: ctl.exitCode ?? 0,
      timedOut: false,
      durationMs: Date.now() - started,
      transcript: ctl.transcript ?? log,
      costUsd: 0,
      turns: 0,
      agentError: ctl.agentError ?? null,
      model: 'fake',
    };
  },
};

function plain(r, model) {
  return {
    exitCode: r.code,
    timedOut: r.timedOut,
    durationMs: r.durationMs,
    transcript: r.stdout + r.stderr,
    costUsd: null,
    turns: null,
    agentError: null,
    model: model || 'default',
  };
}
