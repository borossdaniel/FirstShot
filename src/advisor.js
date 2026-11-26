// The part of OneShot that agents use: current versions from the npm registry, the
// mistakes agents made with each library on our board, and an outdated-dependency check.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeFacts, packageFacts } from './facts.js';
import { scanProjectFacts } from './livefacts.js';

const here = dirname(fileURLToPath(import.meta.url));
const REGISTRY = () => (process.env.ONESHOT_REGISTRY || 'https://registry.npmjs.org').replace(/\/$/, '');

function readJson(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}
const NOTES = readJson(join(here, '..', 'data', 'notes.json'), {});
const BOARD = readJson(join(here, '..', 'data', 'board.json'), {});

const cache = new Map();

/** Latest published version of a package, from the npm registry (dist-tags.latest). */
export async function latestVersion(name) {
  if (cache.has(name)) return cache.get(name);
  const url = `${REGISTRY()}/${name.replace('/', '%2F')}`;
  const p = (async () => {
    const res = await fetch(url, { headers: { accept: 'application/vnd.npm.install-v1+json' }, signal: AbortSignal.timeout(10_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`npm registry answered ${res.status} for ${name}`);
    const doc = await res.json();
    return doc['dist-tags']?.latest ?? null;
  })();
  cache.set(name, p);
  try {
    return await p;
  } catch (err) {
    cache.delete(name);
    throw err;
  }
}

export const majorOf = (version) => {
  const m = String(version ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

/**
 * Major version a package.json range allows at most, or null when we can't tell
 * (git urls, file:, workspace:, tags like "latest", "*").
 */
export function declaredMajor(range) {
  const r = String(range ?? '').trim();
  if (!r || r === '*' || r === 'latest' || /^(file|link|workspace|git|github|http|https|npm):|\//.test(r)) return null;
  const parts = r.split('||').map((x) => x.trim());
  const majors = parts.map((p) => {
    const m = p.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  });
  if (majors.some((m) => m == null)) return null;
  return Math.max(...majors);
}

/** Latest version on PyPI. */
export async function latestPyPI(name) {
  const key = `pypi:${name}`;
  if (cache.has(key)) return cache.get(key);
  const base = (process.env.ONESHOT_PYPI || 'https://pypi.org').replace(/\/$/, '');
  const p = (async () => {
    const res = await fetch(`${base}/pypi/${encodeURIComponent(name)}/json`, { signal: AbortSignal.timeout(10_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`PyPI answered ${res.status} for ${name}`);
    return (await res.json()).info?.version ?? null;
  })();
  cache.set(key, p);
  try {
    return await p;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

/** "pypi:requests" or "requests" with system 'pypi' -> ['pypi', 'requests'] */
export function parseTarget(arg, system = 'npm') {
  const m = String(arg).match(/^(npm|pypi|pip|python):(.+)$/i);
  if (m) return [m[1].toLowerCase() === 'npm' ? 'npm' : 'pypi', m[2]];
  return [system, arg];
}

async function safeFacts(name, system) {
  try {
    return await packageFacts(name, system);
  } catch {
    return null; // facts are a bonus; never fail the check because deps.dev is slow
  }
}

/** What OneShot knows about one package: latest version, install command, agent notes, board stats. */
export async function adviseOne(name, system = 'npm') {
  if (system === 'pypi') {
    const latest = await latestPyPI(name);
    if (!latest) return { package: name, system, exists: false, advice: `"${name}" is not on PyPI. Check the name: agents sometimes invent package names.` };
    const facts = await safeFacts(name, 'pypi');
    const lines = [`Current version: ${name}==${latest} (major ${majorOf(latest)}). Install with: pip install --upgrade "${name}"  (or: uv add ${name})`];
    lines.push(...(describeFacts(facts) || []));
    return { package: name, system, exists: true, latest, latestMajor: majorOf(latest), install: `pip install --upgrade "${name}"`, facts, notes: [], advice: lines.join('\n') };
  }
  const [latest, facts] = await Promise.all([latestVersion(name), safeFacts(name, 'npm')]);
  if (!latest) {
    return { package: name, exists: false, advice: `"${name}" is not on npm. Check the name: agents sometimes invent package names.` };
  }
  const board = BOARD[name] || null;
  const notes = NOTES[name] || [];
  const lines = [`Current version: ${name}@${latest} (major ${majorOf(latest)}). Install with: npm install ${name}@latest`];
  lines.push(...(describeFacts(facts) || []));
  if (board?.old) {
    lines.push(`On the OneShot board, ${board.old} of ${board.runs} agent runs installed an outdated major (${board.oldVersions.join(', ')}). Do not write a version from memory.`);
  }
  lines.push(...notes);
  return { package: name, system: 'npm', exists: true, latest, latestMajor: majorOf(latest), install: `npm install ${name}@latest`, facts, notes, board, advice: lines.join('\n') };
}

/**
 * Highest major a Python requirement allows, or null when it has no upper limit
 * (">=2" can't be outdated). Handles ==, ===, ~=, <, <=, and Poetry's ^ and ~.
 */
export function declaredMajorPy(spec) {
  const s = String(spec ?? '').split(';')[0].trim();
  if (!s) return null;
  let max = null;
  const take = (m) => { if (m != null) max = max == null ? m : Math.max(max, m); };
  for (const [, op, ver] of s.matchAll(/(===|==|~=|<=|<|\^|~)\s*v?([0-9][0-9.*]*)/g)) {
    const parts = ver.split('.').map((x) => (x === '*' ? 0 : Number(x)));
    if (op === '<') take(parts.slice(1).some((x) => x > 0) ? parts[0] : parts[0] - 1);
    else take(parts[0]);
  }
  return max;
}

/** Python dependencies from requirements*.txt and pyproject.toml: { name: spec } */
export function readPythonDeps(dir) {
  const deps = {};
  const add = (line) => {
    const m = String(line).trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*(.*)$/);
    if (m && !line.trim().startsWith('#') && !line.trim().startsWith('-')) deps[m[1].toLowerCase()] = m[3].trim();
  };
  for (const f of ['requirements.txt', 'requirements-dev.txt', 'requirements/base.txt']) {
    const p = join(dir, f);
    if (existsSync(p)) readFileSync(p, 'utf8').split('\n').forEach(add);
  }
  const py = join(dir, 'pyproject.toml');
  if (existsSync(py)) {
    const t = readFileSync(py, 'utf8');
    const arr = t.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m);
    if (arr) for (const [, q] of arr[1].matchAll(/["']([^"']+)["']/g)) add(q);
    const poetry = t.match(/\[tool\.poetry\.(?:dev-)?dependencies\]([\s\S]*?)(\n\[|$)/);
    if (poetry) {
      for (const [, n, v] of poetry[1].matchAll(/^\s*([A-Za-z0-9._-]+)\s*=\s*["']([^"']+)["']/gm)) if (n !== 'python') deps[n.toLowerCase()] = v;
    }
  }
  return deps;
}

/** Compare every dependency (package.json, requirements.txt, pyproject.toml) with the latest major. */
export async function checkProject(dir = process.cwd()) {
  const pj = join(dir, 'package.json');
  const npmDeps = existsSync(pj) ? (({ dependencies, devDependencies }) => ({ ...(dependencies || {}), ...(devDependencies || {}) }))(readJson(pj, {})) : {};
  const pyDeps = readPythonDeps(dir);
  const facts = await scanProjectFacts(dir).catch(() => []);
  const found = existsSync(pj) || Object.keys(pyDeps).length > 0 || facts.length > 0;
  if (!found) return { dir, found: false, outdated: [], checked: [], skipped: [], facts };
  const checked = [];
  const skipped = [];
  const outdated = [];
  const jobs = [
    ...Object.entries(npmDeps).map(([name, range]) => ({ name, range, system: 'npm', declared: declaredMajor(range) })),
    ...Object.entries(pyDeps).map(([name, range]) => ({ name, range, system: 'pypi', declared: declaredMajorPy(range) })),
  ];
  await Promise.all(jobs.map(async ({ name, range, system, declared }) => {
    if (declared == null) return skipped.push({ name, range, system, reason: system === 'pypi' ? 'no upper version limit' : 'range not comparable' });
    let latest;
    try {
      latest = system === 'pypi' ? await latestPyPI(name) : await latestVersion(name);
    } catch (err) {
      return skipped.push({ name, range, system, reason: err.message });
    }
    if (!latest) return skipped.push({ name, range, system, reason: `not on ${system === 'pypi' ? 'PyPI' : 'npm'}` });
    const latestMajor = majorOf(latest);
    const entry = { name, range, system, declaredMajor: declared, latest, latestMajor };
    checked.push(entry);
    // 0.x packages break on minor versions; compare the minor there.
    const behind = latestMajor === 0 ? false : declared < latestMajor;
    if (behind) outdated.push({ ...entry, behind: latestMajor - declared, notes: system === 'npm' ? NOTES[name] || [] : [] });
  }));
  outdated.sort((a, b) => b.behind - a.behind || a.name.localeCompare(b.name));
  return { dir, found, outdated, checked, skipped, facts };
}

export function formatProjectReport(rep) {
  if (!rep.found) return 'No package.json, requirements.txt or pyproject.toml here, nothing to check.';
  const facts = rep.facts || [];
  if (!rep.outdated.length && !facts.length) return `All ${rep.checked.length} dependencies are on their current major version.`;
  const lines = [];
  if (facts.length) {
    lines.push(`${facts.length} outdated value${facts.length === 1 ? '' : 's'} written from memory:`);
    for (const f of facts) lines.push(`  - ${f.file}: ${f.found} → ${f.fix}`);
  }
  if (!rep.outdated.length) return lines.join('\n');
  lines.push(`${rep.outdated.length} dependenc${rep.outdated.length === 1 ? 'y is' : 'ies are'} on an outdated major version:`);
  for (const o of rep.outdated) {
    lines.push(`  - ${o.name} "${o.range}" → current is ${o.latest} (${o.behind} major${o.behind > 1 ? 's' : ''} behind)`);
    for (const n of o.notes.slice(0, 2)) lines.push(`      ${n}`);
  }
  const npmOld = rep.outdated.filter((o) => o.system !== 'pypi');
  const pyOld = rep.outdated.filter((o) => o.system === 'pypi');
  if (npmOld.length) lines.push(`Fix: npm install ${npmOld.map((o) => `${o.name}@latest`).join(' ')}`);
  if (pyOld.length) lines.push(`Fix: pip install --upgrade ${pyOld.map((o) => `"${o.name}"`).join(' ')}  (and raise the version limit in requirements.txt / pyproject.toml)`);
  lines.push('Then update the code for the new major and run the checks again.');
  return lines.join('\n');
}
