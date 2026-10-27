import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { SESSION_DURATION_SECONDS, signSessionToken, verifySessionToken } from './token';

const secret = 'a'.repeat(32);
const now = new Date('2027-01-14T09:00:00Z');
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);
const key = new TextEncoder().encode(secret);

describe('session token (ADR-0006)', () => {
  it('round-trips the user id and the token version', async () => {
    const token = await signSessionToken({ userId: 7, tokenVersion: 3 }, { secret, now });
    expect(await verifySessionToken(token, { secret, now })).toEqual({
      userId: 7,
      tokenVersion: 3,
    });
  });

  it('is valid for 30 days, to the second', async () => {
    const token = await signSessionToken({ userId: 7, tokenVersion: 0 }, { secret, now });
    expect(
      await verifySessionToken(token, { secret, now: later(SESSION_DURATION_SECONDS - 1) }),
    ).not.toBeNull();
    expect(
      await verifySessionToken(token, { secret, now: later(SESSION_DURATION_SECONDS) }),
    ).toBeNull();
  });

  it('refuses a token signed with another key', async () => {
    const token = await signSessionToken(
      { userId: 7, tokenVersion: 0 },
      { secret: 'b'.repeat(32), now },
    );
    expect(await verifySessionToken(token, { secret, now })).toBeNull();
  });

  it('refuses a tampered payload', async () => {
    const token = await signSessionToken({ userId: 7, tokenVersion: 0 }, { secret, now });
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: '1', tv: 0, iat: 1, exp: 9_999_999_999 }),
    ).toString('base64url');
    expect(
      await verifySessionToken(`${header}.${forged}.${signature}`, { secret, now }),
    ).toBeNull();
  });

  it('refuses a token that does not use HS256 (no algorithm confusion)', async () => {
    const hs512 = await new SignJWT({ tv: 0 })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject('7')
      .setExpirationTime('1h')
      .sign(key);
    expect(await verifySessionToken(hs512, { secret, now: new Date() })).toBeNull();
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"7","tv":0}').toString('base64url')}.`;
    expect(await verifySessionToken(none, { secret, now })).toBeNull();
  });

  it('refuses garbage and tokens without a valid subject or version', async () => {
    expect(await verifySessionToken('', { secret, now })).toBeNull();
    expect(await verifySessionToken('a.b.c', { secret, now })).toBeNull();
    const noVersion = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('7')
      .setExpirationTime('1h')
      .sign(key);
    expect(await verifySessionToken(noVersion, { secret, now: new Date() })).toBeNull();
    const badSubject = await new SignJWT({ tv: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('abc')
      .setExpirationTime('1h')
      .sign(key);
    expect(await verifySessionToken(badSubject, { secret, now: new Date() })).toBeNull();
  });
});
