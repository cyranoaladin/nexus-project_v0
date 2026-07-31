/** @jest-environment node */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  LOCAL_FIRST_REPORT_CONTEXT_JSON_SCHEMA,
  SYNTHETIC_BENCHMARK_FIXTURE_JSON_SCHEMA,
  SyntheticBenchmarkFixtureSchema,
  buildLocalFirstReportContext,
  hasValidSyntheticFixtureChecksum,
  validateLocalFirstReportContext,
  approvedEvidenceSourceChecksum,
} from '@/lib/bilans/local-first/contracts';
import { scanPiiFields } from '@/lib/bilans/local-first/pii';
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

  it('preserves a REDACTED scan bound to the sanitized context text', () => {
    const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
    const path = '$.approvedEvidenceForLlm[0].text';
    const scan = scanPiiFields(context.approvedEvidenceForLlm.map(
      (item, index) => ({
        path: `$.approvedEvidenceForLlm[${index}].text`,
        text: index === 0
          ? 'Contact synthétique eleve@example.invalid'
          : item.text,
        source: 'CONTROLLED_TEMPLATE' as const,
      }),
    ));
    const redactedContext = {
      ...context,
      piiScanResult: scan.result,
      approvedEvidenceForLlm: [{
        ...context.approvedEvidenceForLlm[0],
        text: scan.sanitizedFields[path],
      }, ...context.approvedEvidenceForLlm.slice(1)],
    };

    expect(scan.result.status).toBe('REDACTED');
    expect(() => validateLocalFirstReportContext(redactedContext)).not.toThrow();
  });

  it('binds human approval to the exact approved evidence content', () => {
    const context = buildLocalFirstReportContext(fixtures()[0], 'PARENT');
    const original = context.approvedEvidenceForLlm[0];
    const path = '$.approvedEvidenceForLlm[0].text';
    const originalScan = scanPiiFields([{
      path,
      text: original.text,
      source: 'CONTROLLED_TEMPLATE',
    }]);
    const approvalValues = {
      reviewerId: 'reviewer:synthetic',
      reviewedAt: '2026-07-31T10:00:00.000Z',
      sourceChecksum: approvedEvidenceSourceChecksum({
        evidenceRef: original.evidenceRef,
        competencyId: original.competencyId,
        text: original.text,
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
      piiScanResult: originalScan.result,
      humanApproval,
    };
    const contextScan = scanPiiFields(context.approvedEvidenceForLlm.map(
      (item, index) => ({
        path: `$.approvedEvidenceForLlm[${index}].text`,
        text: item.text,
        source: 'CONTROLLED_TEMPLATE' as const,
      }),
    ));
    const approvedContext = {
      ...context,
      piiScanResult: contextScan.result,
      approvedEvidenceForLlm: [
        untrusted,
        ...context.approvedEvidenceForLlm.slice(1),
      ],
    };
    expect(() => validateLocalFirstReportContext(approvedContext)).not.toThrow();

    const changedText = `${original.text} Ajout non revu.`;
    const changedScan = scanPiiFields([{
      path,
      text: changedText,
      source: 'CONTROLLED_TEMPLATE',
    }]);
    const changedContextScan = scanPiiFields([
      {
        path,
        text: changedText,
        source: 'CONTROLLED_TEMPLATE',
      },
      ...context.approvedEvidenceForLlm.slice(1).map((item, index) => ({
        path: `$.approvedEvidenceForLlm[${index + 1}].text`,
        text: item.text,
        source: 'CONTROLLED_TEMPLATE' as const,
      })),
    ]);
    expect(() => validateLocalFirstReportContext({
      ...approvedContext,
      piiScanResult: changedContextScan.result,
      approvedEvidenceForLlm: [{
        ...untrusted,
        text: changedText,
        piiScanResult: changedScan.result,
      }, ...context.approvedEvidenceForLlm.slice(1)],
    })).toThrow(/approval/i);
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
