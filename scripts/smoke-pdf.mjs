import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env.local' });

const base = process.env.BASE_URL || 'http://localhost:3003';
const DEV_TOKEN = process.env.DEV_TOKEN;
const headers = DEV_TOKEN ? { Authorization: `Bearer ${DEV_TOKEN}` } : {};

async function head(headers) {
  return Object.fromEntries([...headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
}

async function fetchPdf(url) {
  const r = await fetch(url, { headers });
  const h = await head(r.headers);
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, contentType: h['content-type'], size: buf.length };
}

async function main() {
  // lire seed artefact (optionnel)
  let seed;
  try { seed = JSON.parse(require('fs').readFileSync('.nexus-seed.json', 'utf8')); } catch {}
  const studentQuery = seed?.student?.id ? `&studentId=${seed.student.id}` : '';
  const urls = [
    `${base}/api/bilan/pdf?niveau=premiere&variant=general${studentQuery}`,
    `${base}/api/bilan/pdf?niveau=premiere&variant=parent${studentQuery}`,
  ];
  const out = [];
  for (const u of urls) {
    out.push({ url: u, ...(await fetchPdf(u)) });
  }
  // Force regen
  process.env.FORCE_PDF_REGEN = '1';
  out.push({ url: urls[0] + '&force=1', ...(await fetchPdf(urls[0])) });
  console.log(JSON.stringify(out));
}

main().catch((e) => { console.error(e); process.exit(2); });
