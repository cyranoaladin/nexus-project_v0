import {
  familyReportAccess,
  projectFamilySubmissions,
  type FamilyReportAudience,
} from '@/lib/npc/report-visibility';

const audiences: FamilyReportAudience[] = ['student', 'parent'];

describe.each(audiences)('family report visibility for %s', (audience) => {
  it.each([
    ['COACH_ONLY', 'hidden'],
    ['COACH_AND_STUDENT', 'full'],
    ['STUDENT_SUMMARY_ONLY', 'summary'],
  ] as const)('maps %s to %s', (visibility, expected) => {
    expect(familyReportAccess(audience, visibility)).toBe(expected);
  });

  it('filters hidden and unavailable submissions before returning a family payload', () => {
    const projected = projectFamilySubmissions([
      submission('coach-only', 'COMPLETED', report('COACH_ONLY')),
      submission('unavailable', 'UNAVAILABLE', report('COACH_AND_STUDENT')),
      submission('full', 'COMPLETED', report('COACH_AND_STUDENT')),
      submission('summary', 'COMPLETED', report('STUDENT_SUMMARY_ONLY')),
      submission('pending', 'ANALYZING', null),
    ], audience);

    expect(projected.map(({ id }) => id)).toEqual(['full', 'summary', 'pending']);
  });

  it('projects summary-only reports without any diagnostic or report URL identifier', () => {
    const [projected] = projectFamilySubmissions([
      submission('summary', 'COMPLETED', report('STUDENT_SUMMARY_ONLY')),
    ], audience);

    expect(projected.report).toEqual({
      visibility: 'STUDENT_SUMMARY_ONLY',
      studentSummary: 'Résumé autorisé',
    });
    expect(projected.report).not.toHaveProperty('id');
    expect(projected.report).not.toHaveProperty('diagnostic');
    expect(projected.report).not.toHaveProperty('strengths');
    expect(projected.report).not.toHaveProperty('weaknesses');
    expect(projected.report).not.toHaveProperty('confidenceScore');
  });

  it('projects full reports with only the fields required by the existing preview and link', () => {
    const [projected] = projectFamilySubmissions([
      submission('full', 'COMPLETED', report('COACH_AND_STUDENT')),
    ], audience);

    expect(projected.report).toEqual({
      id: 'report-COACH_AND_STUDENT',
      visibility: 'COACH_AND_STUDENT',
      diagnostic: {
        summary: 'Diagnostic confidentiel',
        overallLevel: 'advanced',
      },
    });
    expect(projected.report).not.toHaveProperty('rawAiOutput');
    expect(projected.report).not.toHaveProperty('validatedAiOutput');
    expect(projected.report).not.toHaveProperty('coachNotes');
    expect(projected.report).not.toHaveProperty('studentSummary');
  });
});

function report(visibility: 'COACH_ONLY' | 'COACH_AND_STUDENT' | 'STUDENT_SUMMARY_ONLY') {
  return {
    id: `report-${visibility}`,
    visibility,
    diagnostic: {
      summary: 'Diagnostic confidentiel',
      overallLevel: 'advanced',
    },
    studentSummary: 'Résumé autorisé',
    rawAiOutput: 'SORTIE_IA_INTERDITE',
    validatedAiOutput: 'SORTIE_VALIDEE_INTERDITE',
    coachNotes: 'NOTE_COACH_INTERDITE',
    strengths: ['FORCE_INTERDITE'],
    weaknesses: ['FAIBLESSE_INTERDITE'],
  };
}

function submission(
  id: string,
  status: string,
  reportValue: ReturnType<typeof report> | null
) {
  return {
    id,
    createdAt: new Date('2026-08-11T10:00:00.000Z'),
    studentId: 'student-1',
    subject: 'MATHEMATIQUES',
    gradeLevel: 'TERMINALE',
    title: `Copie ${id}`,
    status,
    coach: {
      user: { firstName: 'Coach', lastName: 'Nexus' },
    },
    report: reportValue,
    ocrText: 'OCR_INTERDIT',
    storedFilePath: '/secret/copie.pdf',
  };
}
