import 'server-only';

import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';
import type { BenchmarkRunIdentity } from './run-identity';
import type { BenchmarkScheduleEntry } from './schedule';

export const BENCHMARK_EVENT_TYPES = [
  'RUN_CREATED',
  'PREFLIGHT_PLANNED',
  'PREFLIGHT_STARTED',
  'PREFLIGHT_SUCCEEDED',
  'PREFLIGHT_FAILED',
  'ATTEMPT_PLANNED',
  'ATTEMPT_STARTED',
  'ATTEMPT_RESPONSE_RECEIVED',
  'ATTEMPT_VALIDATED',
  'ATTEMPT_TRANSPORT_FAILED',
  'ATTEMPT_SCHEMA_FAILED',
  'ATTEMPT_GROUNDING_FAILED',
  'ATTEMPT_SECURITY_FAILED',
  'BUDGET_RESERVED',
  'BUDGET_RECONCILED',
  'RUN_PAUSED',
  'RUN_COMPLETED',
  'RUN_FAILED',
] as const;

export type BenchmarkEventType = typeof BENCHMARK_EVENT_TYPES[number];

export type BenchmarkJournalEvent = Readonly<{
  schemaVersion: 'bilan-benchmark-journal-event-v1';
  runId: string;
  sequence: number;
  type: BenchmarkEventType;
  occurredAt: string;
  previousEventChecksum: string | null;
  payload: Readonly<Record<string, unknown>>;
  eventChecksum: string;
}>;

export type BenchmarkJournalHandle = Readonly<{
  runId: string;
  directory: string;
  manifestPath: string;
  eventsPath: string;
}>;

type RunManifest = Readonly<{
  schemaVersion: 'bilan-benchmark-run-manifest-v1';
  runId: string;
  status: 'INITIALIZING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  identity: BenchmarkRunIdentity;
  schedule: readonly BenchmarkScheduleEntry[];
  updatedAt: string;
}>;

