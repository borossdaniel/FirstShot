// Facts about any npm or PyPI package, from deps.dev (Google's open package database):
// current version, when its major version came out, the previous major, deprecation.
// From those we estimate how likely an AI agent is to install an outdated version:
// models learn from data that is months to years old, so a young major is a trap.

const DEPS_DEV = () => (process.env.FIRSTSHOT_DEPSDEV || 'https://api.deps.dev').replace(/\/$/, '');
const cache = new Map();

const isPre = (v) => /-/.test(v);
const majorOf = (v) => {
  const m = String(v).match(/^v?(\d+)/);
  return m ? Number(m[1]) : null;
};
const monthsBetween = (a, b) => (b - a) / (30.44 * 24 * 3600 * 1000);

/** system: 'npm' | 'pypi' */
export async function packageFacts(name, system = 'npm', { now = Date.now() } = {}) {
  const key = `${system}:${name}`;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const url = `${DEPS_DEV()}/v3/systems/${system}/packages/${encodeURIComponent(name)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) return { name, system, exists: false };
    if (!res.ok) throw new Error(`deps.dev answered ${res.status} for ${system}:${name}`);
    const doc = await res.json();
    const versions = (doc.versions || [])
      .map((v) => ({ v: v.versionKey.version, at: v.publishedAt ? Date.parse(v.publishedAt) : null, def: v.isDefault, dep: v.isDeprecated, why: v.deprecatedReason }))
      .filter((v) => v.at);
    const latest = versions.find((v) => v.def) || versions.filter((v) => !isPre(v.v)).sort((a, b) => b.at - a.at)[0];
    if (!latest) return { name, system, exists: true, latest: null };
    const major = majorOf(latest.v);
    const stable = versions.filter((v) => !isPre(v.v));
    const ofMajor = stable.filter((v) => majorOf(v.v) === major);
    const majorSince = Math.min(...ofMajor.map((v) => v.at));
    const older = stable.filter((v) => majorOf(v.v) < major).sort((a, b) => b.at - a.at);
    const prev = older[0] || null;
    // New majors (first release of each major) in the last two years; backports to old majors don't count.
    const firstOfMajor = new Map();
    for (const v of stable) { const mj = majorOf(v.v); if (!firstOfMajor.has(mj) || v.at < firstOfMajor.get(mj)) firstOfMajor.set(mj, v.at); }
    const majorsIn2y = [...firstOfMajor.values()].filter((at) => monthsBetween(at, now) <= 24).length;
    const ageMonths = Math.round(monthsBetween(majorSince, now));
    return {
      name,
      system,
      exists: true,
      latest: latest.v,
      major,
      majorSince: new Date(majorSince).toISOString().slice(0, 10),
      majorAgeMonths: ageMonths,
      previous: prev ? prev.v : null,
      majorsIn2y,
      deprecated: latest.dep ? latest.why || 'deprecated by its author' : null,
      risk: riskOf({ ageMonths, majorsIn2y, major, deprecated: latest.dep }),
    };
  })();
  cache.set(key, p);
  try {
    return await p;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

/**
 * How likely an agent writes an outdated version from memory.
 * high: the current major is under a year old, or the package changed majors twice in two years
 * medium: the current major is one to two years old
 * low: the major is older than two years, or the package is still 0.x
 */
export function riskOf({ ageMonths, majorsIn2y, major, deprecated }) {
  if (deprecated) return 'deprecated';
  if (major === 0 || major >= 1900) return 'low'; // 0.x, or calendar versions (certifi 2026.x) that bump every year
  if (ageMonths < 12 || majorsIn2y >= 3) return 'high';
  if (ageMonths < 24) return 'medium';
  return 'low';
}

export function describeFacts(f) {
  if (!f?.exists) return null;
  const lines = [];
  if (f.deprecated) lines.push(`Deprecated: ${f.deprecated}. Do not add it; use the replacement it names.`);
  if (f.latest && f.risk === 'high') {
    lines.push(`Major ${f.major} came out ${f.majorSince} (${f.majorAgeMonths} months ago). AI models trained before then tend to suggest ${f.previous ? `v${majorOf(f.previous)}` : 'an older major'}; use ${f.latest}.`);
  } else if (f.latest && f.risk === 'medium') {
    lines.push(`Major ${f.major} has been current since ${f.majorSince}. Older models may still suggest v${f.previous ? majorOf(f.previous) : f.major - 1}.`);
  }
  return lines;
}
