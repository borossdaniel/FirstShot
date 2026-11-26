import { nextBusinessDays, humanGap, weekLabel } from "./solution.mjs";

console.log(nextBusinessDays("2026-11-26", 5));
console.log(humanGap("2026-11-26", "2026-11-29"));
console.log(humanGap("2026-11-26", "2026-12-26"));
console.log(weekLabel("2026-11-26"));
console.log(weekLabel("2026-01-01"));
