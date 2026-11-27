// GET /api/badge?repo=owner/name — a README badge from the same check as /api/scan.
//   [OneShot | all current]        nothing stale
//   [OneShot | no retired models]  nothing will break, some versions are older
//   [OneShot | 3 will break]       retired or retiring models, end-of-life runtimes
// Cached at the edge for 6 hours, so a README view rarely triggers a new check.

import { parseRepo, scanRepo } from './scan.js';

const BRAND = '#ff4f1f';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Verdana 11px widths are close to 6.5 px per character for these labels.
const textW = (t) => Math.round(t.length * 6.5 + 14);

export function badgeSvg(value, color, textColor = '#fff') {
  const label = 'OneShot';
  const iconW = 16;
  const lw = textW(label) + iconW;
  const vw = textW(value);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${esc(value)}">
<title>${label}: ${esc(value)}</title>
<clipPath id="r"><rect width="${w}" height="20" rx="4" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#0a0a0a"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/></g>
<circle cx="11" cy="10" r="5.2" fill="none" stroke="${BRAND}" stroke-width="1.8"/><circle cx="11" cy="10" r="2" fill="${BRAND}"/>
<g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${iconW + (lw - iconW) / 2}" y="14" fill="#f5f3ef">${label}</text><text x="${lw + vw / 2}" y="14" fill="${textColor}">${esc(value)}</text>
</g></svg>
`;
}

/** What the badge says for a scan result. */
export function verdict(result) {
  const errors = result.facts.filter((f) => f.level === 'error').length;
  const older = result.facts.length - errors + result.outdated.length;
  if (errors) return { value: `${errors} will break`, color: BRAND, text: '#0a0a0a' };
  if (older) return { value: 'no retired models', color: '#f5f3ef', text: '#0a0a0a' };
  return { value: 'all current', color: '#2e9e44', text: '#fff' };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  // /badge/owner/name.svg arrives as repo=owner/name.svg
  const repo = parseRepo(String(url.searchParams.get('repo') || '').replace(/\.svg$/, ''));
  res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
  if (!repo) {
    res.setHeader('cache-control', 'public, max-age=300');
    res.status(200).send(badgeSvg('add ?repo=owner/name', '#555'));
    return;
  }
  try {
    const v = verdict(await scanRepo(repo));
    res.setHeader('cache-control', 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400');
    res.status(200).send(badgeSvg(v.value, v.color, v.text));
  } catch (err) {
    res.setHeader('cache-control', 'public, max-age=300, s-maxage=600');
    res.status(200).send(badgeSvg(err.status === 404 ? 'repo not found' : err.status === 413 ? 'repo too big' : 'unavailable', '#555'));
  }
}
