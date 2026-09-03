/**
 * DB integration tests for the ProfilCandidat persistence layer (Track A,
 * Section 12). Real Postgres — no mocked Prisma.
 */
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { randomUUID } from 'crypto';
import { testPrisma, setupTestDatabase, canConnectToTestDb } from '../setup/test-database';
import { createProfilCandidat, getProfilCandidatById } from '@/lib/quotes/candidate-profile-persistence.server';

const prisma = testPrisma;

async function createTestContactLead() {
  return prisma.contactLead.create({
    data: {
      name: 'Amira Ben Salah',
      email: `amira.${randomUUID()}@example.com`,
      phone: '+21620000000',
      status: 'NEW',
    },
  });
}

describe('candidate-profile-persistence.server', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (dbAvailable) await setupTestDatabase();
  });

  afterEach(async () => {
    if (!dbAvailable) return;
    await prisma.profilCandidat.deleteMany({});
    await prisma.contactLead.deleteMany({});
  });

  test('creates a ProfilCandidat linked to a ContactLead, staff-attributed', async () => {
    if (!dbAvailable) return;
    const lead = await createTestContactLead();

    const profil = await createProfilCandidat({
      contactLeadId: lead.id,
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'NSI',
      createdByUserId: 'staff-user-1',
    });

    expect(profil.id).toBeTruthy();
    expect(profil.contactLeadId).toBe(lead.id);
    expect(profil.studentId).toBeNull();
    expect(profil.level).toBe('TERMINALE');
    expect(profil.specialite1).toBe('MATHEMATIQUES');
    expect(profil.specialite2).toBe('NSI');
    expect(profil.createdByUserId).toBe('staff-user-1');
    // Defaults never silently overridden by client-supplied intent (no client financial/regulatory truth):
    expect(profil.revisionNumber).toBe(1);
    expect(profil.previousProfilId).toBeNull();
  });

  test('rejects creation without exactly one of contactLeadId/studentId — never an orphan profile', async () => {
    if (!dbAvailable) return;
    await expect(
      createProfilCandidat({
        level: 'TERMINALE',
        examSession: 2027,
        modalite: 'A',
        specialite1: 'MATHEMATIQUES',
        specialite2: 'NSI',
        createdByUserId: 'staff-user-1',
      }),
    ).rejects.toThrow(/contactLeadId|studentId/i);
  });

  test('getProfilCandidatById returns null for an unknown id — never throws on a routine lookup miss', async () => {
    if (!dbAvailable) return;
    const result = await getProfilCandidatById('nonexistent-id');
    expect(result).toBeNull();
  });

  test('getProfilCandidatById round-trips a created profile', async () => {
    if (!dbAvailable) return;
    const lead = await createTestContactLead();
    const created = await createProfilCandidat({
      contactLeadId: lead.id,
      level: 'PREMIERE',
      examSession: 2027,
      modalite: 'B',
      specialite1: 'PHYSIQUE_CHIMIE',
      specialite2: 'SVT',
      createdByUserId: 'staff-user-2',
    });

    const fetched = await getProfilCandidatById(created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.specialite1).toBe('PHYSIQUE_CHIMIE');
  });
});
