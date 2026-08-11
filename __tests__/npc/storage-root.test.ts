/** @jest-environment node */

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  assertNpcStorageReady,
  resolveNpcStoragePath,
  resolveNpcStorageRoot,
} from '@/lib/npc/storage-root';

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

  test('resolves a safe path whose final components do not exist yet', async () => {
    await expect(
      resolveNpcStoragePath('student/submission/page_1/copie.pdf'),
    ).resolves.toBe(
      join(storageRoot, 'student', 'submission', 'page_1', 'copie.pdf'),
    );
  });
});
