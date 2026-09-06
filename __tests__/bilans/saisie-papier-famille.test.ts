/**
 * Création du foyer préalable à une saisie papier.
 *
 * Deux exigences y sont tenues : la surface est staff-only, et le parent pose
 * lui-même son mot de passe — personne ne le fixe à sa place.
 */

jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));

import { NextRequest } from 'next/server';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
jest.mock('@/lib/quotes/candidate-profile-flag', () => ({ getCandidateProfileWorkflowStatus: jest.fn(async () => 'DISABLED') }));

import { createPaperEntryFamilyHandler } from '@/lib/bilans/saisie-papier/famille';

jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn(async () => undefined) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));

jest.mock('@/lib/whatsapp/invitation-scheduler', () => ({ kickParentWhatsAppOutboxDrain: jest.fn() }));
import { kickParentWhatsAppOutboxDrain } from '@/lib/whatsapp/invitation-scheduler';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { enqueueEmailIntent } from '@/lib/email/outbox';

const enqueued = enqueueEmailIntent as jest.MockedFunction<typeof enqueueEmailIntent>;

beforeEach(() => {
  enqueued.mockClear();
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
});

type EnqueuedIntent = Readonly<{ messageType: string; to: string; aggregateId: string }>;

function intents(): readonly EnqueuedIntent[] {
  return enqueued.mock.calls.map(([, intent]) => intent as unknown as EnqueuedIntent);
}

const NOW = new Date('2026-08-08T16:00:00.000Z');
const STAFF_ID = 'assistante-1';

const BODY = {
  parentEmail: 'Parent.Test@example.test',
  parentPhone: '+216 99 19 28 29',
  parentFirstName: 'Claire',
  parentLastName: 'Bernard',
  children: [{ firstName: 'Inès', grade: 'Terminale' }],
};

/**
 * Le double de la base rejoue fidèlement ce dont la machinerie de consentement
 * parent-élève a besoin (`preparePending` verrouille l'élève et vérifie qu'il
 * appartient bien au profil parent). Court-circuiter ce module rendrait le
 * test aveugle au lien de consentement, qui est précisément ce qui rattache
 * légalement l'enfant au parent.
 */
function memoryDatabase() {
  const users: Record<string, unknown>[] = [];
  const students: (Record<string, unknown> & { id: string; parentId: string })[] = [];
  const profiles: (Record<string, unknown> & { id: string; userId: string })[] = [];
  const links: Record<string, unknown>[] = [];
  const candidateProfiles: Record<string, unknown>[] = [];
  // Foyers candidats connus de la base : la recherche anti-doublon en résout
  // les identifiants via `$queryRaw` (clé de nom normalisée) puis les hydrate
  // via `findMany({ where: { id: { in } } })`. Le test les enregistre ici.
  const duplicateCandidates: (Record<string, unknown> & { id: string })[] = [];

  const transaction = {
    profilCandidat: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { candidateProfiles.push(data); return { ...data, id: 'profil-1' }; }) },
    user: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async (args: { where?: { id?: { in?: readonly string[] } } }) => {
        const ids = args?.where?.id?.in;
        if (Array.isArray(ids)) return duplicateCandidates.filter((candidate) => ids.includes(candidate.id));
        return [];
      }),
      update: jest.fn(async ({ where, data }: { where: object; data: object }) => ({ ...where, ...data })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        users.push(data);
        return { ...data, id: `user-${users.length}` };
      }),
    },
    parentProfile: {
      findUnique: jest.fn(async ({ where }: { where: { userId: string } }) => (
        profiles.find((profile) => profile.userId === where.userId) ?? null
      )),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const profile = { ...data, id: `profile-${profiles.length + 1}` } as typeof profiles[number];
        profiles.push(profile);
        return profile;
      }),
    },
    student: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const student = {
          ...data,
          id: `student-${students.length + 1}`,
          parentId: String(data.parentId),
        } as typeof students[number];
        students.push(student);
        return student;
      }),
    },
    parentStudentLink: {
      findFirst: jest.fn(async () => null),
      updateMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        links.push(data);
        return { id: `link-${links.length}`, state: data.state, consentedAt: null, verifiedAt: null };
      }),
    },
    // Deux usages de `$queryRaw` : la résolution des identifiants de foyers
    // candidats (requête portant `nexus_household_name_key`) et le verrou
    // `lockOwnedStudent` (relit l'élève FOR UPDATE). On les distingue par le
    // texte SQL.
    $queryRaw: jest.fn(async (query: { strings?: readonly string[]; sql?: string; values?: readonly unknown[] }) => {
      const text = Array.isArray(query?.strings) ? query.strings.join(' ') : String(query?.sql ?? '');
      if (text.includes('nexus_household_name_key')) {
        return duplicateCandidates.map((candidate) => ({ id: candidate.id }));
      }
      const studentId = query.values?.[0];
      const student = students.find((candidate) => candidate.id === studentId);
      return student === undefined ? [] : [{ id: student.id, parentId: student.parentId }];
    }),
  };

  const idempotency = new Map<string, Record<string, unknown>>();
  const coordinate = (value: { userId: string; route: string; key: string }) =>
    `${value.userId} ${value.route} ${value.key}`;
  const keys = {
    findUnique: jest.fn(async ({ where }: { where: { userId_route_key: never } }) => (
      idempotency.get(coordinate(where.userId_route_key)) ?? null
    )),
    deleteMany: jest.fn(async () => ({ count: 0 })),
    create: jest.fn(async ({ data }: { data: never }) => {
      const id = coordinate(data);
      if (idempotency.has(id)) throw Object.assign(new Error('unique'), { code: 'P2002' });
      idempotency.set(id, { ...(data as object), response: null, responseStatus: null });
      return data;
    }),
    update: jest.fn(async ({ where, data }: { where: { userId_route_key: never }; data: object }) => {
      const id = coordinate(where.userId_route_key);
      idempotency.set(id, { ...idempotency.get(id), ...data });
      return idempotency.get(id);
    }),
  };

  const database = {
    canonicalApiIdempotencyKey: keys,
    $transaction: jest.fn(async (operation: (tx: unknown) => Promise<unknown>) => {
      const before = [users.length, students.length, profiles.length, links.length, candidateProfiles.length];
      const keysBefore = new Map(idempotency);
      try {
        return await operation({ ...transaction, canonicalApiIdempotencyKey: keys });
      } catch (error) {
        [users, students, profiles, links, candidateProfiles].forEach((collection, i) => collection.splice(before[i]));
        idempotency.clear();
        keysBefore.forEach((value, key) => idempotency.set(key, value));
        throw error;
      }
    }),
  };

  return { database, transaction, users, students, profiles, links, duplicateCandidates, candidateProfiles };
}

