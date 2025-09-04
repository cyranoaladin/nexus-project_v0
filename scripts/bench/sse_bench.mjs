#!/usr/bin/env node
// Simple SSE bench for /api/aria/chat?stream=true in E2E stub mode
// Usage: node scripts/bench/sse_bench.mjs [count]

const count = Number(process.argv[2] || 100);
const base = process.env.E2E_BASE_URL || 'http://localhost:3003';
const url = `${base}/api/aria/chat?stream=true`;

async function consumeSSEOnce(i) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-stub': '1',
      // Vary IP to bypass simple per-IP rate-limit (dev/test env)
      'x-forwarded-for': `10.0.0.${(i % 250) + 1}`,
    },
    body: JSON.stringify({ message: 'Explique les suites géométriques', subject: 'MATHEMATIQUES', intent: 'tutor' }),
  });
  if (!res.ok) {
    console.log(`[SSE][http_status] ${res.status}`);
    return null;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let gotToken = false;
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
      if (ev === 'token') gotToken = true;
      if (ev === 'done') {
        const t1 = Date.now();
        console.log(`[SSE][latency_ms] ${t1 - t0}`);
        return t1 - t0;
      }
    }
  }
  return gotToken ? (Date.now() - t0) : null;
}

(async () => {
  for (let i = 0; i < count; i++) {
    try {
      await consumeSSEOnce(i);
    } catch (e) {
      console.log(`[SSE][error] ${String(e && e.message || e)}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });

