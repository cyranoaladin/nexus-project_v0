import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = { vus: 5, duration: '1m' };

export default function () {
  const base = __ENV.BASE_URL || 'http://localhost:3003';
  // Suppose un id de bilan existant est fourni via env
  const id = __ENV.BILAN_ID || 'test-bilan-id';
  const res = http.get(`${base}/api/bilans/${id}/download`);
  check(res, { 'status 200 or 202': r => r.status === 200 || r.status === 202 });
  sleep(1);
}
