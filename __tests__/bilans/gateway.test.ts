import { createPseudonymizedFactSheet } from '@/lib/bilans/local-first/contracts';
import { BilanLlmGateway, type BilanLlmTransport } from '@/lib/bilans/llm/gateway';
import { MockBilanLlmTransport } from '@/lib/bilans/llm/mock-transport';

import { VALIDATED_PACK_FIXTURE as pack } from './fixtures/validated-pack';
import { RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

const factSheet = createPseudonymizedFactSheet(RECIPE_FACT_SHEETS[0]);

describe('constrained five-agent bilan gateway', () => {
  it('runs all five pack-bound agents and returns pending review', async () => {
    const transport = new MockBilanLlmTransport();
    const gateway = new BilanLlmGateway(transport);

    await expect(gateway.run(factSheet, pack)).resolves.toMatchObject({
      status: 'REPORT_PENDING_REVIEW', attempts: 1, validationFailures: [],
    });
    expect(transport.requests.map(({ agent }) => agent.id)).toEqual([
      'preAnalysis', 'eleve', 'parents', 'nexus', 'verifier',
    ]);
    expect(transport.requests[0]).not.toHaveProperty('messages');
  });

  it('retries only PARENTS and verifier while preserving the exact ELEVE output', async () => {
    const mock = new MockBilanLlmTransport();
    let parentsCalls = 0;
    let preservedEleveOutput: unknown;
    const transport: BilanLlmTransport = {
      generate: jest.fn(async (request) => {
        const output = await mock.generate(request);
        if (request.agent.id === 'parents' && parentsCalls > 0) {
          preservedEleveOutput = request.priorOutputs.eleve;
        }
        if (request.agent.id !== 'parents') return output;
        parentsCalls += 1;
        return parentsCalls === 1 ? { ...(output as object), cadre: 'Score 12.' } : output;
      }),
    };
    const result = await new BilanLlmGateway(transport).run(factSheet, pack);

    expect(transport.generate).toHaveBeenCalledTimes(7);
    expect((transport.generate as jest.Mock).mock.calls.slice(5).map(([request]) => request.agent.id))
      .toEqual(['parents', 'verifier']);
    expect(result).toMatchObject({ status: 'REPORT_PENDING_REVIEW', attempts: 2, validationFailures: [] });
    expect(result.bundle?.eleve).toBe(preservedEleveOutput);
    expect((transport.generate as jest.Mock).mock.calls[5][0].correctionFailures).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'V2' })]),
    );
  });

  it('keeps only PARENTS violations after the single targeted retry also fails', async () => {
    const mock = new MockBilanLlmTransport();
    const transport: BilanLlmTransport = {
      generate: jest.fn(async (request) => {
        const output = await mock.generate(request);
        return request.agent.id === 'parents'
          ? { ...(output as object), cadre: 'Score 12.' }
          : output;
      }),
    };

    const result = await new BilanLlmGateway(transport).run(factSheet, pack);

    expect(transport.generate).toHaveBeenCalledTimes(7);
    expect((transport.generate as jest.Mock).mock.calls.slice(5).map(([request]) => request.agent.id))
      .toEqual(['parents', 'verifier']);
    expect(result).toMatchObject({ status: 'REPORT_PENDING_REVIEW', attempts: 2, bundle: null });
    expect(result.validationFailures).not.toEqual([]);
    expect(result.validationFailures.every(({ path }) => path.includes('parents'))).toBe(true);
    expect(result.validationFailures.map(({ rule }) => rule)).toEqual(['V2']);
  });

  it('turns pack-schema failures into pending review and never COMPLETED', async () => {
    const mock = new MockBilanLlmTransport();
    const transport: BilanLlmTransport = {
      generate: jest.fn(async (request) => request.agent.id === 'verifier'
        ? { ok: 'yes', violations: [] }
        : mock.generate(request)),
    };
    const result = await new BilanLlmGateway(transport).run(factSheet, pack);

    expect(result.status).toBe('REPORT_PENDING_REVIEW');
    expect(JSON.stringify(result)).not.toContain('COMPLETED');
    expect(result.bundle).toBeNull();
    expect(result.validationFailures).toEqual([expect.objectContaining({ rule: 'V1' })]);
  });

  it('rejects a tampered PII binding before any agent transport', async () => {
    const transport = new MockBilanLlmTransport();
    const tampered = { ...factSheet, value: { ...factSheet.value, globalScore: 99 } };

    await expect(new BilanLlmGateway(transport).run(tampered, pack)).rejects.toThrow(/PII|checksum/i);
    expect(transport.requests).toEqual([]);
  });
});
