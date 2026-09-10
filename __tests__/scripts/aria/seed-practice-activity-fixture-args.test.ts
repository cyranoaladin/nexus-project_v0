import { parseArgs } from '@/scripts/aria/seed-practice-activity-fixture';

describe('seed-practice-activity-fixture parseArgs', () => {
  it('throws listing every missing required argument', () => {
    expect(() => parseArgs([])).toThrow(
      'ARIA_ACTIVITY_SEED_MISSING_ARGUMENTS:--course-key,--activity-type,--version-label',
    );
  });

  it('throws on a missing --prompt flag', () => {
    expect(() =>
      parseArgs([
        '--course-key', 'eds-maths-premiere',
        '--activity-type', 'MCQ',
        '--version-label', 'v1',
      ]),
    ).toThrow('ARIA_ACTIVITY_SEED_MISSING_ARGUMENTS:--prompt');
  });

  it('throws on malformed JSON in --prompt', () => {
    expect(() =>
      parseArgs([
        '--course-key', 'eds-maths-premiere',
        '--activity-type', 'MCQ',
        '--version-label', 'v1',
        '--prompt', '{not valid json',
        '--expected-answer-shape', '{"field":"selectedOptionId","type":"string"}',
        '--correction-rubric', '{"correctOptionId":"a"}',
      ]),
    ).toThrow('ARIA_ACTIVITY_SEED_INVALID_JSON:--prompt');
  });

  it('throws on malformed JSON in --expected-answer-shape', () => {
    expect(() =>
      parseArgs([
        '--course-key', 'eds-maths-premiere',
        '--activity-type', 'MCQ',
        '--version-label', 'v1',
        '--prompt', '{"questionText":"Q","options":[]}',
        '--expected-answer-shape', 'not json',
        '--correction-rubric', '{"correctOptionId":"a"}',
      ]),
    ).toThrow('ARIA_ACTIVITY_SEED_INVALID_JSON:--expected-answer-shape');
  });

  it('throws on malformed JSON in --correction-rubric', () => {
    expect(() =>
      parseArgs([
        '--course-key', 'eds-maths-premiere',
        '--activity-type', 'MCQ',
        '--version-label', 'v1',
        '--prompt', '{"questionText":"Q","options":[]}',
        '--expected-answer-shape', '{"field":"selectedOptionId","type":"string"}',
        '--correction-rubric', 'not json',
      ]),
    ).toThrow('ARIA_ACTIVITY_SEED_INVALID_JSON:--correction-rubric');
  });

  it('defaults skillId to null and curriculumVersion to v1 when omitted', () => {
    const args = parseArgs([
      '--course-key', 'eds-maths-premiere',
      '--activity-type', 'MCQ',
      '--version-label', 'v1',
      '--prompt', '{"questionText":"Q","options":[{"id":"a","label":"A"}]}',
      '--expected-answer-shape', '{"field":"selectedOptionId","type":"string"}',
      '--correction-rubric', '{"correctOptionId":"a"}',
    ]);
    expect(args.skillId).toBeNull();
    expect(args.curriculumVersion).toBe('v1');
    expect(args.prompt).toEqual({ questionText: 'Q', options: [{ id: 'a', label: 'A' }] });
  });

  it('parses every optional flag when provided', () => {
    const args = parseArgs([
      '--course-key', 'eds-maths-premiere',
      '--skill-id', 'ALG_SUITE_ARITH',
      '--curriculum-version', '2026-v1',
      '--activity-type', 'MCQ',
      '--version-label', 'v1',
      '--prompt', '{"questionText":"Q","options":[{"id":"a","label":"A"}]}',
      '--expected-answer-shape', '{"field":"selectedOptionId","type":"string"}',
      '--correction-rubric', '{"correctOptionId":"a"}',
    ]);
    expect(args.skillId).toBe('ALG_SUITE_ARITH');
    expect(args.curriculumVersion).toBe('2026-v1');
  });
});
