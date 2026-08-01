import expectedMetrics from '@/data/bilans/recipe/maths-terminale-v1-mock-metrics.json';
import reviewPacket from '@/data/bilans/recipe/maths-terminale-v1-mock-review-packet.json';
import { createPseudonymizedFactSheet } from '@/lib/bilans/local-first/contracts';
import { BilanLlmGateway } from '@/lib/bilans/llm/gateway';
import { MockBilanLlmTransport } from '@/lib/bilans/llm/mock-transport';
import { buildDeterministicReport } from '@/lib/bilans/render/report';
import { validateAgentBundle, type ValidationRule } from '@/lib/bilans/validators';

import { VALIDATED_PACK_FIXTURE as pack } from './fixtures/validated-pack';
import { RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

describe('mock technical recipe, twenty FactSheets by three audiences', () => {
  it('completes without LLM environment or network and keeps every validator green', async () => {
    const originalModel = process.env.BILAN_LLM_MODEL;
    delete process.env.BILAN_LLM_MODEL;
    const fetchSpy = jest.spyOn(global, 'fetch');
    const transport = new MockBilanLlmTransport();
    const violations = Object.fromEntries(
      (['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'] as ValidationRule[]).map((rule) => [rule, 0]),
    );
    const reports = [];

    try {
      for (const sheet of RECIPE_FACT_SHEETS) {
        const result = await new BilanLlmGateway(transport).run(createPseudonymizedFactSheet(sheet), pack);
        expect(result.status).toBe('REPORT_PENDING_REVIEW');
        expect(result.bundle).not.toBeNull();
        for (const failure of validateAgentBundle({ bundle: result.bundle, factSheet: sheet, pack })) {
          violations[failure.rule] += 1;
        }
        for (const audience of ['ELEVE', 'PARENTS', 'NEXUS'] as const) {
          const report = buildDeterministicReport(sheet, result.bundle!, audience);
          expect(report.content.domains).toHaveLength(pack.scoring.domains.length);
          reports.push(report);
        }
      }
    } finally {
      if (originalModel === undefined) delete process.env.BILAN_LLM_MODEL;
      else process.env.BILAN_LLM_MODEL = originalModel;
      fetchSpy.mockRestore();
    }

    const actualMetrics = {
      schemaVersion: 'nexus-bilan-mock-recipe-metrics/v1',
      fixtureCount: RECIPE_FACT_SHEETS.length,
      audienceReportCount: reports.length,
      gatewayRunCount: RECIPE_FACT_SHEETS.length,
      agentCallCount: transport.requests.length,
      validationViolations: violations,
    };
    expect(actualMetrics).toEqual(expectedMetrics);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(transport.requests)).not.toMatch(/Camille|@/);
    expect(violations.V2).toBe(0);
    expect(violations.V6).toBe(0);
    expect(reviewPacket.reports).toHaveLength(60);
  });
});
