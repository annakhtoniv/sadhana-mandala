import { beforeEach, describe, expect, it, vi } from 'vitest';

// No real Supabase client in tests (it needs a WebSocket, which Node 20 lacks)
const rpc = vi.fn();
const exchangeCodeForSession = vi.fn();
vi.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a) } } }));
let standalone = false;
vi.mock('../installPrompt', () => ({ isStandalone: () => standalone }));

import { collectSignIn, HANDOFF_MAX_AGE_MS, pendingHandoff, readSignInCallback, signInRedirect } from '../signInHandoff';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const CODE = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
const ID = 'a1b2c3d4-0000-4000-8000-000000000001';

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  standalone = false;
  rpc.mockReset();
  exchangeCodeForSession.mockReset();
});

describe('Sign-in hand-over to the Home Screen app', () => {
  it('a normal browser returns to the site without a hand-over', () => {
    expect(signInRedirect('https://sadhana.zyxenai.com/')).toBe('https://sadhana.zyxenai.com/?signin=1');
    expect(pendingHandoff()).toBeNull();
  });

  it('the Home Screen app adds a hand-over id and remembers it for 10 minutes', () => {
    standalone = true;
    const url = signInRedirect('https://sadhana.zyxenai.com', 1000);
    const id = new URL(url).searchParams.get('handoff');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(pendingHandoff(1000 + HANDOFF_MAX_AGE_MS - 1)).toBe(id);
    expect(pendingHandoff(1000 + HANDOFF_MAX_AGE_MS + 1)).toBeNull();
  });

  it('reads the code, hand-over id and flow id Google returns with', () => {
    expect(readSignInCallback(`?signin=1&handoff=${ID}&sb_flow_id=abc&code=${CODE}`)).toEqual({ code: CODE, handoff: ID, flowId: 'abc' });
    expect(readSignInCallback(`?code=${CODE}`)).toEqual({ code: CODE, handoff: null, flowId: null });
    // A batch QR link is not a sign-in
    expect(readSignInCallback('?code=AUTUMN23')).toBeNull();
    expect(readSignInCallback(`?code=${CODE}&handoff=not-an-id`)?.handoff).toBeNull();
  });

  it('keeps waiting until the Safari window has left the code', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await collectSignIn(ID)).toBe('waiting');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('signs in with the code it picks up, using the flow id', async () => {
    standalone = true;
    signInRedirect('https://sadhana.zyxenai.com');
    rpc.mockResolvedValue({ data: { code: CODE, flow_id: 'abc' }, error: null });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await collectSignIn(ID)).toBe('signed-in');
    expect(rpc).toHaveBeenCalledWith('take_auth_handoff', { p_id: ID });
    expect(exchangeCodeForSession).toHaveBeenCalledWith(CODE, { flowId: 'abc' });
    expect(pendingHandoff()).toBeNull();
  });

  it('reports a code that no longer works', async () => {
    rpc.mockResolvedValue({ data: { code: CODE, flow_id: null }, error: null });
    exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });
    expect(await collectSignIn(ID)).toBe('failed');
    expect(exchangeCodeForSession).toHaveBeenCalledWith(CODE, undefined);
  });
});
