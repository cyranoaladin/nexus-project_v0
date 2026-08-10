import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260810130000_add_parent_merge_tombstone/migration.sql',
);
const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');

describe('parent account merge tombstone migration', () => {
  it('adds the self-reference and audit timestamp without destructive statements', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(/ADD COLUMN\s+"mergedIntoUserId" TEXT/);
    expect(migration).toMatch(/ADD COLUMN\s+"mergedAt" TIMESTAMP\(3\)/);
    expect(migration).toMatch(/FOREIGN KEY \("mergedIntoUserId"\)[\s\S]*REFERENCES "users"\("id"\)/);
    expect(migration).toMatch(/CREATE INDEX "users_mergedIntoUserId_idx"/);
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|TRUNCATE)\b/im);
  });

  it('models a source-to-target merge while retaining both users', () => {
    expect(schema).toMatch(/mergedIntoUserId\s+String\?/);
    expect(schema).toMatch(/mergedAt\s+DateTime\?/);
    expect(schema).toMatch(/mergedInto\s+User\?\s+@relation\("UserAccountMerges"/);
    expect(schema).toMatch(/mergedSources\s+User\[\]\s+@relation\("UserAccountMerges"\)/);
    expect(schema).toMatch(/@@index\(\[mergedIntoUserId\]\)/);
  });
});
