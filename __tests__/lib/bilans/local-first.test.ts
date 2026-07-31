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
} from '@/lib/bilans/local-first/contracts';

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
    'builds a grounded and PII-redacted %s context',
    (audience) => {
      for (const fixture of fixtures()) {
        const context = buildLocalFirstReportContext(fixture, audience);
        expect(() => validateLocalFirstReportContext(context)).not.toThrow();
        expect(context.audience).toBe(audience);
        expect(context.piiStatus).toBe('REDACTED');
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
        if (audience === 'NEXUS') {
          expect(context).toHaveProperty('internalNotes');
        } else {
          expect(context).not.toHaveProperty('internalNotes');
        }
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
      evidence: [{
        ...context.evidence[0],
        text: 'x'.repeat(501),
      }, ...context.evidence.slice(1)],
    })).toThrow();
  });

  it('rejects unredacted PII consistently across consecutive validations', () => {
    const fixture = fixtures()[0];
    const context = buildLocalFirstReportContext(fixture, 'PARENT');
    const withEmail = {
      ...context,
      evidence: [{
        ...context.evidence[0],
        text: 'Écrire à eleve.synthetic@example.invalid',
      }, ...context.evidence.slice(1)],
    };

    expect(() => validateLocalFirstReportContext(withEmail)).toThrow();
    expect(() => validateLocalFirstReportContext(withEmail)).toThrow();
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
