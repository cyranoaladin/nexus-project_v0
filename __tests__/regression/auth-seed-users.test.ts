import { readFileSync } from 'node:fs';

describe('seed credential regression', () => {
  const seed = readFileSync('prisma/seed.ts', 'utf8');
  const auditSeed = readFileSync('scripts/create-audit-profiles.ts', 'utf8');

  it('guards the database target before constructing PrismaClient', () => {
    expect(seed.indexOf('assertSafeSeedTarget();')).toBeGreaterThan(-1);
    expect(seed.indexOf('assertSafeSeedTarget();')).toBeLessThan(seed.indexOf('new PrismaClient()'));
  });

  it('generates credentials at runtime and writes only an ignored manifest', () => {
    expect(seed).toContain('generateRuntimePassword()');
    expect(seed).toContain('writeRuntimeCredentialsManifest(');
    expect(seed).toContain("'.runtime/prisma-seed-credentials.json'");
    expect(seed).not.toMatch(/bcrypt\.hash\(\s*['"`]/);
    expect(seed).not.toMatch(/password\s*:\s*['"`][^'"`]{6,}/);
  });

  it('never logs the runtime password', () => {
    expect(seed).not.toMatch(/console\.(?:log|error)\([^\n]*runtimePassword/);
  });

  it('rotates a hashed pending activation token on every audit seed run', () => {
    expect(auditSeed.match(/activationToken: pendingActivationTokenHash/g)).toHaveLength(2);
    expect(auditSeed).toContain('activationExpiry: pendingActivationExpiry');
    expect(auditSeed).toContain('password, pendingActivationToken');
    expect(auditSeed).not.toContain('activationToken: generateRuntimePassword()');
  });
});
