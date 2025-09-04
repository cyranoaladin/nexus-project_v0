// scripts/openai_smoke.ts
import OpenAI from 'openai';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY non défini');
    process.exit(1);
  }
  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a test assistant.' },
      { role: 'user', content: 'Réponds par un mot: OK' },
    ],
    max_tokens: 5,
    temperature: 0.0,
  });
  const text = resp.choices?.[0]?.message?.content || '';
  console.log('OPENAI_SMOKE_RESPONSE:', JSON.stringify({ ok: !!text, text }));
}

main().catch((e) => { console.error(e); process.exit(1); });