function handlerWith(role: string | undefined, database: ReturnType<typeof memoryDatabase>['database']) {
  return createPaperEntryFamilyHandler({
    prisma: database as never,
    authenticate: async () => (role === undefined ? null : { user: { id: STAFF_ID, role } } as never),
    now: () => NOW,
  });
}

function familyRequest(body: unknown = BODY, key = 'foyer-papier-test-0001') {
  return new NextRequest('http://localhost/api/bilans/saisie-papier/famille', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
  });
}

describe('Création du foyer — rôle staff strict', () => {
  it.each(['ELEVE', 'PARENT', 'COACH'])('refuse le rôle %s sans rien écrire', async (role) => {
    const { database, users } = memoryDatabase();
    const response = await handlerWith(role, database)(familyRequest());

    expect(response.status).toBe(404);
    expect(users).toHaveLength(0);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une requête non authentifiée', async () => {
    const { database, users } = memoryDatabase();
    const response = await handlerWith(undefined, database)(familyRequest());

    expect(response.status).toBe(401);
    expect(users).toHaveLength(0);
  });
});

describe('Création du foyer — suggestion anti-doublon à décision humaine', () => {
  const candidate = {
    id: 'parent-existant',
    firstName: 'Claire',
    lastName: 'Bernard',
    email: null,
    phone: '99 19 28 29',
    phoneNormalized: '99192829',
    mergedSources: [],
    parentProfile: {
      id: 'profile-existant',
      children: [{
        id: 'student-existant',
        gradeLevel: 'TERMINALE',
        user: { firstName: 'Inès', lastName: 'Bernard' },
      }],
    },
  };

  it('suggère le foyer portant le même téléphone normalisé sans rien créer', async () => {
    const { database, transaction, users, students, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push(candidate as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: 'POTENTIAL_DUPLICATE' },
      enteredPhone: '99 19 28 29',
      candidates: [{
        parentUserId: 'parent-existant',
        parentName: 'Claire Bernard',
        phone: '99 19 28 29',
        matchStrength: 'PHONE',
        children: [{ studentId: 'student-existant', studentName: 'Inès Bernard', gradeLevel: 'TERMINALE' }],
      }],
    });
    expect(users).toHaveLength(0);
    expect(students).toHaveLength(0);
  });

  it.each([
    ['RESERVED', null, new Date(NOW.getTime() - 1), true],
    ['RESERVED', null, new Date(NOW.getTime() + 1), false],
    ['VERIFIED', NOW, new Date(NOW.getTime() - 1), false],
  ])('expose uniquement une réservation expirée libérable (%s)', async (state, activatedAt, expiresAt, eligible) => {
    const { database, duplicateCandidates, users, students } = memoryDatabase();
    duplicateCandidates.push({ ...candidate, parentPhoneState: state, parentPhoneVersion: 3,
      activatedAt, parentPhoneChallenges: [{ expiresAt }] });
    const response = await handlerWith('ASSISTANTE', database)(familyRequest());
    const body = await response.json();
    expect(response.status).toBe(409);
    if (eligible) expect(body.candidates[0].phoneReservation).toEqual({ version: 3, canRelease: true });
    else expect(body.candidates[0]).not.toHaveProperty('phoneReservation');
    expect(users).toHaveLength(0);
    expect(students).toHaveLength(0);
  });

  it('ne propose pas de libérer un autre numéro trouvé via un compte fusionné', async () => {
    const { database, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push({ ...candidate, phone: '20 11 22 33', phoneNormalized: '20112233',
      mergedSources: [{ phoneNormalized: '99192829' }], parentPhoneState: 'RESERVED',
      parentPhoneVersion: 3, activatedAt: null, parentPhoneChallenges: [{ expiresAt: new Date(NOW.getTime() - 1) }] });
    const response = await handlerWith('ASSISTANTE', database)(familyRequest());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.candidates[0].matchStrength).toBe('PHONE');
    expect(body.candidates[0]).not.toHaveProperty('phoneReservation');
  });

  it('recherche l’homonymie via la clé de nom normalisée en SQL', async () => {
    const { database, transaction, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push(candidate as never);

    await handlerWith('ASSISTANTE', database)(familyRequest());

    const rawSql = transaction.$queryRaw.mock.calls.map(([query]) => {
      const q = query as { strings?: readonly string[]; sql?: string };
      return Array.isArray(q?.strings) ? q.strings.join(' ') : String(q?.sql ?? '');
    });
    // La recherche passe par la fonction indexée, pas par un ILIKE Prisma.
    expect(rawSql.some((sql) => sql.includes('nexus_household_name_key'))).toBe(true);
  });

  it('rattache au foyer choisi explicitement sans créer un parent', async () => {
    const { database, transaction, profiles, users, students, duplicateCandidates } = memoryDatabase();
    profiles.push({ id: 'profile-existant', userId: 'parent-existant' });
    duplicateCandidates.push(candidate as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-existant' },
    }, 'foyer-papier-attach-0001'));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ parentUserId: 'parent-existant', parentCreated: false });
    expect(users.filter((user) => user.role === 'PARENT')).toHaveLength(0);
    expect(students).toHaveLength(1);
    expect(students[0].parentId).toBe('profile-existant');
  });

  it('complète le contact du foyer choisi quand son e-mail était différé', async () => {
    const { database, transaction, profiles, duplicateCandidates } = memoryDatabase();
    profiles.push({ id: 'profile-existant', userId: 'parent-existant' });
    duplicateCandidates.push(candidate as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-existant' },
    }, 'foyer-papier-attach-contact-0001'));

    expect(response.status).toBe(201);
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'parent-existant' },
      data: expect.objectContaining({
        email: 'parent.test@example.test',
        phone: '99 19 28 29',
        phoneNormalized: '99192829',
        activationToken: expect.any(String),
        activationExpiry: expect.any(Date),
      }),
    });
    expect(intents().filter(({ messageType }) => messageType === 'PARENT_ACTIVATION')).toHaveLength(1);
    expect(intents().filter(({ messageType }) => messageType === 'STUDENT_ACTIVATION')).toHaveLength(1);
  });

  it('complète le profil d’un parent sélectionné qui n’en avait pas encore', async () => {
    const { database, transaction, profiles, users, students, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push({ ...candidate, parentProfile: null } as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-existant' },
    }, 'foyer-papier-attach-profile-0001'));

    expect(response.status).toBe(201);
    expect(users.filter((user) => user.role === 'PARENT')).toHaveLength(0);
    expect(profiles).toEqual([expect.objectContaining({ userId: 'parent-existant' })]);
    expect(students[0].parentId).toBe(profiles[0].id);
  });

  it('crée un nouveau foyer uniquement après la décision explicite', async () => {
    const { database, transaction, users, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push(candidate as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'CREATE_NEW' },
    }, 'foyer-papier-create-new-0001'));

    expect(response.status).toBe(201);
    expect(users.filter((user) => user.role === 'PARENT')).toHaveLength(1);
  });

  it('refuse un rattachement vers un foyer absent des candidats', async () => {
    const { database, transaction, users, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push(candidate as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-injecte' },
    }, 'foyer-papier-invalid-attach-0001'));

    expect(response.status).toBe(409);
    expect(users).toHaveLength(0);
  });
});

