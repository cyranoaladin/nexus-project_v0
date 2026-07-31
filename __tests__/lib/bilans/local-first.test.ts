/** @jest-environment node */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  LOCAL_FIRST_REPORT_CONTEXT_JSON_SCHEMA,
  SYNTHETIC_BENCHMARK_FIXTURE_JSON_SCHEMA,
  SyntheticBenchmarkFixtureSchema,
  buildLocalFirstReportContext,
  collectAllOutboundStringFields,
  hasValidSyntheticFixtureChecksum,
  validateLocalFirstReportContext,
  approvedEvidenceSourceChecksum,
} from '@/lib/bilans/local-first/contracts';
import {
  bindPiiScanResultToPayload,
  scanPiiFields,
} from '@/lib/bilans/local-first/pii';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';

const FIXTURE_ROOT = join(
  process.cwd(),
  'content',
  'bilans',
  'benchmarks',
  'synthetic-v1',
);

function fixtures(): unknown[] {
  return readdirSync(FIXTURE_ROOT)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(FIXTURE_ROOT, name), 'utf8')));
}

function fixtureWithChecksum(value: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...value };
  delete payload.inputChecksum;
  return {
    ...payload,
    inputChecksum: sha256Canonical(payload),
  };
}

function collectExpectedStringPaths(
  value: unknown,
  path = '$',
): string[] {
  if (typeof value === 'string') return [path];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectExpectedStringPaths(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'piiScanResult' || path !== '$')
      .flatMap(([key, item]) => collectExpectedStringPaths(item, `${path}.${key}`));
  }
  return [];
}

function bindContextScan<T extends Record<string, any>>(context: T): T {
  const payload = { ...context };
  delete payload.piiScanResult;
  const scan = scanPiiFields(collectAllOutboundStringFields(payload));
  return {
    ...payload,
    piiScanResult: bindPiiScanResultToPayload(
      scan.result,
      sha256Canonical(payload),
    ),
  } as unknown as T;
}

