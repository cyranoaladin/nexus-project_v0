import OpenAI from 'openai';
import { selectModel } from '../lib/aria/openai.js';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY manquant');
    process.exit(1);
  }
  const client = new OpenAI({ apiKey });
  const model = selectModel();
  const t0 = Date.now();
  const r = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a test assistant.' },
      { role: 'user', content: 'Dis juste: OK' },
    ],
    max_tokens: 4,
    temperature: 0,
  });
  const text = r?.choices?.[0]?.message?.content || '';
  const dt = Date.now() - t0;
  console.log(JSON.stringify({ ok: !!text, model, ms: dt, text }));
}

main().catch((e) => { console.error(e); process.exit(2); });


