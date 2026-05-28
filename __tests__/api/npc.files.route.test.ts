import { GET } from '@/app/api/npc/files/[...path]/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { readSecureFile } from '@/lib/npc';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    copyPage: { findFirst: jest.fn() },
    coachProfile: { findUnique: jest.fn() },
    coachStudentAssignment: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/npc', () => ({
  readSecureFile: jest.fn(),
  MIME_TO_EXT: { 'application/pdf': 'pdf' },
}));

function params(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe('GET /api/npc/files/[...path]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-user-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' });
    (readSecureFile as jest.Mock).mockResolvedValue(Buffer.from('%PDF-1.4'));
  });

  it('rejects path traversal before any file read', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/npc/files/..%2F.env'),
      params(['..', '.env'])
    );

    expect(response.status).toBe(400);
    expect(readSecureFile).not.toHaveBeenCalled();
  });

  it('requires the file path to belong to a copy page resource before reading disk', async () => {
    (prisma.copyPage.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/npc/files/student/sub/page_1/copie.pdf'),
      params(['student', 'sub', 'page_1', 'copie.pdf'])
    );

    expect(response.status).toBe(404);
    expect(readSecureFile).not.toHaveBeenCalled();
  });

  it('serves a file only after resource ownership is confirmed', async () => {
    (prisma.copyPage.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      originalFilePath: 'student/sub/page_1/copie.pdf',
      mimeType: 'application/pdf',
      submission: {
        id: 'submission-1',
        studentId: 'student-1',
        coachId: null,
      },
    });

    const response = await GET(
      new NextRequest('http://localhost/api/npc/files/student/sub/page_1/copie.pdf'),
      params(['student', 'sub', 'page_1', 'copie.pdf'])
    );

    expect(response.status).toBe(200);
    expect(readSecureFile).toHaveBeenCalledWith('student/sub/page_1/copie.pdf');
  });
});
