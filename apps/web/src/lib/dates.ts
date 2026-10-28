import { fromLocalDateTime, toLocalDateTime } from './timezone';

// RG-16: dates are typed and shown in the club's time zone, whatever the zone of the device.

/** `{ date: '2027-03-14', time: '08:00' }` of a UTC instant, in the zone. */
export function toLocalParts(iso: string, timeZone: string): { date: string; time: string } {
  const local = toLocalDateTime(new Date(iso), timeZone);
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** A day and a time typed in the zone, as an ISO 8601 UTC instant; null when they are not valid. */
export function toInstant(date: string, time: string, timeZone: string): string | null {
  return fromLocalDateTime(`${date}T${time}`, timeZone)?.toISOString() ?? null;
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** « 14 mars ». */
export function formatDay(iso: string, timeZone: string): string {
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone });
    dayFormats.set(timeZone, format);
  }
  return format.format(new Date(iso));
}

/** « 08:00 ». */
export function formatTime(iso: string, timeZone: string): string {
  return toLocalParts(iso, timeZone).time;
}

/** « 14 mars, 08:00 » (C1). */
export function formatDayTime(iso: string, timeZone: string): string {
  return `${formatDay(iso, timeZone)}, ${formatTime(iso, timeZone)}`;
}

/** « 14 mars 08:00 → 18:00 », or « 14 mars 08:00 → 15 mars 18:00 » over several days (C2). */
export function formatPeriod(startsAt: string, endsAt: string, timeZone: string): string {
  const sameDay = toLocalParts(startsAt, timeZone).date === toLocalParts(endsAt, timeZone).date;
  const start = `${formatDay(startsAt, timeZone)} ${formatTime(startsAt, timeZone)}`;
  const end = sameDay
    ? formatTime(endsAt, timeZone)
    : `${formatDay(endsAt, timeZone)} ${formatTime(endsAt, timeZone)}`;
  return `${start} → ${end}`;
}
