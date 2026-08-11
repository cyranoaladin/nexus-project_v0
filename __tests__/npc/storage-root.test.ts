/** @jest-environment node */

import {
  chownSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  assertNpcStorageReady,
  inspectNpcStorageFile,
  readNpcStorageFile,
  resolveNpcStoragePath,
  resolveNpcStorageRoot,
  writeNpcStorageFileAtomic,
} from '@/lib/npc/storage-root';
import { createHash } from 'node:crypto';

describe('NPC canonical storage root', () => {
  const originalStorageRoot = process.env.NPC_STORAGE_ROOT;
  let temporaryDirectory: string;
  let releaseRoot: string;
  let storageRoot: string;

  const envWithRoot = (root: string): NodeJS.ProcessEnv => ({
    ...process.env,
    NODE_ENV: 'test',
    NPC_STORAGE_ROOT: root,
  });

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'npc-storage-root-'));
    releaseRoot = join(temporaryDirectory, 'release');
    storageRoot = join(temporaryDirectory, 'shared');
    mkdirSync(releaseRoot);
    mkdirSync(storageRoot, { mode: 0o750 });
    process.env.NPC_STORAGE_ROOT = storageRoot;
  });

  afterEach(() => {
    try {
      chmodSync(storageRoot, 0o750);
    } catch {
      // The test may deliberately replace or remove the root.
    }
    rmSync(temporaryDirectory, { recursive: true, force: true });
    if (originalStorageRoot === undefined) {
      delete process.env.NPC_STORAGE_ROOT;
    } else {
      process.env.NPC_STORAGE_ROOT = originalStorageRoot;
    }
  });

  test.each<[string, NodeJS.ProcessEnv]>([
    ['missing', { NODE_ENV: 'test' }],
    ['blank', envWithRoot('   ')],
    ['relative', envWithRoot('shared/npc')],
  ])('rejects a %s NPC_STORAGE_ROOT', (_label, env) => {
    expect(() => resolveNpcStorageRoot(env)).toThrow(/NPC_STORAGE_ROOT/i);
  });

  test('resolves the configured absolute root without creating it', () => {
    const missingRoot = join(temporaryDirectory, 'missing');

    expect(
      resolveNpcStorageRoot(envWithRoot(missingRoot)),
    ).toBe(resolve(missingRoot));
    expect(() =>
      assertNpcStorageReady({
        capability: 'read-only',
        releaseRoot,
        env: envWithRoot(missingRoot),
      }),
    ).toThrow(/exist|ready|storage/i);
  });

  test('rejects a root that is itself a symbolic link', () => {
    const linkedRoot = join(temporaryDirectory, 'linked-root');
    symlinkSync(storageRoot, linkedRoot, 'dir');

    expect(() =>
      assertNpcStorageReady({
        capability: 'read-only',
        releaseRoot,
        env: envWithRoot(linkedRoot),
      }),
    ).toThrow(/symbolic|symlink/i);
  });

  test('rejects a storage root contained in the active release', () => {
    const releaseStorage = join(releaseRoot, 'private', 'npc');
    mkdirSync(releaseStorage, { recursive: true });

    expect(() =>
      assertNpcStorageReady({
        capability: 'read-write',
        releaseRoot,
        env: envWithRoot(releaseStorage),
      }),
    ).toThrow(/release/i);
  });

  test('rejects a storage root that contains the active release', () => {
    expect(() =>
      assertNpcStorageReady({
        capability: 'read-write',
        releaseRoot,
        env: envWithRoot(temporaryDirectory),
      }),
    ).toThrow(/overlap|release/i);
  });

  test('rejects the filesystem root as storage', () => {
    expect(() =>
      assertNpcStorageReady({
        capability: 'read-only',
        releaseRoot,
        env: envWithRoot('/'),
      }),
    ).toThrow(/overlap|release/i);
  });

  test('uses path segments rather than string prefixes for release overlap', () => {
    const similarlyNamedRoot = join(temporaryDirectory, 'release-shared');
    mkdirSync(similarlyNamedRoot, { mode: 0o750 });

    expect(
      assertNpcStorageReady({
        capability: 'read-write',
        releaseRoot,
        env: envWithRoot(similarlyNamedRoot),
      }),
    ).toBe(similarlyNamedRoot);
  });

  test('allows read-only capability on a non-writable root but denies read-write', () => {
    chmodSync(storageRoot, 0o550);

    expect(
      assertNpcStorageReady({ capability: 'read-only', releaseRoot }),
    ).toBe(storageRoot);
    expect(() =>
      assertNpcStorageReady({ capability: 'read-write', releaseRoot }),
    ).toThrow(/writ|permission|capability/i);
  });

  test.each([
    ['read-only', 0o330],
    ['read-write', 0o550],
    ['read-only', 0o660],
  ] as const)(
    'rejects mode %s capability when required permissions are absent',
    (capability, mode) => {
      chmodSync(storageRoot, mode);

      expect(() =>
        assertNpcStorageReady({ capability, releaseRoot }),
      ).toThrow(/permission|read|writ|travers/i);
    },
  );

  test.each([
    ['group-writable', 0o770],
    ['world-writable', 0o757],
    ['sticky world-writable', 0o1777],
  ] as const)('rejects a %s storage root', (_label, mode) => {
    chmodSync(storageRoot, mode);

    expect(() =>
      assertNpcStorageReady({ capability: 'read-write', releaseRoot }),
    ).toThrow(/trusted|writable|permission/i);
  });

  test('rejects a storage root not owned by root or the current uid', () => {
    const actualUid = process.getuid?.();
    if (actualUid === undefined) {
      throw new Error('This ownership test requires a UID-capable Linux process');
    }
    const untrustedUid = actualUid === 1001 ? 1002 : 1001;
    const uidSpy = actualUid === 0
      ? undefined
      : jest.spyOn(process, 'getuid').mockReturnValue(untrustedUid);

    if (actualUid === 0) {
      chownSync(storageRoot, untrustedUid, untrustedUid);
    }

    try {
      expect(() =>
        assertNpcStorageReady({ capability: 'read-only', releaseRoot }),
      ).toThrow(/owner|trusted/i);
    } finally {
      uidSpy?.mockRestore();
      if (actualUid === 0) {
        chownSync(storageRoot, 0, 0);
      }
    }
  });

  test('returns the canonical real path when the root is ready', () => {
    expect(
      assertNpcStorageReady({ capability: 'read-write', releaseRoot }),
    ).toBe(storageRoot);
  });

  test.each(['../outside.pdf', 'nested/../../outside.pdf', '/outside.pdf'])(
    'rejects unsafe relative path %s',
    async (relativePath) => {
      await expect(resolveNpcStoragePath(relativePath)).rejects.toThrow(
        /absolute|traversal|path/i,
      );
    },
  );

  test('rejects a symbolic-link parent even when its target is inside the root', async () => {
    const realParent = join(storageRoot, 'real-parent');
    mkdirSync(realParent);
    symlinkSync(realParent, join(storageRoot, 'linked-parent'), 'dir');

    await expect(
      resolveNpcStoragePath('linked-parent/file.pdf'),
    ).rejects.toThrow(/symbolic|symlink/i);
  });

  test('rejects a symbolic-link target that escapes the root', async () => {
    const outsideFile = join(temporaryDirectory, 'outside.pdf');
    writeFileSync(outsideFile, 'outside');
    symlinkSync(outsideFile, join(storageRoot, 'linked-file.pdf'));

    await expect(resolveNpcStoragePath('linked-file.pdf')).rejects.toThrow(
      /symbolic|symlink|escape/i,
    );
  });

  test('never follows a symbolic-link final entry during secure read', async () => {
    const outsideFile = join(temporaryDirectory, 'outside-secure.pdf');
    writeFileSync(outsideFile, 'outside', { mode: 0o640 });
    symlinkSync(outsideFile, join(storageRoot, 'linked-secure.pdf'));

    await expect(readNpcStorageFile('linked-secure.pdf')).rejects.toThrow(
      /loop|symbolic|nofollow|storage/i,
    );
  });

  test('streams a descriptor-backed file into size and SHA-256 metadata', async () => {
    const bytes = Buffer.alloc(200_000, 0x5a);
    await writeNpcStorageFileAtomic('student/submission/page_1/large.pdf', bytes, bytes.length);

    await expect(inspectNpcStorageFile(
      'student/submission/page_1/large.pdf',
    )).resolves.toEqual({
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  });

  test('resolves a safe path whose final components do not exist yet', async () => {
    await expect(
      resolveNpcStoragePath('student/submission/page_1/copie.pdf'),
    ).resolves.toBe(
      join(storageRoot, 'student', 'submission', 'page_1', 'copie.pdf'),
    );
  });

  test('rejects an existing group-writable directory below the root', async () => {
    const unsafeDirectory = join(storageRoot, 'unsafe');
    mkdirSync(unsafeDirectory, { mode: 0o770 });
    chmodSync(unsafeDirectory, 0o770);

    await expect(
      resolveNpcStoragePath('unsafe/copie.pdf'),
    ).rejects.toThrow(/trusted|writable|permission/i);
  });

  test('refuses a read after a checked parent is swapped for a symlink', async () => {
    const parent = join(storageRoot, 'parent');
    const originalParent = join(storageRoot, 'parent-original');
    const outside = join(temporaryDirectory, 'outside');
    mkdirSync(parent, { mode: 0o750 });
    mkdirSync(outside);
    writeFileSync(join(parent, 'copie.pdf'), 'inside', { mode: 0o640 });
    writeFileSync(join(outside, 'copie.pdf'), 'outside');

    await expect(resolveNpcStoragePath('parent/copie.pdf')).resolves.toBe(
      join(parent, 'copie.pdf'),
    );
    renameSync(parent, originalParent);
    symlinkSync(outside, parent, 'dir');

    await expect(readNpcStorageFile('parent/copie.pdf')).rejects.toThrow(
      /symbolic|trusted|nofollow|storage/i,
    );
  });

  test('refuses a write after a checked parent is swapped for a symlink', async () => {
    const parent = join(storageRoot, 'parent');
    const originalParent = join(storageRoot, 'parent-original');
    const outside = join(temporaryDirectory, 'outside');
    mkdirSync(parent, { mode: 0o750 });
    mkdirSync(outside);

    await expect(resolveNpcStoragePath('parent/copie.pdf')).resolves.toBe(
      join(parent, 'copie.pdf'),
    );
    renameSync(parent, originalParent);
    symlinkSync(outside, parent, 'dir');

    await expect(
      writeNpcStorageFileAtomic(
        'parent/copie.pdf',
        Buffer.from('blocked'),
        Buffer.byteLength('blocked'),
      ),
    ).rejects.toThrow(/symbolic|trusted|nofollow|storage/i);
    expect(() => readFileSync(join(outside, 'copie.pdf'))).toThrow();
  });
});
