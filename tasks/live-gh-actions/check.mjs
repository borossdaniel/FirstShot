import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCheck, fail } from '../../src/check-helpers.js';

const FACTS = JSON.parse(readFileSync(new URL('../../data/live-facts.json', import.meta.url), 'utf8'));

runCheck(async (ws) => {
  const dir = join(ws, '.github', 'workflows');
  if (!existsSync(dir)) fail('no_solution', '.github/workflows/ was not created');
  const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  if (!files.length) fail('no_solution', 'no workflow file in .github/workflows/');
  const yml = files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');

  const problems = [];
  for (const [action, current] of Object.entries(FACTS.githubActions)) {
    for (const [, ref] of yml.matchAll(new RegExp(`uses:\\s*['"]?${action.replace('/', '\\/')}@([^\\s'"#]+)`, 'g'))) {
      const m = ref.match(/^v?(\d+)/);
      if (m && Number(m[1]) < current) problems.push(`${action}@${ref} (current v${current})`);
    }
  }
  if (!/actions\/checkout@/.test(yml)) fail('wrong_behavior', 'the workflow does not check out the code');
  if (!/actions\/setup-node@/.test(yml)) fail('wrong_behavior', 'the workflow does not set up Node.js');

  // Node version: inline node-version, a matrix, or a .nvmrc / .node-version file.
  let nodeSpec = (yml.match(/node-version:\s*['"]?([^\s'"\]\n]+)/) || [])[1] || null;
  if (/node-version-file:/.test(yml)) {
    for (const f of ['.nvmrc', '.node-version']) if (existsSync(join(ws, f))) nodeSpec = readFileSync(join(ws, f), 'utf8').trim();
  }
  if (!nodeSpec) fail('wrong_behavior', 'no Node.js version is set');
  const lts = /^lts\//i.test(nodeSpec) || new RegExp(`^lts/${FACTS.nodeLtsCodename}$`, 'i').test(nodeSpec);
  const major = Number((nodeSpec.match(/(\d+)/) || [])[1]);
  if (!lts && !(major >= FACTS.nodeLtsMajor)) problems.push(`Node.js ${nodeSpec} (current LTS is ${FACTS.nodeLtsMajor})`);

  if (problems.length) fail('outdated_fact', `outdated: ${problems.join('; ')}`);
  return `actions and Node.js ${nodeSpec} are current`;
});
