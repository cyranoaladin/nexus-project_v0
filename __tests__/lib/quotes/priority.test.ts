import { scoreSubjects, DIFFICULTY_FACTOR, urgencyFactor } from '@/lib/quotes/priority';
import { buildExamProfile } from '@/lib/quotes/exam-profile';
import type { DiagnosticSubjectResult } from '@/lib/quotes/diagnostic';
import type { SituationInput } from '@/lib/quotes/schemas';

const terminale: SituationInput = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
};

describe('scoreSubjects — priority = coefficient x difficulty x urgency x prerequisite x confidence', () => {
  const profile = buildExamProfile(terminale);

  test('a SOLIDE EDS is excluded from regular support', () => {
    const diag: DiagnosticSubjectResult[] = [
      { subject: 'eds1', tier: 'SOLIDE', percentage: 90, overconfident: false },
    ];
    const [eds1] = scoreSubjects(profile, diag).filter((s) => s.subject === 'eds1');
    expect(eds1.excludeFromRegularSupport).toBe(true);
  });

  test('a ponctuelle-only subject (HG) at A_CONSOLIDER stays excluded — only A_INSTALLER/A_RECTIFIER unlock it', () => {
    const diag: DiagnosticSubjectResult[] = [
      { subject: 'histoire-geographie', tier: 'A_CONSOLIDER', percentage: 55, overconfident: false },
    ];
    const [hg] = scoreSubjects(profile, diag).filter((s) => s.subject === 'histoire-geographie');
    expect(hg.excludeFromRegularSupport).toBe(true);
  });

  test('a ponctuelle-only subject at A_RECTIFIER is included', () => {
    const diag: DiagnosticSubjectResult[] = [
      { subject: 'histoire-geographie', tier: 'A_RECTIFIER', percentage: 15, overconfident: false },
    ];
    const [hg] = scoreSubjects(profile, diag).filter((s) => s.subject === 'histoire-geographie');
    expect(hg.excludeFromRegularSupport).toBe(false);
  });

  test('higher coefficient (EDS 16) outranks lower coefficient (philosophie 8) at the same tier', () => {
    const diag: DiagnosticSubjectResult[] = [
      { subject: 'eds1', tier: 'A_INSTALLER', percentage: 40, overconfident: false },
      { subject: 'philosophie', tier: 'A_INSTALLER', percentage: 40, overconfident: false },
    ];
    const scored = scoreSubjects(profile, diag);
    const eds1 = scored.find((s) => s.subject === 'eds1')!;
    const philo = scored.find((s) => s.subject === 'philosophie')!;
    expect(eds1.score).toBeGreaterThan(philo.score);
  });

  test('overconfidence increases the score relative to an identical but well-calibrated subject', () => {
    const overconfident: DiagnosticSubjectResult[] = [
      { subject: 'eds1', tier: 'A_CONSOLIDER', percentage: 60, overconfident: true },
    ];
    const calibrated: DiagnosticSubjectResult[] = [
      { subject: 'eds1', tier: 'A_CONSOLIDER', percentage: 60, overconfident: false },
    ];
    const scoredOverconfident = scoreSubjects(profile, overconfident).find((s) => s.subject === 'eds1')!;
    const scoredCalibrated = scoreSubjects(profile, calibrated).find((s) => s.subject === 'eds1')!;
    expect(scoredOverconfident.score).toBeGreaterThan(scoredCalibrated.score);
  });

  test('difficulty factor table is monotonically decreasing from A_RECTIFIER to SOLIDE', () => {
    expect(DIFFICULTY_FACTOR.A_RECTIFIER).toBeGreaterThan(DIFFICULTY_FACTOR.A_INSTALLER);
    expect(DIFFICULTY_FACTOR.A_INSTALLER).toBeGreaterThan(DIFFICULTY_FACTOR.A_CONSOLIDER);
    expect(DIFFICULTY_FACTOR.A_CONSOLIDER).toBeGreaterThan(DIFFICULTY_FACTOR.NON_EVALUE);
    expect(DIFFICULTY_FACTOR.NON_EVALUE).toBeGreaterThan(DIFFICULTY_FACTOR.SOLIDE);
  });

  test('urgency increases as months remaining decreases (entrée en cours d\'année)', () => {
    expect(urgencyFactor(3)).toBeGreaterThan(urgencyFactor(10));
  });

  test('priority labels partition into haute/moyenne/basse among included subjects only', () => {
    const diag: DiagnosticSubjectResult[] = [
      { subject: 'eds1', tier: 'A_RECTIFIER', percentage: 10, overconfident: false },
      { subject: 'eds2', tier: 'A_INSTALLER', percentage: 35, overconfident: false },
      { subject: 'philosophie', tier: 'A_CONSOLIDER', percentage: 55, overconfident: false },
      { subject: 'grand-oral', tier: 'SOLIDE', percentage: 90, overconfident: false },
    ];
    const scored = scoreSubjects(profile, diag);
    const labels = new Set(scored.filter((s) => !s.excludeFromRegularSupport).map((s) => s.priorityLabel));
    expect(labels.has('haute')).toBe(true);
  });
});
