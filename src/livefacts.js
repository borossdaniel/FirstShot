// Live facts for coding agents: values an agent tends to write from memory and can't
// fetch with "@latest": current AI model names, GitHub Actions versions, runtime LTS
// versions and matching Docker images. Sources:
//   runtimes        endoflife.date (Node.js, Python)
//   GitHub Actions  GitHub releases (latest tag per action)
//   AI models       data/models.json (curated; refreshed from the providers' model lists)
// Results are cached on disk for 6 hours so agents get answers instantly.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TTL_MS = 6 * 3600 * 1000;
const EOL = () => (process.env.ONESHOT_EOL || 'https://endoflife.date').replace(/\/$/, '');
const GH = () => (process.env.ONESHOT_GITHUB || 'https://api.github.com').replace(/\/$/, '');
const CACHE = () => process.env.ONESHOT_FACTS_CACHE || join(tmpdir(), 'oneshot-live-facts.json');

export const ACTIONS = [
  'actions/checkout', 'actions/setup-node', 'actions/setup-python', 'actions/setup-go', 'actions/setup-java',
  'actions/cache', 'actions/upload-artifact', 'actions/download-artifact', 'actions/github-script',
  'docker/login-action', 'docker/setup-buildx-action', 'docker/build-push-action', 'docker/setup-qemu-action',
  'pnpm/action-setup',
];

function readCache() {
  try {
    return JSON.parse(readFileSync(CACHE(), 'utf8'));
  } catch {
    return {};
  }
}
function writeCache(c) {
  try {
    writeFileSync(CACHE(), JSON.stringify(c));
  } catch {
    /* cache is optional */
  }
}
async function cached(key, fn) {
  const c = readCache();
  if (c[key] && Date.now() - c[key].at < TTL_MS) return c[key].value;
  const value = await fn();
  const c2 = readCache();
  c2[key] = { at: Date.now(), value };
  writeCache(c2);
  return value;
}
async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'oneshot-agent' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

const today = () => new Date().toISOString().slice(0, 10);

/** Node.js and Python: current LTS / latest, plus matching Docker image tags. */
export function runtimes() {
  return cached('runtimes', async () => {
    const [node, py] = await Promise.all([getJson(`${EOL()}/api/nodejs.json`), getJson(`${EOL()}/api/python.json`)]);
    const supported = (x) => x.eol === false || String(x.eol) > today();
    const lts = node.find((x) => x.lts && supported(x));
    const nodeLatest = node.find((x) => supported(x));
    const pyLatest = py.find((x) => supported(x));
    return {
      node: {
        ltsMajor: lts ? Number(lts.cycle) : null,
        ltsVersion: lts?.latest ?? null,
        currentMajor: nodeLatest ? Number(nodeLatest.cycle) : null,
        supportedMajors: node.filter(supported).map((x) => Number(x.cycle)),
        docker: lts ? `node:${lts.cycle}-alpine (or node:${lts.cycle}-slim)` : null,
        githubActions: lts ? `node-version: ${lts.cycle}` : null,
      },
      python: {
        latest: pyLatest?.cycle ?? null,
        latestVersion: pyLatest?.latest ?? null,
        supported: py.filter(supported).map((x) => x.cycle),
        docker: pyLatest ? `python:${pyLatest.cycle}-slim` : null,
      },
    };
  });
}

/** Latest major for popular GitHub Actions. */
export function actions() {
  return cached('actions', async () => {
    const out = {};
    await Promise.all(ACTIONS.map(async (a) => {
      try {
        const rel = await getJson(`${GH()}/repos/${a}/releases/latest`);
        const m = String(rel.tag_name || '').match(/^v?(\d+)/);
        if (m) out[a] = Number(m[1]);
      } catch {
        /* skip one action rather than fail all */
      }
    }));
    return out;
  });
}

