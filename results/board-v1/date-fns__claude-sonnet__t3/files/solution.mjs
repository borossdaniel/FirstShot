import {
  parseISO,
  addDays,
  isSaturday,
  isSunday,
  format,
  formatDistanceStrict,
  getISOWeek,
  getISOWeekYear,
} from "date-fns";

export function nextBusinessDays(isoDate, n) {
  const result = [];
  let cursor = parseISO(isoDate);
  while (result.length < n) {
    cursor = addDays(cursor, 1);
    if (!isSaturday(cursor) && !isSunday(cursor)) {
      result.push(format(cursor, "yyyy-MM-dd"));
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
