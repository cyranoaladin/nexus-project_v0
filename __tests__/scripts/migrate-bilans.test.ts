/**
 * F51: migrate-bilans.ts minimal test coverage
 * Tests CLI parsing and dry-run mode without database
 */

import { execFileSync } from 'child_process';
import * as fs from 'node:fs';
import { resolve } from 'path';

describe('F51: migrate-bilans.ts', () => {
  const scriptPath = resolve(process.cwd(), 'scripts/migrate-bilans.ts');

  describe('Script file exists and is parseable', () => {
    it('should exist at scripts/migrate-bilans.ts', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it('should be syntactically valid TypeScript', () => {
      // Type-check the file without executing
      try {
        execFileSync(process.execPath, [resolve(process.cwd(), 'node_modules/typescript/bin/tsc'), '--noEmit', '--skipLibCheck', scriptPath], {
          cwd: process.cwd(),
          stdio: 'pipe',
          encoding: 'utf-8',
          timeout: 30000,
        });
        expect(true).toBe(true);
      } catch (error) {
        // No compiler failure is silently accepted. Prisma generation is a
        // prerequisite of this suite, just as it is in CI.
        if (typeof error === 'object' && error !== null && 'stdout' in error && 'stderr' in error) {
          throw new Error(`TypeScript error: ${String(error.stdout || error.stderr || '')}`);
        }
        throw error;
      }
    });
  });

  describe('CLI option parsing', () => {
    it('should parse --dry-run flag', () => {
      // Verify the script contains dry-run handling
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('--dry-run');
      expect(content).toContain('dryRun');
    });

    it('should parse --execute flag', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('--execute');
    });

    it('should parse --source= filter', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('--source=');
      expect(content).toMatch(/source.*Diagnostic.*Assessment.*StageBilan/);
    });

    it('should parse --batch= parameter', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('--batch=');
      expect(content).toContain('batchSize');
    });

    it('should have dry-run as default mode', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      // Check that dryRun defaults to true when not explicitly executing
      expect(content).toMatch(/dryRun.*true|dryRun:.*args\.includes.*--execute/);
    });
  });

  describe('Migration functions structure', () => {
    it('should have migrateDiagnostic function', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toMatch(/async function migrateDiagnostic|function migrateDiagnostic/);
    });

    it('should have migrateAssessment function', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toMatch(/async function migrateAssessment|function migrateAssessment/);
    });

    it('should have migrateStageBilan function', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toMatch(/async function migrateStageBilan|function migrateStageBilan/);
    });

    it('should have MigrationResult type structure', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('MigrationResult');
      expect(content).toContain('source:');
      expect(content).toContain('sourceId:');
      expect(content).toContain('bilanId:');
      expect(content).toContain('success:');
    });

    it('should have MigrationReport structure', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('MigrationReport');
      expect(content).toContain('total:');
      expect(content).toContain('succeeded:');
      expect(content).toContain('failed:');
    });
  });

  describe('Status mapping', () => {
    it('should map Diagnostic status to BilanStatus', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('RECEIVED');
      expect(content).toContain('PENDING');
      expect(content).toContain('SCORING');
      expect(content).toContain('GENERATING');
      expect(content).toContain('COMPLETED');
    });

    it('should map Assessment status to BilanStatus', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('PENDING');
      expect(content).toContain('SCORING');
      expect(content).toContain('GENERATING');
      expect(content).toContain('COMPLETED');
      expect(content).toContain('FAILED');
    });
  });

  describe('Non-destructive design', () => {
    it('should not delete source data', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      // Ensure no DELETE operations on source tables
      expect(content).not.toMatch(/delete.*diagnostic|delete.*assessment|delete.*stageBilan/i);
      expect(content).not.toMatch(/DROP TABLE/i);
    });

    it('should use legacy IDs for deduplication', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('legacyDiagnosticId');
      expect(content).toContain('legacyAssessmentId');
      expect(content).toContain('legacyStageBilanId');
    });

    it('should check for existing migrated records', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toMatch(/already migrated|existing/i);
    });
  });
});
