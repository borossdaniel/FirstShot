import { nextBusinessDays, humanGap, weekLabel } from "./solution.mjs";

console.log("nextBusinessDays(2026-11-26, 5):", nextBusinessDays("2026-11-26", 5));
console.log("nextBusinessDays(2026-11-27, 3):", nextBusinessDays("2026-11-27", 3)); // Fri -> skip weekend

console.log("humanGap(2026-11-26, 2026-11-29):", humanGap("2026-11-26", "2026-11-29"));
console.log("humanGap(2026-11-26, 2026-12-26):", humanGap("2026-11-26", "2026-12-26"));
console.log("humanGap(2026-01-01, 2026-01-01):", humanGap("2026-01-01", "2026-01-01"));

console.log("weekLabel(2026-11-26):", weekLabel("2026-11-26"));
console.log("weekLabel(2026-01-01):", weekLabel("2026-01-01")); // edge case ISO week year
console.log("weekLabel(2027-01-01):", weekLabel("2027-01-01"));
