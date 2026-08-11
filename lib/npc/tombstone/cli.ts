import {
  lstatSync as nodeLstatSync,
  realpathSync as nodeRealpathSync,
  type Stats,
} from 'node:fs';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import {
  NpcTombstoneError,
  TOMBSTONE_ACTOR_ROLES,
  TOMBSTONE_INITIAL_STATUSES,
  TOMBSTONE_REPORT_STATUSES,
  TOMBSTONE_REPORT_VISIBILITIES,
  type TombstoneActorRole,
  type TombstoneArguments,
  type TombstoneInitialStatus,
  type TombstoneReportStatus,
  type TombstoneReportVisibility,
  tombstoneError,
} from './types';
import { canonicalizeTombstoneExportPath } from './export';
import type { ExecuteNpcTombstoneResult } from './service';

const FLAG_TO_FIELD = {
  '--submission-id': 'submissionId',
  '--expected-initial-status': 'expectedInitialStatus',
  '--expected-page-count': 'expectedPageCount',
  '--expected-report-id': 'expectedReportId',
  '--expected-report-status': 'expectedReportStatus',
  '--expected-report-visibility': 'expectedReportVisibility',
  '--reason': 'reason',
  '--actor-id': 'actorId',
  '--actor-role': 'actorRole',
  '--export-file': 'exportFile',
} as const;

type CliFlag = keyof typeof FLAG_TO_FIELD;
type ParsedValues = Partial<Record<typeof FLAG_TO_FIELD[CliFlag], string>>;

export interface TombstoneCliRuntime {
  getuid: () => number;
  repositoryRoot: string;
  releaseRoot: string;
  lstatSync: (path: string) => Stats;
  realpathSync: (path: string) => string;
}

function productionRuntime(): TombstoneCliRuntime {
  return {
    getuid: () => {
      if (typeof process.getuid !== 'function') {
        tombstoneError(
          'NPC_TOMBSTONE_ROOT_REQUIRED',
          'This command requires a UID-capable root runtime.',
        );
      }
      return process.getuid();
    },
    repositoryRoot: resolve(),
    releaseRoot: resolve(process.env.NEXUS_RELEASE_ROOT ?? resolve()),
    lstatSync: nodeLstatSync,
    realpathSync: nodeRealpathSync,
  };
}

function isOneOf<T extends string>(
  value: string,
  choices: readonly T[],
): value is T {
  return choices.includes(value as T);
}

function requireId(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,190}$/.test(value)) {
    tombstoneError(
      'NPC_TOMBSTONE_INVALID_ID',
      `${label} must be a bounded opaque identifier.`,
    );
  }
  return value;
}

function requireEnum<T extends string>(
  value: string,
  choices: readonly T[],
  label: string,
): T {
  if (!isOneOf(value, choices)) {
    tombstoneError(
      'NPC_TOMBSTONE_INVALID_ENUM',
      `${label} is not an allowed value.`,
    );
  }
  return value;
}

function requireReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 512 || /[\u0000-\u001f\u007f]/.test(reason)) {
    tombstoneError(
      'NPC_TOMBSTONE_INVALID_REASON',
      'Reason must be a single printable line between 3 and 512 characters.',
    );
  }
  return reason;
}

export function parseTombstoneCliArgs(argv: readonly string[]): TombstoneArguments {
  const parsed: ParsedValues = {};

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!(flag in FLAG_TO_FIELD)) {
      tombstoneError('NPC_TOMBSTONE_ARG_UNKNOWN', 'An unknown argument was supplied.');
    }
    if (value === undefined || value.startsWith('--')) {
      tombstoneError('NPC_TOMBSTONE_ARG_REQUIRED', 'Every argument requires a value.');
    }
    const field = FLAG_TO_FIELD[flag as CliFlag];
    if (field in parsed) {
      tombstoneError('NPC_TOMBSTONE_ARG_DUPLICATE', 'An argument was supplied more than once.');
    }
    parsed[field] = value;
  }

  for (const field of Object.values(FLAG_TO_FIELD)) {
    if (parsed[field] === undefined) {
      tombstoneError('NPC_TOMBSTONE_ARG_REQUIRED', 'A required argument is missing.');
    }
  }

  if (parsed.expectedPageCount !== '4') {
    tombstoneError(
      'NPC_TOMBSTONE_INVALID_PAGE_COUNT',
      'The command is restricted to exactly four pages.',
    );
  }

  return {
    submissionId: requireId(parsed.submissionId!, 'Submission id'),
    expectedInitialStatus: requireEnum(
      parsed.expectedInitialStatus!,
      TOMBSTONE_INITIAL_STATUSES,
      'Expected initial status',
    ) as TombstoneInitialStatus,
    expectedPageCount: 4,
    expectedReportId: requireId(parsed.expectedReportId!, 'Report id'),
    expectedReportStatus: requireEnum(
      parsed.expectedReportStatus!,
      TOMBSTONE_REPORT_STATUSES,
      'Expected report status',
    ) as TombstoneReportStatus,
    expectedReportVisibility: requireEnum(
      parsed.expectedReportVisibility!,
      TOMBSTONE_REPORT_VISIBILITIES,
      'Expected report visibility',
    ) as TombstoneReportVisibility,
    reason: requireReason(parsed.reason!),
    actorId: requireId(parsed.actorId!, 'Actor id'),
    actorRole: requireEnum(
      parsed.actorRole!,
      TOMBSTONE_ACTOR_ROLES,
      'Actor role',
    ) as TombstoneActorRole,
    exportFile: parsed.exportFile!,
  };
}