/**
 * Le cœur de la correction : deux familles homonymes au téléphone différent ne
 * doivent jamais être rattachées par réflexe. Le signal faible est un
 * avertissement, la création reste le défaut, et le rattachement exige une
 * confirmation délibérée — faute de quoi le bilan partirait chez le mauvais
 * parent.
 */
describe('Anti-doublon — homonymie et rattachement délibéré', () => {
  // Même nom que BODY (Claire Bernard) mais téléphone différent : homonyme.
  const homonym = {
    id: 'parent-homonyme',
    firstName: 'Claire',
    lastName: 'Bernard',
    email: null,
    phone: '20 00 00 00',
    phoneNormalized: '20000000',
    mergedSources: [],
    parentProfile: {
      id: 'profile-homonyme',
      children: [{
        id: 'student-homonyme',
        gradeLevel: 'SECONDE',
        user: { firstName: 'Léa', lastName: 'Bernard' },
      }],
    },
  };

  it('un homonyme au téléphone différent est signalé comme homonymie, pas comme signal fort', async () => {
    const { database, transaction, users, students, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push(homonym as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.enteredPhone).toBe('99 19 28 29');
    // BODY.child = Inès Terminale ; l'enfant du homonyme est en Seconde → pas de
    // coïncidence de niveau : signal le plus faible.
    expect(body.candidates).toEqual([expect.objectContaining({
      parentUserId: 'parent-homonyme',
      matchStrength: 'NAME_ONLY',
      phone: '20 00 00 00',
    })]);
    expect(users).toHaveLength(0);
    expect(students).toHaveLength(0);
  });

  it('qualifie en NAME_AND_LEVEL quand un niveau d’enfant coïncide', async () => {
    const { database, transaction, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push({
      ...homonym,
      parentProfile: {
        ...homonym.parentProfile,
        children: [{ id: 'c', gradeLevel: 'TERMINALE', user: { firstName: 'Léa', lastName: 'Bernard' } }],
      },
    } as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest());

    const body = await response.json();
    expect(body.candidates[0].matchStrength).toBe('NAME_AND_LEVEL');
  });

  it('refuse le rattachement sur signal faible sans confirmation explicite', async () => {
    const { database, transaction, users, students, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push(homonym as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-homonyme' },
    }, 'foyer-papier-weak-noconfirm-0001'));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: 'ATTACH_REQUIRES_CONFIRMATION' } });
    // Aucune écriture : ni enfant rattaché, ni foyer créé.
    expect(users).toHaveLength(0);
    expect(students).toHaveLength(0);
  });

  it('rattache sur signal faible seulement avec la confirmation délibérée, et à ce foyer-là uniquement', async () => {
    const { database, transaction, profiles, users, students, duplicateCandidates } = memoryDatabase();
    profiles.push({ id: 'profile-homonyme', userId: 'parent-homonyme' });
    duplicateCandidates.push(homonym as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-homonyme', confirmed: true },
    }, 'foyer-papier-weak-confirm-0001'));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ parentUserId: 'parent-homonyme', parentCreated: false });
    // Isolation : aucun nouveau parent, l'enfant est rattaché au foyer choisi et
    // à aucun autre.
    expect(users.filter((user) => user.role === 'PARENT')).toHaveLength(0);
    expect(students).toHaveLength(1);
    expect(students[0].parentId).toBe('profile-homonyme');
  });

  it('sur signal fort (même téléphone), le rattachement reste possible d’un clic', async () => {
    const { database, transaction, profiles, students, duplicateCandidates } = memoryDatabase();
    profiles.push({ id: 'profile-existant', userId: 'parent-existant' });
    duplicateCandidates.push({
      id: 'parent-existant',
      firstName: 'Claire',
      lastName: 'Bernard',
      email: null,
      phone: '99 19 28 29',
      phoneNormalized: '99192829',
      mergedSources: [],
      parentProfile: { id: 'profile-existant', children: [] },
    } as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-existant' },
    }, 'foyer-papier-strong-attach-0001'));

    expect(response.status).toBe(201);
    expect(students[0].parentId).toBe('profile-existant');
  });

  it('crée un nouveau foyer malgré un homonyme, sur décision explicite', async () => {
    const { database, transaction, users, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push(homonym as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'CREATE_NEW' },
    }, 'foyer-papier-homonym-create-0001'));

    expect(response.status).toBe(201);
    expect(users.filter((user) => user.role === 'PARENT')).toHaveLength(1);
  });
});

