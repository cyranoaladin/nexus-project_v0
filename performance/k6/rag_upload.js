import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = { vus: 10, duration: '1m' };

// Load sample PDF in init context per k6 lifecycle rules
const SAMPLE_PDF_PATH = __ENV.SAMPLE_PDF || 'public/sample.pdf';
const SAMPLE_PDF_BIN = open(SAMPLE_PDF_PATH, 'b');

export default function () {
  const url = `${__ENV.BASE_URL}/api/rag/upload`;
  const file = http.file(SAMPLE_PDF_BIN, 'sample.pdf', 'application/pdf');
  const formData = { file, subject: 'autre', level: 'terminale' };
  const res = http.post(url, formData);
  check(res, { 'status 200': r => r.status === 200 });
  sleep(1);
}
