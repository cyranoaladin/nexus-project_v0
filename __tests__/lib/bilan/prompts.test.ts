/**
 * F50: Bilan Prompts Tests
 * Tests for canonical prompt builder
 */

import { buildPromptForAudience } from '@/lib/bilan/prompts';
import type { BilanGenerationContext } from '@/lib/bilan/generator';

describe('F50: buildPromptForAudience', () => {
  const baseContext: BilanGenerationContext = {
    type: 'DIAGNOSTIC_PRE_STAGE',
    subject: 'MATHS',
    studentName: 'Jean Dupont',
    studentEmail: 'jean@example.com',
    sourceData: {
      competencies: { algebra: 'strong', analysis: 'weak' },
      scoring: {
        strengths: ['Suites maîtrisées'],
        gaps: ['Probabilités fragiles'],
      },
    },
    globalScore: 75,
    confidenceIndex: 80,
    domainScores: [
      { domain: 'algebra', score: 85 },
      { domain: 'analysis', score: 70 },
    ],
  };

  it('should build student prompt with correct tone', () => {
    const prompt = buildPromptForAudience('student', baseContext, '');

    expect(prompt).toContain('Jean');
    expect(prompt).toContain('MATHS');
    expect(prompt).toContain('75');
    expect(prompt).toContain('Bienveillant');
    expect(prompt).toContain('tutoie');
    expect(prompt).toContain('SCORE GLOBAL');
    expect(prompt).toContain('DOMAINES ÉVALUÉS');
  });

  it('should build parents prompt with professional tone', () => {
    const prompt = buildPromptForAudience('parents', baseContext, '');

    expect(prompt).toContain('Jean Dupont');
    expect(prompt).toContain('Vouvoyez');
    expect(prompt).toContain('Professionnel');
    expect(prompt).toContain('PERFORMANCES');
    expect(prompt).toContain('80'); // confidenceIndex
  });

  it('should build nexus prompt with technical tone', () => {
    const prompt = buildPromptForAudience('nexus', baseContext, '');

    expect(prompt).toContain('Jean Dupont');
    expect(prompt).toContain('DIAGNOSTIC_PRE_STAGE');
    expect(prompt).toContain('technique');
    expect(prompt).toContain('SSN');
    expect(prompt).toContain('SCORES NORMALISÉS');
  });

  it('should include RAG context when provided', () => {
    const ragContext = 'Méthode des suites arithmétiques...';
    const prompt = buildPromptForAudience('student', baseContext, ragContext);

    expect(prompt).toContain(ragContext);
  });

  it('should handle missing optional fields gracefully', () => {
    const minimalContext: BilanGenerationContext = {
      type: 'ASSESSMENT_QCM',
      subject: 'NSI',
      studentName: 'Marie Curie',
      studentEmail: 'marie@example.com',
      sourceData: {},
    };

    const prompt = buildPromptForAudience('student', minimalContext, '');

    expect(prompt).toContain('Marie');
    expect(prompt).toContain('NSI');
  });

  it('should throw on unknown audience', () => {
    expect(() => {
      buildPromptForAudience('unknown' as 'student', baseContext, '');
    }).toThrow('Unknown audience');
  });
});