describe('Création du foyer — activation en attente', () => {
  it('crée le foyer sans e-mail avec le téléphone parent normalisé', async () => {
    const { parentEmail: _parentEmail, ...withoutEmail } = BODY;
    const { database, users, students } = memoryDatabase();

    const response = await handlerWith('ASSISTANTE', database)(familyRequest(withoutEmail));

    expect(response.status).toBe(201);
    expect(students).toHaveLength(1);
    expect(users.find((user) => user.role === 'PARENT')).toMatchObject({
      email: null,
      phone: '99 19 28 29',
      phoneNormalized: '99192829',
      password: null,
      activatedAt: null,
      activationToken: null,
      activationExpiry: null,
    });
    expect(intents()).toHaveLength(0);
  });

  it('refuse la création sans téléphone parent', async () => {
    const { parentPhone: _parentPhone, ...withoutPhone } = BODY;
    const { database, users } = memoryDatabase();

    const response = await handlerWith('ASSISTANTE', database)(familyRequest(withoutPhone));

    expect(response.status).toBe(400);
    expect(users).toHaveLength(0);
  });

  it('refuse un téléphone parent invalide', async () => {
    const { database, users } = memoryDatabase();
    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      // +33 est désormais un numéro international valide (voir plus bas) ;
      // ce cas est invalide pour une autre raison : bien trop court.
      parentPhone: '+33 1',
    }));

    expect(response.status).toBe(400);
    expect(users).toHaveLength(0);
  });

  it('crée le parent sans mot de passe et en attente d’activation', async () => {
    const { database, users } = memoryDatabase();
    const response = await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(response.status).toBe(201);
    const parent = users.find((user) => user.role === 'PARENT');
    expect(parent).toBeDefined();
    // Le parent posera son mot de passe : aucun n'est fixé ici, et le compte
    // n'est pas activé d'office.
    expect(parent).toMatchObject({ password: null, activatedAt: null });
    expect(parent!.activationToken).toEqual(expect.any(String));
    expect(parent!.activationExpiry).toBeInstanceOf(Date);
  });

  it('normalise l’adresse du parent', async () => {
    const { database, users } = memoryDatabase();
    await handlerWith('ADMIN', database)(familyRequest());

    expect(users.find((user) => user.role === 'PARENT')).toMatchObject({
      email: 'parent.test@example.test',
    });
  });

  it('normalise et conserve le téléphone d’affichage du parent', async () => {
    const { database, users } = memoryDatabase();
    await handlerWith('ADMIN', database)(familyRequest());

    expect(users.find((user) => user.role === 'PARENT')).toMatchObject({
      phone: '99 19 28 29',
      phoneNormalized: '99192829',
    });
  });

  it('crée l’enfant à partir du seul prénom et du niveau', async () => {
    const { database, users, students } = memoryDatabase();
    await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({ gradeLevel: 'TERMINALE', grade: 'Terminale' });
    const child = users.find((user) => user.role === 'ELEVE');
    // À défaut de nom sur la copie, celui du parent.
    expect(child).toMatchObject({ firstName: 'Inès', lastName: 'Bernard', password: null, activatedAt: null });
  });

  it('accepte plusieurs enfants en une fois', async () => {
    const { database, students } = memoryDatabase();
    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      children: [
        { firstName: 'Inès', grade: 'Terminale' },
        { firstName: 'Malik', grade: 'Seconde' },
      ],
    }));

    expect(response.status).toBe(201);
    expect(students).toHaveLength(2);
    expect(students.map(({ gradeLevel }) => gradeLevel)).toEqual(['TERMINALE', 'SECONDE']);
  });

  it('refuse un niveau non reconnu plutôt que d’en deviner un', async () => {
    const { database, students } = memoryDatabase();
    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      children: [{ firstName: 'Inès', grade: 'Niveau imaginaire' }],
    }));

    expect(response.status).toBe(400);
    expect(students).toHaveLength(0);
  });

  it('rattache les enfants à un parent existant sans dupliquer ni réactiver son compte', async () => {
    const { database, transaction, users, profiles } = memoryDatabase();
    profiles.push({ id: 'profile-existant', userId: 'parent-existant' });
    transaction.user.findUnique = jest.fn(async () => ({
      id: 'parent-existant',
      role: 'PARENT',
      parentProfile: { id: 'profile-existant' },
    })) as never;

    const response = await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ parentUserId: 'parent-existant', parentCreated: false });
    // Aucun compte parent recréé, aucun mot de passe ni état d'activation réécrit ;
    // seul le téléphone obligatoire est actualisé.
    expect(users.filter((user) => user.role === 'PARENT')).toHaveLength(0);
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'parent-existant' },
      data: { phone: '99 19 28 29', phoneNormalized: '99192829' },
    });
  });

  /**
   * Sans clé d'idempotence, un renvoi réseau créerait une seconde fois les
   * mêmes enfants : l'adresse du parent est unique, les enfants ne le sont
   * par rien.
   */
  it('ne crée pas deux fois les mêmes enfants sur un renvoi', async () => {
    const { database, students } = memoryDatabase();
    const handler = handlerWith('ASSISTANTE', database);

    const first = await handler(familyRequest());
    const replay = await handler(familyRequest());

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(students).toHaveLength(1);
    expect(await replay.json()).toEqual(await first.json());
  });

  it('exige une clé d’idempotence', async () => {
    const { database, students } = memoryDatabase();
    const response = await handlerWith('ASSISTANTE', database)(
      new NextRequest('http://localhost/api/bilans/saisie-papier/famille', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: JSON.stringify(BODY),
      }),
    );

    expect(response.status).toBe(400);
    expect(students).toHaveLength(0);
  });

  /**
   * « Le parent pose lui-même son mot de passe » n'est vrai que si le courriel
   * d'activation part réellement. Sans cette vérification, un compte sans mot
   * de passe et sans lien serait un compte inaccessible.
   */
  it('met en file le courriel d’activation du parent', async () => {
    const { database } = memoryDatabase();
    await handlerWith('ASSISTANTE', database)(familyRequest());

    const parentIntent = intents().find(({ messageType }) => messageType === 'PARENT_ACTIVATION');
    expect(parentIntent).toBeDefined();
    expect(parentIntent!.to).toBe('parent.test@example.test');
  });

  it('met en file un courriel d’activation par enfant, vers l’adresse du parent', async () => {
    const { database } = memoryDatabase();
    await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      children: [
        { firstName: 'Inès', grade: 'Terminale' },
        { firstName: 'Malik', grade: 'Seconde' },
      ],
    }));

    const studentIntents = intents().filter(({ messageType }) => messageType === 'STUDENT_ACTIVATION');
    expect(studentIntents).toHaveLength(2);
    // L'enfant n'a pas d'adresse à lui : le lien part chez le parent.
    for (const intent of studentIntents) expect(intent.to).toBe('parent.test@example.test');
  });

  it('n’envoie pas d’activation parent à un parent déjà connu', async () => {
    const { database, transaction, profiles } = memoryDatabase();
    profiles.push({ id: 'profile-existant', userId: 'parent-existant' });
    transaction.user.findUnique = jest.fn(async () => ({
      id: 'parent-existant',
      role: 'PARENT',
      parentProfile: { id: 'profile-existant' },
    })) as never;

    await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(intents().some(({ messageType }) => messageType === 'PARENT_ACTIVATION')).toBe(false);
    expect(intents().filter(({ messageType }) => messageType === 'STUDENT_ACTIVATION')).toHaveLength(1);
  });

  it('refuse plus de six enfants en une fois', async () => {
    const { database, students } = memoryDatabase();
    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      children: Array.from({ length: 7 }, (_, index) => ({
        firstName: `Enfant${index}`,
        grade: 'Seconde',
      })),
    }));

    expect(response.status).toBe(400);
    expect(students).toHaveLength(0);
  });

  /**
   * Deux assistantes créant le même parent au même instant : c'est un conflit
   * ordinaire, pas une panne. Un 500 enverrait chercher une erreur serveur là
   * où il suffit de recharger.
   */
  it('signale un conflit, et non une panne, sur une création concurrente', async () => {
    const { database, transaction } = memoryDatabase();
    transaction.user.create = jest.fn(async () => {
      throw Object.assign(new Error('unique'), { code: 'P2002' });
    }) as never;

    const response = await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: 'PARENT_EMAIL_TAKEN' } });
  });

  it('refuse de réutiliser une adresse portée par un autre rôle', async () => {
    const { database, transaction } = memoryDatabase();
    transaction.user.findUnique = jest.fn(async () => ({
      id: 'coach-1',
      role: 'COACH',
      parentProfile: null,
    })) as never;

    const response = await handlerWith('ASSISTANTE', database)(familyRequest());
    expect(response.status).toBe(409);
  });
});

