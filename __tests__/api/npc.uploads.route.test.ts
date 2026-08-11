import { POST } from '@/app/api/npc/uploads/route';
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
    student: { findFirst: jest.fn() },
    parentProfile: { findFirst: jest.fn() },
    coachProfile: { findFirst: jest.fn() },
    copySubmission: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    copyPage: { create: jest.fn(), findFirst: jest.fn() },
    npcAuditLog: { create: jest.fn() },
  },
}));

jest.mock('@/lib/npc/storage', () => ({
  ...jest.requireActual('@/lib/npc/storage'),
  generateSecureFileId: jest.fn(() => 'b'.repeat(64)),
  saveUploadedFile: jest.fn(),
  deleteSecureFile: jest.fn(),
}));

jest.mock('@/lib/npc/storage-root', () => ({
  inspectNpcStorageFile: jest.fn().mockResolvedValue({
    sizeBytes: 8,
    sha256: 'b'.repeat(64),
  }),
}));

function makeUploadRequest(entries: Record<string, string | File>) {
  const formData = new FormData();
  Object.entries(entries).forEach(([key, value]) => formData.append(key, value));
  return {
    formData: jest.fn<Promise<FormData>, []>().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

describe('POST /api/npc/uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-user-1', role: 'COACH' },
    });
    (prisma.coachProfile.findFirst as jest.Mock).mockResolvedValue({
      id: 'coach-1',
      studentAssignments: [{ studentId: 'student-1' }],
    });
    (prisma.copySubmission.create as jest.Mock).mockImplementation(
      async ({ data }) => ({ id: data.id }),
    );
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'submission-1',
      studentId: 'student-1',
      coachId: 'coach-1',
      status: 'UPLOADED',
      unavailableReason: null,
      unavailableAt: null,
      storedFilePath: null,
      fileSizeBytes: null,
      mimeType: null,
    });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'submission-1' }]);
    (prisma.copySubmission.update as jest.Mock).mockResolvedValue({});
    (prisma.copyPage.create as jest.Mock).mockResolvedValue({});
    (prisma.npcAuditLog.create as jest.Mock).mockResolvedValue({});
    (npcStorage.saveUploadedFile as jest.Mock).mockResolvedValue({
      success: true,
      relativePath: 'student/sub/page_1/copie.pdf',
      sha256: 'b'.repeat(64),
    });
  });

  it('authenticates before parsing multipart data', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const request = {
      formData: jest.fn().mockRejectedValue(new Error('multipart parser should not run')),
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(request.formData).not.toHaveBeenCalled();
  });

  it('requires an explicit document type', async () => {
    const response = await POST(makeUploadRequest({
      studentId: 'student-1',
      title: 'Copie bac blanc',
      subject: 'MATHEMATIQUES',
      file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid document type');
    expect(prisma.coachProfile.findFirst).not.toHaveBeenCalled();
    expect(npcStorage.saveUploadedFile).not.toHaveBeenCalled();
  });

  it.each([
    'SUBJECT',
    'OFFICIAL_CORRECTION',
    'GRADING_RUBRIC',
    'GRADING_INSTRUCTIONS',
    'SUPPORTING_DOCUMENT',
  ])('rejects %s on the historical single-copy endpoint', async (documentType) => {
    const response = await POST(makeUploadRequest({
      studentId: 'student-1',
      title: 'Copie bac blanc',
      subject: 'MATHEMATIQUES',
      documentType,
      file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid document type' });
    expect(prisma.coachProfile.findFirst).not.toHaveBeenCalled();
    expect(npcStorage.saveUploadedFile).not.toHaveBeenCalled();
  });

  it('does not expose storage paths after upload', async () => {
    const response = await POST(makeUploadRequest({
      studentId: 'student-1',
      title: 'Copie bac blanc',
      subject: 'MATHEMATIQUES',
      documentType: 'STUDENT_COPY',
      file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      submissionId: 'b'.repeat(64),
      message: 'File uploaded successfully',
    });
    expect(body).not.toHaveProperty('filePath');
    expect(prisma.copyPage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentType: 'STUDENT_COPY',
        sizeBytes: expect.any(Number),
        sha256: 'b'.repeat(64),
      }),
    });
  });

  it('does not delete a committed initial upload after a lost acknowledgement', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      await callback(prisma);
      throw new Error('lost transaction acknowledgement');
    });
    (prisma.copyPage as unknown as { findFirst: jest.Mock }).findFirst
      .mockResolvedValue({ id: 'page-1' });

    const response = await POST(makeUploadRequest({
      studentId: 'student-1',
      title: 'Copie bac blanc',
      subject: 'MATHEMATIQUES',
      documentType: 'STUDENT_COPY',
      file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
    }));

    expect(response.status).toBe(500);
    expect(npcStorage.deleteSecureFile).not.toHaveBeenCalled();
  });

  it('records durable cleanup work if initial-upload rollback deletion fails', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('rollback'));
    (prisma.copyPage as unknown as { findFirst: jest.Mock }).findFirst
      .mockResolvedValue(null);
    (npcStorage.deleteSecureFile as jest.Mock).mockResolvedValue(false);

    const response = await POST(makeUploadRequest({
      studentId: 'student-1',
      title: 'Copie bac blanc',
      subject: 'MATHEMATIQUES',
      documentType: 'STUDENT_COPY',
      file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
    }));

    expect(response.status).toBe(500);
    expect(prisma.npcAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'coach-user-1',
        actorRole: 'COACH',
        action: 'NPC_FILE_CLEANUP_REQUIRED',
        entityType: 'CopySubmission',
        entityId: 'b'.repeat(64),
        details: { relativePath: 'student/sub/page_1/copie.pdf' },
      }),
    });
  });

  it('deletes an unreferenced initial upload after rollback', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('rollback'));
    (prisma.copyPage as unknown as { findFirst: jest.Mock }).findFirst
      .mockResolvedValue(null);
    (npcStorage.deleteSecureFile as jest.Mock).mockResolvedValue(true);

    const response = await POST(makeUploadRequest({
      studentId: 'student-1',
      title: 'Copie bac blanc',
      subject: 'MATHEMATIQUES',
      documentType: 'STUDENT_COPY',
      file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
    }));

    expect(response.status).toBe(500);
    expect(npcStorage.deleteSecureFile).toHaveBeenCalledWith(
      'student/sub/page_1/copie.pdf',
    );
  });

  it('fails loudly when initial-upload cleanup audit storage is unavailable', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('rollback'));
    (prisma.copyPage as unknown as { findFirst: jest.Mock }).findFirst
      .mockResolvedValue(null);
    (npcStorage.deleteSecureFile as jest.Mock).mockResolvedValue(false);
    (prisma.npcAuditLog.create as jest.Mock).mockRejectedValue(
      new Error('audit database unavailable'),
    );

    try {
      const response = await POST(makeUploadRequest({
        studentId: 'student-1',
        title: 'Copie bac blanc',
        subject: 'MATHEMATIQUES',
        documentType: 'STUDENT_COPY',
        file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
      }));

      expect(response.status).toBe(500);
      expect(consoleError).toHaveBeenCalledWith('NPC_FILE_CLEANUP_AUDIT_FAILED');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('/home/');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('rejects invalid metadata before ownership and file handling', async () => {
    const response = await POST(makeUploadRequest({
      studentId: '../student',
      title: 'Copie bac blanc',
      subject: 'MATHEMATIQUES',
      documentType: 'STUDENT_COPY',
      file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(prisma.coachProfile.findFirst).not.toHaveBeenCalled();
    expect(npcStorage.saveUploadedFile).not.toHaveBeenCalled();
  });
});
