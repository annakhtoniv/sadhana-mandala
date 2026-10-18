import { describe, expect, it, vi } from 'vitest';

// No real Supabase client in tests (it needs a WebSocket, which Node 20 lacks)
vi.mock('../supabase', () => ({ supabase: {} }));

import { urlBase64ToUint8Array } from '../pushReminders';

describe('Practice reminders', () => {
  it('turns the public key into the 65 bytes the browser wants', () => {
    const key = urlBase64ToUint8Array('BDNXtDuwsq6Dfc8FUWHWrioFSuKHZAFQQgCfozVBgH-M7H3qJmleFeRrW1JsQoiNIBlfVW-UHSxyPe1YznVrLKA');
    expect(key.length).toBe(65);
    expect(key[0]).toBe(4); // an uncompressed P-256 point starts with 0x04
  });

  it('reads URL-safe characters and missing padding', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });
});
