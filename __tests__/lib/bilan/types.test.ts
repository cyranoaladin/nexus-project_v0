/**
 * F49: Canonical Bilan Types Tests
 * Validates type definitions for unified bilan model
 */

import {
  BilanType,
  BilanStatus,
  DomainScore,
  BilanScores,
  BilanRenders,
  BilanAnalysis,
  Bilan,
  CreateBilanInput,
  UpdateBilanInput,
  BilanFilter,
  MigrationResult,
} from '@/lib/bilan/types';

describe('F49: Bilan Types', () => {
  describe('BilanType enum', () => {
    it('should have all 4 canonical types', () => {
      expect(BilanType.DIAGNOSTIC_PRE_STAGE).toBe('DIAGNOSTIC_PRE_STAGE');
      expect(BilanType.ASSESSMENT_QCM).toBe('ASSESSMENT_QCM');
      expect(BilanType.STAGE_POST).toBe('STAGE_POST');
      expect(BilanType.CONTINUOUS).toBe('CONTINUOUS');
    });
  });

  describe('BilanStatus enum', () => {
    it('should have all pipeline statuses', () => {
      expect(BilanStatus.PENDING).toBe('PENDING');
      expect(BilanStatus.SCORING).toBe('SCORING');
      expect(BilanStatus.GENERATING).toBe('GENERATING');
      expect(BilanStatus.COMPLETED).toBe('COMPLETED');
      expect(BilanStatus.FAILED).toBe('FAILED');
    });
  });

  describe('DomainScore structure', () => {
    it('should accept valid domain score', () => {
      const score: DomainScore = {
        domain: 'analysis',
        score: 75.5,
      };
      expect(score.domain).toBe('analysis');
      expect(score.score).toBe(75.5);
    });
  });

  describe('BilanScores structure', () => {
    it('should accept complete scores', () => {
      const scores: BilanScores = {
        global: 78,
        confidence: 82,
        ssn: 85,
        uai: 80,
        domains: [
          { domain: 'algebra', score: 80 },
          { domain: 'analysis', score: 75 },
        ],
      };
      expect(scores.global).toBe(78);
      expect(scores.domains).toHaveLength(2);
    });

    it('should accept minimal scores (only global)', () => {
      const scores: BilanScores = {
        global: 70,
        domains: [],
      };
      expect(scores.global).toBe(70);
      expect(scores.confidence).toBeUndefined();
    });
  });

  describe('BilanRenders structure', () => {
    it('should have all 3 audiences', () => {
      const renders: BilanRenders = {
        student: '# Bilan Élève\n\nTu as bien progressé...',
        parents: '# Bilan Parents\n\nVotre enfant...',
        nexus: '# Bilan Nexus\n\nForces: ...',
      };
      expect(renders.student).toContain('Élève');
      expect(renders.parents).toContain('Parents');
      expect(renders.nexus).toContain('Nexus');
    });
  });

  describe('BilanAnalysis structure', () => {
    it('should accept complete analysis', () => {
      const analysis: BilanAnalysis = {
        forces: ['Suites maîtrisées', 'Dérivation solide'],
        faiblesses: ['Probabilités fragiles'],
        plan: ['Réviser les lois', 'Automatismes quotidiens'],
        ressources: ['Fiche méthode probas'],
        qualityFlags: ['RAG_OK'],
      };
      expect(analysis.forces).toHaveLength(2);
      expect(analysis.faiblesses).toHaveLength(1);
    });

    it('should accept minimal analysis', () => {
      const analysis: BilanAnalysis = {
        forces: [],
        faiblesses: [],
        plan: [],
      };
      expect(analysis.forces).toHaveLength(0);
    });
  });

  describe('Bilan interface', () => {
    it('should accept complete bilan', () => {
      const bilan: Bilan = {
        id: 'cuid-test-123',
        publicShareId: 'share-test-456',
        type: BilanType.DIAGNOSTIC_PRE_STAGE,
        subject: 'MATHS',
        studentEmail: 'eleve@example.com',
        studentName: 'Jean Dupont',
        status: BilanStatus.COMPLETED,
        progress: 100,
        isPublished: true,
        publishedAt: new Date().toISOString(),
        retryCount: 0,
        ragUsed: true,
        ragCollections: ['methodologie', 'suites'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        globalScore: 78,
        confidenceIndex: 82,
        ssn: 85,
        uai: 80,
        studentMarkdown: '# Bilan Élève',
        parentsMarkdown: '# Bilan Parents',
        nexusMarkdown: '# Bilan Nexus',
      };

      expect(bilan.type).toBe(BilanType.DIAGNOSTIC_PRE_STAGE);
      expect(bilan.status).toBe(BilanStatus.COMPLETED);
      expect(bilan.ragCollections).toHaveLength(2);
    });

    it('should accept minimal bilan (required fields only)', () => {
      const bilan: Bilan = {
        id: 'cuid-test-789',
        publicShareId: 'share-test-abc',
        type: BilanType.CONTINUOUS,
        subject: 'MATHS',
        studentEmail: 'test@example.com',
        studentName: 'Test Student',
        status: BilanStatus.PENDING,
        progress: 0,
        isPublished: false,
        retryCount: 0,
        ragUsed: false,
        ragCollections: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(bilan.isPublished).toBe(false);
      expect(bilan.globalScore).toBeUndefined();
    });

    it('should accept bilan with legacy links', () => {
      const bilan: Bilan = {
        id: 'cuid-new-123',
        publicShareId: 'share-new-456',
        type: BilanType.ASSESSMENT_QCM,
        subject: 'NSI',
        studentEmail: 'test@example.com',
        studentName: 'Test',
        status: BilanStatus.COMPLETED,
        progress: 100,
        isPublished: true,
        retryCount: 0,
        ragUsed: false,
        ragCollections: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        legacyDiagnosticId: 'old-diag-789',
        legacyAssessmentId: 'old-assess-abc',
      };

      expect(bilan.legacyDiagnosticId).toBe('old-diag-789');
      expect(bilan.legacyAssessmentId).toBe('old-assess-abc');
    });
  });

  describe('CreateBilanInput', () => {
    it('should accept valid create input', () => {
      const input: CreateBilanInput = {
        type: BilanType.STAGE_POST,
        subject: 'MATHS',
        studentEmail: 'eleve@example.com',
        studentName: 'Jean Dupont',
        studentPhone: '06 12 34 56 78',
        stageId: 'stage-123',
        coachId: 'coach-456',
      };

      expect(input.type).toBe(BilanType.STAGE_POST);
      expect(input.stageId).toBeDefined();
    });
  });

  describe('UpdateBilanInput', () => {
    it('should accept partial update', () => {
      const input: UpdateBilanInput = {
        status: BilanStatus.GENERATING,
        progress: 50,
        globalScore: 75,
        studentMarkdown: '# Updated',
      };

      expect(input.progress).toBe(50);
    });
  });

  describe('BilanFilter', () => {
    it('should accept filter criteria', () => {
      const filter: BilanFilter = {
        type: BilanType.DIAGNOSTIC_PRE_STAGE,
        status: BilanStatus.COMPLETED,
        subject: 'MATHS',
        studentId: 'student-123',
        isPublished: true,
      };

      expect(filter.isPublished).toBe(true);
    });
  });

  describe('MigrationResult', () => {
    it('should represent successful migration', () => {
      const result: MigrationResult = {
        source: 'Diagnostic',
        sourceId: 'diag-123',
        bilanId: 'bilan-456',
        success: true,
      };

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should represent failed migration', () => {
      const result: MigrationResult = {
        source: 'Assessment',
        sourceId: 'assess-789',
        bilanId: '',
        success: false,
        error: 'Invalid data format',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid data format');
    });
  });
});
