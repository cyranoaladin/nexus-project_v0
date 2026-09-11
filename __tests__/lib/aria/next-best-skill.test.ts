import { pickNextBestSkill, type SkillMasterySummary } from '@/lib/aria/domain/mastery/next-best-skill';

function summary(skillId: string, level: SkillMasterySummary['level']): SkillMasterySummary {
  return { skillId, label: `Label ${skillId}`, level };
}

describe('pickNextBestSkill', () => {
  it('returns null when there are no candidate skills at all', () => {
    expect(pickNextBestSkill([])).toBeNull();
  });

  it('returns null when every candidate skill is already MASTERED', () => {
    expect(pickNextBestSkill([summary('a', 'MASTERED'), summary('b', 'MASTERED')])).toBeNull();
  });

  it('prioritizes a DEVELOPING skill over a NOT_STARTED one (reinforce a struggling skill before branching out)', () => {
    const chosen = pickNextBestSkill([summary('new', 'NOT_STARTED'), summary('struggling', 'DEVELOPING')]);
    expect(chosen?.skillId).toBe('struggling');
  });

  it('prioritizes a PROFICIENT skill over a NOT_STARTED one (keep momentum toward mastery)', () => {
    const chosen = pickNextBestSkill([summary('new', 'NOT_STARTED'), summary('almost', 'PROFICIENT')]);
    expect(chosen?.skillId).toBe('almost');
  });

  it('prioritizes DEVELOPING over PROFICIENT (the most urgent gap first)', () => {
    const chosen = pickNextBestSkill([summary('almost', 'PROFICIENT'), summary('struggling', 'DEVELOPING')]);
    expect(chosen?.skillId).toBe('struggling');
  });

  it('excludes MASTERED skills from consideration even when nothing else qualifies at a higher tier', () => {
    const chosen = pickNextBestSkill([summary('done', 'MASTERED'), summary('new', 'NOT_STARTED')]);
    expect(chosen?.skillId).toBe('new');
  });

  it('within the same tier, picks the first candidate in the given order (stable, no hidden randomness)', () => {
    const chosen = pickNextBestSkill([summary('first', 'DEVELOPING'), summary('second', 'DEVELOPING')]);
    expect(chosen?.skillId).toBe('first');
  });

  it('falls back to NOT_STARTED only when no DEVELOPING or PROFICIENT candidate exists', () => {
    const chosen = pickNextBestSkill([summary('mastered', 'MASTERED'), summary('fresh', 'NOT_STARTED')]);
    expect(chosen?.skillId).toBe('fresh');
  });
});
