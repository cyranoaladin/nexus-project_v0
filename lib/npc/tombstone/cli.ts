import { readSecureRootOwnedJson } from './export';
import type { ExecuteNpcTombstoneResult } from './service';
import {
  NPC_TOMBSTONE_REASON_CODE,
  NpcTombstoneError,
  TOMBSTONE_ACTOR_ROLES,
  TOMBSTONE_INITIAL_STATUSES,
  TOMBSTONE_REPORT_STATUSES,
  TOMBSTONE_REPORT_VISIBILITIES,
  canonicalTombstoneReason,
  requireTombstoneId,
  type TombstoneActorRole,
  type TombstoneArguments,
  type TombstoneInitialStatus,
  type TombstoneReportStatus,
  type TombstoneReportVisibility,
  tombstoneError,
} from './types';

const MANIFEST_KEYS = [
  'version',
  'submissionId',
  'expectedInitialStatus',
  'expectedPageCount',
  'expectedReportId',
  'expectedReportStatus',
  'expectedReportVisibility',
  'reasonCode',
  'actorId',
  'actorRole',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...MANIFEST_KEYS].sort());
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    tombstoneError('NPC_TOMBSTONE_INVALID_ENUM', `${label} is not allowed.`);
  }
  return value as T;
}

export function parseTombstoneCliArgs(argv: readonly string[]): { submissionId: string } {
  if (argv.length !== 2 || argv[0] !== '--submission-id') {
    tombstoneError(
      'NPC_TOMBSTONE_ARG_INVALID',
      'Exactly --submission-id and its value are required.',
    );
  }
  return { submissionId: requireTombstoneId(argv[1], 'Submission id') };
}

export function parseTombstoneRequestManifest(
  value: unknown,
  commandSubmissionId: string,
  exportRoot: string,
): TombstoneArguments {
  if (!isRecord(value) || !exactKeys(value) || value.version !== 1) {
    tombstoneError('NPC_TOMBSTONE_REQUEST_INVALID', 'Request manifest shape is invalid.');
  }
  const submissionId = requireTombstoneId(value.submissionId, 'Submission id');
  if (submissionId !== commandSubmissionId) {
    tombstoneError(
      'NPC_TOMBSTONE_REQUEST_ID_MISMATCH',
      'Command and request manifest target different submissions.',
    );
  }
  if (value.expectedPageCount !== 4) {
    tombstoneError(
      'NPC_TOMBSTONE_INVALID_PAGE_COUNT',
      'The command is restricted to exactly four pages.',
    );
  }
  if (value.reasonCode !== NPC_TOMBSTONE_REASON_CODE) {
    canonicalTombstoneReason(value.reasonCode);
  }
  if (
    typeof value.actorRole !== 'string' ||
    !TOMBSTONE_ACTOR_ROLES.includes(value.actorRole as TombstoneActorRole)
  ) {
    tombstoneError('NPC_TOMBSTONE_INVALID_ACTOR_ROLE', 'Actor role is not authorized.');
  }
  const actorRole = value.actorRole as TombstoneActorRole;
  return {
    version: 1,
    submissionId,
    expectedInitialStatus: enumValue(
      value.expectedInitialStatus,
      TOMBSTONE_INITIAL_STATUSES,
      'Expected initial status',
    ) as TombstoneInitialStatus,
    expectedPageCount: 4,
    expectedReportId: requireTombstoneId(value.expectedReportId, 'Report id'),
    expectedReportStatus: enumValue(
      value.expectedReportStatus,
      TOMBSTONE_REPORT_STATUSES,
      'Expected report status',
    ) as TombstoneReportStatus,
    expectedReportVisibility: enumValue(
      value.expectedReportVisibility,
      TOMBSTONE_REPORT_VISIBILITIES,
      'Expected report visibility',
    ) as TombstoneReportVisibility,
    reasonCode: NPC_TOMBSTONE_REASON_CODE,
    reason: canonicalTombstoneReason(value.reasonCode),
    actorId: requireTombstoneId(value.actorId, 'Actor id'),
    actorRole: actorRole as TombstoneActorRole,
    exportRoot,
  };
}

export async function loadTombstoneCliInvocation(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<TombstoneArguments> {
  const { submissionId } = parseTombstoneCliArgs(argv);
  const requestFile = environment.NPC_TOMBSTONE_REQUEST_FILE;
  const exportRoot = environment.NPC_TOMBSTONE_EXPORT_ROOT;
  if (!requestFile || !exportRoot) {
    tombstoneError(
      'NPC_TOMBSTONE_ENV_REQUIRED',
      'The secure request file and artifact root environment are required.',
    );
  }
  const manifest = await readSecureRootOwnedJson(requestFile);
  return parseTombstoneRequestManifest(manifest, submissionId, exportRoot);
}

export function formatTombstoneCliSuccess(result: ExecuteNpcTombstoneResult): string {
  const digest = result.operationKey.match(/^npc-tombstone-v1:([a-f0-9]{64})$/)?.[1];
  if (!digest) return 'NPC_TOMBSTONE_SUCCESS operation=redacted\n';
  const status = result.status === 'applied'
    ? 'NPC_TOMBSTONE_APPLIED'
    : 'NPC_TOMBSTONE_ALREADY_APPLIED';
  return `${status} operation=${digest}\n`;
}

export function formatTombstoneCliError(error: unknown): string {
  if (
    error instanceof NpcTombstoneError &&
    /^NPC_TOMBSTONE_[A-Z0-9_]+$/.test(error.code) &&
    /^[A-Za-z0-9 .,;'-]+$/.test(error.message)
  ) {
    return `NPC tombstone failed [${error.code}]. ${error.message}\n`;
  }
  return 'NPC tombstone failed [NPC_TOMBSTONE_UNEXPECTED_FAILURE]. Review secure logs and database state.\n';
}
