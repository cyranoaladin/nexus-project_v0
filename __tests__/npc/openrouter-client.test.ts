import { OpenRouterClient } from '@/lib/npc/ai/openrouter-client';

type Body = Record<string, unknown> & { provider?: { ignore?: string[] }; messages?: Array<{ content: unknown }>; model?: string; max_completion_tokens?: number };

const KEY = ['sk', 'or', 'v1', 'k'.repeat(24)].join('-');

interface Capture {
  url: string;
  headers: Record<string, string>;
  body: Body;
  signal?: AbortSignal | null;
}

function fakeFetch(responder: (call: number) => Response | Promise<Response>) {
  const calls: Capture[] = [];
  const impl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
      signal: init?.signal,
    });
    return responder(calls.length);
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const ok = (content: string, id = 'gen-1') =>
  new Response(JSON.stringify({
    id,
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
  }), { status: 200 });

describe('NPC OpenRouter client', () => {
  it('sends the pinned model, the GPT-5 transport shape and the chutes exclusion in the real body', async () => {
    const { calls, impl } = fakeFetch(() => ok('{"a":1}'));
    const client = new OpenRouterClient({ fetchImpl: impl, apiKey: KEY });

    const result = await client.completeJson<{ a: number }>(
      [{ role: 'user', content: 'x' }], 'Schema', { max_tokens: 1234 },
    );

    expect(result).toMatchObject({ success: true, data: { a: 1 } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0].body.model).toBe('openai/gpt-5-mini');
    expect(calls[0].body.max_completion_tokens).toBe(1234);
    expect(calls[0].body).not.toHaveProperty('max_tokens');
    expect(calls[0].body).not.toHaveProperty('temperature');
    expect(calls[0].body.provider?.ignore).toContain('chutes');
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps the exclusion on every attempt (worker-level retries call the client again)', async () => {
    const { calls, impl } = fakeFetch((n) => (n === 1 ? new Response('boom', { status: 503 }) : ok('{"ok":true}')));
    const client = new OpenRouterClient({ fetchImpl: impl, apiKey: KEY });

    const first = await client.completeJson([{ role: 'user', content: 'x' }], 'S');
    const second = await client.completeJson([{ role: 'user', content: 'x' }], 'S');

    expect(first.success).toBe(false);
    expect(second.success).toBe(true);
    expect(calls.map((c) => c.body.provider?.ignore)).toEqual([['chutes'], ['chutes']]);
    expect(calls.every((c) => c.body.model === 'openai/gpt-5-mini')).toBe(true);
  });

  it('OCR sends an image_url part to the same pinned model, without a Chutes model or domain', async () => {
    const { calls, impl } = fakeFetch(() => ok('Bonjour le monde, texte extrait.'));
    const client = new OpenRouterClient({ fetchImpl: impl, apiKey: KEY });

    const result = await client.visionOcr('AAAA', 'image/png');

    expect(result).toMatchObject({ success: true, text: 'Bonjour le monde, texte extrait.' });
    const user = calls[0].body.messages?.[1].content as Array<Record<string, unknown>>;
    expect(user[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } });
    expect(JSON.stringify(calls[0].body)).not.toMatch(/chutes(?!")/i);
    expect(calls[0].body.model).toBe('openai/gpt-5-mini');
    expect(calls[0].body.max_completion_tokens).toBe(4000);
  });

  it('never calls the network without an API key', async () => {
    const { calls, impl } = fakeFetch(() => ok('{}'));
    const client = new OpenRouterClient({ fetchImpl: impl, apiKey: '' });
    const result = await client.complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(result).toMatchObject({ success: false, status: 500 });
    expect(calls).toHaveLength(0);
  });

  it('refuses a base URL on the excluded provider', async () => {
    const { calls, impl } = fakeFetch(() => ok('{}'));
    const client = new OpenRouterClient({ fetchImpl: impl, apiKey: KEY, baseUrl: 'https://llm.chutes.ai/v1' });
    const result = await client.complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(result.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('handles network failure, timeout, HTTP errors and malformed payloads without leaking secrets or bodies', async () => {
    const scenarios: Array<() => Response | Promise<Response>> = [
      () => { throw new Error('socket hang up'); },
      () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); },
      () => new Response(`echo ${KEY} student content`, { status: 500 }),
      () => new Response('{"choices":[]}', { status: 200 }),
    ];
    for (const scenario of scenarios) {
      const { impl } = fakeFetch(scenario);
      const client = new OpenRouterClient({ fetchImpl: impl, apiKey: KEY });
      const result = await client.complete({ messages: [{ role: 'user', content: 'x' }] });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).not.toContain(KEY);
      expect(JSON.stringify(result)).not.toContain('student content');
    }
  });

  it('reports an unparsable JSON answer with its raw content for the worker to reject', async () => {
    const { impl } = fakeFetch(() => ok('pas du JSON'));
    const client = new OpenRouterClient({ fetchImpl: impl, apiKey: KEY });
    const result = await client.completeJson([{ role: 'user', content: 'x' }], 'S');
    expect(result).toMatchObject({ success: false, rawContent: 'pas du JSON' });
  });

  it('strips markdown fences around JSON answers', async () => {
    const { impl } = fakeFetch(() => ok('```json\n{"v":2}\n```'));
    const client = new OpenRouterClient({ fetchImpl: impl, apiKey: KEY });
    await expect(client.completeJson([{ role: 'user', content: 'x' }], 'S')).resolves.toMatchObject({
      success: true, data: { v: 2 },
    });
  });
});
