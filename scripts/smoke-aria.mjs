import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env.local' });

const base = process.env.BASE_URL || 'http://localhost:3003';
const DEV_TOKEN = process.env.DEV_TOKEN;
const headers = DEV_TOKEN ? { Authorization: `Bearer ${DEV_TOKEN}` } : {};

async function main() {
  const t0 = Date.now();
  const h = await fetch(`${base}/api/aria/health`, { headers }).then((r) => r.json());
  const t1 = Date.now();
  const t2 = Date.now();
  const chat = await fetch(`${base}/api/aria/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ message: 'Réponds OK', subject: 'MATHEMATIQUES' }),
  }).then((r) => r.json());
  const t3 = Date.now();
  console.log(JSON.stringify({ health: h, health_ms: t1 - t0, chat_ms: t3 - t2, chat_ok: !!chat.response }));
}

main().catch((e) => { console.error(e); process.exit(2); });
