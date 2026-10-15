/**
 * `disabledAt` est le statut de suspension dédié
 * (prisma/schema.prisma:363 — « non-null = compte désactivé (connexion refusée) »).
 *
 * Défaut relevé en revue indépendante : il était imposé sur le chemin Espace
 * (lib/auth/espace-authorize.ts:68) mais PAS sur le chemin e-mail/mot de passe,
 * si bien qu'un compte désactivé pouvait encore se connecter — et, dès qu'une
 * adhésion Core v2 existe, atteindre Core avec cette session.
 *
 * Rien ne l'assertait : c'est précisément pourquoi le défaut a survécu, et
 * pourquoi la neutralisation par statut doit être PROUVÉE et non supposée.
 */
import bcrypt from 'bcryptjs';
import { authorizeCredentials } from '@/lib/auth/credentials-authorize';
import { prisma } from '@/lib/prisma';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('@/auth', () => ({ auth: jest.fn() }));

const active = {
  id: 'parent-1',
  email: 'parent@example.test',
  role: 'PARENT' as const,
  password: 'stored-hash',
  activatedAt: new Date('2026-05-01T08:30:00.000Z'),
  phoneNormalized: null,
  parentPhoneState: 'NONE' as const,
  phoneVerifiedAt: null,
  mergedIntoUserId: null,
  disabledAt: null as Date | null,
  sessionVersion: 1,
};

const savedMode = process.env.CORE_V2_AUTH_MODE;

beforeEach(() => {
  jest.clearAllMocks();
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  // L'authentification refuse de deviner le dépositaire des identités : le mode
  // doit être explicite. On éprouve celui de la production.
  process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
});

afterAll(() => {
  if (savedMode === undefined) delete process.env.CORE_V2_AUTH_MODE;
  else process.env.CORE_V2_AUTH_MODE = savedMode;
});

describe('la suspension par statut refuse la connexion sur le chemin e-mail', () => {
  test('contrôle positif : un compte actif avec le bon mot de passe est authentifié', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(active);
    await expect(authorizeCredentials({ email: active.email, password: 'correct' }))
      .resolves.toEqual(expect.objectContaining({ id: 'parent-1' }));
  });

  test('un compte DÉSACTIVÉ est refusé, même avec le bon mot de passe', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...active, disabledAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    await expect(authorizeCredentials({ email: active.email, password: 'correct' }))
      .resolves.toBeNull();
  });

  test('un compte FUSIONNÉ est refusé, même avec le bon mot de passe', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...active, mergedIntoUserId: 'parent-2',
    });
    await expect(authorizeCredentials({ email: active.email, password: 'correct' }))
      .resolves.toBeNull();
  });

  test('le refus est antérieur à la comparaison du mot de passe : aucun oracle de validité', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...active, disabledAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    await authorizeCredentials({ email: active.email, password: 'correct' });
    // Si bcrypt était appelé, un attaquant pourrait distinguer « désactivé avec
    // bon mot de passe » de « désactivé avec mauvais mot de passe » au timing.
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test.each([
    ['désactivé', { disabledAt: new Date('2026-10-01T00:00:00.000Z') }],
    ['fusionné', { mergedIntoUserId: 'parent-2' }],
    ['désactivé et fusionné', { disabledAt: new Date(), mergedIntoUserId: 'parent-2' }],
  ])('un compte %s est refusé quel que soit le mot de passe fourni', async (_label, patch) => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...active, ...patch });
    for (const password of ['correct', 'wrong', '']) {
      await expect(authorizeCredentials({ email: active.email, password })).resolves.toBeNull();
    }
  });
});
