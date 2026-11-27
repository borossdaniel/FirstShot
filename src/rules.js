// Team rules: a team's own facts that every agent should follow and every pull request
// should respect. Read from .oneshot.json in the project root, or from a shared URL
// (ONESHOT_RULES_URL) so one file can serve every repo in a company.
//
// {
//   "models":   { "allowed": ["claude-sonnet-5-5", "gpt-6.2-*"], "blocked": ["gpt-4o*"] },
//   "packages": { "blocked": { "moment": "use date-fns" }, "minMajor": { "react": 19 } },
//   "notes":    ["Use @acme/ui for buttons and forms"],
//   "ignore":   ["test/fixtures/", "docs/**/*.md"]   (paths the check skips)
// }

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const glob = (pattern) => new RegExp('^' + String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

export async function loadRules(dir = process.cwd()) {
  let rules = null;
  const p = join(dir, '.oneshot.json');
  if (existsSync(p)) {
    try {
      rules = JSON.parse(readFileSync(p, 'utf8'));
      rules.source = '.oneshot.json';
    } catch (err) {
      return { error: `.oneshot.json is not valid JSON: ${err.message}` };
    }
  } else if (process.env.ONESHOT_RULES_URL) {
    try {
      const r = await fetch(process.env.ONESHOT_RULES_URL, { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        rules = await r.json();
        rules.source = process.env.ONESHOT_RULES_URL;
      }
    } catch {
      /* rules unreachable: check without them */
    }
  }
  return rules;
}

/** Is a model allowed by the team's rules? Returns null when there's no rule about it. */
export function modelRule(rules, id) {
  const m = rules?.models;
  if (!m) return null;
  if ((m.blocked || []).some((b) => glob(b).test(id))) return { ok: false, why: `${id} is blocked by your team's rules (${rules.source})` };
  if (m.allowed?.length && !m.allowed.some((a) => glob(a).test(id))) return { ok: false, why: `${id} is not on your team's approved list (${m.allowed.join(', ')})` };
  return { ok: true };
}

/** Problems with dependencies against the team's package rules. */
export function packageProblems(rules, deps, declaredMajor) {
  const out = [];
  const pk = rules?.packages;
  if (!pk) return out;
  for (const [name, range] of Object.entries(deps)) {
    if (pk.blocked && Object.hasOwn(pk.blocked, name)) {
      out.push({ kind: 'team-rule', level: 'error', file: 'package.json', found: name, fix: pk.blocked[name], message: `${name} is blocked by your team's rules${pk.blocked[name] ? `: ${pk.blocked[name]}` : ''}.` });
    }
    const min = pk.minMajor?.[name];
    const have = declaredMajor(range);
    if (min != null && have != null && have < min) {
      out.push({ kind: 'team-rule', level: 'error', file: 'package.json', found: `${name}@${range}`, fix: `${name}@^${min}`, message: `${name} "${range}" is below your team's minimum (v${min}).` });
    }
  }
  return out;
}

export function formatRules(rules) {
  if (!rules || rules.error) return rules?.error ? `Team rules: ${rules.error}` : '';
  const lines = [`Your team's rules (${rules.source}). Follow these over anything else:`];
  if (rules.models?.allowed?.length) lines.push(`- Only use these AI models: ${rules.models.allowed.join(', ')}.`);
  if (rules.models?.blocked?.length) lines.push(`- Never use: ${rules.models.blocked.join(', ')}.`);
  if (rules.packages?.blocked) lines.push(`- Don't add these packages: ${Object.entries(rules.packages.blocked).map(([n, why]) => (why ? `${n} (${why})` : n)).join(', ')}.`);
  if (rules.packages?.minMajor && Object.keys(rules.packages.minMajor).length) lines.push(`- Minimum versions: ${Object.entries(rules.packages.minMajor).map(([n, v]) => `${n} v${v}+`).join(', ')}.`);
  for (const n of rules.notes || []) lines.push(`- ${n}`);
  return lines.join('\n');
}

export const RULES_TEMPLATE = {
  models: { allowed: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'gpt-6.2-*'], blocked: ['gpt-4o*'] },
  packages: { blocked: { moment: 'use date-fns' }, minMajor: {} },
  notes: ['Write your team conventions here, for example: use our @acme/ui package for buttons and forms.'],
};
