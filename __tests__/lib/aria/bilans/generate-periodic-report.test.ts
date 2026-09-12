import { readFileSync } from 'node:fs';
import { generateAriaPeriodicBilanReport } from '@/lib/aria/bilans/periodic/generate-periodic-report';
import type { AriaSkillGraph } from '@/lib/aria/curriculum/skill-graph';

const GRAPH: AriaSkillGraph = Object.freeze({
  courseKey: 'eds-maths-premiere',
  totalCompetencies: 3,
  domains: [
    {
      id: 'eds-maths-premiere:algebre',
      rawDomainId: 'algebre',
      label: 'Algèbre & Suites',
      competencies: [
        { id: 'eds-maths-premiere:SUITE_ARITH', rawSkillId: 'SUITE_ARITH', label: 'Suites arithmétiques' },
        { id: 'eds-maths-premiere:SUITE_GEO', rawSkillId: 'SUITE_GEO', label: 'Suites géométriques' },
      ],
    },
    {
      id: 'eds-maths-premiere:geometrie',
      rawDomainId: 'geometrie',
      label: 'Géométrie',
      competencies: [
        { id: 'eds-maths-premiere:PROD_SCAL', rawSkillId: 'PROD_SCAL', label: 'Produit scalaire' },
      ],
    },
  ],
});

const PERIOD_START = new Date('2026-08-29T00:00:00.000Z');
const PERIOD_END = new Date('2026-09-12T00:00:00.000Z');

