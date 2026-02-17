/**
 * Unit Tests — BilanGenerator LLM_MODE (off / stub / live)
 *
 * Tests the 3 modes of LLM_MODE environment variable:
 *   - off:  skip generation, status=COMPLETED, errorCode=LLM_GENERATION_SKIPPED
 *   - stub: deterministic bilans, no network, hasBilans=true
 *   - live: calls ollamaChat (mocked here), hasBilans=true
 *
 * All Prisma calls are mocked. ollamaChat is mocked.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mocks (must be before imports) ──────────────────────────────────────────

const mockPrismaUpdate = jest.fn().mockResolvedValue({});
const mockPrismaFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    assessment: {
      findUnique: (...args: any[]) => mockPrismaFindUnique(...args),
      update: (...args: any[]) => mockPrismaUpdate(...args),
    },
  },
}));

const mockOllamaChat = jest.fn();
jest.mock('@/lib/ollama-client', () => ({
  ollamaChat: (...args: any[]) => mockOllamaChat(...args),
}));

jest.mock('@/lib/assessments/prompts', () => ({
  PromptFactory: {
    get: jest.fn().mockReturnValue({
      systemPrompt: 'You are a test system prompt.',
    }),
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { BilanGenerator } from '@/lib/assessments/generators';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ASSESSMENT_ID = 'test-assessment-123';

const MOCK_ASSESSMENT = {
  id: ASSESSMENT_ID,
  subject: 'MATHS',
  grade: 'TERMINALE',
  studentName: 'Test Student',
  studentEmail: 'test@nexus.com',
  status: 'SCORED',
  scoringResult: {
    globalScore: 65,
    confidenceIndex: 70,
    precisionIndex: 80,
    strengths: ['Analyse'],
    weaknesses: ['Combinatoire'],
    recommendations: ['Travailler la combinatoire'],
    metrics: { categoryScores: { analyse: 80, combinatoire: 30 } },
    diagnosticText: 'Niveau correct',
    lucidityText: 'Bonne lucidité',
    totalQuestions: 50,
    totalAttempted: 45,
    totalCorrect: 30,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const originalEnv = process.env.LLM_MODE;

function setLlmMode(mode: string | undefined) {
  if (mode === undefined) {
    delete process.env.LLM_MODE;
  } else {
    process.env.LLM_MODE = mode;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BilanGenerator — LLM_MODE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaFindUnique.mockResolvedValue(MOCK_ASSESSMENT);
    mockPrismaUpdate.mockResolvedValue({});
    mockOllamaChat.mockResolvedValue('Generated bilan text from LLM.');
  });

  afterEach(() => {
    setLlmMode(originalEnv);
  });

  // ─── LLM_MODE=off ───────────────────────────────────────────────────────

  describe('LLM_MODE=off', () => {
    beforeEach(() => setLlmMode('off'));

    it('sets status=COMPLETED and errorCode=LLM_GENERATION_SKIPPED', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      expect(mockPrismaUpdate).toHaveBeenCalledTimes(1);
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: ASSESSMENT_ID },
        data: expect.objectContaining({
          status: 'COMPLETED',
          progress: 100,
          errorCode: 'LLM_GENERATION_SKIPPED',
        }),
      });
    });

    it('does NOT call ollamaChat', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockOllamaChat).not.toHaveBeenCalled();
    });

    it('does NOT fetch the assessment from DB', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockPrismaFindUnique).not.toHaveBeenCalled();
    });

    it('does NOT set status to GENERATING', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);
      const updateCalls = mockPrismaUpdate.mock.calls;
      const generatingCall = updateCalls.find(
        (call: any[]) => call[0]?.data?.status === 'GENERATING'
      );
      expect(generatingCall).toBeUndefined();
    });

    it('includes errorDetails mentioning LLM_MODE=off', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: ASSESSMENT_ID },
        data: expect.objectContaining({
          errorDetails: expect.stringContaining('LLM_MODE=off'),
        }),
      });
    });
  });

  // ─── LLM_MODE=stub ──────────────────────────────────────────────────────

  describe('LLM_MODE=stub', () => {
    beforeEach(() => setLlmMode('stub'));

    it('generates deterministic bilans without calling ollamaChat', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockOllamaChat).not.toHaveBeenCalled();
    });

    it('fetches the assessment from DB', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockPrismaFindUnique).toHaveBeenCalledWith({
        where: { id: ASSESSMENT_ID },
        select: expect.objectContaining({ id: true, subject: true }),
      });
    });

    it('saves studentMarkdown, parentsMarkdown, nexusMarkdown', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      // Find the final update call (status=COMPLETED with bilans)
      const completedCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.status === 'COMPLETED'
      );
      expect(completedCall).toBeDefined();

      const data = completedCall![0].data;
      expect(data.studentMarkdown).toContain('stub');
      expect(data.parentsMarkdown).toContain('stub');
      expect(data.nexusMarkdown).toContain('stub');
      expect(data.studentMarkdown).toContain('Test Student');
      expect(data.studentMarkdown).toContain('65');
    });

    it('sets status=COMPLETED with progress=100', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const completedCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.status === 'COMPLETED'
      );
      expect(completedCall![0].data.progress).toBe(100);
    });

    it('does NOT set errorCode (no error in stub mode)', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const completedCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.status === 'COMPLETED'
      );
      expect(completedCall![0].data.errorCode).toBeUndefined();
    });

    it('stub bilans contain score level classification', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const completedCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.status === 'COMPLETED'
      );
      // globalScore=65 → level 'moyen' (40-69)
      expect(completedCall![0].data.studentMarkdown).toContain('moyen');
    });

    it('first sets GENERATING then COMPLETED', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const statuses = mockPrismaUpdate.mock.calls.map(
        (call: any[]) => call[0]?.data?.status
      );
      expect(statuses).toContain('GENERATING');
      expect(statuses).toContain('COMPLETED');
      const genIdx = statuses.indexOf('GENERATING');
      const compIdx = statuses.indexOf('COMPLETED');
      expect(genIdx).toBeLessThan(compIdx);
    });
  });

  // ─── LLM_MODE=live (default) ────────────────────────────────────────────

  describe('LLM_MODE=live', () => {
    beforeEach(() => setLlmMode('live'));

    it('calls ollamaChat for each audience (3 calls)', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockOllamaChat).toHaveBeenCalledTimes(3);
    });

    it('saves LLM-generated bilans to DB', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const completedCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.status === 'COMPLETED'
      );
      expect(completedCall).toBeDefined();
      expect(completedCall![0].data.studentMarkdown).toBe('Generated bilan text from LLM.');
      expect(completedCall![0].data.parentsMarkdown).toBe('Generated bilan text from LLM.');
      expect(completedCall![0].data.nexusMarkdown).toBe('Generated bilan text from LLM.');
    });

    it('sets status=COMPLETED with progress=100', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const completedCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.status === 'COMPLETED'
      );
      expect(completedCall![0].data.progress).toBe(100);
    });
  });

  // ─── LLM_MODE=live with LLM failure ─────────────────────────────────────

  describe('LLM_MODE=live (LLM failure)', () => {
    beforeEach(() => {
      setLlmMode('live');
      mockOllamaChat.mockRejectedValue(new Error('Ollama connection refused'));
    });

    it('sets status=COMPLETED despite LLM failure (P0 rule)', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const completedCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) =>
          call[0]?.data?.status === 'COMPLETED' &&
          call[0]?.data?.errorCode === 'LLM_GENERATION_FAILED'
      );
      expect(completedCall).toBeDefined();
    });

    it('sets errorCode=LLM_GENERATION_FAILED', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const failCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.errorCode === 'LLM_GENERATION_FAILED'
      );
      expect(failCall).toBeDefined();
      expect(failCall![0].data.errorDetails).toContain('Ollama connection refused');
    });

    it('increments retryCount', async () => {
      await BilanGenerator.generate(ASSESSMENT_ID);

      const failCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.errorCode === 'LLM_GENERATION_FAILED'
      );
      expect(failCall![0].data.retryCount).toEqual({ increment: 1 });
    });
  });

  // ─── LLM_MODE defaults ──────────────────────────────────────────────────

  describe('LLM_MODE defaults and edge cases', () => {
    it('defaults to live when LLM_MODE is unset', async () => {
      setLlmMode(undefined);
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockOllamaChat).toHaveBeenCalledTimes(3);
    });

    it('defaults to live when LLM_MODE is empty string', async () => {
      setLlmMode('');
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockOllamaChat).toHaveBeenCalledTimes(3);
    });

    it('defaults to live for unknown LLM_MODE value', async () => {
      setLlmMode('turbo');
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockOllamaChat).toHaveBeenCalledTimes(3);
    });

    it('is case-insensitive (OFF → off)', async () => {
      setLlmMode('OFF');
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockOllamaChat).not.toHaveBeenCalled();
      expect(mockPrismaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            errorCode: 'LLM_GENERATION_SKIPPED',
          }),
        })
      );
    });

    it('is case-insensitive (Stub → stub)', async () => {
      setLlmMode('Stub');
      await BilanGenerator.generate(ASSESSMENT_ID);
      expect(mockOllamaChat).not.toHaveBeenCalled();

      const completedCall = mockPrismaUpdate.mock.calls.find(
        (call: any[]) => call[0]?.data?.studentMarkdown
      );
      expect(completedCall).toBeDefined();
    });
  });
});
