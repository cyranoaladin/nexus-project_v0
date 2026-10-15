/**
 * §4 — intégrité des credentials V1 lors d'une mise à jour de CONTACT.
 *
 * Défaut visé : `completePaperEntryParentEmail` écrivait `password: null` et
 * `activatedAt: null` en posant l'e-mail d'un parent. Or un parent SANS e-mail
 * peut être pleinement actif par authentification téléphone
 * (`lib/auth/parent-phone.ts` : `parentPhoneState=VERIFIED` + `phoneVerifiedAt`
 * + `activatedAt`, mot de passe posé par `consumeParentPhoneChallenge`).
 * Poser son e-mail détruisait donc silencieusement son identifiant.
 *
 * Les fixtures existantes figent `activatedAt: null`, ce qui explique que le
 * défaut n'ait jamais été détecté.
 *
 * Règle : une mise à jour de contact ne touche JAMAIS à un champ de credential.
 * La neutralisation d'un compte se fait par statut dédié — `disabledAt`
 * (schema.prisma:363) ou le tombstone de fusion `mergedIntoUserId`, que les
 * trois chemins de connexion refusent déjà
 * (`credentials-authorize.ts:88`, `espace-authorize.ts:68`, `parent-phone.ts`)
 * — jamais par effacement du hash.
 */
import { completePaperEntryParentEmail } from '@/lib/bilans/staff/parent-contact-service';

jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn(async () => undefined) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));

const NOW = new Date('2026-10-11T18:00:00.000Z');
const ACTIVATED = new Date('2026-05-01T08:30:00.000Z');

const CREDENTIAL_FIELDS = ['password', 'passwordHash', 'activatedAt'] as const;

/** Parent actif SANS e-mail : cas réel de l'authentification par téléphone. */
function harness(options: {
  sourceActivatedAt?: Date | null;
  existingByEmail?: Record<string, unknown> | null;
} = {}) {
  const revision = {
    id: 'revision-1',
    checksum: 'snapshot-checksum',
    contentJson: { immutable: true },
    reportArtifact: {
      student: {
        id: 'student-1',
        parent: {
          id: 'source-profile',
          children: [{ id: 'student-1' }, { id: 'student-2' }],
          user: {
            id: 'source-parent',
            role: 'PARENT',
            email: null,
            firstName: 'Claire',
            lastName: 'Bernard',
            activatedAt: options.sourceActivatedAt ?? null,
          },
        },
      },
    },
  };
  const updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const transaction = {
    reportRevision: { findUnique: jest.fn(async () => revision) },
    user: {
      findUnique: jest.fn(async () => options.existingByEmail ?? null),
      update: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updates.push({ where, data });
        return { ...where, ...data };
      }),
      create: jest.fn(),
    },
    parentProfile: {
      create: jest.fn(async ({ data }: { data: { userId: string } }) => ({ id: 'target-profile-new', ...data })),
    },
    student: { updateMany: jest.fn(async () => ({ count: 2 })) },
  };
  const database = { $transaction: jest.fn(async (action: (tx: unknown) => Promise<unknown>) => action(transaction)) };
  return { database, transaction, updates };
}

const actor = { userId: 'assistante-1', role: 'ASSISTANTE' } as const;

function run(database: unknown) {
  return completePaperEntryParentEmail(
    { ...actor, revisionId: 'revision-1', email: ' Parent.Test@example.test ' },
    { prisma: database as never, now: () => NOW, synchronizeConsent: jest.fn() },
  );
}

beforeEach(() => {
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
});

describe('§4 une mise à jour de contact ne touche aucun champ de credential', () => {
  test("un parent ACTIF (authentifié par téléphone) conserve exactement son hash et sa date d'activation", async () => {
    const { database, updates } = harness({ sourceActivatedAt: ACTIVATED });
    await run(database);

    const onSource = updates.filter((u) => u.where.id === 'source-parent');
    expect(onSource.length).toBeGreaterThan(0);
    for (const update of onSource) {
      for (const field of CREDENTIAL_FIELDS) {
        // Clé ABSENTE : ne pas écrire le champ, et surtout pas l'écrire à null.
        expect(Object.prototype.hasOwnProperty.call(update.data, field)).toBe(false);
      }
    }
  });

  test("un parent actif ne reçoit PAS de nouvelle invitation d'activation", async () => {
    const { database, updates } = harness({ sourceActivatedAt: ACTIVATED });
    const result = await run(database);
    expect(result.activationQueued).toBe(false);
    for (const update of updates) {
      expect(Object.prototype.hasOwnProperty.call(update.data, 'activationToken')).toBe(false);
    }
  });

  test("un parent NON activé reçoit bien une invitation, sans effacement de credential", async () => {
    const { database, updates } = harness({ sourceActivatedAt: null });
    const result = await run(database);
    expect(result.activationQueued).toBe(true);
    const onSource = updates.filter((u) => u.where.id === 'source-parent');
    expect(onSource.some((u) => typeof u.data.activationToken === 'string')).toBe(true);
    for (const update of onSource) {
      expect(Object.prototype.hasOwnProperty.call(update.data, 'password')).toBe(false);
    }
  });

  test("la fusion neutralise par tombstone, sans effacer le hash du compte retiré", async () => {
    const { database, updates } = harness({
      sourceActivatedAt: ACTIVATED,
      existingByEmail: {
        id: 'target-parent', role: 'PARENT', email: 'parent.test@example.test',
        activatedAt: ACTIVATED, parentProfile: { id: 'target-profile' },
      },
    });
    await run(database);

    const merged = updates.find((u) => u.where.id === 'source-parent' && 'mergedIntoUserId' in u.data);
    expect(merged).toBeDefined();
    // Le tombstone suffit : les trois chemins de connexion refusent déjà un
    // compte fusionné. Effacer le hash n'ajoute rien et détruit une preuve.
    expect(Object.prototype.hasOwnProperty.call(merged!.data, 'password')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(merged!.data, 'activatedAt')).toBe(false);
    expect(merged!.data.mergedIntoUserId).toBe('target-parent');
    // Le secret à usage unique, lui, ne doit pas survivre.
    expect(merged!.data.activationToken).toBeNull();
    expect(merged!.data.sessionVersion).toEqual({ increment: 1 });
  });

  test('aucune écriture ne porte un champ de credential, tous scénarios confondus', async () => {
    for (const scenario of [
      { sourceActivatedAt: ACTIVATED },
      { sourceActivatedAt: null },
      {
        sourceActivatedAt: ACTIVATED,
        existingByEmail: {
          id: 'target-parent', role: 'PARENT', email: 'parent.test@example.test',
          activatedAt: null, parentProfile: { id: 'target-profile' },
        },
      },
    ]) {
      const { database, updates } = harness(scenario);
      await run(database);
      for (const update of updates) {
        for (const field of ['password', 'passwordHash'] as const) {
          expect(Object.prototype.hasOwnProperty.call(update.data, field)).toBe(false);
        }
      }
    }
  });

  test('exécutions concurrentes : aucune ne dégrade un credential', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => {
        const { database, updates } = harness({ sourceActivatedAt: ACTIVATED });
        return run(database).then(() => updates);
      }),
    );
    for (const updates of results) {
      for (const update of updates) {
        for (const field of CREDENTIAL_FIELDS) {
          expect(Object.prototype.hasOwnProperty.call(update.data, field)).toBe(false);
        }
      }
    }
  });
});
