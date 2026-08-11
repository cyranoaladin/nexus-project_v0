import { GET, POST } from '@/app/api/npc/submissions/[submissionId]/documents/route';
import { DELETE, PATCH } from '@/app/api/npc/submissions/[submissionId]/documents/[documentId]/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import * as npcStorage from '@/lib/npc/storage';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    copySubmission: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    coachProfile: {
      findUnique: jest.fn(),
    },
    coachStudentAssignment: {
      findFirst: jest.fn(),
    },
    copyPage: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    aiProcessingJob: {
      create: jest.fn(),
    },
    npcAuditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/npc/storage', () => ({
  ...jest.requireActual('@/lib/npc/storage'),
  generateSecureFileId: jest.fn(() => 'a'.repeat(64)),
  saveUploadedFile: jest.fn(),
  deleteSecureFile: jest.fn(),
}));

jest.mock('@/lib/npc/storage-root', () => ({
  inspectNpcStorageFile: jest.fn().mockResolvedValue({
    sizeBytes: 8,
    sha256: 'a'.repeat(64),
  }),
}));

function params(submissionId = 'submission-1') {
  return { params: Promise.resolve({ submissionId }) };
}

function documentParams(submissionId = 'submission-1', documentId = 'doc-1') {
  return { params: Promise.resolve({ submissionId, documentId }) };
}

