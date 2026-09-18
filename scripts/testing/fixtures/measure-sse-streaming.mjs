/**
 * Fetches an SSE endpoint and records the wall-clock arrival time of each
 * chunk. Used by verify-nginx-sse-streaming.sh to prove Nginx forwards
 * bytes as they arrive (real streaming) rather than buffering the whole
 * response and delivering it in one burst at the end.
 *
 * Usage: node measure-sse-streaming.mjs <port> <path> <expectedEvents> <intervalMs>
 * Exits 0 and prints RESULT: STREAMED if at least one chunk arrives
 * meaningfully before the final one (allowing generous scheduling slack);
 * exits 1 and prints RESULT: BUFFERED otherwise.
 */
import http from 'node:http';

const [, , portArg, pathArg, expectedEventsArg, intervalMsArg] = process.argv;
const port = Number(portArg);
const path = pathArg;
const expectedEvents = Number(expectedEventsArg);
const intervalMs = Number(intervalMsArg);

const start = Date.now();
const arrivals = [];

http.get({ host: '127.0.0.1', port, path }, (res) => {
  if (res.statusCode !== 200) {
    console.error(`RESULT: FAILED (status ${res.statusCode})`);
    process.exit(1);
  }
  res.on('data', () => {
    arrivals.push(Date.now() - start);
  });
  res.on('end', () => {
    console.log(`chunk arrivals (ms): ${arrivals.join(', ')}`);
    if (arrivals.length !== expectedEvents) {
      console.error(`RESULT: FAILED (expected ${expectedEvents} chunks, got ${arrivals.length})`);
      process.exit(1);
    }
    // A truly buffered proxy delivers everything in one burst at (or
    // after) the total emission time. A streaming proxy delivers the
    // first chunk close to one interval in, well before the total time.
    // Allow generous slack (60% of one interval) for scheduling jitter.
    const firstChunkBudget = intervalMs * 1.6;
    const streamed = arrivals[0] <= firstChunkBudget;
    console.log(`first chunk at ${arrivals[0]}ms, budget ${firstChunkBudget}ms`);
    console.log(`RESULT: ${streamed ? 'STREAMED' : 'BUFFERED'}`);
    process.exit(streamed ? 0 : 1);
  });
}).on('error', (err) => {
  console.error(`RESULT: FAILED (${err.message})`);
  process.exit(1);
});
