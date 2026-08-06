import {
  collectAssessmentMigrationDryRun,
  renderAssessmentMigrationDryRun,
  type MigrationDryRunClient,
  type MigrationDryRunDataClient,
} from '../../../scripts/bilans/migration-dry-run';

function buildClient() {
  const operations: string[] = [];
  let transactionOptions: unknown;

  const dataClient: MigrationDryRunDataClient = {
    async $executeRawUnsafe(query: string) {
      operations.push(query);
      return 0;
    },
    assessment: {
      async count(args?: Readonly<Record<string, unknown>>) {
        operations.push('assessment.count');
        if (!args) return 7;
        const where = args.where as Readonly<Record<string, unknown>>;
        if ('OR' in where) return 4;
        if ('student' in where) return 1;
        return 3;
      },
      async groupBy() {
        operations.push('assessment.groupBy');
        return [
          { status: 'COMPLETED', _count: { _all: 4 } },
          { status: 'FAILED', _count: { _all: 1 } },
          { status: 'SCORING', _count: { _all: 2 } },
        ];
      },
      async findMany() {
        operations.push('assessment.findMany');
        return [
          { studentEmail: 'unique@test.invalid' },
          { studentEmail: 'ambiguous@test.invalid' },
          { studentEmail: 'missing@test.invalid' },
        ];
      },
    },
    student: {
      async findMany() {
        operations.push('student.findMany');
        return [
          { user: { email: 'unique@test.invalid' } },
          { user: { email: 'ambiguous@test.invalid' } },
          { user: { email: 'ambiguous@test.invalid' } },
        ];
      },
    },
  };

  const client: MigrationDryRunClient = {
    async $transaction<T>(
      callback: (transaction: MigrationDryRunDataClient) => Promise<T>,
      options: Readonly<{
        isolationLevel: 'RepeatableRead';
        maxWait: number;
        timeout: number;
      }>,
    ): Promise<T> {
      transactionOptions = options;
      return callback(dataClient);
    },
  };

  return {
    client,
    operations,
    getTransactionOptions: () => transactionOptions,
  };
}

describe('Assessment migration dry-run', () => {
  it('collects only aggregate migration feasibility signals through Prisma models', async () => {
    const fixture = buildClient();

    const report = await collectAssessmentMigrationDryRun(fixture.client);

    expect(report).toEqual({
      source: 'assessments',
      readOnly: true,
      totalAssessments: 7,
      withoutStudentId: 3,
      danglingStudentId: 1,
      emailMatchCandidates: 1,
      withoutUsableResult: 4,
      statusCounts: {
        COMPLETED: 4,
        FAILED: 1,
        SCORING: 2,
      },
      usableResultCriterion: 'scoringResult AND globalScore are present',
      warnings: [
        'EMAIL_MATCH_SIGNAL_ONLY_NEVER_AUTO_ATTACH',
        'MISSING_STUDENT_ID_BLOCKS_BACKFILL',
      ],
    });
  });

  it('sets the transaction read-only before using Prisma model operations', async () => {
    const fixture = buildClient();

    await collectAssessmentMigrationDryRun(fixture.client);

    expect(fixture.getTransactionOptions()).toEqual({
      isolationLevel: 'RepeatableRead',
      maxWait: 5_000,
      timeout: 30_000,
    });
    expect(fixture.operations[0]).toBe('SET TRANSACTION READ ONLY');
    expect(fixture.operations.slice(1)).toContain('assessment.count');
    expect(fixture.operations.join('\n')).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i,
    );
  });

  it('labels email matching as non-actionable and emits no PII', async () => {
    const fixture = buildClient();
    const report = await collectAssessmentMigrationDryRun(fixture.client);

    const output = renderAssessmentMigrationDryRun(report);

    expect(output).toContain('EMAIL_MATCH_SIGNAL_ONLY_NEVER_AUTO_ATTACH');
    expect(output).not.toMatch(/studentEmail|studentName|@/i);
    expect(report.emailMatchCandidates).toBe(1);
  });
});
