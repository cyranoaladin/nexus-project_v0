/**
 * Tests dédiés au builder Hub Ressources Pédagogiques (Lot B).
 *
 * Couverture :
 *  - Profils EDS Première / STMG Première / Terminale EDS
 *  - Catégories OFFICIAL_PROGRAM, OFFICIAL_AUTOMATISMES, OFFICIAL_SUJET,
 *    COACH_RESOURCE, USER_DOCUMENT, INVOICE, RECEIPT, STAGE_BILAN
 *  - RAG_REFERENCE (toujours [] en Lot B — TODO post-Lot)
 *  - totalCount + recentlyAddedCount (< 7 jours)
 *  - Empty state
 *  - Cas où le coach est aussi l'élève (auto-upload) → reste USER_DOCUMENT
 */

import { buildHub } from '@/lib/dashboard/student-payload';
import { UserRole } from '@prisma/client';
import type { EleveStageItem } from '@/components/dashboard/eleve/types';

const STUDENT_USER_ID = 'user-eleve-1';

const stageItem = (overrides: Partial<EleveStageItem> = {}): EleveStageItem => ({
  stageId: 'stage-1',
  stageSlug: 'printemps-2026',
  title: 'Stage Printemps 2026',
  startDate: '2026-04-15T08:00:00.000Z',
  endDate: '2026-04-19T17:00:00.000Z',
  location: 'Tunis',
  reservationId: 'res-1',
  reservationStatus: 'COMPLETED',
  hasBilan: true,
  bilanUrl: '/bilan-pallier2-maths/resultat/share-1',
  ...overrides,
});

const userDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  title: 'Cours Maths',
  originalName: 'cours.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 51200,
  createdAt: new Date('2026-04-20T10:00:00.000Z'),
  documentType: 'COURS',
  visibilityScope: 'STUDENT_ONLY',
  subject: null,
  description: null,
  uploadedById: STUDENT_USER_ID, // self-upload by default
  uploadedBy: null,
  ...overrides,
});

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  number: '202604-0001',
  status: 'PAID',
  issuedAt: new Date('2026-04-01T00:00:00.000Z'),
  paidAt: new Date('2026-04-02T00:00:00.000Z'),
  total: 500_000,
  currency: 'TND',
  pdfUrl: 'https://example.com/inv-1.pdf',
  ...overrides,
});

