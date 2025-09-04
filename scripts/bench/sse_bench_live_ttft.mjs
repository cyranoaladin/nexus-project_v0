#!/usr/bin/env node
// Bench TTFT (time-to-first-token) for /api/aria/chat?stream=true in LIVE OpenAI mode
// Usage: node scripts/bench/sse_bench_live_ttft.mjs [count]

import fs from 'fs';

const count = Number(process.argv[2] || 20);
const base = process.env.E2E_BASE_URL || 'http://localhost:3003';
const url = `${base}/api/aria/chat?stream=true`;

function readDevToken() {
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

async function ttftOnce(i) {
  const ctrl = new AbortController();
  const token = readDevToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const body = {
    message: 'Explique les suites géométriques',
    subject: 'MATHEMATIQUES',
    intent: 'tutor',
  };
  const t0 = Date.now();
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
  if (!res.ok) {
    console.log(`[SSE][http_status] ${res.status}`);
    return null;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const chunk of parts) {
      const lines = chunk.split('\n');
      let ev;
      for (const line of lines) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
      }
      if (ev === 'token') {
        const t1 = Date.now();
        console.log(`[SSE][ttft_ms] ${t1 - t0}`);
        try { ctrl.abort(); } catch {}
        return t1 - t0;
      }
    }
  }
  return null;
}

(async () => {
  // Optional live warm-up (not counted)
  try { await ttftOnce(-1); } catch {}
  for (let i = 0; i < count; i++) {
    try {
      await ttftOnce(i);
    } catch (e) {
      console.log(`[SSE][error] ${String(e && e.message || e)}`);
    }
  }
})();

