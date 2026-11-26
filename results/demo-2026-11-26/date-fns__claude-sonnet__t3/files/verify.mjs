import { nextBusinessDays, humanGap, weekLabel } from "./solution.mjs";

console.log("nextBusinessDays('2026-11-26', 5):", nextBusinessDays("2026-11-26", 5));
console.log("humanGap('2026-11-26', '2026-11-29'):", humanGap("2026-11-26", "2026-11-29"));
console.log("humanGap('2026-01-01', '2026-02-01'):", humanGap("2026-01-01", "2026-02-01"));
console.log("weekLabel('2026-11-26'):", weekLabel("2026-11-26"));
console.log("weekLabel('2026-01-01'):", weekLabel("2026-01-01"));
