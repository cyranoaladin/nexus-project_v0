import {
  assertSafeSeedTarget,
  generateRuntimePassword,
  writeRuntimeCredentialsManifest,
} from '@/lib/security/seed-runtime';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
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
