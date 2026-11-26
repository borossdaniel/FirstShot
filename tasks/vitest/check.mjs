import { runCheck, expectInstalled, expect, fail, sh } from '../../src/check-helpers.js';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'vitest', 5);
  if (!existsSync(join(ws, 'math.mjs'))) fail('no_solution', 'math.mjs was not created');
  if (!existsSync(join(ws, 'test/math.test.mjs'))) fail('no_solution', 'test/math.test.mjs was not created');

  // Run without CI=1 and with no TTY: a watch-mode script would hang here and time out.
  const good = await sh(ws, 'env -u CI npm test < /dev/null', 90_000);
  if (good.timedOut) fail('wrong_behavior', 'npm test did not exit (watch mode?)');
  if (good.code !== 0) fail('wrong_behavior', `npm test fails on the agent's own code: ${good.out.trim().split('\n').slice(-4).join(' | ').slice(0, 300)}`);
  expect(/vitest|✓|passed/i.test(good.out), 'npm test does not seem to run Vitest');

  // Break each function in turn: the suite must catch it.
  for (const [label, src] of [
    ['sum', 'export const sum = (a, b) => a - b;\nexport const clamp = (n, min, max) => Math.min(Math.max(n, min), max);\n'],
    ['clamp', 'export const sum = (a, b) => a + b;\nexport const clamp = (n, min, max) => Math.max(n, min);\n'],
  ]) {
    writeFileSync(join(ws, 'math.mjs'), src);
    const bad = await sh(ws, 'env -u CI npm test < /dev/null', 90_000);
    if (bad.timedOut) fail('wrong_behavior', 'npm test did not exit on failure (watch mode?)');
    expect(bad.code !== 0, `the tests did not catch a broken ${label}() (npm test still exited 0)`);
  }
  return `vitest@${version}: runs once, passes, and catches broken code`;
});