function makeUploadRequest(entries: Record<string, string | File>) {
  const formData = new FormData();
  Object.entries(entries).forEach(([key, value]) => formData.append(key, value));
  return {
    formData: jest.fn<Promise<FormData>, []>().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

describe('NPC correction documents API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-user-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue({
      id: 'assignment-1',
    });
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UPLOADED',
      pages: [],
    });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'submission-1' }]);
    (prisma.copyPage.aggregate as jest.Mock).mockResolvedValue({ _max: { pageNumber: 0 } });
    (prisma.copyPage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.copyPage.update as jest.Mock).mockImplementation(
      async ({ where, data }) => ({ id: where.id, documentType: data.documentType }),
    );
    (prisma.copyPage.create as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      documentType: 'STUDENT_COPY',
      originalFilename: 'copie.pdf',
    });
    (prisma.copySubmission.update as jest.Mock).mockResolvedValue({});
    (prisma.npcAuditLog.create as jest.Mock).mockResolvedValue({});
    (npcStorage.saveUploadedFile as jest.Mock).mockResolvedValue({
      success: true,
      relativePath: 'student/sub/page_1/copie.pdf',
      sha256: 'a'.repeat(64),
    });
  });

  it('rejects upload without file', async () => {
    const response = await POST(
      makeUploadRequest({ documentType: 'STUDENT_COPY' }),
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No file provided');
  });

  it('requires an explicitly selected document type', async () => {
    const response = await POST(
      makeUploadRequest({
        file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
      }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid document type');
    expect(npcStorage.saveUploadedFile).not.toHaveBeenCalled();
    expect(prisma.copyPage.create).not.toHaveBeenCalled();
  });

  it('rejects invalid submission ids before reading the submission', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/npc/submissions/../secret/documents'),
      params('../secret')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid');
    expect(prisma.copySubmission.findUnique).not.toHaveBeenCalled();
  });

  it('rejects forbidden MIME types', async () => {
    const response = await POST(
      makeUploadRequest({
        documentType: 'STUDENT_COPY',
        file: new File(['bad'], 'bad.exe', { type: 'application/x-msdownload' }),
      }),
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Type de fichier non autorisé');
  });

  it('rejects invalid document types', async () => {
    const response = await POST(
      makeUploadRequest({
        documentType: 'INVALID_TYPE',
        file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
      }),
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid document type');
  });

  it('attaches a PDF document to an existing correction submission', async () => {
    const response = await POST(
      makeUploadRequest({
        documentType: 'GRADING_RUBRIC',
        file: new File(['%PDF-1.4'], 'bareme.pdf', { type: 'application/pdf' }),
      }),
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.document.id).toBe('doc-1');
    expect(prisma.copySubmission.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'submission-1' } })
    );
    expect(prisma.copyPage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId: 'submission-1',
          documentType: 'GRADING_RUBRIC',
          originalFilename: 'bareme.pdf',
          mimeType: 'application/pdf',
          sizeBytes: expect.any(Number),
          sha256: 'a'.repeat(64),
          uploadedById: 'coach-user-1',
        }),
      })
    );
  });

  it('returns 409 without file or Prisma mutation when document upload races with UNAVAILABLE', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UNAVAILABLE',
      unavailableReason: 'Source irrécupérable',
      pages: [],
    });
    const response = await POST(
      makeUploadRequest({
        documentType: 'STUDENT_COPY',
        file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
      }),
      params(),
    );

    expect(response.status).toBe(409);
    expect(npcStorage.saveUploadedFile).not.toHaveBeenCalled();
    expect(prisma.copyPage.create).not.toHaveBeenCalled();
    expect(prisma.copySubmission.update).not.toHaveBeenCalled();
    expect(prisma.aiProcessingJob.create).not.toHaveBeenCalled();
    expect(prisma.npcAuditLog.create).not.toHaveBeenCalled();
  });

  it('does not expose storage paths or OCR text when listing documents', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      pages: [
        {
          id: 'doc-1',
          pageNumber: 1,
          documentType: 'STUDENT_COPY',
          status: 'UPLOADED',
          originalFilePath: 'student/sub/page_1/copie.pdf',
          convertedFilePaths: ['student/sub/page_1/copie.png'],
          ocrText: 'texte OCR interne',
          originalFilename: 'copie.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 8,
        },
      ],
    });

    const response = await GET(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents'),
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.documents[0]).not.toHaveProperty('originalFilePath');
    expect(body.documents[0]).not.toHaveProperty('convertedFilePaths');
    expect(body.documents[0]).not.toHaveProperty('ocrText');
  });

  it('denies listing documents to a coach who is not assigned to the submission', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-2',
      pages: [],
    });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents'),
      params()
    );

    expect(response.status).toBe(403);
  });

  it('does not expose storage paths after uploading documents', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UPLOADED',
      pages: [{
        id: 'existing-copy',
        pageNumber: 1,
        documentType: 'STUDENT_COPY',
        status: 'UPLOADED',
      }],
    });
    (prisma.copyPage.create as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      documentType: 'STUDENT_COPY',
      originalFilename: 'copie.pdf',
      originalFilePath: 'student/sub/page_1/copie.pdf',
      convertedFilePaths: [],
      ocrText: 'texte OCR interne',
      mimeType: 'application/pdf',
      sizeBytes: 8,
    });
    (prisma.copyPage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'existing-copy',
        pageNumber: 1,
        documentType: 'STUDENT_COPY',
        originalFilePath: 'student/sub/page_1/copie.pdf',
        sizeBytes: 8,
        mimeType: 'application/pdf',
      },
    ]);

    const response = await POST(
      makeUploadRequest({
        documentType: 'STUDENT_COPY',
        file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
      }),
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.document).not.toHaveProperty('originalFilePath');
    expect(body.document).not.toHaveProperty('convertedFilePaths');
    expect(body.document).not.toHaveProperty('ocrText');
    expect(body.documents[0]).not.toHaveProperty('originalFilePath');
  });

  it('rejects document updates when documentId is not a safe route id', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents/../doc', {
        method: 'PATCH',
        body: JSON.stringify({ documentType: 'SUBJECT' }),
      }),
      documentParams('submission-1', '../doc')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid');
    expect(prisma.copySubmission.findUnique).not.toHaveBeenCalled();
  });

  it('does not overwrite existing student copy metadata when attaching a rubric', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      pages: [
        {
          id: 'existing-copy',
          pageNumber: 1,
          documentType: 'STUDENT_COPY',
          status: 'UPLOADED',
        },
      ],
    });
    (prisma.copyPage.create as jest.Mock).mockResolvedValue({
      id: 'doc-rubric',
      documentType: 'GRADING_RUBRIC',
      originalFilename: 'bareme.pdf',
      originalFilePath: 'student/sub/page_2/bareme.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 8,
    });
    (prisma.copyPage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'existing-copy',
        pageNumber: 1,
        documentType: 'STUDENT_COPY',
        originalFilePath: 'student/sub/page_1/copie.pdf',
        sizeBytes: 8,
        mimeType: 'application/pdf',
      },
    ]);

    const response = await POST(
      makeUploadRequest({
        documentType: 'GRADING_RUBRIC',
        file: new File(['%PDF-1.4'], 'bareme.pdf', { type: 'application/pdf' }),
      }),
      params()
    );

    expect(response.status).toBe(201);
    expect(prisma.copySubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'READY_FOR_AI',
          storedFilePath: undefined,
          fileSizeBytes: undefined,
          mimeType: undefined,
        }),
      })
    );
  });

  it('denies uploading documents to a submission owned by another coach', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-2',
      pages: [],
    });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(
      makeUploadRequest({
        documentType: 'STUDENT_COPY',
        file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
      }),
      params()
    );

    expect(response.status).toBe(403);
    expect(npcStorage.saveUploadedFile).not.toHaveBeenCalled();
    expect(prisma.copyPage.create).not.toHaveBeenCalled();
  });

  it('deletes a document only when the coach can access the submission', async () => {
    (prisma.copyPage.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      submissionId: 'submission-1',
      originalFilePath: 'student/sub/page_1/copie.pdf',
    });
    (prisma.copyPage.delete as jest.Mock).mockResolvedValue({});
    (npcStorage.deleteSecureFile as jest.Mock).mockResolvedValue(true);

    const response = await DELETE(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents/doc-1'),
      documentParams()
    );

    expect(response.status).toBe(200);
    expect(prisma.copyPage.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    expect(npcStorage.deleteSecureFile).toHaveBeenCalledWith('student/sub/page_1/copie.pdf');
  });

  it('returns 409 without mutation when reclassification targets UNAVAILABLE', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UNAVAILABLE',
      unavailableReason: 'Source irrécupérable',
      pages: [],
    });

    const response = await PATCH(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents/doc-1', {
        method: 'PATCH',
        body: JSON.stringify({ documentType: 'SUBJECT' }),
      }),
      documentParams(),
    );

    expect(response.status).toBe(409);
    expect(prisma.copyPage.findFirst).not.toHaveBeenCalled();
    expect(prisma.copyPage.create).not.toHaveBeenCalled();
    expect(prisma.copySubmission.update).not.toHaveBeenCalled();
    expect(prisma.npcAuditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    'QUEUED_FOR_ANALYSIS',
    'ANALYZING',
    'COMPLETED',
    'ARCHIVED',
  ])('returns 409 when reclassification observes locked %s state', async (status) => {
    const unlocked = {
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UPLOADED',
      pages: [],
    };
    (prisma.copySubmission.findUnique as jest.Mock)
      .mockResolvedValueOnce(unlocked)
      .mockResolvedValueOnce({ ...unlocked, status });

    const response = await PATCH(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents/doc-1', {
        method: 'PATCH',
        body: JSON.stringify({ documentType: 'SUBJECT' }),
      }),
      documentParams(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'NPC_SUBMISSION_INVENTORY_FROZEN',
    });
    expect(prisma.copyPage.findFirst).not.toHaveBeenCalled();
    expect(prisma.copySubmission.update).not.toHaveBeenCalled();
  });

  it.each([
    'QUEUED_FOR_ANALYSIS',
    'ANALYZING',
    'COMPLETED',
    'ARCHIVED',
  ])('returns 409 when deletion observes locked %s state', async (status) => {
    const unlocked = {
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UPLOADED',
    };
    (prisma.copySubmission.findUnique as jest.Mock)
      .mockResolvedValueOnce(unlocked)
      .mockResolvedValueOnce({ ...unlocked, status });

    const response = await DELETE(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents/doc-1'),
      documentParams(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'NPC_SUBMISSION_INVENTORY_FROZEN',
    });
    expect(prisma.copyPage.delete).not.toHaveBeenCalled();
    expect(npcStorage.deleteSecureFile).not.toHaveBeenCalled();
  });

  it.each([
    'QUEUED_FOR_ANALYSIS',
    'ANALYZING',
    'COMPLETED',
    'ARCHIVED',
  ])('returns 409 when upload observes locked %s state', async (status) => {
    const unlocked = {
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UPLOADED',
      pages: [],
    };
    (prisma.copySubmission.findUnique as jest.Mock)
      .mockResolvedValueOnce(unlocked)
      .mockResolvedValueOnce({ ...unlocked, status });

    const response = await POST(
      makeUploadRequest({
        documentType: 'GRADING_RUBRIC',
        file: new File(['%PDF-1.4'], 'bareme.pdf', { type: 'application/pdf' }),
      }),
      params(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'NPC_SUBMISSION_INVENTORY_FROZEN',
    });
    expect(prisma.copyPage.create).not.toHaveBeenCalled();
    expect(prisma.copySubmission.update).not.toHaveBeenCalled();
  });

  it('stages the file before opening the row-lock transaction and uses bounded options', async () => {
    let releaseSave!: (value: unknown) => void;
    const savePending = new Promise((resolve) => {
      releaseSave = resolve;
    });
    (npcStorage.saveUploadedFile as jest.Mock).mockReturnValue(savePending);

    const pendingResponse = POST(
      makeUploadRequest({
        documentType: 'GRADING_RUBRIC',
        file: new File(['%PDF-1.4'], 'bareme.pdf', { type: 'application/pdf' }),
      }),
      params(),
    );
    while (!(npcStorage.saveUploadedFile as jest.Mock).mock.calls.length) {
      await Promise.resolve();
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();

    releaseSave({
      success: true,
      relativePath: 'student/sub/page_1/bareme.pdf',
      sha256: 'a'.repeat(64),
    });
    await expect(pendingResponse).resolves.toMatchObject({ status: 201 });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { maxWait: 10_000, timeout: 120_000 },
    );
  });

  it('does not delete a staged file when the transaction committed but its acknowledgement was lost', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      await callback(prisma);
      throw new Error('lost transaction acknowledgement');
    });
    (prisma.copyPage.findFirst as jest.Mock).mockResolvedValue({ id: 'doc-1' });

    const response = await POST(
      makeUploadRequest({
        documentType: 'GRADING_RUBRIC',
        file: new File(['%PDF-1.4'], 'bareme.pdf', { type: 'application/pdf' }),
      }),
      params(),
    );

    expect(response.status).toBe(500);
    expect(prisma.copyPage.create).toHaveBeenCalled();
    expect(npcStorage.deleteSecureFile).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced staged file after transaction rollback', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('rollback'));
    (prisma.copyPage.findFirst as jest.Mock).mockResolvedValue(null);
    (npcStorage.deleteSecureFile as jest.Mock).mockResolvedValue(true);

    const response = await POST(
      makeUploadRequest({
        documentType: 'GRADING_RUBRIC',
        file: new File(['%PDF-1.4'], 'bareme.pdf', { type: 'application/pdf' }),
      }),
      params(),
    );

    expect(response.status).toBe(500);
    expect(npcStorage.deleteSecureFile).toHaveBeenCalledWith(
      'student/sub/page_1/copie.pdf',
    );
  });

  it('persists a relative-only cleanup audit when staged file deletion fails', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('rollback'));
    (prisma.copyPage.findFirst as jest.Mock).mockResolvedValue(null);
    (npcStorage.deleteSecureFile as jest.Mock).mockResolvedValue(false);

    const response = await POST(
      makeUploadRequest({
        documentType: 'GRADING_RUBRIC',
        file: new File(['%PDF-1.4'], 'bareme.pdf', { type: 'application/pdf' }),
      }),
      params(),
    );

    expect(response.status).toBe(500);
    expect(prisma.npcAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'coach-user-1',
        actorRole: 'COACH',
        action: 'NPC_FILE_CLEANUP_REQUIRED',
        entityType: 'CopySubmission',
        entityId: 'submission-1',
        details: { relativePath: 'student/sub/page_1/copie.pdf' },
      }),
    });
    expect(JSON.stringify((prisma.npcAuditLog.create as jest.Mock).mock.calls))
      .not.toContain('/home/');
  });

  it('fails loudly with a generic log when cleanup cannot be durably audited', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('rollback'));
    (prisma.copyPage.findFirst as jest.Mock).mockResolvedValue(null);
    (npcStorage.deleteSecureFile as jest.Mock).mockResolvedValue(false);
    (prisma.npcAuditLog.create as jest.Mock).mockRejectedValue(
      new Error('audit database unavailable'),
    );

    try {
      const response = await POST(
        makeUploadRequest({
          documentType: 'GRADING_RUBRIC',
          file: new File(['%PDF-1.4'], 'bareme.pdf', { type: 'application/pdf' }),
        }),
        params(),
      );

      expect(response.status).toBe(500);
      expect(consoleError).toHaveBeenCalledWith('NPC_FILE_CLEANUP_AUDIT_FAILED');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('/home/');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('returns 409 without database or disk mutation when delete targets UNAVAILABLE', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UNAVAILABLE',
      unavailableReason: 'Source irrécupérable',
      pages: [],
    });

    const response = await DELETE(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents/doc-1'),
      documentParams(),
    );

    expect(response.status).toBe(409);
    expect(prisma.copyPage.findFirst).not.toHaveBeenCalled();
    expect(prisma.copyPage.delete).not.toHaveBeenCalled();
    expect(prisma.copySubmission.update).not.toHaveBeenCalled();
    expect(prisma.npcAuditLog.create).not.toHaveBeenCalled();
    expect(npcStorage.deleteSecureFile).not.toHaveBeenCalled();
  });

  it('denies deleting a document from a submission owned by another coach', async () => {
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-2',
    });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest('http://localhost/api/npc/submissions/submission-1/documents/doc-1'),
      documentParams()
    );

    expect(response.status).toBe(403);
    expect(prisma.copyPage.findFirst).not.toHaveBeenCalled();
    expect(npcStorage.deleteSecureFile).not.toHaveBeenCalled();
  });
});