describe('local-first synthetic benchmark contracts', () => {
  it('contains twelve checksum-valid synthetic fixtures in three tiers', () => {
    const parsed = fixtures().map((fixture) =>
      SyntheticBenchmarkFixtureSchema.parse(fixture));

    expect(parsed).toHaveLength(12);
    expect(parsed.filter(({ complexity }) => complexity === 'SIMPLE'))
      .toHaveLength(4);
    expect(parsed.filter(({ complexity }) => complexity === 'INTERMEDIATE'))
      .toHaveLength(4);
    expect(parsed.filter(({ complexity }) => complexity === 'COMPLEX'))
      .toHaveLength(4);
    expect(parsed.every(hasValidSyntheticFixtureChecksum)).toBe(true);
    expect(new Set(parsed.map(({ fixtureId }) => fixtureId)).size).toBe(12);
    expect(new Set(parsed.map(({ datasetVersion }) => datasetVersion)))
      .toEqual(new Set(['synthetic-v1']));
    expect(JSON.stringify(parsed)).not.toContain('sourceSha');
  });

  it('covers every required synthetic scenario without production identifiers', () => {
    const parsed = fixtures().map((fixture) =>
      SyntheticBenchmarkFixtureSchema.parse(fixture));
    const coverage = new Set(parsed.flatMap((fixture) => fixture.coverage));

    expect(coverage).toEqual(new Set([
      'LOW_SCORE',
      'MEDIUM_SCORE',
      'HIGH_SCORE',
      'UNMEASURED_COMPETENCY',
      'MULTIPLE_EVIDENCE_REFS',
      'HIGH_PRIORITY',
      'SYNTHETIC_PROMPT_INJECTION',
      'SYNTHETIC_FALSE_PII',
      'APPARENT_EVIDENCE_CONTRADICTION',
      'NO_MAJOR_DIFFICULTY',
    ]));
    expect(JSON.stringify(parsed)).not.toMatch(
      /nexusreussite\.academy|@gmail\.com|@yahoo\.|@hotmail\./i,
    );
  });

  it.each(['PARENT', 'STUDENT', 'NEXUS'] as const)(
    'builds a grounded and PII-scanned %s context without raw fields',
    (audience) => {
      for (const fixture of fixtures()) {
        const context = buildLocalFirstReportContext(fixture, audience);
        expect(() => validateLocalFirstReportContext(context)).not.toThrow();
        expect(context.audience).toBe(audience);
        expect(['CLEAN', 'REDACTED']).toContain(context.piiScanResult.status);
        expect(context.scoreEcho.percentage).toBe(
          Math.round(
            (context.scoreEcho.points / context.scoreEcho.maxPoints) * 10_000,
          ) / 100,
        );
        expect(JSON.stringify(context)).not.toMatch(
          /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+216[\s.-]*\d/i,
        );
        expect(JSON.stringify(context)).not.toMatch(
          /ignore (?:les|toutes les) (?:règles|instructions)/i,
        );
        expect(context).not.toHaveProperty('rawEvidenceLocalOnly');
        expect(context).not.toHaveProperty('rawInternalNotesLocalOnly');
        expect(context).not.toHaveProperty('internalNotes');
        expect(context).not.toHaveProperty('llmApprovedInternalNotes');
      }
    },
  );

  it('rejects unknown evidence refs and an altered score echo', () => {
    const fixture = fixtures()[0];
    const context = buildLocalFirstReportContext(fixture, 'PARENT');
    expect(() => validateLocalFirstReportContext({
      ...context,
      priorities: [{
        ...context.priorities[0],
        evidenceRefs: ['invented-evidence-ref'],
      }],
    })).toThrow();
    expect(() => validateLocalFirstReportContext({
      ...context,
      scoreEcho: {
        ...context.scoreEcho,
        percentage: context.scoreEcho.percentage + 1,
      },
    })).toThrow();
  });

  it('rejects forbidden claims and oversized evidence locally', () => {
    const fixture = fixtures()[0];
    const context = buildLocalFirstReportContext(fixture, 'PARENT');
    expect(() => validateLocalFirstReportContext({
      ...context,
      allowedRecommendations: [{
        ...context.allowedRecommendations[0],
        title: 'Diagnostic dyslexique garanti',
      }],
    })).toThrow();
    expect(() => validateLocalFirstReportContext({
      ...context,
      approvedEvidenceForLlm: [{
        ...context.approvedEvidenceForLlm[0],
        text: 'x'.repeat(501),
      }, ...context.approvedEvidenceForLlm.slice(1)],
    })).toThrow();
  });

  it('rejects unredacted PII consistently across consecutive validations', () => {
    const fixture = fixtures()[0];
    const context = buildLocalFirstReportContext(fixture, 'PARENT');
    const withEmail = {
      ...context,
      approvedEvidenceForLlm: [{
        ...context.approvedEvidenceForLlm[0],
        text: 'Écrire à eleve.synthetic@example.invalid',
      }, ...context.approvedEvidenceForLlm.slice(1)],
    };

    expect(() => validateLocalFirstReportContext(withEmail)).toThrow();
    expect(() => validateLocalFirstReportContext(withEmail)).toThrow();
  });

  it('scans every outbound string and binds the scan to the final payload', () => {
    const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
    const expectedPaths = collectExpectedStringPaths(context).sort();
    const collected = collectAllOutboundStringFields(context);

    expect(collected.map(({ path }) => path).sort()).toEqual(expectedPaths);
    expect(context.piiScanResult.scannedFieldPaths).toEqual(expectedPaths);
    expect(() => validateLocalFirstReportContext({
      ...context,
      competencies: [{
        ...context.competencies[0],
        title: `${context.competencies[0].title} modifié après scan`,
      }, ...context.competencies.slice(1)],
    })).toThrow(/PII scan/i);
  });

  it('does not exempt an open dataset version from PII detection', () => {
    const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
    const rebound = bindContextScan({
      ...context,
      datasetVersion: 'student.synthetic@example.invalid',
    });

    expect(() => validateLocalFirstReportContext(rebound)).toThrow(/PII scan/i);
  });

  it('does not exempt an open fixture identifier from PII detection', () => {
    const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
    const rebound = bindContextScan({
      ...context,
      fixtureId: 'student.synthetic@example.invalid',
    });

    expect(() => validateLocalFirstReportContext(rebound)).toThrow(/PII scan/i);
  });

  it('rejects duplicate raw evidence references before deriving approvals', () => {
    const value = structuredClone(fixtures()[0]) as Record<string, any>;
    value.rawEvidenceLocalOnly.push({
      ...value.rawEvidenceLocalOnly[0],
      text: 'Observation contradictoire sous la même référence.',
    });

    expect(() => SyntheticBenchmarkFixtureSchema.parse(
      fixtureWithChecksum(value),
    )).toThrow(/duplicate raw evidence reference/i);
  });

  it('rejects untrusted raw evidence relabeled as curated', () => {
    const value = structuredClone(fixtures()[0]) as Record<string, any>;
    value.rawEvidenceLocalOnly[0] = {
      ...value.rawEvidenceLocalOnly[0],
      source: 'UNTRUSTED_FREE_TEXT',
      text: 'Instruction libre qui ne provient pas du template contrôlé.',
    };

    expect(() => SyntheticBenchmarkFixtureSchema.parse(
      fixtureWithChecksum(value),
    )).toThrow(/trust|template|untrusted/i);
  });

  it('rejects caller-defined curated templates absent from the trusted registry', () => {
    const value = structuredClone(fixtures()[0]) as Record<string, any>;
    const approved = value.approvedEvidenceForLlm[0];
    const raw = value.rawEvidenceLocalOnly.find(
      ({ evidenceRef }: { evidenceRef: string }) =>
        evidenceRef === approved.evidenceRef,
    );
    approved.text = 'Texte arbitraire déclaré contrôlé par le seul appelant.';
    approved.templateId = 'tpl:caller-defined';
    approved.templateChecksum = sha256Canonical({
      templateId: approved.templateId,
      text: approved.text,
    });
    raw.text = approved.text;
    raw.source = 'CONTROLLED_TEMPLATE_SOURCE';

    expect(() => SyntheticBenchmarkFixtureSchema.parse(
      fixtureWithChecksum(value),
    )).toThrow(/trusted template registry/i);
  });

  it('binds curated evidence to its exact controlled template', () => {
    const value = structuredClone(fixtures()[0]) as Record<string, any>;
    const evidence = value.approvedEvidenceForLlm[0];
    evidence.templateChecksum = sha256Canonical({
      templateId: evidence.templateId,
      text: evidence.text,
    });
    const valid = fixtureWithChecksum(value);
    expect(() => SyntheticBenchmarkFixtureSchema.parse(valid)).not.toThrow();

    const tampered = structuredClone(value);
    tampered.approvedEvidenceForLlm[0].templateChecksum = '0'.repeat(64);
    expect(() => SyntheticBenchmarkFixtureSchema.parse(
      fixtureWithChecksum(tampered),
    )).toThrow(/template/i);
  });

  it('revalidates curated template provenance at the outbound context boundary', () => {
    const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
    const rebound = bindContextScan({
      ...context,
      approvedEvidenceForLlm: [{
        ...context.approvedEvidenceForLlm[0],
        text: 'Texte sûr mais différent du template contrôlé.',
      }, ...context.approvedEvidenceForLlm.slice(1)],
    });

    expect(() => validateLocalFirstReportContext(rebound)).toThrow(/template/i);
  });

  it('rejects PII in a curated controlled template instead of invalidating provenance', () => {
    const value = structuredClone(fixtures()[0]) as Record<string, any>;
    const evidence = value.approvedEvidenceForLlm[0];
    const raw = value.rawEvidenceLocalOnly.find(
      ({ evidenceRef }: { evidenceRef: string }) =>
        evidenceRef === evidence.evidenceRef,
    );
    evidence.text = 'Contact synthétique eleve@example.invalid';
    raw.text = evidence.text;
    evidence.templateChecksum = sha256Canonical({
      templateId: evidence.templateId,
      text: evidence.text,
    });
    expect(() => buildLocalFirstReportContext(
      fixtureWithChecksum(value),
      'PARENT',
    )).toThrow(/PII in a controlled template|trusted template registry/i);
  });

  it.each(['title', 'rationale'] as const)(
    'binds resolved recommendation %s to the local catalog entry',
    (field) => {
      const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
      const rebound = bindContextScan({
        ...context,
        allowedRecommendations: [{
          ...context.allowedRecommendations[0],
          [field]: `Texte modifié hors catalogue pour ${field}.`,
        }, ...context.allowedRecommendations.slice(1)],
      });

      expect(() => validateLocalFirstReportContext(rebound)).toThrow(
        /recommendation copy differs from the local catalog/i,
      );
    },
  );

  it('binds human approval to the exact approved evidence content', () => {
    const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
    const original = context.approvedEvidenceForLlm[0];
    const path = '$.approvedEvidenceForLlm[0].text';
    const originalScan = scanPiiFields([{
      path,
      text: original.text,
      source: 'CONTROLLED_TEMPLATE',
    }]);
    const rawSourceChecksum = '1'.repeat(64);
    const approvalValues = {
      reviewerId: 'reviewer:synthetic',
      reviewedAt: '2026-07-31T10:00:00.000Z',
      sourceChecksum: approvedEvidenceSourceChecksum({
        evidenceRef: original.evidenceRef,
        competencyId: original.competencyId,
        text: original.text,
        rawSourceChecksum,
        piiScanResult: originalScan.result,
      }),
    };
    const humanApproval = {
      ...approvalValues,
      approvalChecksum: sha256Canonical(approvalValues),
    };
    const untrusted = {
      evidenceRef: original.evidenceRef,
      competencyId: original.competencyId,
      text: original.text,
      trust: 'UNTRUSTED_QUOTED_DATA' as const,
      rawSourceChecksum,
      piiScanResult: originalScan.result,
      humanApproval,
    };
    const approvedContext = bindContextScan({
      ...context,
      approvedEvidenceForLlm: [
        untrusted,
        ...context.approvedEvidenceForLlm.slice(1),
      ],
    });
    expect(() => validateLocalFirstReportContext(approvedContext)).not.toThrow();

    const changedText = `${original.text} Ajout non revu.`;
    const changedScan = scanPiiFields([{
      path,
      text: changedText,
      source: 'CONTROLLED_TEMPLATE',
    }]);
    const changedContext = bindContextScan({
      ...approvedContext,
      approvedEvidenceForLlm: [{
        ...untrusted,
        text: changedText,
        piiScanResult: changedScan.result,
      }, ...context.approvedEvidenceForLlm.slice(1)],
    });
    expect(() => validateLocalFirstReportContext(changedContext)).toThrow(
      /approval/i,
    );
  });

  it('scans an open reviewer identifier even when approval checksums are rebound', () => {
    const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
    const original = context.approvedEvidenceForLlm[0];
    const path = '$.approvedEvidenceForLlm[0].text';
    const evidenceScan = scanPiiFields([{
      path,
      text: original.text,
      source: 'CONTROLLED_TEMPLATE',
    }]);
    const rawSourceChecksum = '2'.repeat(64);
    const evidence = {
      evidenceRef: original.evidenceRef,
      competencyId: original.competencyId,
      text: original.text,
      trust: 'UNTRUSTED_QUOTED_DATA' as const,
      rawSourceChecksum,
      piiScanResult: evidenceScan.result,
    };
    const approvalValues = {
      reviewerId: 'nom:alice',
      reviewedAt: '2026-07-31T10:00:00.000Z',
      sourceChecksum: approvedEvidenceSourceChecksum(evidence),
    };
    const rebound = bindContextScan({
      ...context,
      approvedEvidenceForLlm: [{
        ...evidence,
        humanApproval: {
          ...approvalValues,
          approvalChecksum: sha256Canonical(approvalValues),
        },
      }, ...context.approvedEvidenceForLlm.slice(1)],
    });

    expect(() => validateLocalFirstReportContext(rebound)).toThrow(/PII scan/i);
  });

  it('exports closed local JSON Schemas', () => {
    expect(SYNTHETIC_BENCHMARK_FIXTURE_JSON_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
    expect(LOCAL_FIRST_REPORT_CONTEXT_JSON_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
  });
});