/**
 * Numéros internationaux (au-delà de la Tunisie) — lib/contact/parent-phone.ts.
 *
 * Le défaut d'origine : `normalizeParentPhone` ne connaissait que la Tunisie,
 * donc cette route refusait toute famille étrangère. Preuve que ce n'est plus
 * le cas, et que le rapprochement anti-doublon fonctionne aussi sur les
 * différentes écritures d'un même numéro international.
 */
describe('Création du foyer — téléphone international (Qatar +974)', () => {
  const QATAR_BODY = {
    parentEmail: 'Parent.Qatar@example.test',
    parentPhone: '+97466298752',
    parentFirstName: 'Nasser',
    parentLastName: 'Al-Thani',
    children: [{ firstName: 'Fatima', grade: 'Terminale' }],
  };

  it('crée un parent avec le numéro qatari, phoneNormalized sans indicatif dupliqué', async () => {
    const { database, users, students } = memoryDatabase();
    const response = await handlerWith('ASSISTANTE', database)(familyRequest(QATAR_BODY, 'foyer-qatar-0001'));

    expect(response.status).toBe(201);
    expect(students).toHaveLength(1);
    expect(users.find((user) => user.role === 'PARENT')).toMatchObject({
      phone: '+97466298752',
      phoneNormalized: '97466298752',
      password: null,
      activatedAt: null,
    });
  });

  it('conserve le téléphone d’affichage international', async () => {
    const { database, users } = memoryDatabase();
    await handlerWith('ASSISTANTE', database)(familyRequest(QATAR_BODY, 'foyer-qatar-0002'));

    expect(users.find((user) => user.role === 'PARENT')?.phone).toBe('+97466298752');
  });

  it.each([
    ['00974 66 29 87 52', '00 avec espaces'],
    ['+974 66 29 87 52', '+ avec espaces'],
    ['97466298752', 'chiffres nus'],
  ])('remonte le même candidat anti-doublon depuis %s (%s)', async (parentPhone) => {
    const { database, duplicateCandidates } = memoryDatabase();
    duplicateCandidates.push({
      id: 'parent-qatar-existant',
      firstName: 'Nasser',
      lastName: 'Al-Thani',
      email: null,
      phone: '+97466298752',
      phoneNormalized: '97466298752',
      mergedSources: [],
      parentProfile: null,
    } as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...QATAR_BODY,
      parentPhone,
      // Nom différent : seul le téléphone doit produire le signal fort ici.
      parentFirstName: 'Autre',
      parentLastName: 'Personne',
    }));

    expect(response.status).toBe(409);
    const payload = await response.json() as { candidates: ReadonlyArray<{ parentUserId: string; matchStrength: string }> };
    expect(payload.candidates).toContainEqual(expect.objectContaining({
      parentUserId: 'parent-qatar-existant',
      matchStrength: 'PHONE',
    }));
  });

  it('protège la surface staff-only pour un foyer international comme pour un foyer tunisien', async () => {
    const { database, users } = memoryDatabase();
    const response = await handlerWith('ELEVE', database)(familyRequest(QATAR_BODY, 'foyer-qatar-staff'));

    expect(response.status).toBe(404);
    expect(users).toHaveLength(0);
  });

  it('reste idempotent sur un renvoi avec la même clé', async () => {
    const { database, users } = memoryDatabase();
    const key = 'foyer-qatar-idempotent';

    const first = await handlerWith('ASSISTANTE', database)(familyRequest(QATAR_BODY, key));
    const second = await handlerWith('ASSISTANTE', database)(familyRequest(QATAR_BODY, key));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(users.filter((user) => user.role === 'PARENT')).toHaveLength(1);
  });

  it('prépare le lien de consentement parent-enfant comme pour un foyer tunisien', async () => {
    const { database, links } = memoryDatabase();
    const response = await handlerWith('ASSISTANTE', database)(familyRequest(QATAR_BODY, 'foyer-qatar-consent'));

    expect(response.status).toBe(201);
    expect(links).toHaveLength(1);
  });
});

