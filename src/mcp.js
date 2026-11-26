// OneShot as an MCP server over stdio (newline-delimited JSON-RPC), no dependencies.
// Tools: check_package, check_project.

import { createInterface } from 'node:readline';
import { adviseOne, checkProject, formatProjectReport, parseTarget } from './advisor.js';
import { currentFacts, formatFacts } from './livefacts.js';
import { VERSION } from './runner.js';

const INSTRUCTIONS =
  'Before adding or upgrading a dependency (npm or Python), call check_package with its name and install the version it reports ' +
  '(npm install <name>@latest). Never write a dependency version from memory: agents often install majors that are years old. ' +
  'Before writing AI model names, GitHub Actions versions, Node/Python versions or Docker base images, call current_facts and use exactly what it returns. ' +
  'Before saying you are done, call check_project to catch anything outdated.';

const TOOLS = [
  {
    name: 'current_facts',
    description: 'Today\'s values that agents usually get wrong from memory: the newest AI model names, current GitHub Actions versions, Node.js/Python LTS versions and matching Docker images. Call before writing any of these.',
    inputSchema: { type: 'object', properties: { topic: { type: 'string', enum: ['all', 'models', 'github-actions', 'runtimes'], description: 'Default all' } } },
  },
  {
    name: 'check_package',
    description: 'Get the current version of an npm or Python package, the exact install command, and the mistakes coding agents commonly make with it. Call before adding or upgrading any dependency.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Package name, e.g. "zod", "@supabase/supabase-js", or "pypi:pydantic"' }, ecosystem: { type: 'string', enum: ['npm', 'pypi'], description: 'Default npm' } }, required: ['name'] },
  },
  {
    name: 'check_project',
    description: "Check a project's package.json, requirements.txt and pyproject.toml for dependencies on an outdated major version. Call before finishing a task that touched dependencies.",
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Project folder (default: the current folder)' } } },
  },
];

async function callTool(name, args = {}) {
  if (name === 'check_package') {
    const names = String(args.name || '').split(/[\s,]+/).filter(Boolean);
    if (!names.length) return { isError: true, text: 'Give a package name.' };
    const out = await Promise.all(names.map((n) => adviseOne(...parseTarget(n, args.ecosystem === 'pypi' ? 'pypi' : 'npm').reverse())));
    return { text: out.map((o) => o.advice).join('\n\n') };
  }
  if (name === 'current_facts') {
    return { text: formatFacts(await currentFacts(args.topic || 'all')) };
  }
  if (name === 'check_project') {
    const rep = await checkProject(args.path || process.cwd());
    return { text: formatProjectReport(rep), isError: false };
  }
  return { isError: true, text: `Unknown tool ${name}` };
}

export function startMcpServer({ input = process.stdin, output = process.stdout } = {}) {
  const send = (msg) => output.write(JSON.stringify(msg) + '\n');
  const rl = createInterface({ input });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    const { id, method, params } = msg;
    if (id === undefined) return; // notification
    try {
      if (method === 'initialize') {
        return send({ jsonrpc: '2.0', id, result: {
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'oneshot', version: VERSION },
          instructions: INSTRUCTIONS,
        } });
      }
      if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
      if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      if (method === 'tools/call') {
        let r;
        try {
          r = await callTool(params?.name, params?.arguments);
        } catch (err) {
          r = { isError: true, text: `OneShot could not check this right now: ${err.message}` };
        }
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.text }], isError: !!r.isError } });
      }
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    } catch (err) {
      send({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
    }
  });
  return rl;
}
