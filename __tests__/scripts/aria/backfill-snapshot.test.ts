import {
  canonicalizeAriaBackfillJson,
  createAriaBackfillSnapshot,
  parseAriaBackfillSourceSnapshot,
} from '@/scripts/aria/backfill-snapshot';

describe('ARIA backfill source snapshots', () => {
  it('BACKFILL_SNAPSHOT_CANONICALIZES_OBJECT_KEYS_AND_PRESERVES_SEQUENCE_ARRAY_ORDER', () => {
    expect(canonicalizeAriaBackfillJson(null)).toBe('null');
    expect(canonicalizeAriaBackfillJson({ ä: 2, z: 1 })).toBe('{"z":1,"ä":2}');
    expect(canonicalizeAriaBackfillJson({
      z: true,
      nested: { second: 2, first: 1 },
      sequence: ['assistant', 'user'],
    })).toBe('{"nested":{"first":1,"second":2},"sequence":["assistant","user"],"z":true}');

    const left = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 1,
      inputs: { policy: { b: 2, a: 1 } },
      units: [{ id: 'm1' }, { id: 'm2' }],
      report: { scanned: 2, deterministic: 1, archived: 0, manualReview: 0 },
    });
    const reorderedKeys = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 1,
      inputs: { policy: { a: 1, b: 2 } },
      units: [{ id: 'm1' }, { id: 'm2' }],
      report: { manualReview: 0, archived: 0, deterministic: 1, scanned: 2 },
    });
    const reorderedSequence = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 1,
      inputs: { policy: { a: 1, b: 2 } },
      units: [{ id: 'm2' }, { id: 'm1' }],
      report: { scanned: 2, deterministic: 1, archived: 0, manualReview: 0 },
    });

    expect(left).toEqual(reorderedKeys);
    expect(reorderedSequence.sourceDigest).not.toBe(left.sourceDigest);
  });

  it.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    BigInt(1),
    new Date('2026-08-30T00:00:00.000Z'),
    new Map([['course', 'eds-maths-premiere']]),
    { nested: undefined },
  ])('BACKFILL_SNAPSHOT_REJECTS_NON_JSON_VALUES %#', (value) => {
    expect(() => canonicalizeAriaBackfillJson(value))
      .toThrow('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');
  });

  it('rejects cyclic values while allowing the same object in separate branches', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalizeAriaBackfillJson(cyclic))
      .toThrow('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');

    const shared = { courseKey: 'eds-maths-premiere' };
    expect(canonicalizeAriaBackfillJson({ first: shared, second: shared }))
      .toBe('{"first":{"courseKey":"eds-maths-premiere"},"second":{"courseKey":"eds-maths-premiere"}}');
  });

  it('BACKFILL_SNAPSHOT_REJECTS_SPARSE_ARRAYS_WITHOUT_DIGEST_COLLISION', () => {
    const sparse = new Array(1);
    const sparseMiddle = [{ id: 'first' }, , { id: 'second' }];

    expect(() => canonicalizeAriaBackfillJson(sparse))
      .toThrow('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');
    expect(() => canonicalizeAriaBackfillJson(sparseMiddle))
      .toThrow('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');
    expect(canonicalizeAriaBackfillJson([])).toBe('[]');
    expect(canonicalizeAriaBackfillJson([{ id: 'first' }, { id: 'second' }]))
      .toBe('[{"id":"first"},{"id":"second"}]');
  });

  it('BACKFILL_SNAPSHOT_REJECTS_SYMBOL_ACCESSOR_AND_HIDDEN_PROPERTIES', () => {
    const symbolValue = { [Symbol('secret')]: 'hidden' };
    const accessorValue = {};
    Object.defineProperty(accessorValue, 'secret', { enumerable: true, get: () => 'hidden' });
    const hiddenValue = {};
    Object.defineProperty(hiddenValue, 'secret', { enumerable: false, value: 'hidden' });
    const extraArrayProperty = ['one'] as string[] & { extra?: string };
    extraArrayProperty.extra = 'hidden';
    const symbolArray = ['one'] as string[] & { [key: symbol]: string };
    symbolArray[Symbol('secret')] = 'hidden';
    const hiddenArrayIndex = ['one'];
    Object.defineProperty(hiddenArrayIndex, '0', { enumerable: false, value: 'one' });
    const accessorArrayIndex = ['one'];
    Object.defineProperty(accessorArrayIndex, '0', { enumerable: true, get: () => 'one' });
    const sparseWithExtra = new Array(1) as string[] & { extra?: string };
    sparseWithExtra.extra = 'hidden';
    const unexpectedArrayPrototype = ['one'];
    Object.setPrototypeOf(unexpectedArrayPrototype, null);

    for (const value of [
      symbolValue,
      accessorValue,
      hiddenValue,
      extraArrayProperty,
      symbolArray,
      hiddenArrayIndex,
      accessorArrayIndex,
      sparseWithExtra,
      unexpectedArrayPrototype,
    ]) {
      expect(() => canonicalizeAriaBackfillJson(value))
        .toThrow('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');
    }
  });

  it.each([
    { target: 'unknown', plannerVersion: 1, inputs: {}, report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 } },
    { target: 'conversation-context', plannerVersion: 0, inputs: {}, report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 } },
    { target: 'conversation-context', plannerVersion: 1.5, inputs: {}, report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 } },
    { target: 'conversation-context', plannerVersion: 1, inputs: { 'unsafe/path': true }, report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 } },
    { target: 'conversation-context', plannerVersion: 1, inputs: {}, report: { scanned: -1, deterministic: 0, archived: 0, manualReview: 0 } },
    { target: 'conversation-context', plannerVersion: 1, inputs: {}, report: { scanned: 0, deterministic: 0.5, archived: 0, manualReview: 0 } },
  ])('rejects invalid snapshot metadata %#', (input) => {
    expect(() => createAriaBackfillSnapshot({
      ...input,
      target: input.target as 'conversation-context',
      units: [],
    })).toThrow('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');
  });

  it('BACKFILL_SNAPSHOT_FACTORY_REJECTS_ABNORMAL_INPUT_AND_REPORT_CONTAINERS', () => {
    const hiddenInputs = {};
    Object.defineProperty(hiddenInputs, 'policy', { enumerable: false, value: 'hidden' });
    const accessorInputs = {};
    Object.defineProperty(accessorInputs, 'policy', { enumerable: true, get: () => 'hidden' });
    const symbolInputs = { [Symbol('policy')]: 'hidden' };
    const abnormalInputs = Object.create(null) as Record<string, unknown>;
    Object.setPrototypeOf(abnormalInputs, []);

    const validReport = { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 };
    const missingReport = { scanned: 0, deterministic: 0, archived: 0 };
    const extraReport = { ...validReport, ignored: 0 };
    const hiddenReport = { ...validReport };
    Object.defineProperty(hiddenReport, 'ignored', { enumerable: false, value: 0 });
    const accessorReport = { ...validReport };
    Object.defineProperty(accessorReport, 'scanned', { enumerable: true, get: () => 0 });
    const symbolReport = { ...validReport, [Symbol('ignored')]: 0 };

    for (const inputs of [hiddenInputs, accessorInputs, symbolInputs, abnormalInputs]) {
      expect(() => createAriaBackfillSnapshot({
        target: 'conversation-context',
        plannerVersion: 1,
        inputs,
        units: [],
        report: validReport,
      })).toThrow('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');
    }
    for (const report of [missingReport, extraReport, hiddenReport, accessorReport, symbolReport]) {
      expect(() => createAriaBackfillSnapshot({
        target: 'conversation-context',
        plannerVersion: 1,
        inputs: {},
        units: [],
        report: report as typeof validReport,
      })).toThrow('ARIA_BACKFILL_SNAPSHOT_VALUE_INVALID');
    }
  });

  it('BACKFILL_SOURCE_DIGEST_IS_DERIVED_NOT_CALLER_CONTROLLED', () => {
    const report = { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 };
    const first = createAriaBackfillSnapshot({
      target: 'conversation-context',
      plannerVersion: 1,
      inputs: { evidence: { courseKey: 'eds-maths-premiere' } },
      units: [{ sourceFingerprint: 'a'.repeat(64), decision: 'ACTIVE' }],
      report,
    });
    const sameCountsDifferentSource = createAriaBackfillSnapshot({
      target: 'conversation-context',
      plannerVersion: 1,
      inputs: { evidence: { courseKey: 'eds-maths-premiere' } },
      units: [{ sourceFingerprint: 'b'.repeat(64), decision: 'ACTIVE' }],
      report,
    });
    const sameSourceDifferentEvidence = createAriaBackfillSnapshot({
      target: 'conversation-context',
      plannerVersion: 1,
      inputs: { evidence: { courseKey: 'eds-maths-terminale' } },
      units: [{ sourceFingerprint: 'a'.repeat(64), decision: 'ACTIVE' }],
      report,
    });

    expect(first.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(sameCountsDifferentSource.sourceDigest).not.toBe(first.sourceDigest);
    expect(sameSourceDifferentEvidence.sourceDigest).not.toBe(first.sourceDigest);
  });

  it('BACKFILL_MANIFEST_OMITS_RAW_PII_PATHS_AND_MESSAGES', () => {
    const snapshot = createAriaBackfillSnapshot({
      target: 'feedback-profile',
      plannerVersion: 1,
      inputs: {
        evidenceFile: '/srv/private/students/alice.json',
        owner: 'alice@example.invalid',
      },
      units: [{ message: 'my private homework', studentId: 'student-secret-id' }],
      report: { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 },
    });
    const persisted = JSON.stringify(snapshot.sourceSnapshot);

    expect(persisted).not.toContain('/srv/private/students/alice.json');
    expect(persisted).not.toContain('alice@example.invalid');
    expect(persisted).not.toContain('my private homework');
    expect(persisted).not.toContain('student-secret-id');
    expect(snapshot.sourceSnapshot).toMatchObject({
      schemaVersion: 1,
      target: 'feedback-profile',
      plannerVersion: 1,
      report: { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 },
    });
  });

  it('BACKFILL_PERSISTED_SEAL_IS_RUNTIME_VALIDATED_AND_TARGET_BOUND', () => {
    const snapshot = createAriaBackfillSnapshot({
      target: 'feedback-profile',
      plannerVersion: 1,
      inputs: { contract: { version: 1 } },
      units: [{ source: 'private' }],
      report: { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 },
    });

    expect(parseAriaBackfillSourceSnapshot(
      JSON.parse(JSON.stringify(snapshot.sourceSnapshot)),
      'feedback-profile',
    )).toEqual(snapshot.sourceSnapshot);
    expect(() => parseAriaBackfillSourceSnapshot(
      { ...snapshot.sourceSnapshot, unitsSha256: '0'.repeat(64) },
      'feedback-profile',
    )).toThrow('ARIA_BACKFILL_REPLAY_SEAL_INVALID');
    expect(() => parseAriaBackfillSourceSnapshot(
      snapshot.sourceSnapshot,
      'entitlements',
    )).toThrow('ARIA_BACKFILL_REPLAY_SEAL_INVALID');
  });
});
