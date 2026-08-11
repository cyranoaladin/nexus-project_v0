/** @jest-environment node */

import { chmodSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  formatTombstoneCliError,
  formatTombstoneCliSuccess,
  parseTombstoneCliArgs,
  validateTombstoneCliInvocation,
} from '@/lib/npc/tombstone/cli';
import { NpcTombstoneError } from '@/lib/npc/tombstone/types';

const VALID_ARGV = [
  '--submission-id', 'sub_synthetic_001',
  '--expected-initial-status', 'COMPLETED',
  '--expected-page-count', '4',
  '--expected-report-id', 'report_synthetic_001',
  '--expected-report-status', 'DRAFT',
  '--expected-report-visibility', 'COACH_ONLY',
  '--reason', 'SOURCE_BYTES_UNAVAILABLE',
  '--actor-id', 'maintenance_synthetic_001',
  '--actor-role', 'SYSTEM',
] as const;

function expectCode(callback: () => unknown, code: string) {
  expect(callback).toThrow(expect.objectContaining({ code }));
}

describe('NPC tombstone CLI contract', () => {
  let temporaryRoot: string;
  let repositoryRoot: string;
  let releaseRoot: string;
  let exportParent: string;
  let exportFile: string;

  beforeEach(() => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'npc-tombstone-cli-'));
    repositoryRoot = join(temporaryRoot, 'repository');
    releaseRoot = join(temporaryRoot, 'release');
    exportParent = join(temporaryRoot, 'export');
    require('node:fs').mkdirSync(repositoryRoot, { mode: 0o700 });
    require('node:fs').mkdirSync(releaseRoot, { mode: 0o700 });
    require('node:fs').mkdirSync(exportParent, { mode: 0o700 });
    chmodSync(exportParent, 0o700);
    exportFile = join(exportParent, 'snapshot.json');
  });

  afterEach(() => {
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  function runtime(overrides: Record<string, unknown> = {}) {
    return {
      getuid: () => 0,
      repositoryRoot,
      releaseRoot,
      lstatSync: (path: string) => {
        const stats = lstatSync(path);
        return Object.assign(Object.create(Object.getPrototypeOf(stats)), stats, {
          uid: 0,
        });
      },
      realpathSync,
      ...overrides,
    };
  }

  it('parses the exact public argument contract', () => {
    const parsed = parseTombstoneCliArgs([
      ...VALID_ARGV,
      '--export-file', exportFile,
    ]);

    expect(parsed).toEqual({
      submissionId: 'sub_synthetic_001',
      expectedInitialStatus: 'COMPLETED',
      expectedPageCount: 4,
      expectedReportId: 'report_synthetic_001',
      expectedReportStatus: 'DRAFT',
      expectedReportVisibility: 'COACH_ONLY',
      reason: 'SOURCE_BYTES_UNAVAILABLE',
      actorId: 'maintenance_synthetic_001',
      actorRole: 'SYSTEM',
      exportFile,
    });
  });

  it.each([
    '--submission-id',
    '--expected-initial-status',
    '--expected-page-count',
    '--expected-report-id',
    '--expected-report-status',
    '--expected-report-visibility',
    '--reason',
    '--actor-id',
    '--actor-role',
    '--export-file',
  ])('requires %s', (missingFlag) => {
    const argv = [...VALID_ARGV, '--export-file', exportFile];
    const index = argv.indexOf(missingFlag);
    argv.splice(index, 2);
    expectCode(() => parseTombstoneCliArgs(argv), 'NPC_TOMBSTONE_ARG_REQUIRED');
  });

  it('rejects unknown and duplicate flags', () => {
    expectCode(
      () => parseTombstoneCliArgs([...VALID_ARGV, '--export-file', exportFile, '--dry-run', 'true']),
      'NPC_TOMBSTONE_ARG_UNKNOWN',
    );
    expectCode(
      () => parseTombstoneCliArgs([...VALID_ARGV, '--export-file', exportFile, '--reason', 'SECOND']),
      'NPC_TOMBSTONE_ARG_DUPLICATE',
    );
  });

  it.each([
    ['submission id', '--submission-id', '../escape', 'NPC_TOMBSTONE_INVALID_ID'],
    ['submission status', '--expected-initial-status', 'NOT_A_STATUS', 'NPC_TOMBSTONE_INVALID_ENUM'],
    ['page count below exact scope', '--expected-page-count', '3', 'NPC_TOMBSTONE_INVALID_PAGE_COUNT'],
    ['page count above exact scope', '--expected-page-count', '5', 'NPC_TOMBSTONE_INVALID_PAGE_COUNT'],
    ['report id', '--expected-report-id', 'space is invalid', 'NPC_TOMBSTONE_INVALID_ID'],
    ['report status', '--expected-report-status', 'UNKNOWN', 'NPC_TOMBSTONE_INVALID_ENUM'],
    ['report visibility', '--expected-report-visibility', 'PUBLIC', 'NPC_TOMBSTONE_INVALID_ENUM'],
    ['empty reason', '--reason', '   ', 'NPC_TOMBSTONE_INVALID_REASON'],
    ['multiline reason', '--reason', 'line one\nline two', 'NPC_TOMBSTONE_INVALID_REASON'],
    ['actor id', '--actor-id', 'actor/escape', 'NPC_TOMBSTONE_INVALID_ID'],
    ['actor role', '--actor-role', 'ELEVE', 'NPC_TOMBSTONE_INVALID_ENUM'],
  ])('rejects invalid %s', (_label, flag, invalid, code) => {
    const argv = [...VALID_ARGV, '--export-file', exportFile];
    argv[argv.indexOf(flag) + 1] = invalid;
    expectCode(() => parseTombstoneCliArgs(argv), code);
  });

  it('requires UID 0 and accepts no injected identity on the production path', () => {
    const args = parseTombstoneCliArgs([...VALID_ARGV, '--export-file', exportFile]);
    expectCode(
      () => validateTombstoneCliInvocation(args, runtime({ getuid: () => 1000 })),
      'NPC_TOMBSTONE_ROOT_REQUIRED',
    );
    expect(() => validateTombstoneCliInvocation(args, runtime())).not.toThrow();
  });

  it('requires an absolute JSON destination outside repository and release', () => {
    const relative = parseTombstoneCliArgs([...VALID_ARGV, '--export-file', 'snapshot.json']);
    expectCode(
      () => validateTombstoneCliInvocation(relative, runtime()),
      'NPC_TOMBSTONE_EXPORT_PATH_INVALID',
    );

    const notJson = parseTombstoneCliArgs([...VALID_ARGV, '--export-file', join(exportParent, 'snapshot.txt')]);
    expectCode(
      () => validateTombstoneCliInvocation(notJson, runtime()),
      'NPC_TOMBSTONE_EXPORT_PATH_INVALID',
    );

    for (const unsafePath of [
      join(repositoryRoot, 'snapshot.json'),
      join(releaseRoot, 'snapshot.json'),
    ]) {
      const args = parseTombstoneCliArgs([...VALID_ARGV, '--export-file', unsafePath]);
      expectCode(
        () => validateTombstoneCliInvocation(args, runtime()),
        'NPC_TOMBSTONE_EXPORT_SCOPE_INVALID',
      );
    }
  });

  it('requires an existing root-owned 0700 parent directory', () => {
    const args = parseTombstoneCliArgs([...VALID_ARGV, '--export-file', exportFile]);
    rmSync(exportParent, { recursive: true });
    expectCode(
      () => validateTombstoneCliInvocation(args, runtime()),
      'NPC_TOMBSTONE_EXPORT_PARENT_INVALID',
    );

    require('node:fs').mkdirSync(exportParent, { mode: 0o700 });
    chmodSync(exportParent, 0o750);
    expectCode(
      () => validateTombstoneCliInvocation(args, runtime()),
      'NPC_TOMBSTONE_EXPORT_PARENT_PERMISSIONS',
    );

    chmodSync(exportParent, 0o700);
    expectCode(
      () => validateTombstoneCliInvocation(args, runtime({
        lstatSync: (path: string) => {
          const stats = lstatSync(path);
          return Object.assign(Object.create(Object.getPrototypeOf(stats)), stats, { uid: 1000 });
        },
      })),
      'NPC_TOMBSTONE_EXPORT_PARENT_OWNER',
    );
  });

  it('refuses symlinks and only permits a locked-down regular destination for verified resume', () => {
    const linkedParent = join(temporaryRoot, 'linked-export');
    symlinkSync(exportParent, linkedParent, 'dir');
    const linkedParentArgs = parseTombstoneCliArgs([
      ...VALID_ARGV,
      '--export-file', join(linkedParent, 'snapshot.json'),
    ]);
    expectCode(
      () => validateTombstoneCliInvocation(linkedParentArgs, runtime()),
      'NPC_TOMBSTONE_EXPORT_SYMLINK',
    );

    writeFileSync(join(exportParent, 'target.json'), '{}', { mode: 0o600 });
    symlinkSync(join(exportParent, 'target.json'), exportFile);
    const symlinkArgs = parseTombstoneCliArgs([...VALID_ARGV, '--export-file', exportFile]);
    expectCode(
      () => validateTombstoneCliInvocation(symlinkArgs, runtime()),
      'NPC_TOMBSTONE_EXPORT_SYMLINK',
    );

    rmSync(exportFile);
    writeFileSync(exportFile, '{"already":"present"}', { mode: 0o600 });
    expect(() => validateTombstoneCliInvocation(symlinkArgs, runtime())).not.toThrow();

    chmodSync(exportFile, 0o640);
    expectCode(
      () => validateTombstoneCliInvocation(symlinkArgs, runtime()),
      'NPC_TOMBSTONE_EXPORT_PERMISSIONS',
    );
  });

  it('declares the exact npm entrypoint and keeps CLI output free of database URLs, secrets, paths, and PII', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(packageJson.scripts['npc:tombstone']).toBe(
      'tsx scripts/npc/tombstone-submission.ts',
    );

    expect(formatTombstoneCliSuccess({
      status: 'applied',
      operationKey: `npc-tombstone-v1:${'a'.repeat(64)}`,
      exportPayloadSha256: 'b'.repeat(64),
    })).toBe(`NPC_TOMBSTONE_APPLIED operation=${'a'.repeat(64)}\n`);

    const unsafe = new Error(
      'postgresql://db-user:db-password@private-db/internal?token=secret /private/export.json person@example.test',
    );
    expect(formatTombstoneCliError(unsafe)).toBe(
      'NPC tombstone failed [NPC_TOMBSTONE_UNEXPECTED_FAILURE]. Review secure logs and database state.\n',
    );
    expect(formatTombstoneCliError(new NpcTombstoneError(
      'NPC_TOMBSTONE_PAGE_COUNT_MISMATCH',
      'Submission does not contain exactly four pages.',
    ))).toBe(
      'NPC tombstone failed [NPC_TOMBSTONE_PAGE_COUNT_MISMATCH]. Submission does not contain exactly four pages.\n',
    );
  });
});