describe('buildHub — Lot B', () => {
  describe('empty case', () => {
    it('returns the canonical empty Hub for an EDS Première student with nothing', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [],
      });

      // OFFICIAL_* contains the 6 EDS Première Maths PDFs from the static mapping.
      expect(hub.byCategory.OFFICIAL_PROGRAM.length).toBe(1);
      expect(hub.byCategory.OFFICIAL_AUTOMATISMES.length).toBe(1);
      // SUJET bucket merges PROGRAM=SUJET (2 sujets + 1 declic) + EXEMPLE (1 QCM) = 4.
      expect(hub.byCategory.OFFICIAL_SUJET.length).toBe(4);

      expect(hub.byCategory.COACH_RESOURCE).toEqual([]);
      expect(hub.byCategory.USER_DOCUMENT).toEqual([]);
      expect(hub.byCategory.RAG_REFERENCE).toEqual([]);
      expect(hub.byCategory.INVOICE).toEqual([]);
      expect(hub.byCategory.RECEIPT).toEqual([]);
      expect(hub.byCategory.STAGE_BILAN).toEqual([]);

      expect(hub.totalCount).toBe(6); // 6 PDFs
    });

    it('returns no OFFICIAL entries for STMG Première (until STMG MEN PDFs are added)', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'STMG',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.OFFICIAL_PROGRAM).toEqual([]);
      expect(hub.byCategory.OFFICIAL_AUTOMATISMES).toEqual([]);
      expect(hub.byCategory.OFFICIAL_SUJET).toEqual([]);
      expect(hub.totalCount).toBe(0);
    });

    it('returns no OFFICIAL entries for Terminale EDS (until Terminale PDFs are added)', () => {
      const hub = buildHub({
        level: 'TERMINALE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.OFFICIAL_PROGRAM).toEqual([]);
      expect(hub.byCategory.OFFICIAL_AUTOMATISMES).toEqual([]);
      expect(hub.totalCount).toBe(0);
    });
  });

  describe('OFFICIAL_AUTOMATISMES gating', () => {
    it('EDS Première has the EAM annexe', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [],
      });
      const auto = hub.byCategory.OFFICIAL_AUTOMATISMES;
      expect(auto.length).toBe(1);
      expect(auto[0].title).toMatch(/Annexe automatismes/i);
      expect(auto[0].downloadUrl).toBe(
        '/api/student/resources/official/bo-annexe-automatismes-eam-2025-2026-session-2027',
      );
      expect(auto[0].badge).toBe('OFFICIEL');
      expect(auto[0].type).toBe('PDF');
    });

    it('STMG Première has NO automatismes EDS (cross-track guard)', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'STMG',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.OFFICIAL_AUTOMATISMES).toEqual([]);
    });

    it('STMG_NON_LYCEEN Première has NO automatismes EDS', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'STMG_NON_LYCEEN',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.OFFICIAL_AUTOMATISMES).toEqual([]);
    });

    it('Terminale EDS has NO automatismes (Terminale has no EAM)', () => {
      const hub = buildHub({
        level: 'TERMINALE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.OFFICIAL_AUTOMATISMES).toEqual([]);
    });
  });

  describe('user documents — COACH_RESOURCE vs USER_DOCUMENT classification', () => {
    it('uploaded by COACH (different user) → COACH_RESOURCE with uploaderName + COACH badge', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [
          userDoc({
            id: 'doc-coach-1',
            title: 'Fiche révision personnalisée',
            uploadedById: 'coach-helios',
            uploadedBy: {
              id: 'coach-helios',
              role: UserRole.COACH,
              firstName: 'Helios',
              lastName: 'Akpevon',
            },
          }),
        ],
        invoices: [],
        stageItems: [],
      });
      const coachRes = hub.byCategory.COACH_RESOURCE;
      expect(coachRes.length).toBe(1);
      expect(coachRes[0].title).toBe('Fiche révision personnalisée');
      expect(coachRes[0].uploaderRole).toBe(UserRole.COACH);
      expect(coachRes[0].uploaderName).toBe('Helios Akpevon');
      expect(coachRes[0].badge).toBe('COACH');
      expect(coachRes[0].downloadUrl).toBe('/api/student/documents/doc-coach-1/download');
      // No leak into USER_DOCUMENT
      expect(hub.byCategory.USER_DOCUMENT).toEqual([]);
    });

    it('uploaded by self → USER_DOCUMENT, not COACH_RESOURCE', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [
          userDoc({
            id: 'doc-self',
            title: 'Mon brouillon',
            uploadedById: STUDENT_USER_ID,
            uploadedBy: {
              id: STUDENT_USER_ID,
              role: UserRole.ELEVE,
              firstName: 'Self',
              lastName: null,
            },
          }),
        ],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.COACH_RESOURCE).toEqual([]);
      expect(hub.byCategory.USER_DOCUMENT.length).toBe(1);
      expect(hub.byCategory.USER_DOCUMENT[0].uploaderName).toBeUndefined();
    });

    it('uploaded by ADMIN → USER_DOCUMENT (admin not flagged as coach)', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [
          userDoc({
            id: 'doc-admin',
            title: 'Convention',
            uploadedById: 'admin-1',
            uploadedBy: {
              id: 'admin-1',
              role: UserRole.ADMIN,
              firstName: 'Admin',
              lastName: 'Nexus',
            },
          }),
        ],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.COACH_RESOURCE).toEqual([]);
      expect(hub.byCategory.USER_DOCUMENT.length).toBe(1);
    });

    it('uploaded by COACH but uploadedById === studentUserId is treated as self (no impersonation leak)', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [
          userDoc({
            id: 'doc-edge',
            uploadedById: STUDENT_USER_ID,
            uploadedBy: {
              id: STUDENT_USER_ID,
              role: UserRole.COACH, // unusual edge case
              firstName: 'X',
              lastName: 'Y',
            },
          }),
        ],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.COACH_RESOURCE).toEqual([]);
      expect(hub.byCategory.USER_DOCUMENT.length).toBe(1);
    });
  });

  describe('invoices — INVOICE vs RECEIPT split', () => {
    it('PAID + paidAt → RECEIPT', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [invoice({ status: 'PAID' })],
        stageItems: [],
      });
      expect(hub.byCategory.RECEIPT.length).toBe(1);
      expect(hub.byCategory.RECEIPT[0].title).toMatch(/Reçu de paiement/);
      expect(hub.byCategory.RECEIPT[0].subtitle).toBe('500.00 TND');
      expect(hub.byCategory.INVOICE).toEqual([]);
    });

    it('SENT or DRAFT → INVOICE', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [invoice({ status: 'SENT', paidAt: null })],
        stageItems: [],
      });
      expect(hub.byCategory.INVOICE.length).toBe(1);
      expect(hub.byCategory.INVOICE[0].title).toMatch(/Facture n°/);
      expect(hub.byCategory.RECEIPT).toEqual([]);
    });

    it('falls back to internal /dashboard/eleve/factures route when pdfUrl is missing', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [invoice({ status: 'SENT', paidAt: null, pdfUrl: null })],
        stageItems: [],
      });
      const inv = hub.byCategory.INVOICE[0];
      expect(inv.downloadUrl).toBeUndefined();
      expect(inv.externalUrl).toBe('/dashboard/eleve/factures/inv-1');
      expect(inv.type).toBe('LINK');
    });
  });

  describe('stage bilans', () => {
    it('produces STAGE_BILAN entries from stages with hasBilan', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [stageItem({ hasBilan: true, bilanUrl: '/bilan/share-1' })],
      });
      expect(hub.byCategory.STAGE_BILAN.length).toBe(1);
      expect(hub.byCategory.STAGE_BILAN[0].externalUrl).toBe('/bilan/share-1');
    });

    it('skips stages without bilan', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [stageItem({ hasBilan: false, bilanUrl: null })],
      });
      expect(hub.byCategory.STAGE_BILAN).toEqual([]);
    });
  });

  describe('RAG_REFERENCE', () => {
    it('is always empty in Lot B (TODO future)', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.RAG_REFERENCE).toEqual([]);
    });
  });

  describe('totalCount and recentlyAddedCount', () => {
    it('counts every resource across categories', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'EDS_GENERALE',
        studentUserId: STUDENT_USER_ID,
        userDocs: [
          userDoc({ id: 'd-self', uploadedById: STUDENT_USER_ID, uploadedBy: null }),
          userDoc({
            id: 'd-coach',
            uploadedById: 'coach-1',
            uploadedBy: { id: 'coach-1', role: UserRole.COACH, firstName: 'A', lastName: 'B' },
          }),
        ],
        invoices: [invoice({ id: 'i1', status: 'PAID' })],
        stageItems: [stageItem({ hasBilan: true, bilanUrl: '/b/1' })],
      });
      // 6 official PDFs + 1 user doc + 1 coach + 1 receipt + 1 stage bilan = 10
      expect(hub.totalCount).toBe(10);
    });

    it('recentlyAddedCount = items uploaded within last 7 days', () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'STMG', // no static official PDFs to keep the count clean
        studentUserId: STUDENT_USER_ID,
        userDocs: [
          userDoc({ id: 'd-recent', createdAt: recentDate, uploadedById: STUDENT_USER_ID }),
          userDoc({ id: 'd-old', createdAt: oldDate, uploadedById: STUDENT_USER_ID }),
        ],
        invoices: [],
        stageItems: [],
      });
      expect(hub.totalCount).toBe(2);
      expect(hub.recentlyAddedCount).toBe(1);
    });
  });

  describe('badge attribution', () => {
    it('uses NOUVEAU for self-uploaded documents within 7 days', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'STMG',
        studentUserId: STUDENT_USER_ID,
        userDocs: [
          userDoc({
            id: 'd-fresh',
            createdAt: new Date(Date.now() - 1000 * 60 * 60),
            uploadedById: STUDENT_USER_ID,
          }),
        ],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.USER_DOCUMENT[0].badge).toBe('NOUVEAU');
    });

    it('uses PERSONNEL for self-uploaded documents older than 7 days', () => {
      const hub = buildHub({
        level: 'PREMIERE',
        track: 'STMG',
        studentUserId: STUDENT_USER_ID,
        userDocs: [
          userDoc({
            id: 'd-stale',
            createdAt: new Date('2026-01-01'),
            uploadedById: STUDENT_USER_ID,
          }),
        ],
        invoices: [],
        stageItems: [],
      });
      expect(hub.byCategory.USER_DOCUMENT[0].badge).toBe('PERSONNEL');
    });
  });
});
