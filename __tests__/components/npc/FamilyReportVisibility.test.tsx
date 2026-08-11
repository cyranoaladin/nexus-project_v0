import { render, screen } from '@testing-library/react';
import { ParentReportList } from '@/components/npc/parent/ParentReportList';
import { StudentReportList } from '@/components/npc/student/StudentReportList';

const familyLists = [
  ['parent', ParentReportList],
  ['student', StudentReportList],
] as const;

describe.each(familyLists)('%s NPC report list', (_audience, ReportList) => {
  it('renders no coach-only card, title, diagnostic data, or report URL', () => {
    const { container } = render(
      <ReportList submissions={[submission('COACH_ONLY')] as never} />
    );

    expect(screen.queryByText('TITRE_COACH_SEUL')).not.toBeInTheDocument();
    expect(screen.queryByText('DIAGNOSTIC_SECRET_COACH')).not.toBeInTheDocument();
    expect(screen.queryByText('Résumé autorisé')).not.toBeInTheDocument();
    expect(screen.queryByText(/expert|confiance|point.*fort|à travailler/i)).not.toBeInTheDocument();
    expect(container.querySelector('a')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('report-COACH_ONLY');
  });

  it('renders only studentSummary for summary-only report content and no full-report link', () => {
    const { container } = render(
      <ReportList submissions={[submission('STUDENT_SUMMARY_ONLY')] as never} />
    );

    expect(screen.getByText('Résumé autorisé')).toBeInTheDocument();
    expect(screen.queryByText('DIAGNOSTIC_SECRET_COACH')).not.toBeInTheDocument();
    expect(screen.queryByText(/niveau:|expert|confiance|point.*fort|à travailler/i)).not.toBeInTheDocument();
    expect(container.querySelector('a')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('report-STUDENT_SUMMARY_ONLY');
  });

  it('keeps the existing full preview and report link for coach-and-student reports', () => {
    render(<ReportList submissions={[submission('COACH_AND_STUDENT')] as never} />);

    expect(screen.getByText('DIAGNOSTIC_SECRET_COACH')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/npc/reports/report-COACH_AND_STUDENT')
    );
  });

  it('excludes unavailable submissions even if they still reference a visible report', () => {
    render(
      <ReportList
        submissions={[submission('COACH_AND_STUDENT', 'UNAVAILABLE')] as never}
      />
    );

    expect(screen.queryByText('TITRE_VISIBLE')).not.toBeInTheDocument();
    expect(screen.queryByText('DIAGNOSTIC_SECRET_COACH')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

function submission(
  visibility: 'COACH_ONLY' | 'COACH_AND_STUDENT' | 'STUDENT_SUMMARY_ONLY',
  status = 'COMPLETED'
) {
  return {
    id: `submission-${visibility}`,
    createdAt: new Date('2026-08-11T10:00:00.000Z'),
    updatedAt: new Date('2026-08-11T10:00:00.000Z'),
    studentId: 'student-1',
    coachId: 'coach-1',
    subject: 'MATHEMATIQUES',
    gradeLevel: 'TERMINALE',
    title: visibility === 'COACH_ONLY' ? 'TITRE_COACH_SEUL' : 'TITRE_VISIBLE',
    description: null,
    sourceType: 'DS',
    sourceId: null,
    status,
    unavailableReason: status === 'UNAVAILABLE' ? 'SOURCE_FILE_UNAVAILABLE' : null,
    unavailableAt: status === 'UNAVAILABLE' ? new Date('2026-08-11T10:00:00.000Z') : null,
    ocrText: 'OCR_SECRET',
    ocrError: null,
    aiJobId: null,
    storedFilePath: '/secret/copie.pdf',
    fileSizeBytes: 42,
    mimeType: 'application/pdf',
    coach: {
      id: 'coach-1',
      createdAt: new Date('2026-08-11T10:00:00.000Z'),
      updatedAt: new Date('2026-08-11T10:00:00.000Z'),
      userId: 'coach-user-1',
      bio: null,
      specialties: [],
      certifications: [],
      yearsExperience: 5,
      hourlyRate: null,
      isActive: true,
      rating: null,
      totalReviews: 0,
      user: { firstName: 'Coach', lastName: 'Nexus' },
    },
    report: {
      id: `report-${visibility}`,
      visibility,
      diagnostic: {
        summary: 'DIAGNOSTIC_SECRET_COACH',
        overallLevel: 'expert',
        strengths: [{ title: 'FORCE_SECRETE' }],
        weaknesses: [{ title: 'FAIBLESSE_SECRETE' }],
        confidenceScore: 0.99,
      },
      studentSummary: 'Résumé autorisé',
      strengths: ['FORCE_SECRETE'],
      weaknesses: ['FAIBLESSE_SECRETE'],
      rawAiOutput: { secret: true },
      coachNotes: 'NOTE_COACH_SECRETE',
    },
  };
}
