/**
 * Synthetic SSE upstream for scripts/testing/verify-nginx-sse-streaming.sh.
 *
 * Mirrors the one property of app/api/aria/chat/route.ts that Nginx's
 * `location = /api/aria/chat` block exists to preserve: a response with
 * no Content-Length, written incrementally over time as
 * `text/event-stream`. Everything else about the real route (auth,
 * conversation state, the LLM call itself) is irrelevant to whether
 * Nginx forwards bytes as they arrive or buffers the whole response —
 * this fixture isolates exactly that one property.
 */
import http from 'node:http';

const PORT = process.env.SSE_FIXTURE_PORT || 4510;
const EVENT_COUNT = 5;
const EVENT_INTERVAL_MS = 250;

const server = http.createServer((req, res) => {
  if (req.url !== '/api/aria/chat') {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    res.write(`data: event-${i} ${Date.now()}\n\n`);
    if (i >= EVENT_COUNT) {
      clearInterval(timer);
      res.end();
    }
  }, EVENT_INTERVAL_MS);

  req.on('close', () => clearInterval(timer));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[sse-echo-server] listening on 127.0.0.1:${PORT}`);
});
