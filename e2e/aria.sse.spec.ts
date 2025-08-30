import { test, expect } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:3003';

function readDevToken(): string | undefined {
  try {
    const raw = fs.readFileSync('.nexus-seed.json', 'utf8');
    const j = JSON.parse(raw);
    return j.DEV_TOKEN || j.dev_token || process.env.DEV_TOKEN;
  } catch {
    return process.env.DEV_TOKEN;
  }
}

async function consumeSSE(url: string, init: RequestInit & { abortAfterTokens?: number } = {}) {
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
      if (ev === 'error') return { events, tokens, aborted: false };
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
      },
      body: JSON.stringify({ message: 'Donne-moi un cours long', subject: 'NSI', intent: 'tutor' }),
      abortAfterTokens: 5,
    });
    expect(aborted).toBe(true);
    expect(tokens.length).toBeGreaterThanOrEqual(5);
    console.log('[SSE][abort_excerpt]', events.slice(0, 6).map(e => e.event));
  });
});


