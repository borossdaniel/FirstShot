import { nextBusinessDays, humanGap, weekLabel } from "./solution.mjs";

console.log("nextBusinessDays('2026-11-26', 5):", nextBusinessDays("2026-11-26", 5));
// 2026-11-26 is a Thursday -> next business days: Fri 27, Mon 30, Tue Dec1, Wed Dec2, Thu Dec3

console.log("humanGap('2026-11-26', '2026-11-29'):", humanGap("2026-11-26", "2026-11-29"));
console.log("humanGap('2026-11-26', '2026-12-26'):", humanGap("2026-11-26", "2026-12-26"));

console.log("weekLabel('2026-11-26'):", weekLabel("2026-11-26"));
console.log("weekLabel('2026-01-01'):", weekLabel("2026-01-01"));