describe('Création assistante — foyer canonique et invitation WhatsApp', () => {
  const originalDeliveryMode = process.env.WHATSAPP_SEND_ENABLED;
  beforeEach(() => { process.env.WHATSAPP_SEND_ENABLED = 'true'; });
  afterEach(() => { if (originalDeliveryMode === undefined) delete process.env.WHATSAPP_SEND_ENABLED; else process.env.WHATSAPP_SEND_ENABLED = originalDeliveryMode; });
  it('enregistre plusieurs enfants sans email, leurs situations, et une invitation transactionnelle sans jeton staff', async () => {
    const { database, transaction, users, students } = memoryDatabase();
    const inviteParent = jest.fn(async (_transaction: unknown, _userId: string, _now: Date) => { void [_transaction, _userId, _now]; return { queued: true, required: true }; });
    const handler = createPaperEntryFamilyHandler({
      prisma: database as never,
      authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never),
      now: () => NOW,
      inviteParent,
    }, { mode: 'WHATSAPP', route: 'POST:/api/assistante/families' });
    const body = {
      ...BODY, parentEmail: undefined,
      children: [
        { firstName: 'Inès', lastName: 'Distinct', grade: 'Terminale', schoolingStatus: 'INDIVIDUAL' },
        { firstName: 'Nora', grade: 'Première', schoolingStatus: 'SCHOOL_ENROLLED', school: 'Lycée' },
      ],
    };
    const response = await handler(familyRequest(body, 'foyer-assistante-0001'));
    expect(response.status).toBe(201);
    expect(students.map(student => student.schoolingStatus)).toEqual(['INDIVIDUAL', 'SCHOOL_ENROLLED']);
    expect(users.find(user => user.firstName === 'Inès')).toMatchObject({ lastName: 'Distinct' });
    expect(users.find(user => user.role === 'PARENT')).toMatchObject({ activatedAt: null, password: null });
    expect(inviteParent).toHaveBeenCalledTimes(1);
    expect(inviteParent.mock.calls[0][0]).toEqual(expect.objectContaining({ user: transaction.user }));
    const payload = await response.json();
    expect(payload.invitationQueued).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/rawToken|activationToken|password|https?:/);
    expect(enqueued).not.toHaveBeenCalled();
    const replay = await handler(familyRequest(body, 'foyer-assistante-0001'));
    expect(replay.status).toBe(201);
    expect(students).toHaveLength(2);
    expect(inviteParent).toHaveBeenCalledTimes(1);
  });
});