/** Current AI model names (curated list shipped with the package). */
export function models() {
  const p = join(here, '..', 'data', 'models.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { providers: {} };
}

export async function currentFacts(topic = 'all') {
  const want = (t) => topic === 'all' || topic === t;
  const out = {};
  const errors = [];
  if (want('models')) out.models = models();
  if (want('runtimes')) out.runtimes = await runtimes().catch((e) => (errors.push(e.message), null));
  if (want('github-actions')) out.actions = await actions().catch((e) => (errors.push(e.message), null));
  return { ...out, errors };
}

export function formatFacts(f) {
  const lines = [`Current facts (${today()}). Use these instead of values from memory.`];
  if (f.models?.providers) {
    for (const [prov, m] of Object.entries(f.models.providers)) {
      lines.push(`AI models, ${prov}: newest ${m.newest.join(', ')}${m.notes ? `. ${m.notes}` : ''} Outdated: ${m.outdatedExamples.join(', ')}.`);
    }
  }
  if (f.runtimes?.node?.ltsMajor) {
    const n = f.runtimes.node;
    lines.push(`Node.js: current LTS is ${n.ltsMajor} (${n.ltsVersion}). Docker: ${n.docker}. GitHub Actions setup-node: ${n.githubActions}.`);
  }
  if (f.runtimes?.python?.latest) {
    const p = f.runtimes.python;
    lines.push(`Python: latest is ${p.latest} (${p.latestVersion}); supported ${p.supported.join(', ')}. Docker: ${p.docker}.`);
  }
  if (f.actions && Object.keys(f.actions).length) {
    lines.push(`GitHub Actions (use these majors): ${Object.entries(f.actions).map(([a, v]) => `${a}@v${v}`).join(', ')}.`);
  }
  if (f.errors?.length) lines.push(`(Some sources were unreachable: ${f.errors.join('; ')})`);
  return lines.join('\n');
}

// ---------- project scan: outdated facts already written into a project ----------

const SKIP = /node_modules|\.git\/|dist\/|build\/|\.next\//;
function listFiles(dir, test, max = 400) {
  const out = [];
  const walk = (d) => {
    if (out.length >= max) return;
    let names = [];
    try {
      names = readdirSync(d);
    } catch {
      return;
    }
    for (const n of names) {
      const p = join(d, n);
      if (SKIP.test(p + '/')) continue;
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      else if (test(p) && st.size < 500_000) out.push(p);
      if (out.length >= max) return;
    }
  };
  walk(dir);
  return out;
}

/** Find outdated model names, GitHub Action versions and runtime images in a project. */
export async function scanProjectFacts(dir) {
  const problems = [];
  const m = models();
  const allCurrent = new Set(Object.values(m.providers || {}).flatMap((p) => p.newest.concat(p.alsoCurrent || [])));
  const oldModel = new RegExp(Object.values(m.providers || {}).map((p) => p.outdatedPattern).filter(Boolean).join('|') || '$^');
  for (const f of listFiles(dir, (p) => /\.(m?[jt]sx?|cjs|py|env|json|ya?ml|toml)$/.test(p) && !/package-lock\.json$/.test(p))) {
    const src = readFileSync(f, 'utf8');
    for (const [, id] of src.matchAll(/['"`]((?:claude|gpt|o\d)[a-z0-9.:-]*)['"`]/g)) {
      if (!allCurrent.has(id) && oldModel.test(id)) problems.push({ kind: 'model', file: f.slice(dir.length + 1), found: id, fix: `use a current model (${Object.values(m.providers).map((p) => p.newest[0]).join(', ')})` });
    }
  }
  const wf = join(dir, '.github', 'workflows');
  const ymls = existsSync(wf) ? readdirSync(wf).filter((f) => /\.ya?ml$/.test(f)).map((f) => join(wf, f)) : [];
  const dockerfiles = listFiles(dir, (p) => /(^|\/)Dockerfile[^/]*$/.test(p), 20);
  if (ymls.length || dockerfiles.length) {
    const [acts, rt] = await Promise.all([actions().catch(() => ({})), runtimes().catch(() => null)]);
    for (const f of ymls) {
      const y = readFileSync(f, 'utf8');
      for (const [, a, ref] of y.matchAll(/uses:\s*['"]?([\w.-]+\/[\w.-]+)@([^\s'"#]+)/g)) {
        const cur = acts[a];
        const mj = Number((ref.match(/^v?(\d+)/) || [])[1]);
        if (cur && mj && mj < cur) problems.push({ kind: 'github-action', file: f.slice(dir.length + 1), found: `${a}@${ref}`, fix: `${a}@v${cur}` });
      }
      const nv = (y.match(/node-version:\s*['"]?(\d+)/) || [])[1];
      if (rt?.node?.ltsMajor && nv && Number(nv) < rt.node.ltsMajor) problems.push({ kind: 'runtime', file: f.slice(dir.length + 1), found: `node-version ${nv}`, fix: `node-version: ${rt.node.ltsMajor}` });
    }
    for (const f of dockerfiles) {
      const d = readFileSync(f, 'utf8');
      for (const [, img] of d.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)) {
        const [name, tag = ''] = img.split(':');
        const base = name.split('/').pop();
        if (base === 'node' && rt?.node?.ltsMajor) {
          const mj = Number((tag.match(/^(\d+)/) || [])[1]);
          if (mj && mj < rt.node.ltsMajor) problems.push({ kind: 'runtime', file: f.slice(dir.length + 1), found: img, fix: `node:${rt.node.ltsMajor}-alpine` });
        }
        if (base === 'python' && rt?.python?.supported?.length) {
          const ver = (tag.match(/^(\d+\.\d+)/) || [])[1];
          if (ver && !rt.python.supported.includes(ver)) problems.push({ kind: 'runtime', file: f.slice(dir.length + 1), found: img, fix: `python:${rt.python.latest}-slim` });
        }
      }
    }
  }
  return problems;
}
