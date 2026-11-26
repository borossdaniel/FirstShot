// Live facts for coding agents: values an agent tends to write from memory and can't
// fetch with "@latest": current AI model names, GitHub Actions versions, runtime LTS
// versions and matching Docker images. Sources:
//   runtimes        endoflife.date (Node.js, Python)
//   GitHub Actions  GitHub releases (latest tag per action)
//   AI models       data/models.json (curated; refreshed from the providers' model lists)
// Results are cached on disk for 6 hours so agents get answers instantly.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatRules, loadRules, modelRule } from './rules.js';

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
  const headers = { accept: 'application/json', 'user-agent': 'oneshot-agent' };
  // In GitHub Actions, use the job token so GitHub's API limit (60/hour without it) isn't hit.
  if (url.startsWith(GH()) && process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

const today = () => process.env.ONESHOT_TODAY || new Date().toISOString().slice(0, 10);

// Hosted facts (oneshotagent.dev/facts.json) are refreshed from live sources every few hours,
// so they're newer than the data shipped in the npm package. Used first; direct sources and
// the bundled data are the fallback. Set ONESHOT_FACTS_URL=off to skip.
let HOSTED = null;
export async function loadHosted() {
  const env = process.env.ONESHOT_FACTS_URL;
  if (env === 'off') return null;
  if (HOSTED) return HOSTED;
  const urls = env ? [env] : ['https://oneshotagent.dev/facts.json', 'https://oneshot-tawny.vercel.app/facts.json'];
  try {
    HOSTED = await cached('hosted', async () => {
      for (const u of urls) {
        try {
          const r = await fetch(u, { headers: { 'user-agent': 'oneshot-agent' }, signal: AbortSignal.timeout(5000) });
          if (!r.ok) continue;
          const d = await r.json();
          if (d && d.generatedAt && d.models) return d;
        } catch {
          /* try the next one */
        }
      }
      throw new Error('hosted facts unreachable');
    });
  } catch {
    HOSTED = null;
  }
  return HOSTED;
}
const daysUntil = (date) => Math.round((Date.parse(date) - Date.parse(today())) / 86400000);

/** Official retirement schedules (data/retirements.json), keyed by model name. */
export function retirements() {
  if (HOSTED?.retirements?.models) return { ...HOSTED.retirements, index: new Map(HOSTED.retirements.models.map((r) => [r.model, r])) };
  const p = join(here, '..', 'data', 'retirements.json');
  if (!existsSync(p)) return { index: new Map(), rows: [] };
  const d = JSON.parse(readFileSync(p, 'utf8'));
  return { ...d, index: new Map(d.models.map((r) => [r.model, r])) };
}

/** Is this model retired, retiring soon, or fine? */
export function modelStatus(id) {
  const r = retirements().index.get(id);
  if (!r) return null;
  const days = daysUntil(r.retires);
  // The provider's official replacement can itself be old by now; name the newest model too.
  let use = r.replacement;
  try {
    const newest = newerFor(models(), String(r.replacement).split(' ')[0]);
    const current = new Set(Object.values(models().providers || {}).flatMap((p) => p.newest.concat(p.alsoCurrent || [])));
    if (newest && !current.has(String(r.replacement).split(' ')[0]) && newest !== r.replacement) use = `${r.replacement} (newest: ${newest})`;
  } catch {
    /* keep the official replacement */
  }
  if (days <= 0) return { ...r, replacement: use, state: 'retired', days, level: 'error', message: `${id} was retired on ${r.retires}. Requests to it fail. Use ${use}.` };
  return { ...r, replacement: use, state: 'retiring', days, level: days <= 60 ? 'error' : 'warning', message: `${id} retires on ${r.retires} (in ${days} day${days === 1 ? '' : 's'}). After that, requests fail. Use ${use}.` };
}

/** Node.js and Python: current LTS / latest, plus matching Docker image tags. */
export function runtimes() {
  if (HOSTED?.runtimes?.node?.ltsMajor) return Promise.resolve(HOSTED.runtimes);
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
        supportedMajors: node.filter(supported).map((x) => Number(x.cycle)).filter((n) => n >= 4),
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
  if (HOSTED?.actions && Object.keys(HOSTED.actions).length > 5) return Promise.resolve(HOSTED.actions);
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
  if (HOSTED?.models?.providers) return HOSTED.models;
  const p = join(here, '..', 'data', 'models.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { providers: {} };
}

export async function currentFacts(topic = 'all', dir = process.cwd()) {
  await loadHosted();
  const want = (t) => topic === 'all' || topic === t;
  const out = {};
  const errors = [];
  if (want('models')) out.models = models();
  if (want('runtimes')) out.runtimes = await runtimes().catch((e) => (errors.push(e.message), null));
  if (want('github-actions')) out.actions = await actions().catch((e) => (errors.push(e.message), null));
  out.rules = await loadRules(dir);
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
  const soon = retirements().models
    .filter((r) => !r.alias && daysUntil(r.retires) > 0 && daysUntil(r.retires) <= 120)
    .sort((a, b) => a.retires.localeCompare(b.retires));
  if (soon.length) {
    lines.push(`Retiring soon (don't use; requests will fail after the date): ${soon.slice(0, 10).map((r) => `${r.model} on ${r.retires} → ${r.replacement}`).join('; ')}.`);
  }
  if (f.errors?.length) lines.push(`(Some sources were unreachable: ${f.errors.join('; ')})`);
  const team = formatRules(f.rules);
  if (team) lines.push(team);
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

/** The newest model from the same provider (and the same family, like haiku or sonnet, when there is one). */
function newerFor(m, id) {
  const prov = /^claude-/.test(id) ? m.providers?.anthropic : m.providers?.openai;
  const list = prov?.newest || Object.values(m.providers || {}).map((p) => p.newest[0]);
  const fam = id.match(/^claude-(opus|sonnet|haiku|fable|mythos)/)?.[1];
  if (fam) return list.find((x) => x.includes(`-${fam}-`)) || list[0];
  const line = id.match(/^gpt-[\d.]+-([a-z]+)/)?.[1]; // gpt-6.1-sol -> sol
  return (line && list.find((x) => x.endsWith(`-${line}`))) || list[0];
}

/** Find outdated model names, GitHub Action versions and runtime images in a project. */
export async function scanProjectFacts(dir) {
  dir = resolve(dir);
  const relOf = (f) => relative(dir, f).split(sep).join('/');
  const lineAt = (text, idx) => text.slice(0, idx).split('\n').length;
  await loadHosted();
  const rules = await loadRules(dir);
  const problems = [];
  const m = models();
  const allCurrent = new Set(Object.values(m.providers || {}).flatMap((p) => p.newest.concat(p.alsoCurrent || [])));
  const oldModel = new RegExp(Object.values(m.providers || {}).map((p) => p.outdatedPattern).filter(Boolean).join('|') || '$^');
  const codeFile = (p) => (/\.(m?[jt]sx?|cjs|py|json|ya?ml|toml|go|rb|java|kt|cs|php|rs|swift)$/.test(p) || /(^|\/)\.env(\.[\w-]+)?$/.test(p)) && !/(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.oneshot\.json)$/.test(p);
  const MODEL = /(?<![\w./@-])((?:claude-[a-z0-9.-]*[a-z0-9])|(?:gpt-[0-9](?:[a-z0-9.-]*[a-z0-9])?)|chatgpt-4o-latest|text-davinci-00\d|(?:babbage|davinci)-002)(?![\w.-])/g;
  const OMODEL = /['"`](o[1-4](?:-[a-z0-9-]+)?)['"`]/g;
  for (const f of listFiles(dir, codeFile)) {
    const rel = relOf(f);
    readFileSync(f, 'utf8').split('\n').forEach((text, i) => {
      const ids = new Set([...text.matchAll(MODEL)].map((x) => x[1]).concat([...text.matchAll(OMODEL)].map((x) => x[1])));
      for (const id of ids) {
        const team = modelRule(rules, id);
        if (team && !team.ok) {
          problems.push({ kind: 'team-rule', level: 'error', file: rel, line: i + 1, found: id, fix: (rules.models.allowed || [])[0] || 'an approved model', message: team.why });
          continue;
        }
        const st = modelStatus(id);
        if (st) {
          problems.push({ kind: st.state === 'retired' ? 'model-retired' : 'model-retiring', level: st.level, file: rel, line: i + 1, found: id, fix: st.replacement, message: st.message, retires: st.retires });
        } else if (!allCurrent.has(id) && oldModel.test(id)) {
          const better = newerFor(m, id);
          problems.push({ kind: 'model', level: 'warning', file: rel, line: i + 1, found: id, fix: better, message: `${id} is an older model. Newer: ${better}.` });
        }
      }
    });
  }
  const wf = join(dir, '.github', 'workflows');
  const ymls = existsSync(wf) ? readdirSync(wf).filter((f) => /\.ya?ml$/.test(f)).map((f) => join(wf, f)) : [];
  const dockerfiles = listFiles(dir, (p) => /(^|\/)Dockerfile[^/]*$/.test(p), 20);
  if (ymls.length || dockerfiles.length) {
    const [acts, rt] = await Promise.all([actions().catch(() => ({})), runtimes().catch(() => null)]);
    for (const f of ymls) {
      const y = readFileSync(f, 'utf8');
      for (const mt of y.matchAll(/uses:\s*['"]?([\w.-]+\/[\w.-]+)@([^\s'"#]+)/g)) {
        const [, a, ref] = mt;
        const cur = acts[a];
        // Only version tags (v4, v4.1.2) are compared; commit SHAs and branch names are left alone.
        const mj = /^v?\d+(\.\d+){0,2}$/.test(ref) ? Number(ref.match(/^v?(\d+)/)[1]) : null;
        if (cur && mj && mj < cur) problems.push({ kind: 'github-action', level: 'warning', file: relOf(f), line: lineAt(y, mt.index), found: `${a}@${ref}`, fix: `${a}@v${cur}`, message: `${a}@${ref} is outdated; current is v${cur}.` });
      }
      const nvm = y.match(/node-version:\s*['"]?(\d+)/);
      const nv = nvm?.[1];
      if (rt?.node?.ltsMajor && nv && Number(nv) < rt.node.ltsMajor) {
        const eol = rt.node.supportedMajors?.length && !rt.node.supportedMajors.includes(Number(nv));
        problems.push({ kind: 'runtime', level: eol ? 'error' : 'warning', file: relOf(f), line: lineAt(y, nvm?.index ?? 0), found: `node-version ${nv}`, fix: `node-version: ${rt.node.ltsMajor}`, message: eol ? `Node.js ${nv} is end-of-life: no more security fixes. Use node-version: ${rt.node.ltsMajor}.` : `Node.js ${nv} is behind the current LTS (${rt.node.ltsMajor}).` });
      }
    }
    for (const f of dockerfiles) {
      const d = readFileSync(f, 'utf8');
      for (const mt of d.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)) {
        const img = mt[1];
        const line = lineAt(d, mt.index + mt[0].length);
        const [name, tag = ''] = img.split(':');
        const base = name.split('/').pop();
        if (base === 'node' && rt?.node?.ltsMajor) {
          const mj = Number((tag.match(/^(\d+)/) || [])[1]);
          if (mj && mj < rt.node.ltsMajor) problems.push({ kind: 'runtime', level: rt.node.supportedMajors.includes(mj) ? 'warning' : 'error', file: relOf(f), line, found: img, fix: `node:${rt.node.ltsMajor}-alpine`, message: rt.node.supportedMajors.includes(mj) ? `${img} is behind the current Node.js LTS (${rt.node.ltsMajor}).` : `${img} is end-of-life: no more security fixes. Use node:${rt.node.ltsMajor}-alpine.` });
        }
        if (base === 'python' && rt?.python?.supported?.length) {
          const ver = (tag.match(/^(\d+\.\d+)/) || [])[1];
          if (ver && !rt.python.supported.includes(ver)) problems.push({ kind: 'runtime', level: 'error', file: relOf(f), line, found: img, fix: `python:${rt.python.latest}-slim`, message: `${img} is end-of-life: no more security fixes. Use python:${rt.python.latest}-slim.` });
        }
      }
    }
  }
  return problems;
}
