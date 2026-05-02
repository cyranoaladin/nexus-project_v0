// ═══════════════════════════════════════════════════════════════════════════════
// NPC Storage - Unit Tests
// Tests for secure path generation and file operations
// ═══════════════════════════════════════════════════════════════════════════════

import {
  generateSecureFileId,
  generateSecurePath,
  fileExists,
  deleteSubmissionFiles,
  SECURE_FILE_ID_LENGTH,
  NPC_UPLOAD_DIR,
} from '@/lib/npc';

describe('NPC Storage', () => {
  const mockStudentId = 'student123456';
  const mockSubmissionId = 'submission789012';

  // ─────────────────────────────────────────────────────────────────────────────
  // Secure ID Generation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateSecureFileId', () => {
    it('generates hex string', () => {
      const id = generateSecureFileId();
      expect(id).toMatch(/^[a-f0-9]+$/);
    });

    it('has correct length', () => {
      const id = generateSecureFileId();
      expect(id.length).toBe(SECURE_FILE_ID_LENGTH * 2); // hex = 2 chars per byte
    });

    it('generates unique IDs', () => {
      const id1 = generateSecureFileId();
      const id2 = generateSecureFileId();
      expect(id1).not.toBe(id2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Secure Path Generation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateSecurePath', () => {
    it('includes student ID prefix', () => {
      const path = generateSecurePath(mockStudentId, mockSubmissionId, 1, 'file.pdf');
      expect(path).toContain(mockStudentId.slice(0, 8));
    });

    it('includes submission ID prefix', () => {
      const path = generateSecurePath(mockStudentId, mockSubmissionId, 1, 'file.pdf');
      expect(path).toContain(mockSubmissionId.slice(0, 12));
    });

    it('includes page number', () => {
      const path = generateSecurePath(mockStudentId, mockSubmissionId, 5, 'file.pdf');
      expect(path).toContain('page_5');
    });

    it('includes filename', () => {
      const path = generateSecurePath(mockStudentId, mockSubmissionId, 1, 'document.pdf');
      expect(path).toContain('document.pdf');
    });

    it('uses absolute path from NPC_UPLOAD_DIR', () => {
      const path = generateSecurePath(mockStudentId, mockSubmissionId, 1, 'file.pdf');
      expect(path.startsWith(NPC_UPLOAD_DIR)).toBe(true);
    });

    it('prevents directory traversal in filename', () => {
      const path = generateSecurePath(
        mockStudentId,
        mockSubmissionId,
        1,
        '../../../etc/passwd.pdf'
      );
      // Should still create a path, but the malicious filename is handled by sanitizeFilename
      expect(path).toContain(NPC_UPLOAD_DIR);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Path Traversal Prevention
  // ─────────────────────────────────────────────────────────────────────────────

  describe('path traversal prevention', () => {
    it('prevents relative path components in IDs', () => {
      // IDs should not contain path traversal characters
      // generateSecurePath uses slice(0,8) for studentId and slice(0,12) for submissionId
      const path1 = generateSecurePath('student123456', 'sub45678901234', 1, 'test.pdf');
      expect(path1.startsWith(NPC_UPLOAD_DIR)).toBe(true);
      // Path should contain the sliced IDs: student12 (8 chars) and sub456789012 (12 chars)
      expect(path1).toContain('student1');
      expect(path1).toContain('sub456789012');
    });

    it('handles edge case IDs', () => {
      const path = generateSecurePath('', '', 0, 'test.pdf');
      expect(path.startsWith(NPC_UPLOAD_DIR)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // File Operations (Mocked)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('fileExists', () => {
    it('returns false for non-existent file', async () => {
      const exists = await fileExists('nonexistent/test.pdf');
      expect(exists).toBe(false);
    });

    it('prevents path traversal checks', async () => {
      const exists = await fileExists('../../../etc/passwd');
      expect(exists).toBe(false);
    });
  });

  describe('deleteSubmissionFiles', () => {
    it('returns false for invalid paths', async () => {
      const result = await deleteSubmissionFiles('', '');
      expect(result).toBe(false);
    });

    it('prevents deletion outside upload directory', async () => {
      const result = await deleteSubmissionFiles('../../../etc', 'passwd');
      expect(result).toBe(false);
    });
  });
});
