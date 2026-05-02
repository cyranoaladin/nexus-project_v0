import {
  getGeneratedReportsDir,
  ensureGeneratedReportsDir,
  getGeneratedReportPdfPath,
  writeGeneratedReportPdf,
  readGeneratedReportPdf,
} from '@/lib/reports/stage/reportStorage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock logger to avoid noise in tests
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('reportStorage', () => {
  let originalEnv: string | undefined;
  let tempDir: string;

  beforeEach(async () => {
    originalEnv = process.env.GENERATED_REPORTS_DIR;
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-storage-test-'));
    process.env.GENERATED_REPORTS_DIR = tempDir;
  });

  afterEach(async () => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env.GENERATED_REPORTS_DIR;
    } else {
      process.env.GENERATED_REPORTS_DIR = originalEnv;
    }
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getGeneratedReportsDir', () => {
    it('uses GENERATED_REPORTS_DIR env var when defined', () => {
      const dir = getGeneratedReportsDir();
      expect(dir).toBe(tempDir);
    });

    it('falls back to private/generated-reports when env var is not defined', () => {
      delete process.env.GENERATED_REPORTS_DIR;
      const dir = getGeneratedReportsDir();
      expect(dir).toContain('private');
      expect(dir).toContain('generated-reports');
      // Verify exact ending to ensure proper fallback path
      expect(dir.endsWith(path.join('private', 'generated-reports'))).toBe(true);
    });

    it('does not use public/ directories (strict segment check)', () => {
      delete process.env.GENERATED_REPORTS_DIR;
      const dir = getGeneratedReportsDir();
      // Check that no path segment is exactly "public" (excludes "publication" etc.)
      const segments = dir.split(path.sep);
      expect(segments).not.toContain('public');
      // Negative test: a path like /home/publication/reports would pass the above
      // because "publication" !== "public", but we verify the actual fallback path
      expect(dir.endsWith(path.join('private', 'generated-reports'))).toBe(true);
    });

    it('rejects GENERATED_REPORTS_DIR pointing to public/ directory', () => {
      // Should reject paths containing a segment exactly equal to "public"
      const publicPaths = [
        path.join(process.cwd(), 'public', 'generated-reports'),
        path.join(process.cwd(), 'public'),
        '/var/www/public/reports',
        path.join(process.cwd(), 'my-public', '..', 'public', 'reports'), // resolves to .../public/reports
      ];

      for (const publicPath of publicPaths) {
        process.env.GENERATED_REPORTS_DIR = publicPath;
        expect(() => getGeneratedReportsDir()).toThrow('must not be inside public/');
      }
    });

    it('allows paths containing "public" as substring but not as segment', () => {
      // Paths like "publication", "my-public-stuff" should be allowed
      const allowedPaths = [
        path.join(process.cwd(), 'publication', 'reports'),
        path.join(process.cwd(), 'my-public-data', 'reports'),
        path.join(process.cwd(), 'notpublic', 'reports'),
      ];

      for (const allowedPath of allowedPaths) {
        process.env.GENERATED_REPORTS_DIR = allowedPath;
        // Should not throw
        expect(() => getGeneratedReportsDir()).not.toThrow();
        const result = getGeneratedReportsDir();
        expect(result).toBe(path.resolve(allowedPath));
      }
    });
  });

  describe('getGeneratedReportPdfPath', () => {
    it('returns path with studentId subdirectory when provided', () => {
      const pdfPath = getGeneratedReportPdfPath('report-123', 'student-456');
      expect(pdfPath).toContain('student-456');
      expect(pdfPath).toContain('report-123.pdf');
      expect(path.basename(pdfPath)).toBe('report-123.pdf');
    });

    it('returns flat path when studentId not provided', () => {
      const pdfPath = getGeneratedReportPdfPath('report-123');
      expect(pdfPath).not.toContain('student-');
      expect(pdfPath).toContain('report-123.pdf');
    });

    it('rejects path traversal in reportId', () => {
      expect(() => getGeneratedReportPdfPath('../etc/passwd')).toThrow('path traversal');
      expect(() => getGeneratedReportPdfPath('report-123/../other')).toThrow('path traversal');
    });

    it('rejects path traversal in studentId', () => {
      expect(() => getGeneratedReportPdfPath('report-123', '../other')).toThrow('path traversal');
      expect(() => getGeneratedReportPdfPath('report-123', 'student-123/../../other')).toThrow('path traversal');
    });

    it('rejects invalid characters in reportId', () => {
      expect(() => getGeneratedReportPdfPath('report with spaces')).toThrow('forbidden characters');
      expect(() => getGeneratedReportPdfPath('report%20encoded')).toThrow('forbidden characters');
    });
  });

  describe('writeGeneratedReportPdf', () => {
    it('writes PDF to durable storage', async () => {
      const reportId = 'report-abc-123';
      const studentId = 'student-xyz-456';
      const pdfBuffer = Buffer.from('mock pdf content');

      const result = await writeGeneratedReportPdf({
        reportId,
        studentId,
        pdfBuffer,
      });

      expect(result.filePath).toContain('student-xyz-456');
      expect(result.filePath).toContain('report-abc-123.pdf');

      // Verify file exists
      const content = await fs.readFile(result.filePath);
      expect(content.toString()).toBe('mock pdf content');
    });

    it('creates parent directories if needed', async () => {
      const reportId = 'report-123';
      const studentId = 'new-student-456';
      const pdfBuffer = Buffer.from('pdf content');

      // Ensure directory does not exist yet
      const studentDir = path.join(tempDir, studentId);
      await expect(fs.access(studentDir)).rejects.toThrow();

      await writeGeneratedReportPdf({
        reportId,
        studentId,
        pdfBuffer,
      });

      // Directory should now exist
      const stat = await fs.stat(studentDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('throws on invalid reportId', async () => {
      const pdfBuffer = Buffer.from('pdf content');
      await expect(
        writeGeneratedReportPdf({
          reportId: '../invalid',
          pdfBuffer,
        })
      ).rejects.toThrow('path traversal');
    });
  });

  describe('readGeneratedReportPdf', () => {
    it('reads previously written PDF', async () => {
      const reportId = 'report-to-read';
      const studentId = 'student-789';
      const pdfBuffer = Buffer.from('readable pdf content');

      await writeGeneratedReportPdf({
        reportId,
        studentId,
        pdfBuffer,
      });

      const readBuffer = await readGeneratedReportPdf({
        reportId,
        studentId,
      });

      expect(readBuffer.toString()).toBe('readable pdf content');
    });

    it('throws when PDF does not exist', async () => {
      await expect(
        readGeneratedReportPdf({
          reportId: 'non-existent-report',
          studentId: 'non-existent-student',
        })
      ).rejects.toThrow('PDF not found');
    });

    it('throws on path traversal attempt', async () => {
      await expect(
        readGeneratedReportPdf({
          reportId: '../etc/passwd',
        })
      ).rejects.toThrow('path traversal');
    });
  });

  describe('ensureGeneratedReportsDir', () => {
    it('creates directory if it does not exist', async () => {
      const newTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ensure-test-'));
      process.env.GENERATED_REPORTS_DIR = path.join(newTempDir, 'nested', 'reports');

      await ensureGeneratedReportsDir();

      const stat = await fs.stat(process.env.GENERATED_REPORTS_DIR);
      expect(stat.isDirectory()).toBe(true);

      // Cleanup
      await fs.rm(newTempDir, { recursive: true, force: true });
    });
  });
});
