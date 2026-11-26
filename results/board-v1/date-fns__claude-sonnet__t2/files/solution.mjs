import {
  addDays,
  formatDistanceStrict,
  format,
  getISOWeek,
  getISOWeekYear,
  isWeekend,
  parseISO,
} from "date-fns";

export function nextBusinessDays(isoDate, n) {
  const result = [];
  let current = parseISO(isoDate);
  while (result.length < n) {
    current = addDays(current, 1);
    if (!isWeekend(current)) {
      result.push(format(current, "yyyy-MM-dd"));
    }
  }
  return result;
}

export function humanGap(fromIso, toIso) {
  return formatDistanceStrict(parseISO(toIso), parseISO(fromIso));
}

export function weekLabel(isoDate) {
  const date = parseISO(isoDate);
  const year = getISOWeekYear(date);
  const week = String(getISOWeek(date)).padStart(2, "0");
  return `${year}-W${week}`;
}
