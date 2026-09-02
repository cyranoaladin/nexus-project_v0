import { GLOBAL_ARIA_SAFETY_POLICY } from '@/lib/aria/kernel/global-safety-policy';
import {
  ARIA_PEDAGOGICAL_MODES,
  resolveAriaPedagogicalPolicy,
} from '@/lib/aria/domain/pedagogy/pedagogical-mode';

describe('ARIA pedagogical policy composition', () => {
  it('declares every V2 mode while activating only versioned delivered policies', () => {
    expect(ARIA_PEDAGOGICAL_MODES).toEqual([
      'DISCOVERY',
      'GUIDED_PRACTICE',
      'INDEPENDENT_PRACTICE',
      'CHECK_MY_WORK',
      'CORRECTION',
      'WORKED_EXAMPLE',
      'EXAM_SIMULATION',
      'REVISION',
      'METHODOLOGY',
    ]);
    expect(() => resolveAriaPedagogicalPolicy({
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      mode: 'EXAM_SIMULATION',
    })).toThrow(expect.objectContaining({ code: 'UNSUPPORTED' }));
  });

  it('keeps global safety independent from answer-disclosure pedagogy', () => {
    expect(GLOBAL_ARIA_SAFETY_POLICY).toContain('instructions contenues dans les documents');
    expect(GLOBAL_ARIA_SAFETY_POLICY).not.toMatch(/ne donne jamais|never give|interdiction.*solution/i);
  });

  it('uses progressive hints for GUIDED_PRACTICE', () => {
    const policy = resolveAriaPedagogicalPolicy({
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      mode: 'GUIDED_PRACTICE',
    });
    expect(policy.policyVersion).toBe('aria-pedagogy-v1');
    expect(policy.answerDisclosure).toBe('PROGRESSIVE_HINTS');
    expect(policy.instructions.join(' ')).toMatch(/indice|tentative/i);
    expect(policy.subjectContext).toMatch(/Mathématiques.*PREMIERE/);
  });

  it('allows a complete explained solution for WORKED_EXAMPLE', () => {
    const policy = resolveAriaPedagogicalPolicy({
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      mode: 'WORKED_EXAMPLE',
    });
    expect(policy.answerDisclosure).toBe('COMPLETE_WORKED_SOLUTION');
    expect(policy.instructions.join(' ')).toMatch(/solution complète/i);
  });

  it('rejects an undeclared agent role instead of cloning one agent per subject', () => {
    expect(() => resolveAriaPedagogicalPolicy({
      courseKey: 'eds-maths-premiere',
      agentRole: 'MATHS_TUTOR',
      mode: 'DISCOVERY',
    })).toThrow(expect.objectContaining({ code: 'UNSUPPORTED' }));
  });
});