function writeDurableNewFile(path: string, content: string): void {
  const descriptor = openSync(path, 'wx', 0o600);
  try {
    writeSync(descriptor, content, undefined, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  chmodSync(path, 0o600);
}

function fsyncDirectory(path: string): void {
  const descriptor = openSync(path, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function parseManifest(path: string): RunManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('BENCHMARK_RUN_MANIFEST_INVALID');
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || !('runId' in parsed)
    || typeof parsed.runId !== 'string'
    || !('identity' in parsed)
    || parsed.identity === null
    || typeof parsed.identity !== 'object'
    || !('schedule' in parsed)
    || !Array.isArray(parsed.schedule)
  ) {
    throw new Error('BENCHMARK_RUN_MANIFEST_INVALID');
  }
  return parsed as RunManifest;
}

function manifestValues(
  identity: BenchmarkRunIdentity,
  schedule: readonly BenchmarkScheduleEntry[],
  status: RunManifest['status'],
  updatedAt: string,
): RunManifest {
  return Object.freeze({
    schemaVersion: 'bilan-benchmark-run-manifest-v1',
    runId: identity.runId,
    status,
    identity,
    schedule,
    updatedAt,
  });
}

function stableIdentity(identity: BenchmarkRunIdentity) {
  const { createdAt: _createdAt, ...stable } = identity;
  return stable;
}

export function createBenchmarkJournal(
  input: Readonly<{
    rootDirectory: string;
    identity: BenchmarkRunIdentity;
    schedule: readonly BenchmarkScheduleEntry[];
    resumeDirectory?: string;
  }>,
): BenchmarkJournalHandle {
  mkdirSync(input.rootDirectory, { recursive: true, mode: 0o700 });
  chmodSync(input.rootDirectory, 0o700);
  const directory = input.resumeDirectory
    ?? join(input.rootDirectory, input.identity.runId);
  const manifestPath = join(directory, 'run-manifest.json');
  const eventsPath = join(directory, 'events.ndjson');
  const handle = Object.freeze({
    runId: input.identity.runId,
    directory,
    manifestPath,
    eventsPath,
  });

  if (existsSync(directory)) {
    const manifest = parseManifest(manifestPath);
    if (
      manifest.runId !== input.identity.runId
      || sha256Canonical(stableIdentity(manifest.identity))
        !== sha256Canonical(stableIdentity(input.identity))
      || sha256Canonical(manifest.schedule) !== sha256Canonical(input.schedule)
    ) {
      throw new Error('BENCHMARK_RUN_DIRECTORY_IDENTITY_MISMATCH');
    }
    if ((statSync(directory).mode & 0o777) !== 0o700) {
      throw new Error('BENCHMARK_RUN_DIRECTORY_PERMISSIONS_INVALID');
    }
    readBenchmarkJournal(handle);
    return handle;
  }

  mkdirSync(directory, { mode: 0o700 });
  chmodSync(directory, 0o700);
  const manifest = manifestValues(
    input.identity,
    input.schedule,
    'INITIALIZING',
    input.identity.createdAt,
  );
  writeDurableNewFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeDurableNewFile(eventsPath, '');
  fsyncDirectory(directory);
  return handle;
}

function replaceManifestStatus(
  journal: BenchmarkJournalHandle,
  status: RunManifest['status'],
): void {
  const manifest = parseManifest(journal.manifestPath);
  if (manifest.runId !== journal.runId) {
    throw new Error('BENCHMARK_RUN_DIRECTORY_IDENTITY_MISMATCH');
  }
  const temporaryPath = join(
    dirname(journal.manifestPath),
    `.run-manifest-${process.pid}-${Date.now()}.tmp`,
  );
  writeDurableNewFile(temporaryPath, `${JSON.stringify({
    ...manifest,
    status,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`);
  renameSync(temporaryPath, journal.manifestPath);
  chmodSync(journal.manifestPath, 0o600);
  fsyncDirectory(journal.directory);
}

export function markBenchmarkRunRunning(
  journal: BenchmarkJournalHandle,
): void {
  replaceManifestStatus(journal, 'RUNNING');
}

export function markBenchmarkRunStatus(
  journal: BenchmarkJournalHandle,
  status: 'PAUSED' | 'COMPLETED' | 'FAILED',
): void {
  replaceManifestStatus(journal, status);
}

function eventValues(
  event: Omit<BenchmarkJournalEvent, 'eventChecksum'>,
) {
  return { ...event };
}

export function readBenchmarkJournal(
  journal: BenchmarkJournalHandle,
): readonly BenchmarkJournalEvent[] {
  const content = readFileSync(journal.eventsPath, 'utf8');
  if (content.length === 0) return Object.freeze([]);
  const lines = content.split('\n').filter((line) => line.length > 0);
  const events: BenchmarkJournalEvent[] = [];
  let previousEventChecksum: string | null = null;
  for (const [index, line] of lines.entries()) {
    let event: BenchmarkJournalEvent;
    try {
      event = JSON.parse(line) as BenchmarkJournalEvent;
    } catch {
      throw new Error('BENCHMARK_JOURNAL_HASH_CHAIN_INVALID');
    }
    const { eventChecksum, ...values } = event;
    if (
      event.runId !== journal.runId
      || event.sequence !== index + 1
      || !BENCHMARK_EVENT_TYPES.includes(event.type)
      || event.previousEventChecksum !== previousEventChecksum
      || eventChecksum !== sha256Canonical(values)
    ) {
      throw new Error('BENCHMARK_JOURNAL_HASH_CHAIN_INVALID');
    }
    events.push(Object.freeze(event));
    previousEventChecksum = eventChecksum;
  }
  return Object.freeze(events);
}

export function appendBenchmarkEvent(
  journal: BenchmarkJournalHandle,
  input: Readonly<{
    type: BenchmarkEventType;
    occurredAt?: string;
    payload: Readonly<Record<string, unknown>>;
  }>,
): BenchmarkJournalEvent {
  const events = readBenchmarkJournal(journal);
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new Error('BENCHMARK_JOURNAL_EVENT_INVALID');
  }
  const values = {
    schemaVersion: 'bilan-benchmark-journal-event-v1' as const,
    runId: journal.runId,
    sequence: events.length + 1,
    type: input.type,
    occurredAt,
    previousEventChecksum: events.at(-1)?.eventChecksum ?? null,
    payload: Object.freeze({ ...input.payload }),
  };
  const event = Object.freeze({
    ...values,
    eventChecksum: sha256Canonical(eventValues(values)),
  });
  const descriptor = openSync(journal.eventsPath, 'a', 0o600);
  try {
    writeSync(descriptor, `${JSON.stringify(event)}\n`, undefined, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  return event;
}

export type BenchmarkAttemptProjection = Readonly<{
  state:
    | 'UNKNOWN_OUTCOME'
    | 'VALIDATED'
    | 'TRANSPORT_FAILED'
    | 'SCHEMA_FAILED'
    | 'GROUNDING_FAILED'
    | 'SECURITY_FAILED';
  networkAttemptCount: number;
  retryable: boolean;
}>;

export function projectBenchmarkAttempts(
  events: readonly BenchmarkJournalEvent[],
): ReadonlyMap<string, BenchmarkAttemptProjection> {
  const projections = new Map<string, BenchmarkAttemptProjection>();
  for (const event of events) {
    const attemptKey = typeof event.payload.attemptKey === 'string'
      ? event.payload.attemptKey
      : null;
    if (attemptKey === null) continue;
    const previous = projections.get(attemptKey);
    if (event.type === 'ATTEMPT_STARTED') {
      projections.set(attemptKey, Object.freeze({
        state: 'UNKNOWN_OUTCOME',
        networkAttemptCount: Math.max(
          previous?.networkAttemptCount ?? 0,
          typeof event.payload.networkAttemptNumber === 'number'
            ? event.payload.networkAttemptNumber
            : 1,
        ),
        retryable: false,
      }));
      continue;
    }
    const terminal = {
      ATTEMPT_VALIDATED: 'VALIDATED',
      ATTEMPT_TRANSPORT_FAILED: 'TRANSPORT_FAILED',
      ATTEMPT_SCHEMA_FAILED: 'SCHEMA_FAILED',
      ATTEMPT_GROUNDING_FAILED: 'GROUNDING_FAILED',
      ATTEMPT_SECURITY_FAILED: 'SECURITY_FAILED',
    } as const;
    if (!(event.type in terminal)) continue;
    projections.set(attemptKey, Object.freeze({
      state: terminal[event.type as keyof typeof terminal],
      networkAttemptCount: previous?.networkAttemptCount ?? 1,
      retryable: event.type === 'ATTEMPT_TRANSPORT_FAILED'
        && event.payload.retryable === true,
    }));
  }
  return projections;
}

export function shouldAutomaticallyStartAttempt(
  projection: BenchmarkAttemptProjection | undefined,
): boolean {
  return projection === undefined;
}

export function canStartDeferredTransportRetry(
  projection: BenchmarkAttemptProjection | undefined,
): boolean {
  return projection?.state === 'TRANSPORT_FAILED'
    && projection.retryable
    && projection.networkAttemptCount < 2;
}
