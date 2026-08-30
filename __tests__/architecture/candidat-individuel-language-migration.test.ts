import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  process.cwd(),
  'prisma/migrations/20260830150000_add_lva_lvb_languages/migration.sql',
);

test('la migration ajoute exactement quatre langues de facon additive et rejouable', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const additions = [...sql.matchAll(/ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS '([A-Z_]+)'/g)]
    .map((match) => match[1]);
  const allSubjectAdditions = sql.match(/ALTER TYPE "Subject" ADD VALUE/gi) ?? [];
  const executableSql = sql
    .replace(/^\s*--.*$/gm, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  expect(additions).toEqual(['ARABE', 'ITALIEN', 'RUSSE', 'ALLEMAND']);
  expect(allSubjectAdditions).toHaveLength(4);
  expect(executableSql).toEqual([
    'ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS \'ARABE\';',
    'ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS \'ITALIEN\';',
    'ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS \'RUSSE\';',
    'ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS \'ALLEMAND\';',
  ]);
  expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i);
  expect(sql).not.toMatch(/ALTER\s+TABLE/i);
});
