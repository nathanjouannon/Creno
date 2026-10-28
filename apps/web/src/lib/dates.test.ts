import { describe, expect, it } from 'vitest';
import { formatDayTime, formatPeriod, toInstant, toLocalParts } from './dates';

const PARIS = 'Europe/Paris';

describe('dates in the club time zone (RG-16)', () => {
  it('[F-04 S8] RG-16: 08:00 typed in Paris is 07:00 UTC in winter, and shows as 08:00 again', () => {
    const instant = toInstant('2027-03-14', '08:00', PARIS);
    expect(instant).toBe('2027-03-14T07:00:00.000Z');
    expect(toLocalParts(instant!, PARIS)).toEqual({ date: '2027-03-14', time: '08:00' });
  });

  it('an empty or invalid day gives no instant', () => {
    expect(toInstant('', '08:00', PARIS)).toBeNull();
    expect(toInstant('2027-02-30', '08:00', PARIS)).toBeNull();
  });

  it('formats a start as « 14 mars, 08:00 »', () => {
    expect(formatDayTime('2027-03-14T07:00:00Z', PARIS)).toBe('14 mars, 08:00');
  });

  it('formats a period on one day, then over two days', () => {
    expect(formatPeriod('2027-03-14T07:00:00Z', '2027-03-14T17:00:00Z', PARIS)).toBe(
      '14 mars 08:00 → 18:00',
    );
    expect(formatPeriod('2027-03-14T07:00:00Z', '2027-03-15T17:00:00Z', PARIS)).toBe(
      '14 mars 08:00 → 15 mars 18:00',
    );
  });
});
