/** @jest-environment node */
import OpenAI from 'openai';
import {
  buildAriaModelProviderRouting,
  buildAriaModelTransportRequest,
  type AriaModelIdentity,
} from '@/lib/aria/infrastructure/model/transport-policy';

type Body = Record<string, unknown> & { provider?: { ignore?: string[] }; messages?: Array<{ content: unknown }>; model?: string; max_completion_tokens?: number };

const openrouter: AriaModelIdentity = { provider: 'OPENROUTER_HOSTED', model: 'openai/gpt-5-mini' };

describe('ARIA OpenRouter request on the wire', () => {
  it('routing fragment: chutes ignored on OpenRouter only', () => {
    expect(buildAriaModelProviderRouting(openrouter)).toEqual({ provider: { ignore: ['chutes'] } });
    expect(buildAriaModelProviderRouting({ provider: 'OPENAI_HOSTED', model: 'gpt-4o-mini' })).toEqual({});
    expect(buildAriaModelProviderRouting({ provider: 'OPENAI_COMPATIBLE_LOCAL', model: 'x' })).toEqual({});
  });

  it.each([false, true])('the real SDK serialises provider.ignore in the HTTP body (stream=%s)', async (stream) => {
    const bodies: Body[] = [];
    const fetchStub = jest.fn(async (_url: unknown, init?: { body?: unknown }) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(
        stream
          ? 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'
          : JSON.stringify({ id: 'g', object: 'chat.completion', created: 0, model: 'm', choices: [] }),
        { status: 200, headers: { 'content-type': stream ? 'text/event-stream' : 'application/json' } },
      );
    });
    const client = new OpenAI({
      apiKey: ['sk', 'or', 'v1', 'z'.repeat(24)].join('-'),
      baseURL: 'https://openrouter.ai/api/v1',
      fetch: fetchStub as unknown as typeof fetch,
      maxRetries: 0,
    });

    const response = await client.chat.completions.create({
      model: openrouter.model,
      messages: [{ role: 'user', content: 'test' }],
      ...buildAriaModelTransportRequest(openrouter, {}),
      ...buildAriaModelProviderRouting(openrouter),
      stream,
    } as never);
    if (stream) for await (const chunk of response as unknown as AsyncIterable<unknown>) void chunk;

    expect(bodies).toHaveLength(1);
    expect(bodies[0].provider).toEqual({ ignore: ['chutes'] });
    expect(bodies[0].model).toBe('openai/gpt-5-mini');
    expect(bodies[0].max_completion_tokens).toBe(1500);
    expect(bodies[0]).not.toHaveProperty('max_tokens');
    expect(bodies[0]).not.toHaveProperty('temperature');
    expect(String(fetchStub.mock.calls[0][0])).toBe('https://openrouter.ai/api/v1/chat/completions');
  });
});
