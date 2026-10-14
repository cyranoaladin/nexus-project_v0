import {
  assertSafeSeedTarget,
  generateRuntimePassword,
  writeRuntimeCredentialsManifest,
  readRuntimeCredentialsManifest,
} from '@/lib/security/seed-runtime';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync, symlinkSync, linkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('seed runtime security', () => {
  const disposable = 'postgresql://user:pass@127.0.0.1:5432/nexus_disposable_seed_test';

  it('allows production-mode builds only against the marked local disposable target', () => {
    expect(() => assertSafeSeedTarget({
      NODE_ENV: 'production',
      NEXUS_DISPOSABLE_POSTGRES: '1',
      DATABASE_URL: disposable,
    })).not.toThrow();
  });

  it('requires both an explicit marker and a disposable local database', () => {
    expect(() => assertSafeSeedTarget({ DATABASE_URL: disposable })).toThrow('SEED_TARGET_FORBIDDEN');
    expect(() => assertSafeSeedTarget({
      NODE_ENV: 'production',
      NEXUS_DISPOSABLE_POSTGRES: '1',
      DATABASE_URL: 'postgresql://user:pass@prod.internal:5432/nexus_disposable_seed_test',
    })).toThrow('SEED_TARGET_FORBIDDEN');
    expect(() => assertSafeSeedTarget({
      NODE_ENV: 'development',
      NEXUS_DISPOSABLE_POSTGRES: '1',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/nexus',
    })).toThrow('SEED_TARGET_FORBIDDEN');
  });

  it('accepts an explicitly disposable local test database', () => {
    expect(() => assertSafeSeedTarget({
      NODE_ENV: 'test',
      NEXUS_DISPOSABLE_POSTGRES: '1',
      DATABASE_URL: disposable,
    })).not.toThrow();
  });

  it('accepts the IPv6 loopback for an explicitly disposable test database', () => {
    expect(() => assertSafeSeedTarget({
      NODE_ENV: 'test',
      NEXUS_DISPOSABLE_POSTGRES: '1',
      DATABASE_URL: 'postgresql://user:pass@[::1]:5432/nexus_disposable_seed_test',
    })).not.toThrow();
  });

  it('generates independent high-entropy passwords at runtime', () => {
    const first = generateRuntimePassword();
    const second = generateRuntimePassword();

    expect(first).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(first).not.toBe(second);
  });

  it('writes credential manifests outside Git with owner-only permissions', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexus-seed-manifest-'));
    const path = join(directory, 'nested', 'credentials.json');

    try {
      writeRuntimeCredentialsManifest(path, { password: generateRuntimePassword() });

      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(path, 'utf8'))).toHaveProperty('password');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});


describe('private credential manifest lifecycle', () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'nexus-private-seed-')); });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  it('reads only an owner-private bounded JSON object', () => {
    const file = join(directory, 'credentials.json');
    writeRuntimeCredentialsManifest(file, { synthetic: { email: 'fixture@example.test' } });
    expect(readRuntimeCredentialsManifest(file)).toEqual({ synthetic: { email: 'fixture@example.test' } });
    for (const content of ['[]', 'null', 'invalid-json', 'x'.repeat(65_537)]) {
      writeFileSync(file, content, { mode: 0o600 });
      expect(() => readRuntimeCredentialsManifest(file)).toThrow('RUNTIME_CREDENTIALS_MANIFEST_INVALID');
    }
  });
  it('refuses public, linked and missing reader inputs with one diagnostic', () => {
    const file = join(directory, 'credentials.json');
    writeFileSync(file, '{}', { mode: 0o600 });
    chmodSync(file, 0o644);
    expect(() => readRuntimeCredentialsManifest(file)).toThrow('RUNTIME_CREDENTIALS_MANIFEST_INVALID');
    chmodSync(file, 0o600);
    const symlink = join(directory, 'symlink'); symlinkSync(file, symlink);
    expect(() => readRuntimeCredentialsManifest(symlink)).toThrow('RUNTIME_CREDENTIALS_MANIFEST_INVALID');
    const hardlink = join(directory, 'hardlink'); linkSync(file, hardlink);
    expect(() => readRuntimeCredentialsManifest(file)).toThrow('RUNTIME_CREDENTIALS_MANIFEST_INVALID');
    expect(() => readRuntimeCredentialsManifest(hardlink)).toThrow('RUNTIME_CREDENTIALS_MANIFEST_INVALID');
    expect(() => readRuntimeCredentialsManifest(join(directory, 'missing'))).toThrow('RUNTIME_CREDENTIALS_MANIFEST_INVALID');
  });
  it.each(['public', 'symlink', 'hardlink'] as const)('never writes through an unsafe existing target: %s', kind => {
    const file = join(directory, 'credentials.json'); const target = join(directory, 'existing.json');
    writeFileSync(target, '{"preserve":true}', { mode: 0o600 });
    if (kind === 'symlink') symlinkSync(target, file);
    else if (kind === 'hardlink') linkSync(target, file);
    else { writeFileSync(file, '{"preserve":true}', { mode: 0o644 }); chmodSync(file, 0o644); }
    expect(() => writeRuntimeCredentialsManifest(file, { replacement: true })).toThrow('RUNTIME_CREDENTIALS_MANIFEST_WRITE_REFUSED');
    expect(readFileSync(target, 'utf8')).toBe('{"preserve":true}');
    expect(readFileSync(file, 'utf8')).toBe('{"preserve":true}');
  });
  it('replaces a safe existing manifest atomically and leaves no temporary credential file', () => {
    const file = join(directory, 'credentials.json');
    writeRuntimeCredentialsManifest(file, { generation: 1 });
    const original = statSync(file);
    writeRuntimeCredentialsManifest(file, { generation: 2 });
    expect(statSync(file).ino).not.toBe(original.ino);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readRuntimeCredentialsManifest(file)).toEqual({ generation: 2 });
    expect(readdirSync(directory)).toEqual(['credentials.json']);
  });
});
