// Simple OpenAI connectivity check (live)
const OpenAI = require('openai');

(async () => {
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
    temperature: 0,
  });
  const text = resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content;
  console.log('OPENAI_SMOKE_RESPONSE:', JSON.stringify({ ok: !!text, text }));
})().catch((e) => { console.error('SMOKE_ERROR:', e && (e.message || e)); process.exit(1); });
