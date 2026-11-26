import { runCheck, expectInstalled, expect, fail, sh } from '../../src/check-helpers.js';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'eslint', 10);
  const pj = join(ws, 'package.json');
  if (!existsSync(pj)) fail('no_solution', 'package.json was not created');
  if (!(JSON.parse(readFileSync(pj, 'utf8')).scripts || {}).lint) fail('no_solution', 'npm script lint is missing');

  const ok = await sh(ws, 'npm run lint', 120_000);
  if (ok.code !== 0) fail('wrong_behavior', `npm run lint fails on the agent's own code: ${ok.out.trim().split('\n').slice(-4).join(' | ').slice(0, 300)}`);

  writeFileSync(join(ws, 'src', 'firstshot-probe.js'), [
    'export function check(a, b) {',
    '  const unused = 1;',
    '  console.log(process.env.HOME);',
    '  return a == b;',
    '}',
    '',
  ].join('\n'));
  const r = await sh(ws, 'node node_modules/eslint/bin/eslint.js src/firstshot-probe.js --format json', 120_000);
  let report;
  try {
    report = JSON.parse(r.out.slice(r.out.indexOf('[')));
  } catch {
    fail('crash', `eslint did not run: ${r.out.trim().split('\n').slice(-3).join(' | ').slice(0, 300)}`);
  }
  const msgs = report[0]?.messages || [];
  const sev = (rule) => msgs.find((x) => x.ruleId === rule)?.severity;
  expect(sev('eqeqeq') === 2, `eqeqeq should be an error (got ${sev('eqeqeq') ?? 'not reported'})`);
  expect(sev('no-unused-vars') === 2, `no-unused-vars (from recommended) should be an error (got ${sev('no-unused-vars') ?? 'not reported'})`);
  expect(sev('no-console') === 1, `no-console should be a warning (got ${sev('no-console') ?? 'not reported'})`);
  expect(!msgs.some((x) => x.ruleId === 'no-undef'), '`process` is reported as undefined: Node.js globals are not configured');
  return `eslint@${version}: config, rules and globals correct`;
});
