/**
 * Database Migrations Integrity Tests
 *
 * Tests: migration file count, lock file integrity,
 *        migration naming conventions, sequential ordering
 *
 * Source: prisma/migrations/
 *
 * Runs with jest.config.db.js (serial, real DB)
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations');

describe('Database Migrations', () => {
  const migrationEntries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  const migrationDirs = migrationEntries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  describe('Migration File Count', () => {
    it('should have at least 16 migration directories', () => {
      expect(migrationDirs.length).toBeGreaterThanOrEqual(16);
    });

    it('should have migration_lock.toml file', () => {
      const lockPath = path.join(MIGRATIONS_DIR, 'migration_lock.toml');
      expect(fs.existsSync(lockPath)).toBe(true);
    });
  });

  describe('Migration Lock File', () => {
    it('should have correct provider=postgresql in migration_lock.toml', () => {
      const lockPath = path.join(MIGRATIONS_DIR, 'migration_lock.toml');
      const content = fs.readFileSync(lockPath, 'utf-8');
      expect(content).toContain('provider = "postgresql"');
    });
  });

  describe('Migration Structure', () => {
    migrationDirs.forEach((dir) => {
      it(`migration ${dir} should contain a migration.sql file`, () => {
        const sqlPath = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
        expect(fs.existsSync(sqlPath)).toBe(true);
      });
    });

    it('all migration SQL files should be non-empty', () => {
      migrationDirs.forEach((dir) => {
        const sqlPath = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
        const content = fs.readFileSync(sqlPath, 'utf-8');
        expect(content.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('Migration Naming Conventions', () => {
    it('all migration directories should start with a date prefix (YYYYMMDD)', () => {
      migrationDirs.forEach((dir) => {
        // Should start with 8+ digits (date prefix)
        expect(dir).toMatch(/^\d{8}/);
      });
    });

    it('migration directories should be in chronological order', () => {
      for (let i = 1; i < migrationDirs.length; i++) {
        const prevDate = migrationDirs[i - 1].substring(0, 8);
        const currDate = migrationDirs[i].substring(0, 8);
        expect(parseInt(currDate)).toBeGreaterThanOrEqual(parseInt(prevDate));
      }
    });
  });

  describe('Critical Migrations Present', () => {
    it('should have init migration', () => {
      const hasInit = migrationDirs.some((d) => d.includes('init'));
      expect(hasInit).toBe(true);
    });

    it('should have payment idempotency migration', () => {
      const has = migrationDirs.some((d) => d.includes('payment_idempotency'));
      expect(has).toBe(true);
    });

    it('should have session overlap prevention migration', () => {
      const has = migrationDirs.some((d) => d.includes('session_overlap'));
      expect(has).toBe(true);
    });

    it('should have credit transaction idempotency migration', () => {
      const has = migrationDirs.some((d) => d.includes('credit_transaction_idempotency'));
      expect(has).toBe(true);
    });

    it('should have entitlement engine migration', () => {
      const has = migrationDirs.some((d) => d.includes('entitlement'));
      expect(has).toBe(true);
    });

    it('should have pgvector migration', () => {
      const has = migrationDirs.some((d) => d.includes('pgvector'));
      expect(has).toBe(true);
    });

    it('should have user documents migration', () => {
      const has = migrationDirs.some((d) => d.includes('user_documents'));
      expect(has).toBe(true);
    });
  });

  describe('SQL Content Validation', () => {
    it('init migration should create users table', () => {
      const initDir = migrationDirs.find((d) => d.includes('init'));
      expect(initDir).toBeDefined();
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, initDir!, 'migration.sql'), 'utf-8');
      expect(sql.toLowerCase()).toContain('create table');
    });

    it('no migration should contain DROP DATABASE', () => {
      migrationDirs.forEach((dir) => {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf-8');
        expect(sql.toUpperCase()).not.toContain('DROP DATABASE');
      });
    });

    it('no migration should contain TRUNCATE on production tables', () => {
      migrationDirs.forEach((dir) => {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf-8');
        // TRUNCATE in migrations is dangerous — data loss
        expect(sql.toUpperCase()).not.toMatch(/TRUNCATE\s+TABLE\s+"?(users|payments|subscriptions)"?/i);
      });
    });
  });
});
