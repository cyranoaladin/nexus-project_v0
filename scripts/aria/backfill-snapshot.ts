import { createHash } from 'node:crypto';

export type AriaBackfillSnapshotTarget =
  | 'conversation-context'
  | 'conversation-turns'
  | 'entitlements'
  | 'feedback-profile';

export interface AriaBackfillSnapshotReport {
  readonly scanned: number;
  readonly deterministic: number;
  readonly archived: number;
  readonly manualReview: number;
}

export interface AriaBackfillSourceSnapshot {
  readonly schemaVersion: 1;
  readonly target: AriaBackfillSnapshotTarget;
  readonly plannerVersion: number;
  readonly inputDigests: Readonly<Record<string, string>>;
  readonly unitsSha256: string;
  readonly report: AriaBackfillSnapshotReport;
  readonly sourceSnapshotSha256: string;
}

const TARGETS = new Set<AriaBackfillSnapshotTarget>([
  'conversation-context',
  'conversation-turns',
  'entitlements',
  'feedback-profile',
]);

function invalidSnapshotValue(): never {
  throw new Error('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');
}

function canonicalize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return invalidSnapshotValue();
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') return invalidSnapshotValue();
  if (ancestors.has(value)) return invalidSnapshotValue();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return invalidSnapshotValue();
      const ownKeys = Reflect.ownKeys(value);
      if (
        ownKeys.some((key) => typeof key !== 'string')
        || ownKeys.length !== value.length + 1
      ) {
        return invalidSnapshotValue();
      }
      const entries: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor?.enumerable || !('value' in descriptor)) return invalidSnapshotValue();
        entries.push(canonicalize(descriptor.value, ancestors));
      }
      return `[${entries.join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalidSnapshotValue();
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) return invalidSnapshotValue();
    const entries = (ownKeys as string[]).sort().map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !('value' in descriptor)) return invalidSnapshotValue();
      return `${JSON.stringify(key)}:${canonicalize(descriptor.value, ancestors)}`;
    });
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeAriaBackfillJson(value: unknown): string {
  return canonicalize(value, new Set());
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalizeAriaBackfillJson(value)).digest('hex');
}

function assertSnapshotMetadata(input: Readonly<{
  target: AriaBackfillSnapshotTarget;
  plannerVersion: number;
  inputs: Readonly<Record<string, unknown>>;
  report: AriaBackfillSnapshotReport;
}>): void {
  canonicalizeAriaBackfillJson(input.inputs);
  canonicalizeAriaBackfillJson(input.report);
  if (!TARGETS.has(input.target) || !Number.isInteger(input.plannerVersion) || input.plannerVersion < 1) {
    invalidSnapshotValue();
  }
  const inputNames = Object.keys(input.inputs);
  if (inputNames.some((name) => !/^[a-z][A-Za-z0-9]{0,63}$/.test(name))) {
    invalidSnapshotValue();
  }
  const reportKeys = Object.keys(input.report).sort();
  if (
    reportKeys.join(',') !== 'archived,deterministic,manualReview,scanned'
    || reportKeys.some((key) => {
      const count = input.report[key as keyof AriaBackfillSnapshotReport];
      return !Number.isInteger(count) || count < 0;
    })
  ) {
    invalidSnapshotValue();
  }
}

export function createAriaBackfillSnapshot(input: Readonly<{
  target: AriaBackfillSnapshotTarget;
  plannerVersion: number;
  inputs: Readonly<Record<string, unknown>>;
  units: readonly unknown[];
  report: AriaBackfillSnapshotReport;
}>): Readonly<{
  sourceDigest: string;
  sourceSnapshot: AriaBackfillSourceSnapshot;
}> {
  assertSnapshotMetadata(input);
  const inputDigests = Object.freeze(Object.fromEntries(
    Object.keys(input.inputs).sort().map((name) => [name, sha256(input.inputs[name])]),
  ));
  const descriptor = Object.freeze({
    schemaVersion: 1 as const,
    target: input.target,
    plannerVersion: input.plannerVersion,
    inputDigests,
    unitsSha256: sha256(input.units),
    report: Object.freeze({ ...input.report }),
  });
  const sourceDigest = sha256(descriptor);
  return Object.freeze({
    sourceDigest,
    sourceSnapshot: Object.freeze({
      ...descriptor,
      sourceSnapshotSha256: sourceDigest,
    }),
  });
}

export function parseAriaBackfillSourceSnapshot(
  value: unknown,
  expectedTarget: AriaBackfillSnapshotTarget,
): AriaBackfillSourceSnapshot {
  try {
    canonicalizeAriaBackfillJson(value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).sort().join(',')
        !== 'inputDigests,plannerVersion,report,schemaVersion,sourceSnapshotSha256,target,unitsSha256'
      || record.schemaVersion !== 1
      || record.target !== expectedTarget
      || !Number.isInteger(record.plannerVersion)
      || (record.plannerVersion as number) < 1
      || typeof record.unitsSha256 !== 'string'
      || typeof record.sourceSnapshotSha256 !== 'string'
      || !record.inputDigests
      || typeof record.inputDigests !== 'object'
      || Array.isArray(record.inputDigests)
      || !record.report
      || typeof record.report !== 'object'
      || Array.isArray(record.report)
    ) {
      throw new Error();
    }
    const sha256Pattern = /^[a-f0-9]{64}$/;
    const inputDigests = record.inputDigests as Record<string, unknown>;
    const report = record.report as Record<string, unknown>;
    if (
      Object.values(inputDigests).some(
        (digest) => typeof digest !== 'string' || !sha256Pattern.test(digest),
      )
      || Object.keys(report).sort().join(',') !== 'archived,deterministic,manualReview,scanned'
      || Object.values(report).some((count) => !Number.isInteger(count) || (count as number) < 0)
      || !sha256Pattern.test(record.unitsSha256)
      || !sha256Pattern.test(record.sourceSnapshotSha256)
    ) {
      throw new Error();
    }
    const descriptor = {
      schemaVersion: 1 as const,
      target: expectedTarget,
      plannerVersion: record.plannerVersion as number,
      inputDigests: Object.freeze(Object.fromEntries(
        Object.entries(inputDigests).map(([name, digest]) => [name, digest as string]),
      )),
      unitsSha256: record.unitsSha256,
      report: Object.freeze({
        scanned: report.scanned as number,
        deterministic: report.deterministic as number,
        archived: report.archived as number,
        manualReview: report.manualReview as number,
      }),
    };
    if (sha256(descriptor) !== record.sourceSnapshotSha256) throw new Error();
    return Object.freeze({
      ...descriptor,
      sourceSnapshotSha256: record.sourceSnapshotSha256,
    });
  } catch {
    throw new Error('ARIA_BACKFILL_REPLAY_SEAL_INVALID');
  }
}
