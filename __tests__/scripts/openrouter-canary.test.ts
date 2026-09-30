/** @jest-environment node */
import { inflateSync } from 'node:zlib';
import { OpenRouterClient } from '@/lib/npc/ai/openrouter-client';
import { renderTextPng } from '@/scripts/openrouter-canary/png';
import {
  CANARY_CALL_COUNT,
  parseApproval,
  runCanary,
  worstCaseUsd,
  type Pricing,
} from '@/scripts/openrouter-canary/run';

const PRICING: Pricing = { promptUsdPerToken: 0.25e-6, completionUsdPerToken: 2e-6 };
const KEY = ['sk', 'or', 'v1', 'q'.repeat(24)].join('-');

function scriptedClient(answers: string[]) {
  const bodies: Array<Record<string, unknown>> = [];
  const impl = jest.fn(async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const content = answers.shift() ?? '';
    return new Response(JSON.stringify({
      id: 'gen',
      choices: [{ message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
    }), { status: 200 });
  }) as unknown as typeof fetch;
  return { client: new OpenRouterClient({ fetchImpl: impl, apiKey: KEY }), impl, bodies };
}

async function* stream(text: string) {
  yield text;
}

describe('OpenRouter canary (prepared, not armed)', () => {
  it('requires an explicit approval naming an alias and a cap no higher than the proposed 1 USD', () => {
    expect(() => parseApproval(undefined)).toThrow('CANARY_APPROVAL_REQUIRED');
    expect(() => parseApproval('alias=x')).toThrow('CANARY_APPROVAL_INVALID');
    expect(() => parseApproval('alias=x;cap-usd=2')).toThrow('CANARY_CAP_ABOVE_PROPOSED_CEILING');
    expect(parseApproval('alias=qualif;cap-usd=1')).toEqual({ alias: 'qualif', capUsd: 1 });
  });

  it('runs exactly four sequential calls with the chutes exclusion, and reports a bounded spend under the cap', async () => {
    const { client, impl, bodies } = scriptedClient(['CANARY-OK', '{"status":"ok","answer":42}', 'NEXUS 4271']);
    const report = await runCanary({ client, pricing: PRICING, stream: () => stream('STREAM-OK') }, { alias: 'qualif', capUsd: 1 });

    expect(report.completed).toBe(true);
    expect(report.steps.map((step) => step.name)).toEqual(['text', 'json', 'image', 'stream']);
    expect(report.steps.every((step) => step.ok)).toBe(true);
    expect(report.steps).toHaveLength(CANARY_CALL_COUNT);
    expect((impl as unknown as jest.Mock).mock.calls).toHaveLength(3); // the 4th call is the stream path
    expect(bodies.every((body) => (body.provider as { ignore: string[] }).ignore.includes('chutes'))).toBe(true);
    expect(bodies.every((body) => body.model === 'openai/gpt-5-mini')).toBe(true);
    expect(report.boundedSpendUsd).toBeGreaterThan(0);
    expect(report.boundedSpendUsd).toBeLessThan(1);
    expect(JSON.stringify(report)).not.toContain(KEY);
  });

  it('sends the synthetic image as a data URL to the pinned model', async () => {
    const { client, bodies } = scriptedClient(['CANARY-OK', '{"status":"ok","answer":42}', 'NEXUS 4271']);
    await runCanary({ client, pricing: PRICING, stream: () => stream('STREAM-OK') }, { alias: 'q', capUsd: 1 });
    const imageBody = bodies[2] as { messages: Array<{ content: unknown }> };
    const parts = imageBody.messages[1].content as Array<{ type: string; image_url?: { url: string } }>;
    expect(parts[0].image_url?.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('refuses to start, without any call, when the worst case could exceed the cap', async () => {
    const { client, impl } = scriptedClient([]);
    await expect(runCanary({ client, pricing: PRICING, stream: () => stream('x') }, { alias: 'q', capUsd: 0.001 }))
      .rejects.toThrow('CANARY_WORST_CASE_ABOVE_CAP');
    expect(impl).not.toHaveBeenCalled();
  });

  it('stops at the first failed step and never switches keys or retries', async () => {
    const { client, impl } = scriptedClient(['wrong answer']);
    const report = await runCanary({ client, pricing: PRICING, stream: () => stream('x') }, { alias: 'q', capUsd: 1 });
    expect(report.completed).toBe(false);
    expect(report.steps).toHaveLength(1);
    expect((impl as unknown as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('keeps the planned worst case far below the proposed cap', () => {
    const planned = worstCaseUsd(PRICING, 200, 1_200) * 3 + worstCaseUsd(PRICING, 400, 4_000, 2_000);
    expect(planned).toBeLessThan(0.1);
  });

  it('renders a valid synthetic PNG', () => {
    const png = renderTextPng('NEXUS 4271');
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const idatStart = png.indexOf(Buffer.from('IDAT')) + 4;
    const idatLength = png.readUInt32BE(idatStart - 8);
    const raw = inflateSync(png.subarray(idatStart, idatStart + idatLength));
    expect(raw.length).toBe(height * (width + 1));
    expect(raw.includes(0x00)).toBe(true);
  });
});
