// ═══════════════════════════════════════════════════════════════════════════════
// NPC File Validator - Unit Tests
// Tests for filename sanitization, MIME validation, size checks
// ═══════════════════════════════════════════════════════════════════════════════

import {
  sanitizeFilename,
  validateFilename,
  validateMimeType,
  validateFileSize,
  validatePageCount,
  validateUploadedFile,
  FILE_VALIDATION_ERRORS,
  NPC_MAX_FILE_SIZE_BYTES,
  NPC_MAX_PAGES_PER_SUBMISSION,
} from '@/lib/npc';

describe('NPC File Validator', () => {
  const mockSecureId = 'a'.repeat(32);

  // ─────────────────────────────────────────────────────────────────────────────
  // Filename Sanitization
  // ─────────────────────────────────────────────────────────────────────────────

  describe('sanitizeFilename', () => {
    it('removes forbidden characters', () => {
      const result = sanitizeFilename('test<file>.pdf', mockSecureId);
      expect(result).toBe('testfile_aaaaaaaa.pdf');
    });

    it('replaces spaces with underscores', () => {
      const result = sanitizeFilename('my document.pdf', mockSecureId);
      expect(result).toBe('my_document_aaaaaaaa.pdf');
    });

    it('limits base name length to 50 chars', () => {
      const longName = 'a'.repeat(100) + '.pdf';
      const result = sanitizeFilename(longName, mockSecureId);
      expect(result.length).toBeLessThanOrEqual(50 + 1 + 8 + 1 + 3); // base + _ + suffix + . + ext
    });

    it('adds unique suffix from secureId', () => {
      const result = sanitizeFilename('document.pdf', mockSecureId);
      expect(result).toContain('aaaaaaaa'); // first 8 chars of secureId
    });

    it('preserves file extension', () => {
      const result = sanitizeFilename('test.PDF', mockSecureId);
      expect(result).toMatch(/\.pdf$/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Filename Validation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('validateFilename', () => {
    it('accepts valid PDF filename', () => {
      const result = validateFilename('test.pdf', mockSecureId);
      expect(result.valid).toBe(true);
      expect(result.detectedExt).toBe('pdf');
    });

    it('accepts valid image filenames', () => {
      expect(validateFilename('test.jpg', mockSecureId).valid).toBe(true);
      expect(validateFilename('test.jpeg', mockSecureId).valid).toBe(true);
      expect(validateFilename('test.png', mockSecureId).valid).toBe(true);
      expect(validateFilename('test.webp', mockSecureId).valid).toBe(true);
    });

    it('rejects empty filename', () => {
      const result = validateFilename('', mockSecureId);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('FILENAME_EMPTY');
    });

    it('rejects path traversal attempts', () => {
      const result = validateFilename('../../../etc/passwd.pdf', mockSecureId);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('PATH_TRAVERSAL_DETECTED');
    });

    it('rejects double extension attacks', () => {
      const result = validateFilename('document.pdf.exe', mockSecureId);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SUSPICIOUS_DOUBLE_EXTENSION');
    });

    it('rejects missing extension', () => {
      const result = validateFilename('nofileextension', mockSecureId);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NO_FILE_EXTENSION');
    });

    it('rejects disallowed extensions', () => {
      const result = validateFilename('virus.exe', mockSecureId);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EXTENSION_NOT_ALLOWED');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // MIME Type Validation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('validateMimeType', () => {
    it('accepts valid MIME types', () => {
      expect(validateMimeType('application/pdf').valid).toBe(true);
      expect(validateMimeType('image/jpeg').valid).toBe(true);
      expect(validateMimeType('image/png').valid).toBe(true);
      expect(validateMimeType('image/webp').valid).toBe(true);
    });

    it('rejects invalid MIME types', () => {
      const result = validateMimeType('application/javascript');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('MIME_TYPE_NOT_ALLOWED');
    });

    it('validates MIME/extension match', () => {
      const result = validateMimeType('application/pdf', 'pdf');
      expect(result.valid).toBe(true);
    });

    it('rejects MIME/extension mismatch', () => {
      const result = validateMimeType('image/jpeg', 'png');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('MIME_EXTENSION_MISMATCH');
    });

    it('accepts jpg/jpeg variation', () => {
      const result = validateMimeType('image/jpeg', 'jpg');
      expect(result.valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // File Size Validation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('validateFileSize', () => {
    it('accepts valid file size', () => {
      const result = validateFileSize(1024 * 1024); // 1MB
      expect(result.valid).toBe(true);
    });

    it('accepts max file size', () => {
      const result = validateFileSize(NPC_MAX_FILE_SIZE_BYTES);
      expect(result.valid).toBe(true);
    });

    it('rejects empty file', () => {
      const result = validateFileSize(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('FILE_EMPTY');
    });

    it('rejects oversized file', () => {
      const result = validateFileSize(NPC_MAX_FILE_SIZE_BYTES + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('FILE_TOO_LARGE');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Page Count Validation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('validatePageCount', () => {
    it('accepts valid page count', () => {
      const result = validatePageCount(5);
      expect(result.valid).toBe(true);
      expect(result.pageCount).toBe(5);
    });

    it('accepts max pages', () => {
      const result = validatePageCount(NPC_MAX_PAGES_PER_SUBMISSION);
      expect(result.valid).toBe(true);
    });

    it('rejects zero pages', () => {
      const result = validatePageCount(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NO_PAGES_DETECTED');
    });

    it('rejects negative pages', () => {
      const result = validatePageCount(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NO_PAGES_DETECTED');
    });

    it('rejects too many pages', () => {
      const result = validatePageCount(NPC_MAX_PAGES_PER_SUBMISSION + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('TOO_MANY_PAGES');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Complete Validation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('validateUploadedFile', () => {
    it('accepts valid complete file', () => {
      const result = validateUploadedFile({
        filename: 'homework.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        secureId: mockSecureId,
      });
      expect(result.valid).toBe(true);
      expect(result.sanitizedName).toBeDefined();
    });

    it('rejects on any validation failure', () => {
      const result = validateUploadedFile({
        filename: 'virus.exe',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        secureId: mockSecureId,
      });
      expect(result.valid).toBe(false);
    });

    it('returns first error encountered', () => {
      // Filename error takes precedence over MIME
      const result = validateUploadedFile({
        filename: '../../../etc/passwd.pdf',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        secureId: mockSecureId,
      });
      expect(result.error).toBe('PATH_TRAVERSAL_DETECTED');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Error Messages
  // ─────────────────────────────────────────────────────────────────────────────

  describe('FILE_VALIDATION_ERRORS', () => {
    it('contains all error codes', () => {
      const requiredErrors = [
        'FILENAME_EMPTY',
        'PATH_TRAVERSAL_DETECTED',
        'SUSPICIOUS_DOUBLE_EXTENSION',
        'NO_FILE_EXTENSION',
        'EXTENSION_NOT_ALLOWED',
        'MIME_TYPE_NOT_ALLOWED',
        'MIME_EXTENSION_MISMATCH',
        'FILE_EMPTY',
        'FILE_TOO_LARGE',
        'NO_PAGES_DETECTED',
        'TOO_MANY_PAGES',
      ];

      requiredErrors.forEach((code) => {
        expect(FILE_VALIDATION_ERRORS[code]).toBeDefined();
        expect(FILE_VALIDATION_ERRORS[code].length).toBeGreaterThan(0);
      });
    });
  });
});
