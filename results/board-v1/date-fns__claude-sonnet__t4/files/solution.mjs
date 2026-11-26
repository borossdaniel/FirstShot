import {
  addBusinessDays,
  format,
  formatDistanceStrict,
  getISOWeek,
  getISOWeekYear,
  parseISO,
} from "date-fns";

export function nextBusinessDays(isoDate, n) {
  const start = parseISO(isoDate);
  const days = [];
  for (let i = 1; i <= n; i++) {
    days.push(format(addBusinessDays(start, i), "yyyy-MM-dd"));
  }
  return days;
}

export function humanGap(fromIso, toIso) {
  return formatDistanceStrict(parseISO(fromIso), parseISO(toIso));
}

export function weekLabel(isoDate) {
  const date = parseISO(isoDate);
  const year = getISOWeekYear(date);
  const week = String(getISOWeek(date)).padStart(2, "0");
  return `${year}-W${week}`;
}
