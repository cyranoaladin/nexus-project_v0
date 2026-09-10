import { parseArgs as parseSeedArgs } from '@/scripts/aria/seed-learning-evidence-fixture';
import { parseArgs as parseInspectArgs } from '@/scripts/aria/inspect-learning-evidence';

describe('seed-learning-evidence-fixture parseArgs', () => {
  it('throws listing every missing required argument', () => {
    expect(() => parseSeedArgs([])).toThrow(
      'ARIA_EVIDENCE_SEED_MISSING_ARGUMENTS:--student-id,--course-key,--source,--source-ref-id,--outcome',
    );
  });

  it('throws on malformed --outcome JSON', () => {
    expect(() =>
      parseSeedArgs([
        '--student-id', 's1',
        '--course-key', 'eds-maths-premiere',
        '--source', 'PRACTICE_ATTEMPT',
        '--source-ref-id', 'ref-1',
        '--outcome', '{not valid json',
      ]),
    ).toThrow('ARIA_EVIDENCE_SEED_INVALID_OUTCOME_JSON');
  });

  it('defaults skillId to null and curriculumVersion to v1 when omitted', () => {
    const args = parseSeedArgs([
      '--student-id', 's1',
      '--course-key', 'eds-maths-premiere',
      '--source', 'PRACTICE_ATTEMPT',
      '--source-ref-id', 'ref-1',
      '--outcome', '{"outcome":"CORRECT","activityAttemptId":"ref-1"}',
    ]);
    expect(args.skillId).toBeNull();
    expect(args.curriculumVersion).toBe('v1');
    expect(args.outcome).toEqual({ outcome: 'CORRECT', activityAttemptId: 'ref-1' });
  });

  it('parses every optional flag when provided', () => {
    const args = parseSeedArgs([
      '--student-id', 's1',
      '--course-key', 'eds-maths-premiere',
      '--skill-id', 'ALG_SUITE_ARITH',
      '--curriculum-version', '2026-v1',
      '--source', 'PRACTICE_ATTEMPT',
      '--source-ref-id', 'ref-1',
      '--outcome', '{"outcome":"CORRECT","activityAttemptId":"ref-1"}',
    ]);
    expect(args.skillId).toBe('ALG_SUITE_ARITH');
    expect(args.curriculumVersion).toBe('2026-v1');
  });
});

describe('inspect-learning-evidence parseArgs', () => {
  it('throws when --student-user-id is missing', () => {
    expect(() => parseInspectArgs([])).toThrow('ARIA_EVIDENCE_INSPECT_MISSING_ARGUMENT');
  });

  it('leaves optional filters undefined when omitted', () => {
    const args = parseInspectArgs(['--student-user-id', 'u1']);
    expect(args.studentUserId).toBe('u1');
    expect(args.courseKey).toBeUndefined();
    expect(args.skillId).toBeUndefined();
    expect(args.source).toBeUndefined();
  });

  it('parses every optional filter when provided', () => {
    const args = parseInspectArgs([
      '--student-user-id', 'u1',
      '--course-key', 'eds-maths-premiere',
      '--skill-id', 'ALG_SUITE_ARITH',
      '--source', 'PRACTICE_ATTEMPT',
    ]);
    expect(args.courseKey).toBe('eds-maths-premiere');
    expect(args.skillId).toBe('ALG_SUITE_ARITH');
    expect(args.source).toBe('PRACTICE_ATTEMPT');
  });
});