function isAtOrBelow(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  if (child === '') return true;
  const [first] = child.split(sep);
  return !isAbsolute(child) && first !== '..';
}

function safeLstat(runtime: TombstoneCliRuntime, path: string): Stats | null {
  try {
    return runtime.lstatSync(path);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

export function validateTombstoneCliInvocation(
  args: TombstoneArguments,
  runtime: TombstoneCliRuntime = productionRuntime(),
): string {
  if (runtime.getuid() !== 0) {
    tombstoneError(
      'NPC_TOMBSTONE_ROOT_REQUIRED',
      'This command must be executed as UID 0.',
    );
  }

  const canonicalExportFile = canonicalizeTombstoneExportPath(args.exportFile);
  if (extname(canonicalExportFile).toLowerCase() !== '.json') {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PATH_INVALID',
      'Export destination must be an absolute JSON path.',
    );
  }

  const requestedParent = dirname(canonicalExportFile);
  const parentStats = safeLstat(runtime, requestedParent);
  if (parentStats?.isSymbolicLink()) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_SYMLINK',
      'Symbolic links are forbidden for the export destination.',
    );
  }
  if (!parentStats || !parentStats.isDirectory()) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_INVALID',
      'Export parent must be an existing directory.',
    );
  }
  if (parentStats.uid !== 0) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_OWNER',
      'Export parent must be owned by root.',
    );
  }
  if ((parentStats.mode & 0o077) !== 0) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_PERMISSIONS',
      'Export parent must grant no group or world permissions.',
    );
  }

  const canonicalParent = runtime.realpathSync(requestedParent);
  if (canonicalParent !== requestedParent) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_SYMLINK',
      'Symbolic path components are forbidden for the export destination.',
    );
  }
  const candidate = join(canonicalParent, basename(canonicalExportFile));
  const repositoryRoot = runtime.realpathSync(resolve(runtime.repositoryRoot));
  const releaseRoot = runtime.realpathSync(resolve(runtime.releaseRoot));
  if (
    isAtOrBelow(repositoryRoot, candidate) ||
    isAtOrBelow(releaseRoot, candidate)
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_SCOPE_INVALID',
      'Export destination must be outside repository and active release.',
    );
  }

  const destinationStats = safeLstat(runtime, candidate);
  if (destinationStats?.isSymbolicLink()) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_SYMLINK',
      'Symbolic links are forbidden for the export destination.',
    );
  }
  if (destinationStats) {
    if (!destinationStats.isFile()) {
      tombstoneError(
        'NPC_TOMBSTONE_EXPORT_PATH_INVALID',
        'Existing export destination must be a regular file.',
      );
    }
    if (destinationStats.uid !== 0) {
      tombstoneError(
        'NPC_TOMBSTONE_EXPORT_PARENT_OWNER',
        'Existing export must be owned by root.',
      );
    }
    if ((destinationStats.mode & 0o777) !== 0o600) {
      tombstoneError(
        'NPC_TOMBSTONE_EXPORT_PERMISSIONS',
        'Existing export must have mode 0600.',
      );
    }
  }
  return candidate;
}

export function parseAndValidateTombstoneCliArgs(
  argv: readonly string[],
): TombstoneArguments {
  const args = parseTombstoneCliArgs(argv);
  return {
    ...args,
    exportFile: validateTombstoneCliInvocation(args),
  };
}

export function formatTombstoneCliSuccess(
  result: ExecuteNpcTombstoneResult,
): string {
  const operationDigest = result.operationKey.match(
    /^npc-tombstone-v1:([a-f0-9]{64})$/,
  )?.[1];
  if (!operationDigest) {
    return 'NPC_TOMBSTONE_SUCCESS operation=redacted\n';
  }
  const status = result.status === 'applied'
    ? 'NPC_TOMBSTONE_APPLIED'
    : 'NPC_TOMBSTONE_ALREADY_APPLIED';
  return `${status} operation=${operationDigest}\n`;
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
