import { readFileSync } from 'node:fs';

import { buildWorkerScoring } from '@/lib/bilans/worker/scoring';
import { validateDeterministicReports } from '@/lib/bilans/worker/structural-validation';

import {
  CANONICAL_WORKER_ANSWERS,
  CANONICAL_WORKER_PACK,
} from './fixtures/canonical-worker';

describe('A86 deterministic scoring contract', () => {
  it('composes Scoring V2 and computeFacts through one FactSheet', () => {
    const first = buildWorkerScoring({
      attemptId: 'attempt-a86',
      startedAt: new Date('2026-08-02T08:00:00.000Z'),
      submittedAt: new Date('2026-08-02T08:12:00.000Z'),
      answers: CANONICAL_WORKER_ANSWERS,
      pack: CANONICAL_WORKER_PACK,
    });
    const second = buildWorkerScoring({
      attemptId: 'attempt-a86',
      startedAt: new Date('2026-08-02T08:00:00.000Z'),
      submittedAt: new Date('2026-08-02T08:12:00.000Z'),
      answers: CANONICAL_WORKER_ANSWERS,
      pack: CANONICAL_WORKER_PACK,
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.factSheet.domains).toHaveLength(CANONICAL_WORKER_PACK.scoring.domains.length);
    expect(first.factSheet.domains.map(({ id }) => id)).toEqual(CANONICAL_WORKER_PACK.scoring.domains);
    expect(first.factSheet.nodes.some(({ profile }) => profile === 'ERREUR_CONFIANTE')).toBe(true);
  });

  it('validates all three deterministic audience artifacts', () => {
    const result = buildWorkerScoring({
      attemptId: 'attempt-a86-reports',
      startedAt: new Date('2026-08-02T08:00:00.000Z'),
      submittedAt: new Date('2026-08-02T08:12:00.000Z'),
      answers: CANONICAL_WORKER_ANSWERS,
      pack: CANONICAL_WORKER_PACK,
    });
    expect(() => validateDeterministicReports(result.factSheet, result.reports)).not.toThrow();
  });
});

describe('A86 external-call boundary', () => {
  const sources = [
    'lib/bilans/worker/scoring.ts',
    'lib/bilans/worker/structural-validation.ts',
    'lib/bilans/worker/score-job.ts',
    'lib/bilans/core/report-service.ts',
    'lib/bilans/render/report.ts',
  ];

  it('contains no agent, LLM, RAG, HTTP client or network call', () => {
    for (const path of sources) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(/from ['"][^'"]*(agents|llm|rag-client|ollama|openrouter)/i);
      expect(source).not.toMatch(/\b(fetch|axios)\s*\(/i);
    }
  });

  it('keeps direct attempt status writes out of the worker', () => {
    const source = readFileSync('lib/bilans/worker/score-job.ts', 'utf8');
    const scoring = readFileSync('lib/bilans/worker/scoring.ts', 'utf8');
    expect(source).not.toMatch(/canonicalAssessmentAttempt\.(update|updateMany)/);
    expect(scoring).toContain('buildFactSheet');
    expect(source).toContain('advanceAttemptLifecycle');
  });
});
