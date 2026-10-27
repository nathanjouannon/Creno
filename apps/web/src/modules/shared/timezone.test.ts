import { describe, expect, it } from 'vitest';
import { fromLocalDateTime, isValidTimezone, toLocalDateTime } from './timezone';

describe('RG-16: time zone conversion', () => {
  it('RG-16: converts a winter local time of Paris to UTC (UTC+1)', () => {
    expect(fromLocalDateTime('2027-01-14T09:30', 'Europe/Paris')?.toISOString()).toBe(
      '2027-01-14T08:30:00.000Z',
    );
  });

  it('RG-16: converts a summer local time of Paris to UTC (UTC+2)', () => {
    expect(fromLocalDateTime('2027-07-14T09:30', 'Europe/Paris')?.toISOString()).toBe(
      '2027-07-14T07:30:00.000Z',
    );
  });

  it('RG-16: shows a UTC instant in the zone of the club, not in the device zone', () => {
    const instant = new Date('2027-07-14T22:30:00Z');
    expect(toLocalDateTime(instant, 'Europe/Paris')).toBe('2027-07-15T00:30:00');
    expect(toLocalDateTime(instant, 'America/Martinique')).toBe('2027-07-14T18:30:00');
  });

  it('round-trips local → UTC → local across the year', () => {
    for (const local of [
      '2027-01-01T00:00:00',
      '2027-03-27T23:59:00',
      '2027-03-29T12:00:00',
      '2027-10-31T12:00:00',
      '2027-12-31T23:59:00',
    ]) {
      const utc = fromLocalDateTime(local, 'Europe/Paris')!;
      expect(toLocalDateTime(utc, 'Europe/Paris').startsWith(local.slice(0, 16))).toBe(true);
    }
  });

  it('RG-16: resolves a time skipped by the spring clock change after the gap', () => {
    // 2027-03-28: 02:00 → 03:00 in Paris, so 02:30 does not exist
    expect(fromLocalDateTime('2027-03-28T02:30', 'Europe/Paris')?.toISOString()).toBe(
      '2027-03-28T01:30:00.000Z',
    );
  });

  it('RG-16: resolves an ambiguous autumn time to its first occurrence', () => {
    // 2027-10-31: 03:00 → 02:00 in Paris, so 02:30 happens twice; first is UTC+2
    expect(fromLocalDateTime('2027-10-31T02:30', 'Europe/Paris')?.toISOString()).toBe(
      '2027-10-31T00:30:00.000Z',
    );
  });

  it('rejects malformed or impossible local date-times', () => {
    expect(fromLocalDateTime('2027-02-30T10:00', 'Europe/Paris')).toBeNull();
    expect(fromLocalDateTime('2027-01-14 10:00', 'Europe/Paris')).toBeNull();
    expect(fromLocalDateTime('2027-01-14T25:00', 'Europe/Paris')).toBeNull();
  });

  it('knows IANA zones and rejects the others (FIELD_TIMEZONE_INVALID)', () => {
    expect(isValidTimezone('Europe/Paris')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(fromLocalDateTime('2027-01-14T09:30', 'Mars/Olympus')).toBeNull();
  });
});
