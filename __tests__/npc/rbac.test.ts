// ═══════════════════════════════════════════════════════════════════════════════
// NPC RBAC - Unit Tests
// Tests for role-based access control on NPC resources
// ═══════════════════════════════════════════════════════════════════════════════

import { can, Resource, Action } from '@/lib/rbac';
import { UserRole } from '@prisma/client';

describe('NPC RBAC Permissions', () => {
  const npcResources: Resource[] = [
    'COPY_SUBMISSION',
    'PEDAGOGICAL_REPORT',
    'AI_PROCESSING_JOB',
    'REMEDIATION_ROADMAP',
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN Permissions
  // ─────────────────────────────────────────────────────────────────────────────

  describe('ADMIN', () => {
    it('has MANAGE on all NPC resources', () => {
      npcResources.forEach((resource) => {
        expect(can(UserRole.ADMIN, 'MANAGE', resource)).toBe(true);
        expect(can(UserRole.ADMIN, 'CREATE', resource)).toBe(true);
        expect(can(UserRole.ADMIN, 'READ', resource)).toBe(true);
        expect(can(UserRole.ADMIN, 'UPDATE', resource)).toBe(true);
        expect(can(UserRole.ADMIN, 'DELETE', resource)).toBe(true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COACH Permissions
  // ─────────────────────────────────────────────────────────────────────────────

  describe('COACH', () => {
    it('can READ and CREATE COPY_SUBMISSION', () => {
      expect(can(UserRole.COACH, 'READ', 'COPY_SUBMISSION')).toBe(true);
      expect(can(UserRole.COACH, 'CREATE', 'COPY_SUBMISSION')).toBe(true);
    });

    it('cannot DELETE COPY_SUBMISSION', () => {
      expect(can(UserRole.COACH, 'DELETE', 'COPY_SUBMISSION')).toBe(false);
    });

    it('can manage PEDAGOGICAL_REPORT', () => {
      expect(can(UserRole.COACH, 'READ', 'PEDAGOGICAL_REPORT')).toBe(true);
      expect(can(UserRole.COACH, 'CREATE', 'PEDAGOGICAL_REPORT')).toBe(true);
      expect(can(UserRole.COACH, 'UPDATE', 'PEDAGOGICAL_REPORT')).toBe(true);
      expect(can(UserRole.COACH, 'VALIDATE', 'PEDAGOGICAL_REPORT')).toBe(true);
    });

    it('can manage REMEDIATION_ROADMAP', () => {
      expect(can(UserRole.COACH, 'READ', 'REMEDIATION_ROADMAP')).toBe(true);
      expect(can(UserRole.COACH, 'CREATE', 'REMEDIATION_ROADMAP')).toBe(true);
    });

    it('cannot access AI_PROCESSING_JOB', () => {
      expect(can(UserRole.COACH, 'READ', 'AI_PROCESSING_JOB')).toBe(false);
      expect(can(UserRole.COACH, 'CREATE', 'AI_PROCESSING_JOB')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ELEVE Permissions
  // ─────────────────────────────────────────────────────────────────────────────

  describe('ELEVE', () => {
    it('can READ_SELF COPY_SUBMISSION', () => {
      expect(can(UserRole.ELEVE, 'READ_SELF', 'COPY_SUBMISSION')).toBe(true);
      // READ_SELF satisfies READ check
      expect(can(UserRole.ELEVE, 'READ', 'COPY_SUBMISSION')).toBe(true);
    });

    it('cannot CREATE COPY_SUBMISSION', () => {
      expect(can(UserRole.ELEVE, 'CREATE', 'COPY_SUBMISSION')).toBe(false);
    });

    it('can READ_SELF PEDAGOGICAL_REPORT', () => {
      expect(can(UserRole.ELEVE, 'READ_SELF', 'PEDAGOGICAL_REPORT')).toBe(true);
      expect(can(UserRole.ELEVE, 'READ', 'PEDAGOGICAL_REPORT')).toBe(true);
    });

    it('can READ_SELF REMEDIATION_ROADMAP', () => {
      expect(can(UserRole.ELEVE, 'READ_SELF', 'REMEDIATION_ROADMAP')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PARENT Permissions
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PARENT', () => {
    it('can READ_OWN COPY_SUBMISSION', () => {
      expect(can(UserRole.PARENT, 'READ_OWN', 'COPY_SUBMISSION')).toBe(true);
      // READ_OWN satisfies READ check
      expect(can(UserRole.PARENT, 'READ', 'COPY_SUBMISSION')).toBe(true);
    });

    it('can READ_OWN PEDAGOGICAL_REPORT', () => {
      expect(can(UserRole.PARENT, 'READ_OWN', 'PEDAGOGICAL_REPORT')).toBe(true);
    });

    it('cannot CREATE PEDAGOGICAL_REPORT', () => {
      expect(can(UserRole.PARENT, 'CREATE', 'PEDAGOGICAL_REPORT')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ASSISTANTE Permissions
  // ─────────────────────────────────────────────────────────────────────────────

  describe('ASSISTANTE', () => {
    it('can READ all NPC resources', () => {
      expect(can(UserRole.ASSISTANTE, 'READ', 'COPY_SUBMISSION')).toBe(true);
      expect(can(UserRole.ASSISTANTE, 'READ', 'PEDAGOGICAL_REPORT')).toBe(true);
    });

    it('cannot CREATE NPC resources', () => {
      expect(can(UserRole.ASSISTANTE, 'CREATE', 'COPY_SUBMISSION')).toBe(false);
      expect(can(UserRole.ASSISTANTE, 'CREATE', 'PEDAGOGICAL_REPORT')).toBe(false);
    });

    it('cannot manage AI_PROCESSING_JOB', () => {
      expect(can(UserRole.ASSISTANTE, 'READ', 'AI_PROCESSING_JOB')).toBe(false);
    });
  });
});
