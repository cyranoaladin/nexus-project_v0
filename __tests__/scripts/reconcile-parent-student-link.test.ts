import {
  main,
  type ReconcileParentStudentLinkPort,
} from '@/scripts/bilans/reconcile-parent-student-link';

const REQUIRED_ARGS = [
  '--student-id',
  'student-tech-1',
  '--parent-email',
  'parent.exact@example.test',
  '--confirm',
  'PREPARER_CONSENTEMENT_PARENT',
] as const;

function createHarness(overrides: Partial<ReconcileParentStudentLinkPort> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const port: ReconcileParentStudentLinkPort = {
    findParentUserIdByExactEmail: jest.fn().mockResolvedValue('parent-user-tech-1'),
    preparePending: jest.fn().mockResolvedValue({
      id: 'link-tech-1',
      state: 'PENDING_PARENT_CONSENT',
    }),
    ...overrides,
  };

  return {
    port,
    stdout,
    stderr,
    run: (args: readonly string[]) => main([...args], {
      port,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    }),
  };
}

describe('reconcile-parent-student-link', () => {
  it.each([
    { args: [] },
    { args: ['--student-id', 'student-tech-1'] },
    { args: [
      '--student-id', 'student-tech-1',
      '--parent-email', 'parent.exact@example.test',
      '--confirm', 'WRONG_CONFIRMATION',
    ] },
    { args: [...REQUIRED_ARGS, '--student-id', 'student-tech-2'] },
    { args: [...REQUIRED_ARGS, '--parent-email', 'other@example.test'] },
    { args: [...REQUIRED_ARGS, '--confirm', 'PREPARER_CONSENTEMENT_PARENT'] },
    { args: [...REQUIRED_ARGS, '--all', 'true'] },
  ])('refuses incomplete, duplicated or additional arguments: $args', async ({ args }) => {
    const harness = createHarness();

    await expect(harness.run(args)).resolves.toBe(2);

    expect(harness.port.findParentUserIdByExactEmail).not.toHaveBeenCalled();
    expect(harness.port.preparePending).not.toHaveBeenCalled();
    expect(harness.stdout).toEqual([]);
    expect(harness.stderr).toEqual([
      'Usage: tsx scripts/bilans/reconcile-parent-student-link.ts --student-id <id> --parent-email <email> --confirm PREPARER_CONSENTEMENT_PARENT',
    ]);
  });

  it('resolves one parent by exact email and prepares only one pending link', async () => {
    const harness = createHarness();

    await expect(harness.run(REQUIRED_ARGS)).resolves.toBe(0);

    expect(harness.port.findParentUserIdByExactEmail).toHaveBeenCalledTimes(1);
    expect(harness.port.findParentUserIdByExactEmail).toHaveBeenCalledWith('parent.exact@example.test');
    expect(harness.port.preparePending).toHaveBeenCalledTimes(1);
    expect(harness.port.preparePending).toHaveBeenCalledWith({
      parentUserId: 'parent-user-tech-1',
      studentId: 'student-tech-1',
    });
    expect(harness.stdout).toEqual([
      'CANONICAL_LINK_PREPARED=link-tech-1:student-tech-1:parent-user-tech-1:PENDING_PARENT_CONSENT',
    ]);
    expect(`${harness.stdout.join('\n')}\n${harness.stderr.join('\n')}`).not.toContain('parent.exact@example.test');
  });

  it('refuses an unknown exact email without attempting a write', async () => {
    const harness = createHarness({
      findParentUserIdByExactEmail: jest.fn().mockResolvedValue(null),
    });

    await expect(harness.run(REQUIRED_ARGS)).resolves.toBe(1);

    expect(harness.port.preparePending).not.toHaveBeenCalled();
    expect(harness.stdout).toEqual([]);
    expect(harness.stderr).toEqual(['RECONCILIATION_REFUSED=PARENT_PROFILE_NOT_FOUND']);
    expect(harness.stderr.join('\n')).not.toContain('parent.exact@example.test');
  });

  it('refuses a legacy ownership mismatch without leaking parent identity', async () => {
    const ownershipError = Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
    const harness = createHarness({
      preparePending: jest.fn().mockRejectedValue(ownershipError),
    });

    await expect(harness.run(REQUIRED_ARGS)).resolves.toBe(1);

    expect(harness.stdout).toEqual([]);
    expect(harness.stderr).toEqual(['RECONCILIATION_REFUSED=LEGACY_OWNERSHIP_MISMATCH']);
    expect(harness.stderr.join('\n')).not.toContain('parent.exact@example.test');
  });

  it('is idempotent for a single record and never reports a verified transition', async () => {
    const harness = createHarness();

    await expect(harness.run(REQUIRED_ARGS)).resolves.toBe(0);
    await expect(harness.run(REQUIRED_ARGS)).resolves.toBe(0);

    expect(harness.port.preparePending).toHaveBeenCalledTimes(2);
    expect(harness.stdout).toEqual([
      'CANONICAL_LINK_PREPARED=link-tech-1:student-tech-1:parent-user-tech-1:PENDING_PARENT_CONSENT',
      'CANONICAL_LINK_PREPARED=link-tech-1:student-tech-1:parent-user-tech-1:PENDING_PARENT_CONSENT',
    ]);
    expect(harness.stdout.join('\n')).not.toContain('VERIFIED');
  });

  it('fails closed if the consent service returns any state other than pending', async () => {
    const harness = createHarness({
      preparePending: jest.fn().mockResolvedValue({ id: 'link-tech-1', state: 'VERIFIED' }),
    });

    await expect(harness.run(REQUIRED_ARGS)).resolves.toBe(1);

    expect(harness.stdout).toEqual([]);
    expect(harness.stderr).toEqual(['RECONCILIATION_REFUSED=LINK_NOT_PENDING']);
  });
});
