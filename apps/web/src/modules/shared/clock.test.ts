import { afterEach, describe, expect, it } from 'vitest';
import { clock, fixedClock, resetClock, setClock } from './clock';

afterEach(resetClock);

describe('clock', () => {
  it('returns the real time by default', () => {
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('can be frozen for the whole process and restored', () => {
    setClock(fixedClock('2027-01-14T09:00:00Z'));
    expect(clock.now().toISOString()).toBe('2027-01-14T09:00:00.000Z');
    resetClock();
    expect(clock.now().getFullYear()).not.toBe(2027);
  });

  it('hands out copies so a caller cannot move the frozen time', () => {
    setClock(fixedClock('2027-01-14T09:00:00Z'));
    clock.now().setFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2027);
  });
});
