/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import injectionCorpus from '@/content/bilans/security/prompt-injection-synthetic-v1.json';
import {
  SyntheticBenchmarkFixtureSchema,
  buildLocalFirstReportContext,
} from '@/lib/bilans/local-first/contracts';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';

const BASE_FIXTURE = JSON.parse(readFileSync(join(
  process.cwd(),
  'content/bilans/benchmarks/synthetic-v1/synthetic-simple-01.json',
), 'utf8'));

function withChecksum(value: Record<string, unknown>) {
  const { inputChecksum: _checksum, ...values } = value;
  return {
    ...value,
    inputChecksum: sha256Canonical(values),
  };
}

describe('local-first prompt-injection boundary', () => {
  it('contains at least thirty multilingual synthetic attack strings', () => {
    expect(injectionCorpus.syntheticOnly).toBe(true);
    expect(injectionCorpus.cases.length).toBeGreaterThanOrEqual(30);
    expect(new Set(injectionCorpus.cases.map(({ id }) => id)).size)
      .toBe(injectionCorpus.cases.length);
    expect(injectionCorpus.cases.some(({ language }) => language === 'fr'))
      .toBe(true);
    expect(injectionCorpus.cases.some(({ language }) => language === 'en'))
      .toBe(true);
    expect(injectionCorpus.cases.some(({ language }) => language === 'ar'))
      .toBe(true);
    expect(injectionCorpus.cases.some(({ vector }) =>
      vector === 'unicode_confusable')).toBe(true);
  });

  it.each(injectionCorpus.cases)(
    'keeps $id in raw local-only evidence and outside every LLM DTO',
    ({ payload }) => {
      const fixture = structuredClone(BASE_FIXTURE);
      fixture.rawEvidenceLocalOnly[0].text = payload;
      fixture.rawEvidenceLocalOnly[0].source = 'UNTRUSTED_FREE_TEXT';
      const parsed = SyntheticBenchmarkFixtureSchema.parse(
        withChecksum(fixture),
      );

      for (const audience of ['PARENT', 'STUDENT', 'NEXUS'] as const) {
        const context = buildLocalFirstReportContext(parsed, audience);
        expect(JSON.stringify(context)).not.toContain(payload);
        expect(context).not.toHaveProperty('rawEvidenceLocalOnly');
        expect(context).not.toHaveProperty('rawInternalNotesLocalOnly');
      }
    },
  );

  it('does not expose instruction-shaped raw fields in the transport schema', () => {
    const context = buildLocalFirstReportContext(BASE_FIXTURE, 'PARENT');
    expect(Object.keys(context)).not.toEqual(expect.arrayContaining([
      'messages',
      'instructions',
      'systemPrompt',
      'rawEvidenceLocalOnly',
      'rawInternalNotesLocalOnly',
    ]));
  });
});
