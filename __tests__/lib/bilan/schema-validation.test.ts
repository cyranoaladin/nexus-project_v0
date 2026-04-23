/**
 * F49/F51: Bilan Schema Validation (no DB required)
 * Validates Prisma schema structure without database connection
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('F49/F51: Prisma Schema Structure', () => {
  const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = readFileSync(schemaPath, 'utf-8');
  });

  describe('Bilan model exists in schema', () => {
    it('should have model Bilan defined', () => {
      expect(schemaContent).toMatch(/^model Bilan \{/m);
    });

    it('should have BilanType enum', () => {
      expect(schemaContent).toMatch(/^enum BilanType \{/m);
      expect(schemaContent).toContain('DIAGNOSTIC_PRE_STAGE');
      expect(schemaContent).toContain('ASSESSMENT_QCM');
      expect(schemaContent).toContain('STAGE_POST');
      expect(schemaContent).toContain('CONTINUOUS');
    });

    it('should have BilanStatus enum', () => {
      expect(schemaContent).toMatch(/^enum BilanStatus \{/m);
      expect(schemaContent).toContain('PENDING');
      expect(schemaContent).toContain('SCORING');
      expect(schemaContent).toContain('GENERATING');
      expect(schemaContent).toContain('COMPLETED');
      expect(schemaContent).toContain('FAILED');
    });
  });

  describe('Bilan model has required fields', () => {
    it('should have id and publicShareId with CUID default', () => {
      expect(schemaContent).toContain('id            String @id @default(cuid())');
      expect(schemaContent).toContain('publicShareId String @unique @default(cuid())');
    });

    it('should have type and subject fields', () => {
      expect(schemaContent).toMatch(/type\s+BilanType/);
      expect(schemaContent).toMatch(/subject\s+String/);
    });

    it('should have legacy ID fields for migration', () => {
      expect(schemaContent).toContain('legacyDiagnosticId');
      expect(schemaContent).toContain('legacyAssessmentId');
      expect(schemaContent).toContain('legacyStageBilanId');
    });

    it('should have student linkage fields', () => {
      expect(schemaContent).toMatch(/studentId\s+String\?/);
      expect(schemaContent).toMatch(/studentEmail\s+String/);
      expect(schemaContent).toMatch(/studentName\s+String/);
    });

    it('should have score fields', () => {
      expect(schemaContent).toMatch(/globalScore\s+Float\?/);
      expect(schemaContent).toMatch(/confidenceIndex\s+Float\?/);
      expect(schemaContent).toMatch(/ssn\s+Float\?/);
      expect(schemaContent).toMatch(/uai\s+Float\?/);
    });

    it('should have tri-destinataire markdown fields', () => {
      expect(schemaContent).toMatch(/studentMarkdown\s+String\?.*@db\.Text/);
      expect(schemaContent).toMatch(/parentsMarkdown\s+String\?.*@db\.Text/);
      expect(schemaContent).toMatch(/nexusMarkdown\s+String\?.*@db\.Text/);
    });

    it('should have status and progress fields', () => {
      expect(schemaContent).toMatch(/status\s+BilanStatus/);
      expect(schemaContent).toMatch(/progress\s+Int/);
    });

    it('should have publication fields', () => {
      expect(schemaContent).toMatch(/isPublished\s+Boolean/);
      expect(schemaContent).toMatch(/publishedAt\s+DateTime\?/);
    });
  });

  describe('Bilan model has indexes', () => {
    it('should have @@map("bilans") for table name', () => {
      expect(schemaContent).toContain('@@map("bilans")');
    });

    it('should have indexes on key fields', () => {
      expect(schemaContent).toContain('@@index([type, status])');
      expect(schemaContent).toContain('@@index([studentId])');
      expect(schemaContent).toContain('@@index([studentEmail])');
      expect(schemaContent).toContain('@@index([publicShareId])');
      expect(schemaContent).toContain('@@index([legacyDiagnosticId])');
      expect(schemaContent).toContain('@@index([legacyAssessmentId])');
    });
  });

  describe('Bilan model has relations', () => {
    it('should have Student relation', () => {
      expect(schemaContent).toMatch(/student\s+Student\?.*@relation/);
    });

    it('should have Stage relation', () => {
      expect(schemaContent).toMatch(/stage\s+Stage\?.*@relation/);
    });

    it('should have CoachProfile relation', () => {
      expect(schemaContent).toMatch(/coach\s+CoachProfile\?.*@relation/);
    });

    it('should have reverse relation in Student model', () => {
      // Find the Student model section
      const studentMatch = schemaContent.match(/model Student \{[\s\S]*?\n\}/);
      expect(studentMatch).toBeTruthy();
      expect(studentMatch![0]).toContain('bilans');
    });

    it('should have reverse relation in CoachProfile model', () => {
      const coachMatch = schemaContent.match(/model CoachProfile \{[\s\S]*?\n\}/);
      expect(coachMatch).toBeTruthy();
      expect(coachMatch![0]).toContain('bilans');
    });
  });

  describe('Prisma schema validates', () => {
    it('should pass prisma validate', () => {
      try {
        execSync('npx prisma validate', {
          cwd: process.cwd(),
          stdio: 'pipe',
          encoding: 'utf-8',
        });
        expect(true).toBe(true);
      } catch (error: any) {
        throw new Error(`Prisma validation failed: ${error.stdout || error.message}`);
      }
    });
  });
});
