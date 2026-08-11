import { render, screen } from '@testing-library/react';
import { CopySubmissionList } from '@/components/npc/coach/CopySubmissionList';
import UploadPage from '@/app/dashboard/coach/npc/submissions/[submissionId]/upload/page';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    copySubmission: { findUnique: jest.fn() },
    coachProfile: { findUnique: jest.fn() },
    coachStudentAssignment: { findFirst: jest.fn() },
  },
}));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));
jest.mock('@/components/npc/coach/FileUploadZone', () => ({
  FileUploadZone: () => <div>UPLOAD_ACTION_SHOULD_NOT_RENDER</div>,
}));

const unavailableReason = 'Les fichiers sources ne sont plus disponibles.';

function unavailableSubmission() {
  return {
    id: 'submission-1',
    title: 'Copie bac blanc',
    description: null,
    subject: 'MATHEMATIQUES',
    gradeLevel: 'TERMINALE',
    status: 'UNAVAILABLE',
    unavailableReason,
    unavailableAt: new Date('2026-08-11T10:00:00.000Z'),
    createdAt: new Date('2026-08-10T10:00:00.000Z'),
    updatedAt: new Date('2026-08-11T10:00:00.000Z'),
    studentId: 'student-1',
    coachId: 'coach-1',
    sourceType: 'AUTRE',
    sourceId: null,
    ocrText: null,
    ocrError: null,
    aiJobId: 'job-1',
    storedFilePath: null,
    fileSizeBytes: null,
    mimeType: null,
    student: {
      id: 'student-1',
      userId: 'student-user-1',
      user: { firstName: 'Élève', lastName: 'Test' },
    },
    report: { id: 'report-stale' },
    aiJob: { id: 'job-1', status: 'FAILED', tokensUsed: null },
    pages: [],
  };
}

describe('coach terminal display for unavailable NPC submissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-user-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' });
    (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' });
    (prisma.copySubmission.findUnique as jest.Mock).mockResolvedValue(unavailableSubmission());
  });

  it('shows the reason in the list and suppresses report/generate/retry actions', () => {
    render(<CopySubmissionList submissions={[unavailableSubmission() as never]} />);

    expect(screen.getByText('Indisponible')).toBeInTheDocument();
    expect(screen.getByText(unavailableReason)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /diagnostic|générer|réessayer/i })).not.toBeInTheDocument();
  });

  it('shows a terminal notice on the upload page and does not render document actions', async () => {
    const page = await UploadPage({
      params: Promise.resolve({ submissionId: 'submission-1' }),
    });
    render(page);

    expect(screen.getByText('Indisponible')).toBeInTheDocument();
    expect(screen.getByText(unavailableReason)).toBeInTheDocument();
    expect(screen.queryByText('UPLOAD_ACTION_SHOULD_NOT_RENDER')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rapport|générer|réessayer/i })).not.toBeInTheDocument();
  });
});
