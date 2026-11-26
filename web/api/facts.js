// GET /facts.json — today's facts for coding agents, assembled from live sources and
// cached at the edge for 6 hours. The OneShot CLI and MCP server read this first, so
// facts stay current without a new npm release.
//
// Sources: endoflife.date (Node.js, Python), GitHub releases (Actions majors),
// the official Anthropic and OpenAI SDK model lists (newest models), and the curated
// retirement schedules in ./_data/retirements.json (from the providers' deprecation pages).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const readData = (f) => JSON.parse(readFileSync(join(here, '_data', f), 'utf8'));

const ACTIONS = [
  'actions/checkout', 'actions/setup-node', 'actions/setup-python', 'actions/setup-go', 'actions/setup-java',
  'actions/cache', 'actions/upload-artifact', 'actions/download-artifact', 'actions/github-script',
  'docker/login-action', 'docker/setup-buildx-action', 'docker/build-push-action', 'docker/setup-qemu-action',
  'pnpm/action-setup',
];
const today = () => new Date().toISOString().slice(0, 10);
const T = (ms) => AbortSignal.timeout(ms);

async function json(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'oneshot-facts' }, signal: T(8000) });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
async function text(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'oneshot-facts' }, signal: T(8000) });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.text();
}

async function runtimes() {
  const [node, py] = await Promise.all([json('https://endoflife.date/api/nodejs.json'), json('https://endoflife.date/api/python.json')]);
  const ok = (x) => x.eol === false || String(x.eol) > today();
  const lts = node.find((x) => x.lts && ok(x));
  const pyl = py.find(ok);
  return {
    node: { ltsMajor: Number(lts.cycle), ltsVersion: lts.latest, currentMajor: Number(node.find(ok).cycle), supportedMajors: node.filter(ok).map((x) => Number(x.cycle)), docker: `node:${lts.cycle}-alpine (or node:${lts.cycle}-slim)`, githubActions: `node-version: ${lts.cycle}` },
    python: { latest: pyl.cycle, latestVersion: pyl.latest, supported: py.filter(ok).map((x) => x.cycle), docker: `python:${pyl.cycle}-slim` },
  };
}

/** Latest major per action, from the github.com "releases/latest" redirect (no API rate limit). */
async function actions() {
  const out = {};
  await Promise.all(ACTIONS.map(async (a) => {
    try {
      const r = await fetch(`https://github.com/${a}/releases/latest`, { redirect: 'manual', signal: T(8000) });
      const loc = r.headers.get('location') || '';
      const m = loc.match(/\/tag\/v?(\d+)/);
      if (m) out[a] = Number(m[1]);
    } catch {
      /* skip */
    }
  }));
  return out;
}

const vnum = (s) => s.split('.').map(Number);
const cmp = (a, b) => { const x = vnum(a), y = vnum(b); return (x[0] - y[0]) || ((x[1] || 0) - (y[1] || 0)); };

/** Newest model names, read from the official SDKs' model lists on npm. */
async function sdkModels() {
  const out = {};
  try {
    const src = await text('https://unpkg.com/@anthropic-ai/sdk@latest/resources/messages/messages.d.ts');
    const fam = {};
    for (const [, f, maj, min] of src.matchAll(/'claude-([a-z]+)-(\d+)(?:-(\d))?'/g)) {
      if (['opus', 'sonnet', 'haiku', 'fable', 'mythos'].includes(f)) {
        const v = `${maj}.${min || 0}`;
        if (!fam[f] || cmp(v, fam[f].v) > 0) fam[f] = { v, id: `claude-${f}-${maj}${min ? `-${min}` : ''}` };
      }
    }
    const top = Object.values(fam).map((x) => x.v).sort(cmp).pop();
    out.anthropic = Object.values(fam).filter((x) => vnum(x.v)[0] === vnum(top)[0]).sort((a, b) => cmp(b.v, a.v)).map((x) => x.id);
  } catch {
    /* fall back to the curated list */
  }
  try {
    const src = await text('https://unpkg.com/openai@latest/resources/shared.d.ts');
    const ids = [...new Set([...src.matchAll(/'(gpt-(\d+(?:\.\d+)?)(-[a-z]+)?)'/g)].map((m) => ({ id: m[1], v: m[2], tail: m[3] || '' })))];
    const top = ids.map((x) => x.v).sort(cmp).pop();
    out.openai = [...new Set(ids.filter((x) => x.v === top && !/healthcare|law|cyber/.test(x.tail)).map((x) => x.id))];
  } catch {
    /* fall back */
  }
  return out;
}

export default async function handler(req, res) {
  const models = readData('models.json');
  const retire = readData('retirements.json');
  const errors = [];
  const [rt, acts, sdk] = await Promise.all([
    runtimes().catch((e) => (errors.push(`runtimes: ${e.message}`), null)),
    actions().catch((e) => (errors.push(`actions: ${e.message}`), {})),
    sdkModels().catch((e) => (errors.push(`models: ${e.message}`), {})),
  ]);
  for (const [prov, ids] of Object.entries(sdk)) {
    if (ids?.length && models.providers[prov]) {
      models.providers[prov].newest = ids;
      models.providers[prov].source = 'official SDK model list (npm, latest)';
    }
  }
  models.checkedAt = today();
  const body = { generatedAt: new Date().toISOString(), runtimes: rt, actions: acts, models, retirements: retire, errors };
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  res.status(200).send(JSON.stringify(body));
}
