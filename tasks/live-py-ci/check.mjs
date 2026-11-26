import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCheck, fail } from '../../src/check-helpers.js';

const FACTS = JSON.parse(readFileSync(new URL('../../data/live-facts.json', import.meta.url), 'utf8'));
const ver = (s) => s.split('.').map(Number);
const older = (a, b) => { const [x1, y1] = ver(a), [x2, y2] = ver(b); return x1 < x2 || (x1 === x2 && y1 < y2); };

runCheck(async (ws) => {
  const dir = join(ws, '.github', 'workflows');
  if (!existsSync(dir)) fail('no_solution', '.github/workflows/ was not created');
  const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  if (!files.length) fail('no_solution', 'no workflow file');
  const yml = files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  if (!/actions\/setup-python@/.test(yml)) fail('wrong_behavior', 'the workflow does not set up Python');
  const problems = [];
  for (const a of ['actions/checkout', 'actions/setup-python']) {
    for (const [, ref] of yml.matchAll(new RegExp(`uses:\\s*['"]?${a.replace('/', '\\/')}@([^\\s'"#]+)`, 'g'))) {
      const m = ref.match(/^v?(\d+)/);
      if (m && Number(m[1]) < FACTS.githubActions[a]) problems.push(`${a}@${ref} (current v${FACTS.githubActions[a]})`);
    }
  }
  const specs = [...yml.matchAll(/python-version:\s*\[?([^\n\]]+)/g)].flatMap((m) => m[1].split(',')).map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean);
  if (!specs.length && !/python-version-file:/.test(yml)) fail('wrong_behavior', 'no Python version is set');
  for (const v of specs) {
    if (/^3\.x$/i.test(v)) continue;
    const mm = (v.match(/^(\d+\.\d+)/) || [])[1];
    if (mm && older(mm, FACTS.pythonLatest)) problems.push(`python-version ${v} (latest is ${FACTS.pythonLatest})`);
  }
  if (problems.length) fail('outdated_fact', `outdated: ${problems.join('; ')}`);
  return `actions and Python ${specs.join(', ') || '(from file)'} are current`;
});
