import { PrismaClient } from '@prisma/client';

type ModelArgs = Readonly<Record<string, unknown>>;

type AssessmentStatusCount = Readonly<{
  status: string;
  _count: Readonly<{ _all: number }>;
}>;

type AssessmentEmail = Readonly<{ studentEmail: string }>;
type StudentEmail = Readonly<{ user: Readonly<{ email: string }> }>;

export type MigrationDryRunDataClient = Readonly<{
  $executeRawUnsafe(query: string): Promise<number>;
  assessment: Readonly<{
    count(args?: ModelArgs): Promise<number>;
    groupBy(args: ModelArgs): Promise<readonly AssessmentStatusCount[]>;
    findMany(args: ModelArgs): Promise<readonly AssessmentEmail[]>;
  }>;
  student: Readonly<{
    findMany(args: ModelArgs): Promise<readonly StudentEmail[]>;
  }>;
}>;

export type MigrationDryRunClient = Readonly<{
  $transaction<T>(
    callback: (transaction: MigrationDryRunDataClient) => Promise<T>,
    options: Readonly<{
      isolationLevel: 'RepeatableRead';
      maxWait: number;
      timeout: number;
    }>,
  ): Promise<T>;
}>;

export type AssessmentMigrationDryRunReport = Readonly<{
  source: 'assessments';
  readOnly: true;
  totalAssessments: number;
  withoutStudentId: number;
  danglingStudentId: number;
  emailMatchCandidates: number;
  withoutUsableResult: number;
  statusCounts: Readonly<Record<string, number>>;
  usableResultCriterion: 'scoringResult AND globalScore are present';
  warnings: readonly string[];
}>;

const READ_ONLY_STATEMENT = 'SET TRANSACTION READ ONLY';

function assertSafeCount(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid aggregate count for ${field}`);
  }
  return value;
}

function normalizeEmailForSignal(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function countUniqueEmailMatchCandidates(
  assessments: readonly AssessmentEmail[],
  students: readonly StudentEmail[],
): number {
  const studentCountsByEmail = new Map<string, number>();

  for (const student of students) {
    const normalizedEmail = normalizeEmailForSignal(student.user.email);
    if (!normalizedEmail) continue;
    studentCountsByEmail.set(
      normalizedEmail,
      (studentCountsByEmail.get(normalizedEmail) ?? 0) + 1,
    );
  }

  return assessments.reduce((count, assessment) => {
    const normalizedEmail = normalizeEmailForSignal(assessment.studentEmail);
    return count + (normalizedEmail && studentCountsByEmail.get(normalizedEmail) === 1 ? 1 : 0);
  }, 0);
}

export async function collectAssessmentMigrationDryRun(
  client: MigrationDryRunClient,
): Promise<AssessmentMigrationDryRunReport> {
  return client.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(READ_ONLY_STATEMENT);

    const totalAssessments = await transaction.assessment.count();
    const withoutStudentId = await transaction.assessment.count({
      where: { studentId: null },
    });
    const danglingStudentId = await transaction.assessment.count({
      where: {
        studentId: { not: null },
        student: { is: null },
      },
    });
    const withoutUsableResult = await transaction.assessment.count({
      where: {
        OR: [
          { scoringResult: { equals: null } },
          { globalScore: null },
        ],
      },
    });
    const statusRows = await transaction.assessment.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
    const unlinkedAssessments = await transaction.assessment.findMany({
      where: { studentId: null },
      select: { studentEmail: true },
    });
    const students = await transaction.student.findMany({
      select: {
        user: { select: { email: true } },
      },
    });

    const safeWithoutStudentId = assertSafeCount(withoutStudentId, 'withoutStudentId');
    const statusCounts = Object.fromEntries(
      statusRows.map((row) => [
        row.status,
        assertSafeCount(row._count._all, `status:${row.status}`),
      ]),
    );

    return {
      source: 'assessments',
      readOnly: true,
      totalAssessments: assertSafeCount(totalAssessments, 'totalAssessments'),
      withoutStudentId: safeWithoutStudentId,
      danglingStudentId: assertSafeCount(danglingStudentId, 'danglingStudentId'),
      emailMatchCandidates: assertSafeCount(
        countUniqueEmailMatchCandidates(unlinkedAssessments, students),
        'emailMatchCandidates',
      ),
      withoutUsableResult: assertSafeCount(withoutUsableResult, 'withoutUsableResult'),
      statusCounts,
      usableResultCriterion: 'scoringResult AND globalScore are present',
      warnings: [
        'EMAIL_MATCH_SIGNAL_ONLY_NEVER_AUTO_ATTACH',
        ...(safeWithoutStudentId > 0 ? ['MISSING_STUDENT_ID_BLOCKS_BACKFILL'] : []),
      ],
    };
  }, {
    isolationLevel: 'RepeatableRead',
    maxWait: 5_000,
    timeout: 30_000,
  });
}

export function renderAssessmentMigrationDryRun(
  report: AssessmentMigrationDryRunReport,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const report = await collectAssessmentMigrationDryRun(
      prisma as unknown as MigrationDryRunClient,
    );
    process.stdout.write(renderAssessmentMigrationDryRun(report));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch(() => {
    console.error('[migration-dry-run] failed without emitting database content');
    process.exitCode = 1;
  });
}
