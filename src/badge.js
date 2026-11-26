// Shields-style SVG badge, no network needed.

const CHAR_W = 6.6;

function width(text) {
  return Math.round(text.length * CHAR_W + 12);
}

export function color(rate) {
  if (rate == null) return '#9f9f9f';
  if (rate >= 0.9) return '#2e9e44';
  if (rate >= 0.6) return '#97b522';
  if (rate >= 0.3) return '#dfa21b';
  return '#d0453a';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** badge({ label: 'agents first try', passes: 4, trials: 5 }) -> svg string */
export function badge({ label = 'agents first try', passes, trials }) {
  const rate = trials ? passes / trials : null;
  const value = trials ? `${passes}/${trials}` : 'untested';
  const lw = width(label);
  const vw = width(value);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<title>${esc(label)}: ${esc(value)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${color(rate)}"/><rect width="${w}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14">${esc(label)}</text><text x="${lw + vw / 2}" y="14">${esc(value)}</text>
</g></svg>
`;
}
