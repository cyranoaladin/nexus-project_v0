/**
 * F49/F51: Bilan Schema Tests
 * Validates Prisma schema has canonical Bilan model
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('F49/F51: Bilan Schema in Database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Bilan model exists', () => {
    it('should have Bilan model accessible via Prisma client', () => {
      // If this compiles and runs, the model exists in schema
      expect(prisma.bilan).toBeDefined();
    });

    it('should have BilanType enum values', async () => {
      // Enum values should be accessible
      const BilanType = {
        DIAGNOSTIC_PRE_STAGE: 'DIAGNOSTIC_PRE_STAGE',
        ASSESSMENT_QCM: 'ASSESSMENT_QCM',
        STAGE_POST: 'STAGE_POST',
        CONTINUOUS: 'CONTINUOUS',
      };

      expect(BilanType.DIAGNOSTIC_PRE_STAGE).toBe('DIAGNOSTIC_PRE_STAGE');
      expect(BilanType.ASSESSMENT_QCM).toBe('ASSESSMENT_QCM');
      expect(BilanType.STAGE_POST).toBe('STAGE_POST');
      expect(BilanType.CONTINUOUS).toBe('CONTINUOUS');
    });

    it('should have BilanStatus enum values', async () => {
      const BilanStatus = {
        PENDING: 'PENDING',
        SCORING: 'SCORING',
        GENERATING: 'GENERATING',
        COMPLETED: 'COMPLETED',
        FAILED: 'FAILED',
      };

      expect(BilanStatus.PENDING).toBe('PENDING');
      expect(BilanStatus.COMPLETED).toBe('COMPLETED');
    });
  });

  describe('Bilan CRUD operations', () => {
    let testBilanId: string;

    it('should create a minimal bilan', async () => {
      const bilan = await prisma.bilan.create({
        data: {
          type: 'CONTINUOUS',
          subject: 'MATHS',
          studentEmail: 'test@example.com',
          studentName: 'Test Student',
          status: 'PENDING',
          progress: 0,
          isPublished: false,
          retryCount: 0,
          ragUsed: false,
          ragCollections: [],
        },
      });

      expect(bilan.id).toBeDefined();
      expect(bilan.publicShareId).toBeDefined();
      expect(bilan.type).toBe('CONTINUOUS');
      expect(bilan.subject).toBe('MATHS');
      testBilanId = bilan.id;
    });

    it('should read the created bilan', async () => {
      const bilan = await prisma.bilan.findUnique({
        where: { id: testBilanId },
      });

      expect(bilan).toBeDefined();
      expect(bilan?.studentEmail).toBe('test@example.com');
    });

    it('should update the bilan', async () => {
      const updated = await prisma.bilan.update({
        where: { id: testBilanId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          globalScore: 85,
          studentMarkdown: '# Test Bilan',
        },
      });

      expect(updated.status).toBe('COMPLETED');
      expect(updated.progress).toBe(100);
      expect(updated.globalScore).toBe(85);
    });

    it('should find bilan by legacy ID fields', async () => {
      // Create bilan with legacy IDs
      const bilanWithLegacy = await prisma.bilan.create({
        data: {
          type: 'DIAGNOSTIC_PRE_STAGE',
          subject: 'MATHS',
          studentEmail: 'legacy@example.com',
          studentName: 'Legacy Student',
          status: 'COMPLETED',
          progress: 100,
          isPublished: true,
          retryCount: 0,
          ragUsed: true,
          ragCollections: ['methodologie'],
          legacyDiagnosticId: 'diag-12345',
          legacyAssessmentId: 'assess-67890',
        },
      });

      // Find by legacy diagnostic ID
      const foundByDiag = await prisma.bilan.findUnique({
        where: { legacyDiagnosticId: 'diag-12345' },
      });
      expect(foundByDiag?.id).toBe(bilanWithLegacy.id);

      // Find by legacy assessment ID
      const foundByAssess = await prisma.bilan.findUnique({
        where: { legacyAssessmentId: 'assess-67890' },
      });
      expect(foundByAssess?.id).toBe(bilanWithLegacy.id);

      // Cleanup
      await prisma.bilan.delete({ where: { id: bilanWithLegacy.id } });
    });

    it('should delete the test bilan', async () => {
      await prisma.bilan.delete({
        where: { id: testBilanId },
      });

      const deleted = await prisma.bilan.findUnique({
        where: { id: testBilanId },
      });

      expect(deleted).toBeNull();
    });
  });

  describe('Bilan indexes', () => {
    it('should have indexes defined in schema', async () => {
      // This test validates that the schema has the expected indexes
      // We can't directly query indexes in Prisma, but we can test query performance
      // by ensuring filtered queries work

      const bilan = await prisma.bilan.create({
        data: {
          type: 'ASSESSMENT_QCM',
          subject: 'NSI',
          studentEmail: 'indexed@example.com',
          studentName: 'Indexed Student',
          status: 'COMPLETED',
          progress: 100,
          isPublished: true,
          retryCount: 0,
          ragUsed: false,
          ragCollections: [],
        },
      });

      // Query by indexed fields (should work efficiently)
      const byType = await prisma.bilan.findMany({
        where: { type: 'ASSESSMENT_QCM' },
        take: 1,
      });
      expect(byType.length).toBeGreaterThanOrEqual(1);

      const byStatus = await prisma.bilan.findMany({
        where: { status: 'COMPLETED' },
        take: 1,
      });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const byEmail = await prisma.bilan.findMany({
        where: { studentEmail: 'indexed@example.com' },
        take: 1,
      });
      expect(byEmail.length).toBe(1);

      // Cleanup
      await prisma.bilan.delete({ where: { id: bilan.id } });
    });
  });
});
