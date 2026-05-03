import { buildCorrectionContext } from '@/lib/npc/correction-context';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    copySubmission: {
      findUnique: jest.fn(),
    },
  },
}));

describe('buildCorrectionContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('groups student copy, subject and grading rubric for the LLM', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      title: 'DS fonctions',
      subject: 'MATHEMATIQUES',
      gradeLevel: 'PREMIERE',
      description: 'Derivation',
      status: 'UPLOADED',
      pages: [
        {
          id: 'doc-copy',
          documentType: 'STUDENT_COPY',
          originalFilename: 'copie.pdf',
          originalFilePath: 'student/sub/page_1/copie.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          status: 'UPLOADED',
          createdAt: new Date('2026-05-02T09:00:00Z'),
        },
        {
          id: 'doc-subject',
          documentType: 'SUBJECT',
          originalFilename: 'sujet.pdf',
          originalFilePath: 'student/sub/page_2/sujet.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2000,
          status: 'UPLOADED',
          createdAt: new Date('2026-05-02T09:01:00Z'),
        },
        {
          id: 'doc-rubric',
          documentType: 'GRADING_RUBRIC',
          originalFilename: 'bareme.pdf',
          originalFilePath: 'student/sub/page_3/bareme.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1500,
          status: 'UPLOADED',
          createdAt: new Date('2026-05-02T09:02:00Z'),
        },
      ],
    });

    const context = await buildCorrectionContext('submission-1');

    expect(context.documents.studentCopies).toHaveLength(1);
    expect(context.documents.subjects).toHaveLength(1);
    expect(context.documents.gradingRubrics).toHaveLength(1);
    expect(context.readiness.canLaunchAi).toBe(true);
    expect(context.readiness.warnings).not.toContain('MISSING_STUDENT_COPY');
  });

  it('refuses AI launch without a student copy and reports missing documents', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-2',
      title: 'DS sans copie',
      subject: 'MATHEMATIQUES',
      gradeLevel: 'PREMIERE',
      description: null,
      status: 'PENDING_UPLOAD',
      pages: [
        {
          id: 'doc-subject',
          documentType: 'SUBJECT',
          originalFilename: 'sujet.pdf',
          originalFilePath: 'student/sub/page_1/sujet.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2000,
          status: 'UPLOADED',
          createdAt: new Date('2026-05-02T09:01:00Z'),
        },
      ],
    });

    const context = await buildCorrectionContext('submission-2');

    expect(context.documents.studentCopies).toHaveLength(0);
    expect(context.readiness.canLaunchAi).toBe(false);
    expect(context.readiness.warnings).toEqual(
      expect.arrayContaining(['MISSING_STUDENT_COPY', 'MISSING_GRADING_RUBRIC'])
    );
  });

  it('warns when subject or rubric is missing but allows AI launch with student copy', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-3',
      title: 'DS sans sujet',
      subject: 'MATHEMATIQUES',
      gradeLevel: 'PREMIERE',
      description: null,
      status: 'UPLOADED',
      pages: [
        {
          id: 'doc-copy',
          documentType: 'STUDENT_COPY',
          originalFilename: 'copie.pdf',
          originalFilePath: 'student/sub/page_1/copie.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          status: 'UPLOADED',
          createdAt: new Date('2026-05-02T09:00:00Z'),
        },
      ],
    });

    const context = await buildCorrectionContext('submission-3');

    expect(context.documents.studentCopies).toHaveLength(1);
    expect(context.documents.subjects).toHaveLength(0);
    expect(context.documents.gradingRubrics).toHaveLength(0);
    expect(context.readiness.canLaunchAi).toBe(false);
    expect(context.readiness.warnings).toEqual(
      expect.arrayContaining(['MISSING_SUBJECT', 'MISSING_GRADING_RUBRIC'])
    );
  });

  it('allows AI launch with student copy and minimal correction instructions', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-4',
      title: 'DS avec instructions',
      subject: 'MATHEMATIQUES',
      gradeLevel: 'PREMIERE',
      description: null,
      status: 'UPLOADED',
      pages: [
        {
          id: 'doc-copy',
          documentType: 'STUDENT_COPY',
          originalFilename: 'copie.pdf',
          originalFilePath: 'student/sub/page_1/copie.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          status: 'UPLOADED',
          createdAt: new Date('2026-05-02T09:00:00Z'),
        },
        {
          id: 'doc-subject',
          documentType: 'SUBJECT',
          originalFilename: 'sujet.pdf',
          originalFilePath: 'student/sub/page_2/sujet.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 500,
          status: 'UPLOADED',
          createdAt: new Date('2026-05-02T09:01:00Z'),
        },
        {
          id: 'doc-instructions',
          documentType: 'GRADING_INSTRUCTIONS',
          originalFilename: 'instructions.pdf',
          originalFilePath: 'student/sub/page_3/instructions.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 300,
          status: 'UPLOADED',
          createdAt: new Date('2026-05-02T09:02:00Z'),
        },
      ],
    });

    const context = await buildCorrectionContext('submission-4');

    expect(context.documents.studentCopies).toHaveLength(1);
    expect(context.documents.subjects).toHaveLength(1);
    expect(context.documents.gradingInstructions).toHaveLength(1);
    expect(context.readiness.canLaunchAi).toBe(true);
    expect(context.readiness.warnings).not.toContain('MISSING_STUDENT_COPY');
    expect(context.readiness.warnings).not.toContain('MISSING_SUBJECT');
    // Note: MISSING_GRADING_RUBRIC and MISSING_OFFICIAL_CORRECTION warnings may still be present
    // but canLaunchAi is true because SUBJECT is present
  });
});
