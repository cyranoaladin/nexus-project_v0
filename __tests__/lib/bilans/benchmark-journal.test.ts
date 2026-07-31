/** @jest-environment node */

import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  appendBenchmarkEvent,
  createBenchmarkJournal,
  markBenchmarkRunRunning,
  projectBenchmarkAttempts,
  readBenchmarkJournal,
  shouldAutomaticallyStartAttempt,
} from '@/lib/bilans/benchmark/journal';
import { createBenchmarkRunIdentity } from '@/lib/bilans/benchmark/run-identity';
import { buildBalancedBenchmarkSchedule } from '@/lib/bilans/benchmark/schedule';

function identity() {
  return createBenchmarkRunIdentity({
    repositorySha: 'a'.repeat(40),
    benchmarkPolicyChecksum: 'b'.repeat(64),
    transportPolicyChecksum: 'c'.repeat(64),
    datasetChecksum: 'd'.repeat(64),
    promptChecksum: 'e'.repeat(64),
    draftSchemaChecksum: 'f'.repeat(64),
    finalSchemaChecksum: '0'.repeat(64),
    randomizationSeed: 'journal-test-seed-v1',
    createdAt: '2026-07-31T10:00:00.000Z',
  });
}

function schedule(runId: string) {
  return buildBalancedBenchmarkSchedule({
    runId,
    randomizationSeed: 'journal-test-seed-v1',
    fixtureIds: Array.from({ length: 12 }, (_, index) => `fixture-${index}`),
    modelIds: ['luna', 'terra', 'sonnet'],
  });
}

describe('benchmark append-only journal', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nexus-benchmark-journal-'));
    chmodSync(root, 0o700);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('creates the private manifest and schedule before any caller network work', () => {
    const run = identity();
    const journal = createBenchmarkJournal({
      rootDirectory: root,
      identity: run,
      schedule: schedule(run.runId),
    });

    expect(statSync(journal.directory).mode & 0o777).toBe(0o700);
    expect(statSync(journal.manifestPath).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(journal.manifestPath, 'utf8'))).toMatchObject({
      runId: run.runId,
      status: 'INITIALIZING',
    });
    markBenchmarkRunRunning(journal);
    expect(JSON.parse(readFileSync(journal.manifestPath, 'utf8')).status)
      .toBe('RUNNING');
  });

  it('writes an ordered checksum-bound chain and rejects tampering', () => {
    const run = identity();
    const journal = createBenchmarkJournal({
      rootDirectory: root,
      identity: run,
      schedule: schedule(run.runId),
    });
    appendBenchmarkEvent(journal, {
      type: 'RUN_CREATED',
      occurredAt: '2026-07-31T10:00:01.000Z',
      payload: { syntheticOnly: true },
    });
    appendBenchmarkEvent(journal, {
      type: 'PREFLIGHT_PLANNED',
      occurredAt: '2026-07-31T10:00:02.000Z',
      payload: { model: 'openai/gpt-5.6-luna' },
    });

    const events = readBenchmarkJournal(journal);
    expect(events).toHaveLength(2);
    expect(events[0].sequence).toBe(1);
    expect(events[1].previousEventChecksum).toBe(events[0].eventChecksum);

    const tampered = readFileSync(journal.eventsPath, 'utf8')
      .replace('PREFLIGHT_PLANNED', 'PREFLIGHT_STARTED');
    writeFileSync(journal.eventsPath, tampered, { mode: 0o600 });
    expect(() => readBenchmarkJournal(journal))
      .toThrow('BENCHMARK_JOURNAL_HASH_CHAIN_INVALID');
  });

  it('refuses to resume a directory belonging to another run', () => {
    const run = identity();
    createBenchmarkJournal({
      rootDirectory: root,
      identity: run,
      schedule: schedule(run.runId),
    });
    expect(() => createBenchmarkJournal({
      rootDirectory: root,
      identity: { ...run, runId: '1'.repeat(64) },
      schedule: schedule('1'.repeat(64)),
      resumeDirectory: join(root, run.runId),
    })).toThrow('BENCHMARK_RUN_DIRECTORY_IDENTITY_MISMATCH');
  });

  it('resumes the same run id even when the process creation time changes', () => {
    const run = identity();
    const plan = schedule(run.runId);
    const first = createBenchmarkJournal({
      rootDirectory: root,
      identity: run,
      schedule: plan,
    });
    const resumed = createBenchmarkJournal({
      rootDirectory: root,
      identity: { ...run, createdAt: '2026-07-31T11:00:00.000Z' },
      schedule: plan,
    });

    expect(resumed.directory).toBe(first.directory);
  });

  it('projects a crash after start as UNKNOWN_OUTCOME and forbids replay', () => {
    const run = identity();
    const plan = schedule(run.runId);
    const journal = createBenchmarkJournal({
      rootDirectory: root,
      identity: run,
      schedule: plan,
    });
    const attempt = plan[0];
    appendBenchmarkEvent(journal, {
      type: 'ATTEMPT_STARTED',
      occurredAt: '2026-07-31T10:00:01.000Z',
      payload: {
        attemptKey: attempt.attemptKey,
        networkAttemptNumber: 1,
      },
    });

    const projection = projectBenchmarkAttempts(readBenchmarkJournal(journal));
    expect(projection.get(attempt.attemptKey)).toMatchObject({
      state: 'UNKNOWN_OUTCOME',
      networkAttemptCount: 1,
    });
    expect(shouldAutomaticallyStartAttempt(
      projection.get(attempt.attemptKey),
    )).toBe(false);
  });

  it('never starts a validated combination twice', () => {
    const run = identity();
    const plan = schedule(run.runId);
    const journal = createBenchmarkJournal({
      rootDirectory: root,
      identity: run,
      schedule: plan,
    });
    const attempt = plan[0];
    appendBenchmarkEvent(journal, {
      type: 'ATTEMPT_STARTED',
      occurredAt: '2026-07-31T10:00:01.000Z',
      payload: { attemptKey: attempt.attemptKey, networkAttemptNumber: 1 },
    });
    appendBenchmarkEvent(journal, {
      type: 'ATTEMPT_VALIDATED',
      occurredAt: '2026-07-31T10:00:02.000Z',
      payload: { attemptKey: attempt.attemptKey, networkAttemptNumber: 1 },
    });

    const projection = projectBenchmarkAttempts(readBenchmarkJournal(journal));
    expect(projection.get(attempt.attemptKey)?.state).toBe('VALIDATED');
    expect(shouldAutomaticallyStartAttempt(
      projection.get(attempt.attemptKey),
    )).toBe(false);
  });
});
