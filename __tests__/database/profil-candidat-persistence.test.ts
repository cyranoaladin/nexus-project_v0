/**
 * DB integration tests for lib/quotes/profil-candidat.server.ts (mission
 * recâblage §5) — before this module, no application code ever wrote a
 * ProfilCandidat row (confirmed by a repo-wide search). Real DB, real Zod-
 * validated enum columns, not mocked.
 */
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { testPrisma, setupTestDatabase, canConnectToTestDb } from '../setup/test-database';
import {
  createProfilCandidat,
  updateProfilCandidat,
  getProfilCandidat,
  listProfilsCandidats,
  requestProfilCandidatReview,
  createProfilCandidatRevision,
  profilCandidatToPipelineInput,
  type ProfilCandidatDraftInput,
} from '@/lib/quotes/profil-candidat.server';

const prisma = testPrisma;

const VALID_DRAFT: ProfilCandidatDraftInput = {
  publicInput: {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
  },
};

describe('ProfilCandidat persistence (mission recâblage §5)', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping ProfilCandidat persistence tests: test database not available');
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  });

  test('createProfilCandidat persists a well-formed draft with the requesting staff id', async () => {
    if (!dbAvailable) return;
    const result = await createProfilCandidat(VALID_DRAFT, 'staff-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profil.level).toBe('TERMINALE');
    expect(result.profil.createdByUserId).toBe('staff-1');
    expect(result.profil.revisionNumber).toBe(1);

    const row = await prisma.profilCandidat.findUnique({ where: { id: result.profil.id } });
    expect(row).not.toBeNull();
  });

  test('createProfilCandidat fails closed — missing required field never silently defaulted', async () => {
    if (!dbAvailable) return;
    const result = await createProfilCandidat({ publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES' } }, 'staff-1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingRequiredFields).toContain('specialite2');
  });

  test('createProfilCandidat fails closed — unresolved value never guessed into a code', async () => {
    if (!dbAvailable) return;
    const result = await createProfilCandidat(
      { publicInput: { ...VALID_DRAFT.publicInput, specialite1: 'Chimie Improbable' } },
      'staff-1',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unresolvedFields).toContain('specialite1');
  });

  test('createProfilCandidat stores staffExtension arrays as JSON, empty arrays stored as null (not [])', async () => {
    if (!dbAvailable) return;
    const withStaff = await createProfilCandidat(
      { ...VALID_DRAFT, staffExtension: { dispensesDeclarees: [{ epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' }] } },
      'staff-1',
    );
    expect(withStaff.ok).toBe(true);
    if (!withStaff.ok) return;
    expect(withStaff.profil.dispensesDeclarees).toEqual([{ epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' }]);
    expect(withStaff.profil.notesConservees).toBeNull();
  });

  test('updateProfilCandidat overwrites an existing draft; 404-equivalent for an unknown id', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(VALID_DRAFT, 'staff-1');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateProfilCandidat(created.profil.id, { publicInput: { ...VALID_DRAFT.publicInput, estRedoublant: true } });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect((updated as { profil: { estRedoublant: boolean } }).profil.estRedoublant).toBe(true);

    const missing = await updateProfilCandidat('nonexistent-id', VALID_DRAFT);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect('notFound' in missing).toBe(true);
  });

  test('listProfilsCandidats returns most-recently-updated first', async () => {
    if (!dbAvailable) return;
    const first = await createProfilCandidat(VALID_DRAFT, 'staff-1');
    const second = await createProfilCandidat(VALID_DRAFT, 'staff-1');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const list = await listProfilsCandidats();
    expect(list[0].id).toBe(second.profil.id);
    expect(list.map((p) => p.id)).toEqual(expect.arrayContaining([first.profil.id, second.profil.id]));
  });

  test('requestProfilCandidatReview sets a staff-set marker, never auto-derived from a pipeline status', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(VALID_DRAFT, 'staff-1');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const reviewed = await requestProfilCandidatReview(created.profil.id, 'staff-2', 'Vérifier P3');
    expect(reviewed).not.toBeNull();
    expect(reviewed?.reviewRequestedByUserId).toBe('staff-2');
    expect(reviewed?.reviewNote).toBe('Vérifier P3');
    expect(reviewed?.reviewRequestedAt).not.toBeNull();

    const missing = await requestProfilCandidatReview('nonexistent-id', 'staff-2', null);
    expect(missing).toBeNull();
  });

  test('createProfilCandidatRevision creates a new row linked via previousProfilId, never mutates the original', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(VALID_DRAFT, 'staff-1');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await requestProfilCandidatReview(created.profil.id, 'staff-2', 'note');

    const revision = await createProfilCandidatRevision(created.profil.id, 'staff-3');
    expect(revision).not.toBeNull();
    expect(revision?.previousProfilId).toBe(created.profil.id);
    expect(revision?.revisionNumber).toBe(2);
    expect(revision?.createdByUserId).toBe('staff-3');
    // A fresh revision starts unreviewed — not carried over from the row it supersedes.
    expect(revision?.reviewRequestedAt).toBeNull();

    const original = await getProfilCandidat(created.profil.id);
    expect(original?.reviewRequestedAt).not.toBeNull(); // unchanged — never mutated

    const missing = await createProfilCandidatRevision('nonexistent-id', 'staff-3');
    expect(missing).toBeNull();
  });

  test('profilCandidatToPipelineInput round-trips a stored row into a valid CandidateQuotePipelineInput', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(VALID_DRAFT, 'staff-1');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const input = profilCandidatToPipelineInput(created.profil, { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' });
    expect(input.publicInput.level).toBe('TERMINALE');
    expect(input.publicInput.specialite1).toBe('MATHEMATIQUES');
    expect(input.staffExtension?.notesConservees).toBeNull();
    expect(input.budget).toEqual({ monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' });
  });
});
