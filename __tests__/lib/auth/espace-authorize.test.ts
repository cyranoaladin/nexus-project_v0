import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';

const findUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { authorizeEspaceCredentials } from '@/lib/auth/espace-authorize';
import { hashPin } from '@/lib/espace/pin';

const PIN = 'ABCD2345';
let pinHash: string;
// Généré à chaque exécution : aucun mot de passe en littéral dans le dépôt.
const coachPassword = randomBytes(18).toString('base64url');
let passwordHash: string;

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: null,
    role: 'ELEVE',
    firstName: 'Adam',
    lastName: 'CHOUKALI',
    sessionVersion: 3,
    activatedAt: new Date('2026-10-01'),
    disabledAt: null,
    mergedIntoUserId: null,
    pinHash,
    password: null,
    ...over,
  };
}

beforeAll(async () => {
  pinHash = await hashPin(PIN);
  passwordHash = await bcrypt.hash(coachPassword, 4);
});
beforeEach(() => findUnique.mockReset());

describe('authorizeEspaceCredentials — élève', () => {
  it('accepte un identifiant et un code valides, sans email', async () => {
    findUnique.mockResolvedValue(row());
    const user = await authorizeEspaceCredentials({ username: 'adam.c', secret: PIN });
    expect(user).toMatchObject({ id: 'u1', role: 'ELEVE', email: null, sessionVersion: 3, authority: 'V1' });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { username: 'adam.c' } }));
  });

  it("tolère la casse de l'identifiant et le format affiché du code", async () => {
    findUnique.mockResolvedValue(row());
    expect(await authorizeEspaceCredentials({ username: ' ADAM.C ', secret: 'abcd-2345' })).not.toBeNull();
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { username: 'adam.c' } }));
  });

  it('refuse un mauvais code', async () => {
    findUnique.mockResolvedValue(row());
    expect(await authorizeEspaceCredentials({ username: 'adam.c', secret: 'ZZZZ9999' })).toBeNull();
  });

  it('refuse un identifiant inconnu', async () => {
    findUnique.mockResolvedValue(null);
    expect(await authorizeEspaceCredentials({ username: 'inconnu.x', secret: PIN })).toBeNull();
  });

  it('refuse un compte désactivé', async () => {
    findUnique.mockResolvedValue(row({ disabledAt: new Date() }));
    expect(await authorizeEspaceCredentials({ username: 'adam.c', secret: PIN })).toBeNull();
  });

  it('refuse un compte élève non activé', async () => {
    findUnique.mockResolvedValue(row({ activatedAt: null }));
    expect(await authorizeEspaceCredentials({ username: 'adam.c', secret: PIN })).toBeNull();
  });

  it('refuse un compte fusionné', async () => {
    findUnique.mockResolvedValue(row({ mergedIntoUserId: 'autre' }));
    expect(await authorizeEspaceCredentials({ username: 'adam.c', secret: PIN })).toBeNull();
  });

  it("refuse un élève sans code défini, même avec un mot de passe qui correspondrait", async () => {
    findUnique.mockResolvedValue(row({ pinHash: null, password: passwordHash }));
    expect(await authorizeEspaceCredentials({ username: 'adam.c', secret: coachPassword })).toBeNull();
  });

  it('refuse un identifiant mal formé sans interroger la base', async () => {
    expect(await authorizeEspaceCredentials({ username: 'adam@x.tn', secret: PIN })).toBeNull();
    expect(await authorizeEspaceCredentials({ username: '', secret: PIN })).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('refuse des entrées non textuelles', async () => {
    expect(await authorizeEspaceCredentials({ username: 'adam.c', secret: undefined })).toBeNull();
    expect(await authorizeEspaceCredentials({ username: { $ne: 1 }, secret: PIN })).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('authorizeEspaceCredentials — enseignant', () => {
  const coach = (over: Record<string, unknown> = {}) =>
    row({ role: 'COACH', pinHash: null, password: passwordHash, firstName: 'Alaeddine', ...over });

  it('un coach se connecte avec son mot de passe, casse du mot de passe respectée', async () => {
    findUnique.mockResolvedValue(coach());
    expect(await authorizeEspaceCredentials({ username: 'alaeddine', secret: coachPassword })).toMatchObject({ role: 'COACH' });
    expect(await authorizeEspaceCredentials({ username: 'alaeddine', secret: coachPassword.toUpperCase() })).toBeNull();
  });

  it("un coach ne peut pas se connecter avec un code d'élève même s'il en avait un", async () => {
    findUnique.mockResolvedValue(coach({ pinHash }));
    expect(await authorizeEspaceCredentials({ username: 'alaeddine', secret: PIN })).toBeNull();
  });
});

describe('authorizeEspaceCredentials — autres rôles', () => {
  it.each(['ADMIN', 'ASSISTANTE', 'PARENT'])('%s ne peut pas utiliser ce chemin de connexion', async (role) => {
    findUnique.mockResolvedValue(row({ role, password: passwordHash, pinHash }));
    expect(await authorizeEspaceCredentials({ username: 'x.y', secret: PIN })).toBeNull();
    expect(await authorizeEspaceCredentials({ username: 'x.y', secret: coachPassword })).toBeNull();
  });
});
