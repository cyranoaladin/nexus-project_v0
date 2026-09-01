jest.unmock('@/lib/prisma');

/**
 * Correspondance de nom robuste de l'anti-doublon, sur PostgreSQL réel.
 *
 * C'est ici — et seulement ici — que se prouve la correction du défaut relevé
 * au déploiement de #131 : la recherche de foyers candidats reposait sur un
 * `ILIKE` exact (casse seule), si bien qu'une variante d'accent ou de
 * ponctuation (« ben-rhouma », « Bén Rhouma ») échappait à la recherche et
 * créait un doublon.
 *
 * On vérifie la fonction indexée `nexus_household_name_key` de bout en bout,
 * à travers le vrai handler de création de foyer : chaque variante d'un même
 * nom, saisie avec un téléphone DIFFÉRENT, doit remonter le foyer stocké comme
 * homonyme (409, aucune écriture), dans les deux sens (saisi normalisé /
 * stocké non normalisé, et l'inverse). L'invariant serveur
 * `ATTACH_REQUIRES_CONFIRMATION` reste tenu.
 */

import { NextRequest } from 'next/server';

import { createPaperEntryFamilyHandler } from '@/lib/bilans/saisie-papier/famille';
import { prisma } from '@/lib/prisma';

const PREFIX = `norm-${Date.now()}-`;
const NOW = new Date('2026-08-13T10:00:00.000Z');
const STAFF_ID = `${PREFIX}staff`;

let dbReady = false;

function handler() {
  return createPaperEntryFamilyHandler({
    prisma: prisma as never,
    authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never),
    now: () => NOW,
  });
}

let requestCounter = 0;
function familyRequest(body: unknown) {
  requestCounter += 1;
  return new NextRequest('http://localhost/api/bilans/saisie-papier/famille', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': `${PREFIX}${requestCounter}` },
    body: JSON.stringify(body),
  });
}

async function seedParent(input: Readonly<{ firstName: string; lastName: string; phoneNormalized: string }>): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${input.phoneNormalized}@example.test`,
      role: 'PARENT',
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phoneNormalized,
      phoneNormalized: input.phoneNormalized,
      password: null,
      activatedAt: null,
    },
  });
  await prisma.parentProfile.create({ data: { userId: user.id } });
  return user.id;
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // La fonction de normalisation doit exister (migration appliquée).
    await prisma.$queryRaw`SELECT nexus_household_name_key('a', 'b')`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  if (!dbReady) return;
  await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.canonicalApiIdempotencyKey.deleteMany({ where: { key: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

// Variantes qui DOIVENT toutes coller à « Alaeddine Ben Rhouma ».
const VARIANTS: ReadonlyArray<Readonly<{ label: string; firstName: string; lastName: string }>> = [
  { label: 'trait d’union minuscule', firstName: 'alaeddine', lastName: 'ben-rhouma' },
  { label: 'accent', firstName: 'Alaeddine', lastName: 'Bén Rhouma' },
  { label: 'espaces multiples', firstName: 'Alaeddine', lastName: 'ben  rhouma' },
  { label: 'majuscules', firstName: 'ALAEDDINE', lastName: 'BEN RHOUMA' },
  { label: 'trait d’union + apostrophe', firstName: 'Alaeddine', lastName: "Ben-Rhouma'" },
  { label: 'orthographe exacte', firstName: 'Alaeddine', lastName: 'Ben Rhouma' },
];

describe('Anti-doublon — correspondance de nom normalisée (PostgreSQL réel)', () => {
  it('reste exécutable avec le search_path restreint utilisé par ANALYZE', async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL search_path TO pg_catalog');
      return tx.$queryRaw<Array<{ key: string }>>`
        SELECT public.nexus_household_name_key('Alaeddine', 'Ben-Rhouma') AS key
      `;
    });

    expect(result).toEqual([{ key: 'alaeddine\tben rhouma' }]);
  });

  it('remonte le foyer stocké pour chaque variante saisie, avec un téléphone différent', async () => {
    if (!dbReady) {
      console.warn('DB indisponible — test de normalisation ignoré');
      return;
    }
    const storedId = await seedParent({ firstName: 'Alaeddine', lastName: 'Ben Rhouma', phoneNormalized: '55110011' });

    for (const variant of VARIANTS) {
      const response = await handler()(familyRequest({
        parentPhone: '20000001', // téléphone DIFFÉRENT → seule la clé de nom peut relier
        parentFirstName: variant.firstName,
        parentLastName: variant.lastName,
        children: [{ firstName: 'Enfant', grade: 'Terminale' }],
      }));

      expect(response.status).toBe(409);
      const payload = await response.json();
      expect(payload.error.code).toBe('POTENTIAL_DUPLICATE');
      const found = (payload.candidates as ReadonlyArray<{ parentUserId: string; matchStrength: string }>)
        .find((candidate) => candidate.parentUserId === storedId);
      expect(`${variant.label}: ${found?.matchStrength ?? 'ABSENT'}`).toBe(`${variant.label}: NAME_ONLY`);
    }
  });

  it('remonte un foyer stocké sous une variante quand la saisie est l’orthographe exacte (sens inverse)', async () => {
    if (!dbReady) return;
    // Stocké NON normalisé, saisi normalisé : la clé indexée les rapproche
    // quand même, dans ce sens aussi.
    const storedId = await seedParent({ firstName: 'josé', lastName: "de l'Île", phoneNormalized: '55220022' });

    const response = await handler()(familyRequest({
      parentPhone: '20000002',
      parentFirstName: 'Jose',
      parentLastName: 'de l Ile',
      children: [{ firstName: 'Enfant', grade: 'Seconde' }],
    }));

    expect(response.status).toBe(409);
    const payload = await response.json();
    const found = (payload.candidates as ReadonlyArray<{ parentUserId: string }>)
      .some((candidate) => candidate.parentUserId === storedId);
    expect(found).toBe(true);
  });

  it('n’écrit rien sur un rattachement faible sans confirmation, même nom reconnu', async () => {
    if (!dbReady) return;
    const storedId = await seedParent({ firstName: 'Amine', lastName: 'Trabelsi', phoneNormalized: '55330033' });
    const before = await prisma.user.count();

    const response = await handler()(familyRequest({
      parentPhone: '20000003',
      parentFirstName: 'amine',
      parentLastName: 'TRABELSI',
      children: [{ firstName: 'Enfant', grade: 'Première' }],
      duplicateResolution: { mode: 'ATTACH', parentUserId: storedId },
    }));

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('ATTACH_REQUIRES_CONFIRMATION');
    // Invariant : le refus n'a créé ni parent ni enfant.
    expect(await prisma.user.count()).toBe(before);
  });

  it('ne relie pas deux noms dont seule la frontière prénom/nom diffère', async () => {
    if (!dbReady) return;
    const storedId = await seedParent({ firstName: 'Ali Ben', lastName: 'Salah', phoneNormalized: '55440044' });

    const response = await handler()(familyRequest({
      parentPhone: '20000004',
      parentFirstName: 'Ali',
      parentLastName: 'Ben Salah',
      children: [{ firstName: 'Enfant', grade: 'Terminale' }],
    }));

    // « Ali Ben » + « Salah » ≠ « Ali » + « Ben Salah » : aucune correspondance,
    // donc création directe (201), pas de faux positif.
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.parentUserId).not.toBe(storedId);
  });
});
