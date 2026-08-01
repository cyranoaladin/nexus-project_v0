import { createPseudonymizedFactSheet } from '@/lib/bilans/local-first/contracts';
import { BilanLlmGateway } from '@/lib/bilans/llm/gateway';
import { MockBilanLlmTransport } from '@/lib/bilans/llm/mock-transport';
import { buildDeterministicReport } from '@/lib/bilans/render/report';
import { validateAgentBundle, type ValidationRule } from '@/lib/bilans/validators';
import type { ValidatedPack } from '@/lib/bilans/validators/contracts';

const AUDIENCES = ['ELEVE', 'PARENTS', 'NEXUS'] as const;
const RULES = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'] as const satisfies readonly ValidationRule[];

type RecipeFactSheet = Parameters<typeof createPseudonymizedFactSheet>[0];

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function generateMockRecipeEvidence(
  factSheets: readonly RecipeFactSheet[],
  pack: ValidatedPack,
) {
  const transport = new MockBilanLlmTransport();
  const validationViolations: Record<ValidationRule, number> = {
    V1: 0, V2: 0, V3: 0, V4: 0, V5: 0, V6: 0, V7: 0,
  };
  const reports = [];

  for (const [index, factSheet] of factSheets.entries()) {
    const result = await new BilanLlmGateway(transport).run(
      createPseudonymizedFactSheet(factSheet),
      pack,
    );
    if (result.bundle === null || result.validationFailures.length > 0) {
      throw new Error(`Mock recipe failed for FactSheet ${index + 1}`);
    }
    for (const current of validateAgentBundle({ bundle: result.bundle, factSheet, pack })) {
      validationViolations[current.rule] += 1;
    }
    for (const audience of AUDIENCES) {
      const report = buildDeterministicReport(factSheet, result.bundle, audience);
      if (report.content.domains.length !== pack.scoring.domains.length) {
        throw new Error(`Mock recipe omitted a domain for FactSheet ${index + 1}`);
      }
      reports.push({
        blindId: `CAS_${String(index + 1).padStart(2, '0')}_${audience}`,
        audience,
        report,
      });
    }
  }

  const metrics = {
    schemaVersion: 'nexus-bilan-mock-recipe-metrics/v1',
    fixtureCount: factSheets.length,
    audienceReportCount: reports.length,
    gatewayRunCount: factSheets.length,
    agentCallCount: transport.requests.length,
    validationViolations: Object.fromEntries(RULES.map((rule) => [rule, validationViolations[rule]])),
  };
  const reviewPacket = {
    schemaVersion: 'nexus-bilan-blind-review-packet/v1',
    status: 'TECHNICAL_MOCK_ONLY_NOT_PEDAGOGICALLY_VALIDATED',
    sourceDraftPack: 'maths-terminale-v1',
    executionFixture: pack.slug,
    instructions: 'Évaluer la clarté, la fidélité aux faits et l’utilité pédagogique sans inférer une validation du pack DRAFT.',
    reports,
  };

  return Object.freeze({
    metrics,
    reviewPacket,
    metricsJson: stableJson(metrics),
    reviewPacketJson: stableJson(reviewPacket),
    requests: Object.freeze([...transport.requests]),
  });
}
