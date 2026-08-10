import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260809090000_deferred_parent_email/migration.sql',
);
const pendingLifecycle = readFileSync(
  resolve(process.cwd(), 'lib/auth/pending-account-lifecycle.ts'),
  'utf8',
);

describe('migration de contact parent différé', () => {
  test('rend l’e-mail nullable tout en conservant son unicité Prisma', () => {
    expect(schema).toMatch(/model User \{[\s\S]*?email\s+String\?\s+@unique/);
  });

  test('ajoute le téléphone normalisé et son index de recherche', () => {
    expect(schema).toMatch(/model User \{[\s\S]*?phoneNormalized\s+String\?/);
    expect(schema).toMatch(/model User \{[\s\S]*?@@index\(\[phoneNormalized\]\)/);
  });

  test('retire seulement le NOT NULL de l’e-mail et ne supprime pas son index unique', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toMatch(/ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL/);
    expect(migration).toMatch(/ADD COLUMN\s+"phoneNormalized" TEXT/);
    expect(migration).toMatch(/CREATE INDEX "users_phoneNormalized_idx"/);
    expect(migration).not.toMatch(/DROP\s+(?:INDEX|CONSTRAINT)\s+"?users_email_key/i);
    expect(migration).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(migration).not.toMatch(/^\s*(?:DELETE|TRUNCATE)\b/im);
  });

  test('exclut les foyers sans e-mail du nettoyage des activations abandonnées', () => {
    expect(pendingLifecycle).toMatch(/password: null,[\s\S]*?activatedAt: null,[\s\S]*?email: \{ not: null \}/);
  });
});
