import {
  parseISO,
  addDays,
  isSaturday,
  isSunday,
  format,
  formatDistanceStrict,
} from "date-fns";

export function nextBusinessDays(isoDate, n) {
  const result = [];
  let current = parseISO(isoDate);
  while (result.length < n) {
    current = addDays(current, 1);
    if (!isSaturday(current) && !isSunday(current)) {
      result.push(format(current, "yyyy-MM-dd"));
    }
  }
  return result;
}

export function humanGap(fromIso, toIso) {
  return formatDistanceStrict(parseISO(toIso), parseISO(fromIso));
}

export function weekLabel(isoDate) {
  return format(parseISO(isoDate), "RRRR-'W'II");
}
