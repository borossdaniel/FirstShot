import { runCheck, expectInstalled, importSolution, expect, expectEqual } from '../../src/check-helpers.js';

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'date-fns', 4);
  const m = await importSolution(ws);
  for (const f of ['nextBusinessDays', 'humanGap', 'weekLabel']) expect(typeof m[f] === 'function', `${f} is not exported`);

  // Thursday 26 Nov 2026 -> Fri, Mon, Tue
  expectEqual(m.nextBusinessDays('2026-11-26', 3), ['2026-11-27', '2026-11-30', '2026-12-01'], 'nextBusinessDays(2026-11-26, 3)');
  // Saturday -> Monday first
  expectEqual(m.nextBusinessDays('2026-11-28', 1), ['2026-11-30'], 'nextBusinessDays(2026-11-28, 1)');
  expectEqual(m.nextBusinessDays('2026-12-31', 2), ['2027-01-01', '2027-01-04'], 'nextBusinessDays across new year');

  expectEqual(m.humanGap('2026-11-26', '2026-11-29'), '3 days', 'humanGap 3 days');
  expectEqual(m.humanGap('2026-01-01', '2026-02-01'), '1 month', 'humanGap 1 month');

  expectEqual(m.weekLabel('2026-11-26'), '2026-W48', 'weekLabel(2026-11-26)');
  // ISO week-numbering year differs from calendar year here
  expectEqual(m.weekLabel('2027-01-01'), '2026-W53', 'weekLabel(2027-01-01)');
  expectEqual(m.weekLabel('2026-01-05'), '2026-W02', 'weekLabel(2026-01-05)');
  return `date-fns@${version}: business days, distances and ISO weeks correct`;
});
