import { describe, it, expect, beforeEach } from 'vitest';
import { batchJoinUrl, cleanCode, isAuthCode, peekPending, readLinkParams, savePending, takePending } from '../joinLink';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('batch join links', () => {
  it('builds the QR link from the join code', () => {
    expect(batchJoinUrl('autumn23', 'https://sadhana.zyxenai.com')).toBe('https://sadhana.zyxenai.com/?code=AUTUMN23');
    expect(batchJoinUrl(' AUTUMN23 ', 'https://sadhana.zyxenai.com/')).toBe('https://sadhana.zyxenai.com/?code=AUTUMN23');
  });

  it('reads ?code= and the older ?join= links', () => {
    expect(readLinkParams('?code=autumn23')).toEqual({ joinCode: 'AUTUMN23', eventCode: null });
    expect(readLinkParams('?join=AUTUMN23')).toEqual({ joinCode: 'AUTUMN23', eventCode: null });
    expect(readLinkParams('?event=nowcheck')).toEqual({ joinCode: null, eventCode: 'NOWCHECK' });
    expect(readLinkParams('')).toEqual({ joinCode: null, eventCode: null });
  });

  it('never takes the Google sign-in code (a UUID) for a join code', () => {
    const authCode = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
    expect(isAuthCode(authCode)).toBe(true);
    expect(isAuthCode('AUTUMN23')).toBe(false);
    expect(readLinkParams(`?signin=1&code=${authCode}`)).toEqual({ joinCode: null, eventCode: null });
    expect(readLinkParams(`?code=${authCode}&join=AUTUMN23`)).toEqual({ joinCode: 'AUTUMN23', eventCode: null });
  });

  it('strips characters a join code never has', () => {
    expect(cleanCode(' ab<c>12 ')).toBe('ABC12');
  });
});

describe('pending code across the Google sign-in', () => {
  it('keeps the code until it is taken', () => {
    savePending('k', 'AUTUMN23', 1000);
    expect(peekPending('k', 2000)).toBe('AUTUMN23');
    expect(takePending('k', 2000)).toBe('AUTUMN23');
    expect(takePending('k', 2000)).toBeNull();
  });

  it('forgets a code older than a day', () => {
    savePending('k', 'AUTUMN23', 0);
    expect(peekPending('k', 25 * 60 * 60 * 1000)).toBeNull();
  });
});
