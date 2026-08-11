export type FamilyReportAudience = 'student' | 'parent';
export type FamilyReportAccess = 'hidden' | 'full' | 'summary';
export type FamilyReportVisibility =
  | 'COACH_ONLY'
  | 'COACH_AND_STUDENT'
  | 'STUDENT_SUMMARY_ONLY';

export const FAMILY_VISIBLE_REPORT_VISIBILITIES = [
  'COACH_AND_STUDENT',
  'STUDENT_SUMMARY_ONLY',
] as const;

type FamilyCoach = {
  user: {
    firstName: string | null;
    lastName: string | null;
  };
} | null;

export type FamilyReportProjectionInput = {
  id?: string;
  visibility: string;
  diagnostic?: unknown;
  studentSummary?: string | null;
};

export type FamilySubmissionProjectionInput = {
  id: string;
  createdAt: Date | string;
  studentId: string;
  subject: string;
  gradeLevel: string | null;
  title: string;
  status: string;
  coach: FamilyCoach;
  report: FamilyReportProjectionInput | null;
};

export type FamilyFullReport = {
  id: string;
  visibility: 'COACH_AND_STUDENT';
  diagnostic: unknown;
};

export type FamilySummaryReport = {
  visibility: 'STUDENT_SUMMARY_ONLY';
  studentSummary: string | null;
};

export type FamilySubmission = Omit<FamilySubmissionProjectionInput, 'report'> & {
  report: FamilyFullReport | FamilySummaryReport | null;
};

export function familyReportAccess(
  audience: FamilyReportAudience,
  visibility: string
): FamilyReportAccess {
  if (audience !== 'student' && audience !== 'parent') return 'hidden';

  switch (visibility) {
    case 'COACH_AND_STUDENT':
      return 'full';
    case 'STUDENT_SUMMARY_ONLY':
      return 'summary';
    case 'COACH_ONLY':
    default:
      return 'hidden';
  }
}

export function projectFamilySubmissions(
  submissions: readonly FamilySubmissionProjectionInput[],
  audience: FamilyReportAudience
): FamilySubmission[] {
  const projected: FamilySubmission[] = [];

  for (const submission of submissions) {
    if (submission.status === 'UNAVAILABLE') continue;

    const base = {
      id: submission.id,
      createdAt: submission.createdAt,
      studentId: submission.studentId,
      subject: submission.subject,
      gradeLevel: submission.gradeLevel,
      title: submission.title,
      status: submission.status,
      coach: submission.coach
        ? {
            user: {
              firstName: submission.coach.user.firstName,
              lastName: submission.coach.user.lastName,
            },
          }
        : null,
    };

    if (!submission.report) {
      projected.push({ ...base, report: null });
      continue;
    }

    const access = familyReportAccess(audience, submission.report.visibility);
    if (access === 'hidden') continue;

    if (access === 'summary') {
      projected.push({
        ...base,
        report: {
          visibility: 'STUDENT_SUMMARY_ONLY' as const,
          studentSummary: submission.report.studentSummary ?? null,
        },
      });
      continue;
    }

    if (!submission.report.id) continue;

    projected.push({
      ...base,
      report: {
        id: submission.report.id,
        visibility: 'COACH_AND_STUDENT' as const,
        diagnostic: submission.report.diagnostic ?? null,
      },
    });
  }

  return projected;
}
