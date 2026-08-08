/**
 * Provisionnement de l'élève candidat libre.
 *
 * Aucun chemin existant ne permet à un élève d'avoir une adresse réelle **et**
 * de choisir son mot de passe : les routes de création forcent l'identifiant
 * synthétique `@nexus-student.local`, et la route admin impose un mot de passe
 * choisi par un tiers puis laisse le compte inactivable.
 *
 * Ce chemin est **isolé** du flux add-child du bilan gratuit, qui tourne en
 * production. Il ne réutilise que des primitives pures — génération de token —
 * et laisse l'activation elle-même à `completeStudentActivation`, inchangée,
 * qui pose le mot de passe fourni par l'élève.
 */

const mockUserFindUnique = jest.fn();
const mockParentProfileFindUnique = jest.fn();
const mockUserCreate = jest.fn();
const mockStudentCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      user: {
        findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
        create: (...a: unknown[]) => mockUserCreate(...a),
      },
      parentProfile: { findUnique: (...a: unknown[]) => mockParentProfileFindUnique(...a) },
      student: { create: (...a: unknown[]) => mockStudentCreate(...a) },
    }),
  },
}));

import {
  StudentProvisioningError,
  provisionCandidateLibreStudent,
} from '@/lib/diagnostics/candidat-libre/student-provisioning.server';
import { hashActivationToken } from '@/lib/auth/activation-token';

const INPUT = {
  parentUserId: 'usr_parent_1',
  firstName: 'Ahmed',
  lastName: 'Ben Hadj Salem',
  email: 'eleve.reel@example.test',
  gradeLevel: 'TERMINALE' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParentProfileFindUnique.mockResolvedValue({ id: 'pp_1' });
  mockUserFindUnique.mockResolvedValue(null);
  mockUserCreate.mockImplementation(async ({ data }: any) => ({ id: 'usr_eleve_1', ...data }));
  mockStudentCreate.mockImplementation(async ({ data }: any) => ({ id: 'stu_1', ...data }));
});

describe('provisionCandidateLibreStudent', () => {
  it('crée le compte avec l’adresse réelle fournie', async () => {
    await provisionCandidateLibreStudent(INPUT);
    const { data } = mockUserCreate.mock.calls[0][0];
    expect(data.email).toBe('eleve.reel@example.test');
    expect(data.email).not.toContain('nexus-student.local');
  });

  /** Le cœur de l'exigence : personne d'autre que l'élève ne pose son mot de passe. */
  it('ne pose jamais de mot de passe', async () => {
    await provisionCandidateLibreStudent(INPUT);
    const { data } = mockUserCreate.mock.calls[0][0];
    expect(data.password).toBeNull();
    expect(JSON.stringify(data)).not.toMatch(/motDePasse|passwordHash|"password":"/);
  });

  it('stocke le token d’activation haché, jamais en clair', async () => {
    const result = await provisionCandidateLibreStudent(INPUT);
    const { data } = mockUserCreate.mock.calls[0][0];

    expect(data.activationToken).toBe(hashActivationToken(result.activationToken));
    expect(data.activationToken).not.toBe(result.activationToken);
    expect(data.activationToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it('émet un token de finalité élève, avec expiration', async () => {
    const result = await provisionCandidateLibreStudent(INPUT);
    expect(result.activationToken.startsWith('sact_')).toBe(true);
    const { data } = mockUserCreate.mock.calls[0][0];
    expect(data.activationTokenExpiresAt).toBeInstanceOf(Date);
    expect(data.activationTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('laisse le compte inactif jusqu’à l’activation par l’élève', async () => {
    await provisionCandidateLibreStudent(INPUT);
    const { data } = mockUserCreate.mock.calls[0][0];
    expect(data.activatedAt ?? null).toBeNull();
    expect(data.role).toBe('ELEVE');
  });

  it('rattache l’élève au profil du parent', async () => {
    await provisionCandidateLibreStudent(INPUT);
    const { data } = mockStudentCreate.mock.calls[0][0];
    expect(data.parentId).toBe('pp_1');
    expect(data.userId).toBe('usr_eleve_1');
    expect(data.gradeLevel).toBe('TERMINALE');
  });

  it('refuse quand le parent n’a pas de profil', async () => {
    mockParentProfileFindUnique.mockResolvedValue(null);
    await expect(provisionCandidateLibreStudent(INPUT)).rejects.toThrow(/PARENT_NOT_FOUND/);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('refuse une adresse déjà utilisée', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'usr_existant' });
    await expect(provisionCandidateLibreStudent(INPUT)).rejects.toThrow(/EMAIL_ALREADY_USED/);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['vide', ''],
    ['sans arobase', 'pas-une-adresse'],
    ['domaine synthétique', 'eleve@nexus-student.local'],
  ])('refuse une adresse %s', async (_label, email) => {
    await expect(provisionCandidateLibreStudent({ ...INPUT, email }))
      .rejects.toThrow(StudentProvisioningError);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('normalise l’adresse en minuscules', async () => {
    await provisionCandidateLibreStudent({ ...INPUT, email: '  Eleve.Reel@Example.Test  ' });
    expect(mockUserCreate.mock.calls[0][0].data.email).toBe('eleve.reel@example.test');
  });

  it('ne retourne jamais de mot de passe', async () => {
    const result = await provisionCandidateLibreStudent(INPUT);
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(['studentId', 'userId', 'activationToken']),
    );
    expect(JSON.stringify(result)).not.toMatch(/password/i);
  });
});

describe('isolation du flux bilan gratuit', () => {
  /**
   * Non-régression : ce chemin ne doit pas toucher au flux add-child, qui sert
   * les familles en production. Il ne réutilise que la primitive pure de
   * génération de token et n'importe aucun service partagé mutable.
   */
  it('n’importe pas le service d’activation du flux add-child', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'lib/diagnostics/candidat-libre/student-provisioning.server.ts'),
      'utf8',
    );
    expect(source).not.toContain('student-activation.service');
    expect(source).not.toContain('student-login-identifier');
    expect(source).toContain('activation-token');
  });
});
