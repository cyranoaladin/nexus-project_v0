/**
 * F50: Bilan Generator Tests
 * Tests for canonical bilan generator
 */

import { BilanGenerator, generateBilans, generateAndSaveBilans } from '@/lib/bilan/generator';
import type { BilanGenerationContext } from '@/lib/bilan/generator';

describe('F50: BilanGenerator', () => {
  describe('generate', () => {
    const baseContext: BilanGenerationContext = {
      type: 'DIAGNOSTIC_PRE_STAGE',
      subject: 'MATHS',
      studentName: 'Jean Dupont',
      studentEmail: 'jean@example.com',
      sourceData: {
        competencies: { algebra: 'strong', analysis: 'weak' },
      },
      globalScore: 75,
      confidenceIndex: 80,
    };

    it('should generate stub bilans in stub mode', async () => {
      process.env.LLM_MODE = 'stub';

      const result = await BilanGenerator.generate(baseContext);

      expect(result.studentMarkdown).toContain('Jean');
      expect(result.studentMarkdown).toContain('75');
      expect(result.parentsMarkdown).toContain('Jean Dupont');
      expect(result.nexusMarkdown).toContain('75');
      expect(result.engineVersion).toBe('stub-v1');
      expect(result.ragUsed).toBe(false);
    });

    it('should return empty content in off mode', async () => {
      process.env.LLM_MODE = 'off';

      const result = await BilanGenerator.generate(baseContext);

      expect(result.studentMarkdown).toBe('');
      expect(result.parentsMarkdown).toBe('');
      expect(result.nexusMarkdown).toBe('');
      expect(result.engineVersion).toBe('LLM_MODE_OFF');
    });

    it('should include RAG info when enabled', async () => {
      process.env.LLM_MODE = 'stub';

      const context: BilanGenerationContext = {
        ...baseContext,
        enableRAG: true,
        ragQuery: 'suites dérivation',
        ragCollections: ['methodologie', 'suites'],
      };

      const result = await BilanGenerator.generate(context);

      // In stub mode, RAG is not actually used
      expect(result.ragUsed).toBe(false);
      expect(result.ragHitCount).toBe(0);
    });
  });

  describe('generateAndSave', () => {
    it('should handle off mode without database', async () => {
      process.env.LLM_MODE = 'off';

      const context: BilanGenerationContext = {
        bilanId: 'test-bilan-123',
        type: 'ASSESSMENT_QCM',
        subject: 'NSI',
        studentName: 'Marie Curie',
        studentEmail: 'marie@example.com',
        sourceData: { answers: { q1: 'a', q2: 'b' } },
        globalScore: 85,
      };

      // This will try to update DB but should handle gracefully in off mode
      const result = await BilanGenerator.generateAndSave(context);

      expect(result.success).toBe(true);
    });
  });

  describe('convenience functions', () => {
    it('generateBilans should call BilanGenerator.generate', async () => {
      process.env.LLM_MODE = 'stub';

      const context: BilanGenerationContext = {
        type: 'STAGE_POST',
        subject: 'MATHS',
        studentName: 'Pierre Martin',
        studentEmail: 'pierre@example.com',
        sourceData: {},
      };

      const result = await generateBilans(context);

      expect(result.studentMarkdown).toBeDefined();
      expect(result.parentsMarkdown).toBeDefined();
      expect(result.nexusMarkdown).toBeDefined();
    });

    it('generateAndSaveBilans should call BilanGenerator.generateAndSave', async () => {
      process.env.LLM_MODE = 'off';

      const context: BilanGenerationContext = {
        type: 'CONTINUOUS',
        subject: 'MATHS',
        studentName: 'Sophie Bernard',
        studentEmail: 'sophie@example.com',
        sourceData: {},
      };

      const result = await generateAndSaveBilans(context);

      expect(result.success).toBe(true);
    });
  });

  describe('LLM_MODE handling', () => {
    afterEach(() => {
      delete process.env.LLM_MODE;
    });

    it('should default to live mode when LLM_MODE not set', async () => {
      delete process.env.LLM_MODE;

      // Should attempt live generation (will fail without Ollama but that's expected)
      // We just verify it doesn't default to stub
      const context: BilanGenerationContext = {
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHS',
        studentName: 'Test',
        studentEmail: 'test@example.com',
        sourceData: {},
      };

      // This will likely fail due to no Ollama, but verifies the mode is 'live'
      await expect(BilanGenerator.generate(context)).rejects.toThrow();
    });

    it('should accept stub mode', async () => {
      process.env.LLM_MODE = 'stub';

      const context: BilanGenerationContext = {
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHS',
        studentName: 'Test',
        studentEmail: 'test@example.com',
        sourceData: {},
      };

      const result = await BilanGenerator.generate(context);
      expect(result.engineVersion).toBe('stub-v1');
    });

    it('should accept off mode', async () => {
      process.env.LLM_MODE = 'off';

      const context: BilanGenerationContext = {
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHS',
        studentName: 'Test',
        studentEmail: 'test@example.com',
        sourceData: {},
      };

      const result = await BilanGenerator.generate(context);
      expect(result.engineVersion).toBe('LLM_MODE_OFF');
    });
  });
});
