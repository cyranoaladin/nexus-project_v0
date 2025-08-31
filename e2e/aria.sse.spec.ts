import { expect, test } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:3003';
const BASE_TIMEOUT = process.env.BASE_URL_TIMEOUT || process.env.BASE_URL || 'http://localhost:3004';
const BASE_FB_OK = process.env.BASE_URL_FBOK || process.env.BASE_URL || 'http://localhost:3005';
const BASE_FB_FAIL = process.env.BASE_URL_FBFAIL || process.env.BASE_URL || 'http://localhost:3006';
const BASE_PROD = process.env.BASE_URL_PROD || process.env.BASE_URL || 'http://localhost:3007';

function readDevToken(): string | undefined {
  // Priorité à l'environnement (aligné sur le secret du serveur courant)
  const fromEnv = (process.env.DEV_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const raw = fs.readFileSync('.nexus-seed.json', 'utf8');
    const j = JSON.parse(raw);
    const token = j.DEV_TOKEN || j.dev_token || '';
    return (token || '').toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

async function consumeSSE(url: string, init: RequestInit & { abortAfterTokens?: number; } = {}) {
  const ctrl = new AbortController();
  const tokens: string[] = [];
  const res = await fetch(url, { ...init, signal: ctrl.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = (res.body as any).getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const events: Array<{ event?: string; data?: any; raw?: string; }> = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const chunk of parts) {
      const lines = chunk.split('\n');
      let ev: string | undefined;
      let data: any;
      for (const line of lines) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        if (line.startsWith('data:')) {
          const json = line.slice(5).trim();
          try { data = JSON.parse(json); } catch { data = json; }
        }
      }
      events.push({ event: ev, data, raw: chunk });
      if (ev === 'token' && data?.text) {
        tokens.push(data.text);
        if (init.abortAfterTokens && tokens.length >= init.abortAfterTokens) {
          ctrl.abort();
          return { events, tokens, aborted: true };
        }
      }
      if (ev === 'done') return { events, tokens, aborted: false };
      // Do not early-return on 'error'; keep consuming until 'done' or stream ends
    }
  }
  return { events, tokens, aborted: false };
}

test.describe('ARIA SSE (real)', () => {
  test('happy path: tokens then done', async () => {
    const token = readDevToken();
    test.skip(!token, 'DEV_TOKEN required. Run npm run dev-seed');
    const body = {
      message: 'Explique les suites géométriques',
      subject: 'MATHEMATIQUES',
      intent: 'tutor',
    };
    const t0 = Date.now();
    const { events, tokens } = await consumeSSE(`${BASE}/api/aria/chat?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-e2e-stub': '1',
      },
      body: JSON.stringify(body),
    });
    const t1 = Date.now();
    expect(tokens.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last?.event).toBe('done');
    // attach short excerpt for artifacts
    console.log('[SSE][excerpt]', events.slice(0, 6).map(e => `${e.event}:${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}`));
    console.log('[SSE][latency_ms]', t1 - t0);
  });

  test('abort client mid-stream', async () => {
    const token = readDevToken();
    test.skip(!token, 'DEV_TOKEN required. Run npm run dev-seed');
    const { events, tokens, aborted } = await consumeSSE(`${BASE}/api/aria/chat?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-e2e-stub': '1',
      },
      body: JSON.stringify({ message: 'Donne-moi un cours long', subject: 'NSI', intent: 'tutor' }),
      abortAfterTokens: 5,
    });
    expect(aborted).toBe(true);
    expect(tokens.length).toBeGreaterThanOrEqual(5);
    console.log('[SSE][abort_excerpt]', events.slice(0, 6).map(e => e.event));
  });

  test('timeout then retry with success (fallback optional)', async () => {
    const token = readDevToken();
    test.skip(!token, 'DEV_TOKEN required. Run npm run dev-seed');
    const { events, tokens } = await consumeSSE(`${BASE_TIMEOUT}/api/aria/chat?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-e2e-stub': '1',
      },
      body: JSON.stringify({ message: 'Explique la dérivée', subject: 'MATHEMATIQUES', intent: 'summary' }),
    });
    expect(tokens.length).toBeGreaterThan(0);
    expect(events[events.length - 1]?.event).toBe('done');
  });

  test('primary timeout/error then fallback success', async () => {
    const token = readDevToken();
    test.skip(!token, 'DEV_TOKEN required. Run npm run dev-seed');
    const { events, tokens } = await consumeSSE(`${BASE_FB_OK}/api/aria/chat?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-e2e-stub': '1',
      },
      body: JSON.stringify({ message: 'Rappelle la loi des grands nombres', subject: 'MATHEMATIQUES', intent: 'tutor' }),
    });
    expect(tokens.length).toBeGreaterThan(0);
    expect(events[events.length - 1]?.event).toBe('done');
  });

  test('primary and fallback both fail → error then done', async () => {
    const token = readDevToken();
    test.skip(!token, 'DEV_TOKEN required. Run npm run dev-seed');
    const { events } = await consumeSSE(`${BASE_FB_FAIL}/api/aria/chat?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'Test erreurs intentionnelles', subject: 'NSI', intent: 'tutor' }),
    });
    const hasError = events.some(e => e.event === 'error');
    expect(hasError).toBe(true);
    expect(events[events.length - 1]?.event).toBe('done');
  });

  test('production ignores dev-token → 401/403', async () => {
    const token = readDevToken() || '';
    const res = await fetch(`${BASE_PROD}/api/aria/chat?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-prod-like': '1',
      },
      body: JSON.stringify({ message: 'prod mode check', subject: 'NSI', intent: 'tutor' }),
    });
    expect([401, 403]).toContain(res.status);
  });
});
