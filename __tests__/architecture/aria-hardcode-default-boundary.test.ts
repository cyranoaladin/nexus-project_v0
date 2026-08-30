import { execFileSync } from 'node:child_process';

describe('H011 ARIA hardcode, default and legacy caller boundary', () => {
  it('proves the canonical runtime cannot invent a grade, course or Subject context', () => {
    const output = execFileSync('npm', ['run', 'aria:integrity'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    for (const invariant of [
      'ARIA_HARDCODED_COURSE_LISTS=0',
      'ARIA_IMPLICIT_GRADE_DEFAULTS=0',
      'ARIA_IMPLICIT_COURSE_DEFAULTS=0',
      'LEGACY_ADAPTER_DEFAULT_GRADE=NONE',
      'HARDCODED_TERMINALE_LEGACY_CALLS=0',
      'LEGACY_SUBJECT_NULL_TO_MATHS=0',
      'ACTIVE_SUBJECT_BASED_CHAT_CLIENTS=0',
      'UNNECESSARY_LEGACY_ARIA_ADAPTERS=0',
      'ARIA_HISTORY_PRIMARY_CONTEXT=COURSE_KEY',
    ]) expect(output).toContain(invariant);
  });
});
