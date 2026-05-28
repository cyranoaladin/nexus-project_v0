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
    student: { findFirst: jest.fn() },
    parentProfile: { findFirst: jest.fn() },
    coachProfile: { findFirst: jest.fn() },
    copySubmission: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    copyPage: { create: jest.fn() },
  },
}));

jest.mock('@/lib/npc/storage', () => ({
  ...jest.requireActual('@/lib/npc/storage'),
  generateSecureFileId: jest.fn(() => 'b'.repeat(64)),
  saveUploadedFile: jest.fn(),
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
    (prisma.copySubmission.create as jest.Mock).mockResolvedValue({
      id: 'submission-1',
    });
    (prisma.copySubmission.update as jest.Mock).mockResolvedValue({});
    (prisma.copyPage.create as jest.Mock).mockResolvedValue({});
    (npcStorage.saveUploadedFile as jest.Mock).mockResolvedValue({
      success: true,
      relativePath: 'student/sub/page_1/copie.pdf',
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

  it('does not expose storage paths after upload', async () => {
    const response = await POST(makeUploadRequest({
      studentId: 'student-1',
      title: 'Copie bac blanc',
      subject: 'MATHEMATIQUES',
      file: new File(['%PDF-1.4'], 'copie.pdf', { type: 'application/pdf' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      submissionId: 'submission-1',
      message: 'File uploaded successfully',
    });
    expect(body).not.toHaveProperty('filePath');
  });
});
