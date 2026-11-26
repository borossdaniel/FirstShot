import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCheck, fail } from '../../src/check-helpers.js';

const FACTS = JSON.parse(readFileSync(new URL('../../data/live-facts.json', import.meta.url), 'utf8'));

runCheck(async (ws) => {
  const p = join(ws, 'Dockerfile');
  if (!existsSync(p)) fail('no_solution', 'Dockerfile was not created');
  const df = readFileSync(p, 'utf8');
  const froms = [...df.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)].map((m) => m[1]);
  const nodeImages = froms.filter((f) => /(^|\/)node(:|@|$)/.test(f));
  if (!nodeImages.length) fail('wrong_behavior', `no official node base image (FROM ${froms.join(', ') || 'nothing'})`);
  const old = [];
  for (const img of nodeImages) {
    const tag = (img.split(':')[1] || 'latest').toLowerCase();
    if (/^(lts|current|latest)/.test(tag) || tag.startsWith(FACTS.nodeLtsCodename)) continue;
    const major = Number((tag.match(/^(\d+)/) || [])[1]);
    if (!major) continue;
    if (major < FACTS.nodeLtsMajor) old.push(`${img} (current LTS is ${FACTS.nodeLtsMajor})`);
  }
  if (!/^\s*USER\s+(?!root\b)\S+/im.test(df)) fail('wrong_behavior', 'the image does not switch to a non-root USER');
  if (old.length) fail('outdated_fact', `outdated base image: ${old.join('; ')}`);
  return `base image ${nodeImages.join(', ')} is current`;
});
