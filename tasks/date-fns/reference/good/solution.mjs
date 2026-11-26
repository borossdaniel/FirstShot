import { addBusinessDays, formatDistanceStrict, format, parseISO } from 'date-fns';

export function nextBusinessDays(isoDate, n) {
  const start = parseISO(isoDate);
  return Array.from({ length: n }, (_, i) => format(addBusinessDays(start, i + 1), 'yyyy-MM-dd'));
}

export function humanGap(fromIso, toIso) {
  return formatDistanceStrict(parseISO(toIso), parseISO(fromIso));
}

export function weekLabel(isoDate) {
  return format(parseISO(isoDate), "RRRR-'W'II");
}