describe('Création assistante — compatibilité et atomicité', () => {
  it('refuse un email élève existant avant toute écriture parent', async () => {
    const { database, transaction, users } = memoryDatabase();
    transaction.user.findUnique.mockResolvedValue({ id: 'existing-student' } as never);
    const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: jest.fn() }, { mode: 'WHATSAPP', legacy: true });
    const response = await handler(familyRequest({ parentFirstName: 'Claire', parentLastName: 'Bernard', parentPhone: '99192829', parentEmail: 'parent@example.test', studentFirstName: 'Nora', studentLastName: 'Bernard', studentGrade: 'Première', studentEmail: 'existing@example.test' }, 'legacy-conflict-0001'));
    expect(response.status).toBe(409);
    expect(users).toHaveLength(0);
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('ne transforme pas CREATE_NEW en rattachement implicite par email', async () => {
    const { database, transaction } = memoryDatabase();
    transaction.user.findUnique.mockResolvedValue({ id: 'known-parent', role: 'PARENT', mergedIntoUserId: null, parentProfile: { id: 'known-profile' } } as never);
    const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: async () => ({ queued: false, required: false }) }, { mode: 'WHATSAPP' });
    const response = await handler(familyRequest({ ...BODY, duplicateResolution: { mode: 'CREATE_NEW' } }, 'create-new-existing-email'));
    expect(response.status).toBe(409);
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('refuse de rattacher des enfants à un ancien parent fusionné trouvé par email', async () => {
    const { database, transaction, users } = memoryDatabase();
    transaction.user.findUnique.mockResolvedValue({ id: 'merged-parent', role: 'PARENT', mergedIntoUserId: 'canonical-parent', parentProfile: { id: 'old-profile' } } as never);
    const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: async () => ({ queued: false, required: false }) }, { mode: 'WHATSAPP' });
    const response = await handler(familyRequest(BODY, 'merged-parent-reject'));
    expect(response.status).toBe(409);
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(users).toHaveLength(0);
  });

  it('préserve coordonnées et accès du foyer sélectionné lors de l’ajout d’enfant', async () => {
    const { database, transaction, profiles, duplicateCandidates } = memoryDatabase();
    profiles.push({ id: 'profile-existing', userId: 'parent-existing' });
    duplicateCandidates.push({ id: 'parent-existing', firstName: 'Claire', lastName: 'Bernard', email: 'existing@example.test', phone: '99192829', phoneNormalized: '99192829', mergedSources: [], parentProfile: { id: 'profile-existing', children: [] } });
    const inviteParent = jest.fn(async () => ({ queued: false, required: false }));
    const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent }, { mode: 'WHATSAPP' });
    const response = await handler(familyRequest({ ...BODY, duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-existing' } }, 'existing-no-reset-0001'));
    expect(response.status).toBe(201);
    expect(transaction.user.update).toHaveBeenCalledWith({ where: { id: 'parent-existing' }, data: { registrationCompletedAt: null } });
    expect(enqueued).not.toHaveBeenCalled();
  });
});

describe('Profil candidat dans la transaction familiale', () => {
  beforeEach(() => (getCandidateProfileWorkflowStatus as jest.Mock).mockResolvedValue('ACTIVE_INTERNAL'));
  afterEach(() => (getCandidateProfileWorkflowStatus as jest.Mock).mockResolvedValue('DISABLED'));
  const candidateProfile = { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', intentionCycleComplet: true, estRedoublant: false, estTitulaireBacDejaObtenu: false, changementSpecialite: false };
  it.each([
    { examSession: 1999 },
    { specialite1: 'FRANCAIS' },
    { studentId: 'other-student' },
    { contactLeadId: 'other-contact' },
  ])('validates family candidate facts through the canonical profile schema: %j', async (override) => {
    const { database, users, candidateProfiles } = memoryDatabase();
    const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: async () => ({ queued: true, required: true }) }, { mode: 'WHATSAPP' });
    const response = await handler(familyRequest({ ...BODY, children: [{ firstName: 'Inès', grade: 'Terminale', schoolingStatus: 'INDIVIDUAL', candidateProfile: { ...candidateProfile, ...override } }] }, 'profil-family-schema'));
    expect(response.status).toBe(400);
    expect(users).toHaveLength(0);
    expect(candidateProfiles).toHaveLength(0);
  });
  it.each(['estRedoublant', 'estTitulaireBacDejaObtenu', 'changementSpecialite'])('refuse un profil sans discriminant déclaré %s', async (field) => {
    const { database, users } = memoryDatabase();
    const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: async () => ({ queued: true, required: true }) }, { mode: 'WHATSAPP' });
    const response = await handler(familyRequest({ ...BODY, children: [{ firstName: 'Inès', grade: 'Terminale', schoolingStatus: 'INDIVIDUAL', candidateProfile: { ...candidateProfile, [field]: undefined } }] }, 'profil-family-unknown-status'));
    expect(response.status).toBe(400);
    expect(users).toHaveLength(0);
  });
  it('persiste les faits du candidat via ProfilCandidat sans créer de parcours parallèle', async () => {
    const { database, candidateProfiles } = memoryDatabase();
    const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: async () => ({ queued: true, required: true }) }, { mode: 'WHATSAPP' });
    const response = await handler(familyRequest({ ...BODY, children: [{ firstName: 'Inès', grade: 'Terminale', schoolingStatus: 'INDIVIDUAL', candidateProfile }] }, 'profil-family-create'));
    expect(response.status).toBe(201);
    expect(candidateProfiles).toEqual([expect.objectContaining({ studentId: 'student-1', examSession: 2027, modalite: 'A', createdByUserId: STAFF_ID })]);
  });
  it('annule foyer, enfants et profil si la préparation invitation échoue', async () => {
    const { database, users, students, candidateProfiles } = memoryDatabase();
    const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: async () => { throw new Error('INVITATION_ENQUEUE_FAILED'); } }, { mode: 'WHATSAPP' });
    const response = await handler(familyRequest({ ...BODY, children: [{ firstName: 'Inès', grade: 'Terminale', schoolingStatus: 'INDIVIDUAL', candidateProfile }] }, 'profil-family-rollback'));
    expect(response.status).toBe(500);
    expect(users).toHaveLength(0);
    expect(students).toHaveLength(0);
    expect(candidateProfiles).toHaveLength(0);
  });
});

