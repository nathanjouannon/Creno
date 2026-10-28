// RG-16: one time zone per instance (Club.timezone). Dates are UTC `Date`s in the code and are
// typed and shown as local date-times of that zone ("2027-01-14T09:30"), never in the device zone.

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function localParts(instant: Date, timeZone: string): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts;
}

/** Offset of the zone from UTC at an instant, in milliseconds (positive east of Greenwich). */
function offsetMs(instant: Date, timeZone: string): number {
  const p = localParts(instant, timeZone);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** UTC instant shown as a local date-time of the zone: `2027-01-14T09:30:00`. */
export function toLocalDateTime(instant: Date, timeZone: string): string {
  const p = localParts(instant, timeZone);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(p.year!, 4)}-${pad(p.month!)}-${pad(p.day!)}T${pad(p.hour!)}:${pad(p.minute!)}:${pad(p.second!)}`;
}

/**
 * Local date-time typed in the zone (`2027-01-14T09:30`) to its UTC instant.
 * A time skipped by a clock change resolves to the instant after the gap; an ambiguous one to the first occurrence.
 * Returns null when the text is not a valid local date-time.
 */
export function fromLocalDateTime(local: string, timeZone: string): Date | null {
  const m = LOCAL_DATE_TIME.exec(local);
  if (!m || !isValidTimezone(timeZone)) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(
    Number,
  ) as [number, number, number, number, number, number];
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wallClock);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null;
  }
  // Offsets a day before and after surround any clock change; keep the candidates that are consistent.
  const DAY = 86_400_000;
  const before = offsetMs(new Date(wallClock - DAY), timeZone);
  const after = offsetMs(new Date(wallClock + DAY), timeZone);
  const valid = [...new Set([before, after])]
    .map((offset) => ({ offset, instant: wallClock - offset }))
    .filter(({ offset, instant }) => offsetMs(new Date(instant), timeZone) === offset)
    .map(({ instant }) => instant);
  // No candidate means the time falls in the skipped hour: use the offset in force before the change.
  return new Date(valid.length > 0 ? Math.min(...valid) : wallClock - before);
}