function d(daysAgo: number): Date {
  return new Date(PERIOD_END.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

describe('generateAriaPeriodicBilanReport', () => {
  it('reports zero activity when no evidence falls within the period', () => {
    const report = generateAriaPeriodicBilanReport({
      courseLabel: 'Mathématiques',
      skillGraph: GRAPH,
      studentFirstName: 'Mehdi',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      evidenceUpToPeriodEnd: [],
    });
    expect(report.totalAttemptsInPeriod).toBe(0);
    expect(report.globalScore).toBeNull();
    expect(report.domainScores.every((domain) => domain.attemptCount === 0)).toBe(true);
  });

  it('computes per-domain success rate from evidence strictly inside the period window', () => {
    const report = generateAriaPeriodicBilanReport({
      courseLabel: 'Mathématiques',
      skillGraph: GRAPH,
      studentFirstName: 'Mehdi',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      evidenceUpToPeriodEnd: [
        // Inside the window: 2 correct, 1 incorrect on SUITE_ARITH.
        { skillId: 'SUITE_ARITH', outcome: 'CORRECT', observedAt: d(1) },
        { skillId: 'SUITE_ARITH', outcome: 'CORRECT', observedAt: d(2) },
        { skillId: 'SUITE_ARITH', outcome: 'INCORRECT', observedAt: d(3) },
        // Outside the window (before periodStart): must not count.
        { skillId: 'SUITE_ARITH', outcome: 'INCORRECT', observedAt: new Date('2026-08-01T00:00:00.000Z') },
      ],
    });

    const algebre = report.domainScores.find((domain) => domain.domainId === 'algebre')!;
    expect(algebre.attemptCount).toBe(3);
    expect(algebre.correctCount).toBe(2);
    expect(algebre.successRate).toBeCloseTo(2 / 3, 5);

    const geometrie = report.domainScores.find((domain) => domain.domainId === 'geometrie')!;
    expect(geometrie.attemptCount).toBe(0);
    expect(geometrie.successRate).toBeNull();

    expect(report.totalAttemptsInPeriod).toBe(3);
  });

  it('weights PARTIALLY_CORRECT as half a success', () => {
    const report = generateAriaPeriodicBilanReport({
      courseLabel: 'Mathématiques',
      skillGraph: GRAPH,
      studentFirstName: 'Mehdi',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      evidenceUpToPeriodEnd: [
        { skillId: 'PROD_SCAL', outcome: 'PARTIALLY_CORRECT', observedAt: d(1) },
        { skillId: 'PROD_SCAL', outcome: 'PARTIALLY_CORRECT', observedAt: d(2) },
      ],
    });
    const geometrie = report.domainScores.find((domain) => domain.domainId === 'geometrie')!;
    expect(geometrie.successRate).toBeCloseTo(0.5, 5);
  });

  it('computes globalScore as the attempt-weighted average of domains with activity', () => {
    const report = generateAriaPeriodicBilanReport({
      courseLabel: 'Mathématiques',
      skillGraph: GRAPH,
      studentFirstName: 'Mehdi',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      evidenceUpToPeriodEnd: [
        // Algèbre: 1 correct / 1 attempt = 100%
        { skillId: 'SUITE_ARITH', outcome: 'CORRECT', observedAt: d(1) },
        // Géométrie: 0 correct / 3 attempts = 0%
        { skillId: 'PROD_SCAL', outcome: 'INCORRECT', observedAt: d(1) },
        { skillId: 'PROD_SCAL', outcome: 'INCORRECT', observedAt: d(2) },
        { skillId: 'PROD_SCAL', outcome: 'INCORRECT', observedAt: d(3) },
      ],
    });
    // Weighted: (1*100 + 3*0) / 4 = 25
    expect(report.globalScore).toBeCloseTo(25, 5);
  });

  it('computes cumulative mastery (as of periodEnd) per practiced skill, not windowed to the period', () => {
    const report = generateAriaPeriodicBilanReport({
      courseLabel: 'Mathématiques',
      skillGraph: GRAPH,
      studentFirstName: 'Mehdi',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      evidenceUpToPeriodEnd: [
        // A correct streak of 3 that started BEFORE the period — mastery is cumulative.
        { skillId: 'SUITE_GEO', outcome: 'CORRECT', observedAt: d(1) },
        { skillId: 'SUITE_GEO', outcome: 'CORRECT', observedAt: new Date('2026-08-20T00:00:00.000Z') },
        { skillId: 'SUITE_GEO', outcome: 'CORRECT', observedAt: new Date('2026-08-15T00:00:00.000Z') },
      ],
    });
    expect(report.masteredSkillCount).toBe(1);
    expect(report.practicedSkillCount).toBe(1);
  });

  it('never renders raw skill ids in the tutoiement student markdown, and greets the student by first name', () => {
    const report = generateAriaPeriodicBilanReport({
      courseLabel: 'Mathématiques',
      skillGraph: GRAPH,
      studentFirstName: 'Mehdi',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      evidenceUpToPeriodEnd: [{ skillId: 'SUITE_ARITH', outcome: 'CORRECT', observedAt: d(1) }],
    });
    expect(report.studentMarkdown).toContain('Mehdi');
    expect(report.studentMarkdown).toContain('Suites arithmétiques');
    expect(report.studentMarkdown).not.toContain('SUITE_ARITH');
    expect(report.studentMarkdown).toMatch(/\btu\b|\bton\b|\btes\b/i);
  });

  it('renders the parent markdown with vouvoiement and without any raw skill ids', () => {
    const report = generateAriaPeriodicBilanReport({
      courseLabel: 'Mathématiques',
      skillGraph: GRAPH,
      studentFirstName: 'Mehdi',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      evidenceUpToPeriodEnd: [{ skillId: 'SUITE_ARITH', outcome: 'CORRECT', observedAt: d(1) }],
    });
    expect(report.parentsMarkdown).not.toContain('SUITE_ARITH');
    expect(report.parentsMarkdown).toMatch(/\bvotre\b|\bvous\b/i);
  });

  it('is a pure function: never imports Prisma or any AriaMessage/AriaConversation source', () => {
    // Enforced structurally by not importing them in the module — this test
    // documents the invariant so a future edit accidentally wiring chat
    // content in fails a readable assertion, not just a lint rule.
    const source = readFileSync(
      require.resolve('@/lib/aria/bilans/periodic/generate-periodic-report'),
      'utf-8',
    );
    const importLines = source.split('\n').filter((line: string) => /^import\b/.test(line.trim()));
    for (const line of importLines) {
      expect(line).not.toMatch(/AriaMessage|AriaConversation|@prisma\/client|@\/lib\/prisma/);
    }
  });
});
