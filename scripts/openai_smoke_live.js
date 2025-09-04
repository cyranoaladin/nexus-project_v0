// Load .env.local and call OpenAI to verify live connectivity
require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai');

(async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) {
    console.error('OPENAI_API_KEY non défini');
    process.exit(1);
  }
  const client = new OpenAI({ apiKey });
  try {
    const r = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a test assistant.' },
        { role: 'user', content: 'Réponds par un mot: OK' },
      ],
      max_tokens: 5,
      temperature: 0,
    });
    const text = r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content;
    console.log(JSON.stringify({ ok: !!text, model, text }));
  } catch (e) {
    console.error('OPENAI_SMOKE_ERROR:', e && (e.message || e));
    process.exit(2);
  }
})();
