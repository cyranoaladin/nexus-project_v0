/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  formatTombstoneCliError,
  formatTombstoneCliSuccess,
  parseTombstoneCliArgs,
  parseTombstoneRequestManifest,
} from '@/lib/npc/tombstone/cli';
import { executeNpcTombstone } from '@/lib/npc/tombstone/service';
import {
  NPC_TOMBSTONE_REASON,
  NPC_TOMBSTONE_REASON_CODE,
  NpcTombstoneError,
} from '@/lib/npc/tombstone/types';

const submissionId = 'sub_synthetic_cli';
const manifest = {
  version: 1,
  submissionId,
  expectedInitialStatus: 'COMPLETED',
  expectedPageCount: 4,
  expectedReportId: 'report_synthetic_cli',
  expectedReportStatus: 'DRAFT',
  expectedReportVisibility: 'COACH_ONLY',
  reasonCode: NPC_TOMBSTONE_REASON_CODE,
  actorId: 'admin_synthetic_cli',
  actorRole: 'ADMIN',
};

function expectCode(callback: () => unknown, code: string): void {
  expect(callback).toThrow(expect.objectContaining({ code }));
}

describe('NPC tombstone public input contract', () => {
  it('accepts exactly one opaque submission id in argv', () => {
    expect(parseTombstoneCliArgs(['--submission-id', submissionId])).toEqual({ submissionId });
  });

  it.each([
    { argv: [] },
    { argv: ['--submission-id'] },
    { argv: ['--submission-id', submissionId, '--actor-id', 'hidden'] },
    { argv: ['--submission-id', submissionId, '--submission-id', submissionId] },
    { argv: ['--expected-report-id', 'hidden'] },
  ])('rejects missing, duplicate, or non-public argv fields: $argv', ({ argv }) => {
    expectCode(() => parseTombstoneCliArgs(argv), 'NPC_TOMBSTONE_ARG_INVALID');
  });

  it.each(['../escape', 'space invalid', '', 'a'.repeat(192)])(
    'rejects invalid submission id %j',
    (value) => {
      expectCode(
        () => parseTombstoneCliArgs(['--submission-id', value]),
        'NPC_TOMBSTONE_INVALID_ID',
      );
    },
  );

  it('parses the exact root-only manifest shape and maps its reason code internally', () => {
    expect(parseTombstoneRequestManifest(manifest, submissionId, '/secure/artifacts')).toEqual({
      ...manifest,
      reason: NPC_TOMBSTONE_REASON,
      exportRoot: '/secure/artifacts',
    });
  });

  it('requires exact manifest keys, exact target, four pages and approved enums', () => {
    const invalidCases: Array<[Record<string, unknown>, string]> = [
      [{ ...manifest, submissionId: 'another_submission' }, 'NPC_TOMBSTONE_REQUEST_ID_MISMATCH'],
      [{ ...manifest, expectedPageCount: 3 }, 'NPC_TOMBSTONE_INVALID_PAGE_COUNT'],
      [{ ...manifest, expectedInitialStatus: 'INVALID' }, 'NPC_TOMBSTONE_INVALID_ENUM'],
      [{ ...manifest, expectedReportStatus: 'INVALID' }, 'NPC_TOMBSTONE_INVALID_ENUM'],
      [{ ...manifest, expectedReportVisibility: 'PUBLIC' }, 'NPC_TOMBSTONE_INVALID_ENUM'],
      [{ ...manifest, reasonCode: 'FREE_TEXT' }, 'NPC_TOMBSTONE_REASON_CODE_INVALID'],
      [{ ...manifest, actorRole: 'COACH' }, 'NPC_TOMBSTONE_INVALID_ACTOR_ROLE'],
      [{ ...manifest, unexpected: true }, 'NPC_TOMBSTONE_REQUEST_INVALID'],
    ];

    for (const [value, code] of invalidCases) {
      expectCode(
        () => parseTombstoneRequestManifest(value, submissionId, '/secure/artifacts'),
        code,
      );
    }
  });

  it('declares the silent-compatible npm entrypoint and sanitizes all output', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(packageJson.scripts['npc:tombstone']).toBe('tsx scripts/npc/tombstone-submission.ts');

    expect(formatTombstoneCliSuccess({
      status: 'applied',
      operationKey: `npc-tombstone-v1:${'a'.repeat(64)}`,
      artifactChecksumSha256: 'b'.repeat(64),
    })).toBe(`NPC_TOMBSTONE_APPLIED operation=${'a'.repeat(64)}\n`);

    const sensitive = 'postgresql://user:pass@host/db /secure/manifest admin@example.test';
    const formatted = formatTombstoneCliError(new NpcTombstoneError('UNSAFE', sensitive));
    expect(formatted).toBe(
      'NPC tombstone failed [NPC_TOMBSTONE_UNEXPECTED_FAILURE]. Review secure logs and database state.\n',
    );
    expect(formatted).not.toContain('postgresql:');
    expect(formatted).not.toContain('/secure/manifest');
    expect(formatted).not.toContain('admin@example.test');
  });

  it('keeps UID enforcement inside the destructive service with no exported test bypass', async () => {
    const serviceSource = readFileSync(
      join(process.cwd(), 'lib/npc/tombstone/service.ts'),
      'utf8',
    );
    expect(serviceSource).not.toContain('testOnlyTrustedUid');
    expect(serviceSource).not.toContain('trustedUid');
    if (process.getuid?.() === 0) return;

    const previousKey = process.env.DOCUMENT_ENCRYPTION_KEY;
    process.env.DOCUMENT_ENCRYPTION_KEY =
      'synthetic-unit-document-encryption-key-with-thirty-two-characters';
    const transaction = jest.fn();
    try {
      const args = parseTombstoneRequestManifest(manifest, submissionId, '/tmp');
      await expect(executeNpcTombstone({ $transaction: transaction } as never, args))
        .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_ROOT_REQUIRED' });
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      if (previousKey === undefined) delete process.env.DOCUMENT_ENCRYPTION_KEY;
      else process.env.DOCUMENT_ENCRYPTION_KEY = previousKey;
    }
  });
});