it('ne contourne pas le drapeau du pipeline pour enregistrer un profil candidat', async () => {
  (getCandidateProfileWorkflowStatus as jest.Mock).mockResolvedValue('DISABLED');
  const { database, users } = memoryDatabase();
  const handler = createPaperEntryFamilyHandler({ prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: async () => ({ queued: true, required: true }) }, { mode: 'WHATSAPP' });
  const response = await handler(familyRequest({ ...BODY, children: [{ firstName: 'Inès', grade: 'Terminale', schoolingStatus: 'INDIVIDUAL', candidateProfile: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'NSI', specialite2: 'MATHEMATIQUES', estRedoublant: false, estTitulaireBacDejaObtenu: false, changementSpecialite: false } }] }, 'profil-disabled-0001'));
  expect(response.status).toBe(403);
  expect(users).toHaveLength(0);
});

it('manual family metadata is safely replayable without storing its raw invitation',async()=>{
 const mode=process.env.WHATSAPP_SEND_ENABLED;delete process.env.WHATSAPP_SEND_ENABLED;
 jest.mocked(kickParentWhatsAppOutboxDrain).mockClear();jest.mocked(kickEmailOutboxDrain).mockClear();
 try {
  const {database,students}=memoryDatabase();
  const inviteParent=jest.fn(async()=>({queued:false,required:true,rawToken:'synthetic-private-link'}));
  const handler=createPaperEntryFamilyHandler({prisma:database as never,authenticate:async()=>({user:{id:STAFF_ID,role:'ASSISTANTE'}} as never),now:()=>NOW,inviteParent},{mode:'WHATSAPP'});
  const first=await handler(familyRequest({...BODY,parentEmail:undefined},'manual-family-replay'));
  const payload=await first.json();expect(first.status).toBe(201);
  expect(payload).toMatchObject({invitationQueued:false,invitationMode:'MANUAL',invitationRequired:true});
  const replay=await handler(familyRequest({...BODY,parentEmail:undefined},'manual-family-replay'));
  expect(await replay.json()).toEqual(payload);expect(inviteParent).toHaveBeenCalledTimes(1);expect(students).toHaveLength(1);
  expect(JSON.stringify(payload)).not.toContain('synthetic-private-link');
  expect(kickParentWhatsAppOutboxDrain).not.toHaveBeenCalled();expect(kickEmailOutboxDrain).not.toHaveBeenCalled();
 }finally{if(mode===undefined)delete process.env.WHATSAPP_SEND_ENABLED;else process.env.WHATSAPP_SEND_ENABLED=mode;}
});

describe('canonical family payload idempotency', () => {
  test('replays a normalized legacy alias without creating another graph', async () => {
    const { database, students, users } = memoryDatabase();
    const dependencies = { prisma: database as never, authenticate: async () => ({ user: { id: STAFF_ID, role: 'ASSISTANTE' } } as never), now: () => NOW, inviteParent: async () => ({ queued: false, required: true }) };
    const primary = createPaperEntryFamilyHandler(dependencies, { mode: 'WHATSAPP' });
    const alias = createPaperEntryFamilyHandler(dependencies, { mode: 'WHATSAPP', legacy: true, route: 'POST:/api/assistante/students' });
    const first = await primary(familyRequest(BODY, 'canonical-alias-replay'));
    const second = await alias(familyRequest({
      parentEmail: 'parent.test@example.test', parentPhone: '99192829', parentFirstName: ' Claire ', parentLastName: 'Bernard',
      studentFirstName: 'Inès', studentLastName: 'Bernard', studentGrade: 'terminale',
    }, 'canonical-alias-replay'));
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.json()); expect(students).toHaveLength(1); expect(users).toHaveLength(2);
  });
  test('returns the exact conflict code for a changed child without another write', async () => {
    const { database, students } = memoryDatabase();
    const handler = handlerWith('ASSISTANTE', database);
    expect((await handler(familyRequest(BODY, 'changed-family-body'))).status).toBe(201);
    const second = await handler(familyRequest({ ...BODY, children: [{firstName:'Other', grade:'Terminale'}] }, 'changed-family-body'));
    expect(second.status).toBe(409); expect(await second.json()).toEqual({error:{code:'IDEMPOTENCY_CONFLICT'}}); expect(students).toHaveLength(1);
  });
});
