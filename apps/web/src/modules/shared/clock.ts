// Services get the time from here, never from `new Date()` (conventions.md, section 7), so tests can freeze it.
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

let current: Clock = systemClock;

export const clock: Clock = { now: () => current.now() };

export function fixedClock(at: Date | string): Clock {
  const instant = new Date(at);
  return { now: () => new Date(instant) };
}

/** Replaces the clock for the whole process; tests call `resetClock()` afterwards. */
export function setClock(next: Clock): void {
  current = next;
}

export function resetClock(): void {
  current = systemClock;
}
