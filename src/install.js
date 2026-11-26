// `firstshot init`: add FirstShot to a project for Claude Code (and other agents):
//   .mcp.json             -> the check_package / check_project tools
//   .claude/settings.json -> a Stop hook that blocks "done" while package.json has outdated majors
//   CLAUDE.md / AGENTS.md -> one line telling any agent to check versions first
// `firstshot hook`: the Stop hook itself.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProject, formatProjectReport } from './advisor.js';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'firstshot.js');
export const agentLine = (checkCmd = 'npx firstshot check') =>
  `Before adding or upgrading an npm dependency, run \`${checkCmd} <package>\` (or the firstshot check_package tool) and install the version it reports. Never write dependency versions from memory.`;
export const AGENT_LINE = agentLine();

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

/** local: point at this checkout (for tests and before the npm package exists). */
export function init(dir = process.cwd(), { local = false } = {}) {
  const cmd = local ? { command: process.execPath, args: [BIN] } : { command: 'npx', args: ['-y', 'firstshot'] };
  const hookCmd = local ? `"${process.execPath}" "${BIN}" hook` : 'npx -y firstshot hook';
  const line = local ? agentLine(`node "${BIN}" check`) : AGENT_LINE;
  const done = [];

  const mcpPath = join(dir, '.mcp.json');
  const mcp = readJson(mcpPath);
  mcp.mcpServers = { ...(mcp.mcpServers || {}), firstshot: { command: cmd.command, args: [...cmd.args, 'mcp'] } };
  writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + '\n');
  done.push('.mcp.json: firstshot MCP server');

  const setPath = join(dir, '.claude', 'settings.json');
  mkdirSync(dirname(setPath), { recursive: true });
  const settings = readJson(setPath);
  settings.hooks = settings.hooks || {};
  const stop = (settings.hooks.Stop = settings.hooks.Stop || []);
  if (!JSON.stringify(stop).includes('firstshot')) stop.push({ hooks: [{ type: 'command', command: hookCmd, timeout: 30 }] });
  writeFileSync(setPath, JSON.stringify(settings, null, 2) + '\n');
  done.push('.claude/settings.json: Stop hook that catches outdated majors');

  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    const p = join(dir, f);
    const cur = existsSync(p) ? readFileSync(p, 'utf8') : '';
    if (cur.includes('firstshot check')) continue;
    if (f === 'AGENTS.md' && !existsSync(p)) continue; // only touch AGENTS.md if the project uses it
    writeFileSync(p, (cur && !cur.endsWith('\n') ? cur + '\n' : cur) + (cur ? '\n' : '') + line + '\n');
    done.push(`${f}: one line on checking versions`);
  }
  return done;
}

/** Claude Code Stop hook: exit 2 with a reason (fed back to Claude) while package.json has outdated majors. */
export async function stopHook(stdinText) {
  let input = {};
  try {
    input = JSON.parse(stdinText || '{}');
  } catch {
    /* no input */
  }
  if (input.stop_hook_active) return { code: 0, message: '' }; // already blocked once this turn: don't loop
  try {
    const rep = await checkProject(input.cwd || process.cwd());
    if (!rep.found || !rep.outdated.length) return { code: 0, message: '' };
    return { code: 2, message: `FirstShot: ${formatProjectReport(rep)}` };
  } catch {
    return { code: 0, message: '' }; // never block the agent because FirstShot itself failed
  }
}
