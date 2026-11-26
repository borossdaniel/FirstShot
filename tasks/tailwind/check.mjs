import { runCheck, expectInstalled, expect, fail, sh } from '../../src/check-helpers.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'tailwindcss', 4);
  const pj = join(ws, 'package.json');
  if (!existsSync(pj)) fail('no_solution', 'package.json was not created');
  const scripts = JSON.parse(readFileSync(pj, 'utf8')).scripts || {};
  if (!scripts['build:css']) fail('no_solution', 'npm script build:css is missing');
  if (!existsSync(join(ws, 'src/input.css'))) fail('no_solution', 'src/input.css was not created');

  // Replace the page with our own markup so we know exactly which classes must appear.
  writeFileSync(join(ws, 'index.html'), '<!doctype html><html><body><div class="bg-brand text-brand p-4 sm:flex rounded-xl">x</div></body></html>\n');
  const r = await sh(ws, 'npm run build:css', 120_000);
  if (r.code !== 0) fail('crash', `npm run build:css failed: ${r.out.trim().split('\n').slice(-3).join(' | ').slice(0, 300)}`);
  const out = join(ws, 'dist/output.css');
  if (!existsSync(out)) fail('wrong_behavior', 'dist/output.css was not produced by npm run build:css');
  const css = readFileSync(out, 'utf8');
  for (const cls of ['.bg-brand', '.text-brand', '.p-4', '.rounded-xl']) {
    expect(css.includes(cls), `${cls} is missing from dist/output.css (is index.html scanned?)`);
  }
  expect(/\.sm\\:flex/.test(css), '.sm:flex is missing from dist/output.css');
  expect(/#0e7490/i.test(css), 'the brand colour #0e7490 does not appear in dist/output.css');
  expect(!css.includes('.bg-red-500'), 'output contains unused classes (bg-red-500): content scanning is not limited to used classes');
  return `tailwindcss@${version}: build script, content scanning and brand colour correct`;
});
