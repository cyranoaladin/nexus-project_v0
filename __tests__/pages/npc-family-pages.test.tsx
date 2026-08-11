import { fireEvent, render, screen, within } from '@testing-library/react';
import ParentNpcPage from '@/app/dashboard/parent/npc/page';
import StudentNpcPage from '@/app/dashboard/eleve/npc/page';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    parentProfile: { findUnique: jest.fn() },
    copySubmission: { findMany: jest.fn() },
  },
}));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));
jest.mock('@/components/npc/student/StudentReportList', () => ({
  StudentReportList: ({ submissions, showStatus }: { submissions: unknown[]; showStatus?: boolean }) => (
    <pre data-testid={showStatus ? 'student-pending-payload' : 'student-report-payload'}>
      {JSON.stringify(submissions)}
    </pre>
  ),
}));
jest.mock('@/components/npc/parent/ParentReportList', () => ({
  ParentReportList: ({ submissions }: { submissions: unknown[] }) => (
    <pre data-testid="parent-report-payload">{JSON.stringify(submissions)}</pre>
  ),
}));

const mockAuth = auth as jest.Mock;
const mockStudentFindUnique = prisma.student.findUnique as jest.Mock;
const mockParentFindUnique = prisma.parentProfile.findUnique as jest.Mock;
const mockSubmissionFindMany = prisma.copySubmission.findMany as jest.Mock;

describe('NPC family pages server-side visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmissionFindMany.mockResolvedValue(allDatabaseRows());
  });

  it('filters and projects student rows before counters and client serialization', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1' });

    render(await StudentNpcPage());

    expectFamilyVisibilityQuery(mockSubmissionFindMany.mock.calls[0][0]);
    expectStat('Diagnostics reçus', '2');
    expectStat('Matières couvertes', '2');
    expectStat('En cours', '1');

    const reportPayload = screen.getByTestId('student-report-payload').textContent ?? '';
    fireEvent.click(screen.getByRole('tab', { name: 'pending' }));
    const pendingPayload = screen.getByTestId('student-pending-payload').textContent ?? '';
    expect(reportPayload).toContain('full-visible');
    expect(reportPayload).toContain('summary-visible');
    expect(reportPayload).toContain('Résumé familial sûr');
    expect(pendingPayload).toContain('pending-visible');
    expect(`${reportPayload}${pendingPayload}`).not.toMatch(
      /coach-only|unavailable|DIAGNOSTIC_SUMMARY_INTERDIT|NOTE_COACH_INTERDITE|RAW_AI_INTERDIT/
    );
    expect(JSON.parse(reportPayload)[1].report).toEqual({
      visibility: 'STUDENT_SUMMARY_ONLY',
      studentSummary: 'Résumé familial sûr',
    });
  });

  it('filters and projects parent rows before child/all counters and client serialization', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'parent-user-1', role: 'PARENT' } });
    mockParentFindUnique.mockResolvedValue({
      id: 'parent-1',
      children: [
        {
          id: 'student-1',
          user: { id: 'student-user-1', firstName: 'Élise', lastName: 'Nexus' },
        },
      ],
    });

    render(await ParentNpcPage());

    expectFamilyVisibilityQuery(mockSubmissionFindMany.mock.calls[0][0]);
    expectStat('Diagnostics reçus', '2');
    expectStat('En cours', '1');
    expectStat('Matières', '3');

    const allTab = screen.getByRole('tab', { name: 'all' });
    const childTab = screen.getByRole('tab', { name: 'student-1' });
    expect(within(allTab).getByText('3')).toBeInTheDocument();
    expect(within(childTab).getByText('3')).toBeInTheDocument();

    for (const payloadNode of screen.getAllByTestId('parent-report-payload')) {
      const payload = payloadNode.textContent ?? '';
      expect(payload).toContain('full-visible');
      expect(payload).toContain('summary-visible');
      expect(payload).toContain('pending-visible');
      expect(payload).not.toMatch(
        /coach-only|unavailable|DIAGNOSTIC_SUMMARY_INTERDIT|NOTE_COACH_INTERDITE|RAW_AI_INTERDIT/
      );
      expect(JSON.parse(payload)[1].report).toEqual({
        visibility: 'STUDENT_SUMMARY_ONLY',
        studentSummary: 'Résumé familial sûr',
      });
    }
  });
});

function expectStat(label: string, value: string) {
  const card = screen.getByRole('heading', { name: label }).closest('.rounded-xl');
  expect(card).not.toBeNull();
  expect(within(card as HTMLElement).getByText(value)).toBeInTheDocument();
}

function expectFamilyVisibilityQuery(query: Record<string, unknown>) {
  expect(query).not.toHaveProperty('include');
  expect(query).toEqual(expect.objectContaining({
    where: expect.objectContaining({
      status: { not: 'UNAVAILABLE' },
      OR: [
        { report: { is: null } },
        {
          report: {
            is: {
              visibility: {
                in: ['COACH_AND_STUDENT', 'STUDENT_SUMMARY_ONLY'],
              },
            },
          },
        },
      ],
    }),
    select: expect.objectContaining({
      id: true,
      title: true,
      status: true,
      report: {
        select: {
          id: true,
          visibility: true,
          diagnostic: true,
          studentSummary: true,
        },
      },
    }),
  }));
  expect(JSON.stringify(query)).not.toMatch(/rawAiOutput|validatedAiOutput|coachNotes|ocrText|storedFilePath/);
}

function allDatabaseRows() {
  return [
    databaseRow('full-visible', 'COMPLETED', 'COACH_AND_STUDENT', 'MATHEMATIQUES'),
    databaseRow('summary-visible', 'COMPLETED', 'STUDENT_SUMMARY_ONLY', 'FRANCAIS'),
    databaseRow('pending-visible', 'ANALYZING', null, 'PHYSIQUE_CHIMIE'),
    databaseRow('coach-only', 'COMPLETED', 'COACH_ONLY', 'NSI'),
    databaseRow('unavailable', 'UNAVAILABLE', 'COACH_AND_STUDENT', 'ANGLAIS'),
  ];
}

function databaseRow(
  id: string,
  status: string,
  visibility: 'COACH_ONLY' | 'COACH_AND_STUDENT' | 'STUDENT_SUMMARY_ONLY' | null,
  subject: string
) {
  return {
    id,
    createdAt: new Date('2026-08-11T10:00:00.000Z'),
    studentId: 'student-1',
    subject,
    gradeLevel: 'TERMINALE',
    title: `Copie ${id}`,
    status,
    coach: { user: { firstName: 'Coach', lastName: 'Nexus' } },
    report: visibility === null ? null : {
      id: `report-${id}`,
      visibility,
      diagnostic: {
        summary: visibility === 'STUDENT_SUMMARY_ONLY'
          ? 'DIAGNOSTIC_SUMMARY_INTERDIT'
          : 'Aperçu diagnostic autorisé',
        overallLevel: 'advanced',
      },
      studentSummary: 'Résumé familial sûr',
      rawAiOutput: 'RAW_AI_INTERDIT',
      coachNotes: 'NOTE_COACH_INTERDITE',
    },
    ocrText: 'OCR_INTERDIT',
    storedFilePath: '/secret/copie.pdf',
  };
}
