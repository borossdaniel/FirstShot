import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCheck, fail } from '../../src/check-helpers.js';

const FACTS = JSON.parse(readFileSync(new URL('../../data/live-facts.json', import.meta.url), 'utf8'));
const ver = (s) => s.split('.').map(Number);
const older = (a, b) => { const [x1, y1] = ver(a), [x2, y2] = ver(b); return x1 < x2 || (x1 === x2 && y1 < y2); };

runCheck(async (ws) => {
  const p = join(ws, 'Dockerfile');
  if (!existsSync(p)) fail('no_solution', 'Dockerfile was not created');
  const df = readFileSync(p, 'utf8');
  const imgs = [...df.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)].map((m) => m[1]).filter((i) => /(^|\/)python(:|@|$)/.test(i));
  if (!imgs.length) fail('wrong_behavior', 'no official python base image');
  if (!/^\s*USER\s+(?!root\b)\S+/im.test(df)) fail('wrong_behavior', 'the image does not switch to a non-root USER');
  const old = [];
  for (const img of imgs) {
    const tag = (img.split(':')[1] || 'latest').toLowerCase();
    const mm = (tag.match(/^(\d+\.\d+)/) || [])[1];
    if (mm && older(mm, FACTS.pythonLatest)) old.push(`${img} (latest is ${FACTS.pythonLatest})`);
  }
  if (old.length) fail('outdated_fact', `outdated base image: ${old.join('; ')}`);
  return `base image ${imgs.join(', ')} is current`;
});
