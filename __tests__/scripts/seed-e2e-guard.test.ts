/**
 * Seed script hard guard: refuses to run against non-e2e databases.
 */
import { spawnSync } from 'node:child_process';

describe('seed-e2e-db.ts target guard', () => {
  it('refuses to seed a non-e2e database and exits before connecting', () => {
    const result = spawnSync(
      'npx',
      ['tsx', 'scripts/seed-e2e-db.ts'],
      {
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://user:pass@prod-host.example:5432/nexus_prod',
        },
        timeout: 10_000, // must exit fast — no Prisma connection attempt
        encoding: 'utf8',
      }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('Refusing');
  });
});
