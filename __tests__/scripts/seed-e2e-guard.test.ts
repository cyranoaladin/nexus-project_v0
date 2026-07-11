/**
 * Seed script hard guard: refuses to run against non-e2e databases.
 */
import { spawnSync } from 'node:child_process';
import { isAllowedSeedTarget } from '@/lib/e2e/seed-guard';

describe('isAllowedSeedTarget (unit)', () => {
  // Legitimate targets
  it('allows 127.0.0.1:5435/nexus_e2e (gate local)', () => {
    const r = isAllowedSeedTarget('postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public');
    expect(r.ok).toBe(true);
    expect(r.host).toBe('127.0.0.1');
    expect(r.db).toBe('nexus_e2e');
  });

  it('allows localhost:5433/nexus_e2e (CI)', () => {
    const r = isAllowedSeedTarget('postgresql://postgres:postgres@localhost:5433/nexus_e2e');
    expect(r.ok).toBe(true);
    expect(r.host).toBe('localhost');
  });

  it('allows postgres-e2e:5432/nexus_e2e (docker-compose)', () => {
    const r = isAllowedSeedTarget('postgresql://postgres:postgres@postgres-e2e:5432/nexus_e2e?schema=public');
    expect(r.ok).toBe(true);
    expect(r.host).toBe('postgres-e2e');
  });

  // Wrong db only
  it('refuses localhost:5435/nexus (wrong db)', () => {
    const r = isAllowedSeedTarget('postgresql://postgres:postgres@localhost:5435/nexus');
    expect(r.ok).toBe(false);
    expect(r.db).toBe('nexus');
  });

  // Wrong host only
  it('refuses prod-host.example:5435/nexus_e2e (wrong host)', () => {
    const r = isAllowedSeedTarget('postgresql://user:pass@prod-host.example:5435/nexus_e2e');
    expect(r.ok).toBe(false);
    expect(r.host).toBe('prod-host.example');
  });

  // Without userinfo
  it('allows postgresql://localhost:5435/nexus_e2e (no userinfo)', () => {
    const r = isAllowedSeedTarget('postgresql://localhost:5435/nexus_e2e');
    expect(r.ok).toBe(true);
  });

  // IPv6 bracketed
  it('allows postgresql://u:p@[::1]:5435/nexus_e2e', () => {
    const r = isAllowedSeedTarget('postgresql://u:p@[::1]:5435/nexus_e2e');
    expect(r.ok).toBe(true);
    expect(r.host).toBe('::1');
  });

  // Empty/garbage
  it('refuses empty string', () => {
    expect(isAllowedSeedTarget('').ok).toBe(false);
  });
});

describe('seed-e2e-db.ts spawn guard (e2e)', () => {
  it('refuses a non-e2e database and exits before connecting', () => {
    const result = spawnSync(
      'npx',
      ['tsx', 'scripts/seed-e2e-db.ts'],
      {
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://user:pass@prod-host.example:5432/nexus_prod',
        },
        timeout: 10_000,
        encoding: 'utf8',
      }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('Refusing');
  });
});
