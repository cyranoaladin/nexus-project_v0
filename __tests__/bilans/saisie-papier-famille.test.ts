/**
 * Création du foyer préalable à une saisie papier.
 *
 * Deux exigences y sont tenues : la surface est staff-only, et le parent pose
 * lui-même son mot de passe — personne ne le fixe à sa place.
 */

import { NextRequest } from 'next/server';

import { createPaperEntryFamilyHandler } from '@/lib/bilans/saisie-papier/famille';

jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn(async () => undefined) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));

import { enqueueEmailIntent } from '@/lib/email/outbox';

const enqueued = enqueueEmailIntent as jest.MockedFunction<typeof enqueueEmailIntent>;

beforeEach(() => { enqueued.mockClear(); });

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

  const transaction = {
    user: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
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
    // `lockOwnedStudent` relit l'élève FOR UPDATE ; le double rend la ligne
    // réellement créée, sans quoi le lien de consentement échouerait.
    $queryRaw: jest.fn(async (query: { values?: readonly unknown[] }) => {
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
    $transaction: jest.fn(async (operation: (tx: unknown) => Promise<unknown>) => operation({
      ...transaction,
      canonicalApiIdempotencyKey: keys,
    })),
  };

  return { database, transaction, users, students, profiles, links };
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
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
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
    const { database, transaction, users, students } = memoryDatabase();
    transaction.user.findMany.mockResolvedValue([candidate] as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: 'POTENTIAL_DUPLICATE' },
      candidates: [{
        parentUserId: 'parent-existant',
        parentName: 'Claire Bernard',
        phone: '99 19 28 29',
        children: [{ studentId: 'student-existant', studentName: 'Inès Bernard', gradeLevel: 'TERMINALE' }],
      }],
    });
    expect(users).toHaveLength(0);
    expect(students).toHaveLength(0);
  });

  it('recherche aussi le couple nom, prénom et niveau de l’élève', async () => {
    const { database, transaction } = memoryDatabase();
    transaction.user.findMany.mockResolvedValue([candidate] as never);

    await handlerWith('ASSISTANTE', database)(familyRequest());

    expect(transaction.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        role: 'PARENT',
        OR: expect.arrayContaining([
          { phoneNormalized: '99192829' },
          expect.objectContaining({ parentProfile: expect.any(Object) }),
        ]),
      }),
    }));
  });

  it('rattache au foyer choisi explicitement sans créer un parent', async () => {
    const { database, transaction, profiles, users, students } = memoryDatabase();
    profiles.push({ id: 'profile-existant', userId: 'parent-existant' });
    transaction.user.findMany.mockResolvedValue([candidate] as never);

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
    const { database, transaction, profiles } = memoryDatabase();
    profiles.push({ id: 'profile-existant', userId: 'parent-existant' });
    transaction.user.findMany.mockResolvedValue([candidate] as never);

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
    const { database, transaction, profiles, users, students } = memoryDatabase();
    transaction.user.findMany.mockResolvedValue([{ ...candidate, parentProfile: null }] as never);

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
    const { database, transaction, users } = memoryDatabase();
    transaction.user.findMany.mockResolvedValue([candidate] as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'CREATE_NEW' },
    }, 'foyer-papier-create-new-0001'));

    expect(response.status).toBe(201);
    expect(users.filter((user) => user.role === 'PARENT')).toHaveLength(1);
  });

  it('refuse un rattachement vers un foyer absent des candidats', async () => {
    const { database, transaction, users } = memoryDatabase();
    transaction.user.findMany.mockResolvedValue([candidate] as never);

    const response = await handlerWith('ASSISTANTE', database)(familyRequest({
      ...BODY,
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-injecte' },
    }, 'foyer-papier-invalid-attach-0001'));

    expect(response.status).toBe(409);
    expect(users).toHaveLength(0);
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
      parentPhone: '+33 6 12 34 56 78',
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
        headers: { 'content-type': 'application/json' },
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
