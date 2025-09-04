import { Trend, check, sleep } from 'k6';
import http from 'k6/http';

export const options = { vus: 50, duration: '2m' };
const p95 = new Trend('aria_p95');

export default function () {
  const url = `${__ENV.BASE_URL}/api/aria/chat`;
  const payload = JSON.stringify({ message: 'Test dérivée', subject: 'MATHEMATIQUES' });
  const res = http.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'status 200': r => r.status === 200 });
  p95.add(res.timings.duration);
  sleep(1);
}
