/**
 * Contrat HTTP canonique des routes d'invitation (§3 de la directive).
 *
 * Défaut visé (D1) : `assertAccountEmailHandoffRuntimeConfiguration()` était la
 * PREMIÈRE instruction du handler, donc exécutée AVANT toute vérification de
 * capacité. Sous `CORE_V2_AUTH_MODE=V1_ONLY` elle lève `CoreV2ConfigError`, ce
 * qui produisait un 503 CORE_V2_MISCONFIGURED pour TOUS les rôles — y compris un
 * acteur authentifié, actif, mais NON autorisé, qui doit recevoir 403.
 *
 * Un 503 n'est légitime que si la dépendance Core v2 est réellement absente,
 * inaccessible, en timeout, ou porte un marqueur d'identité invalide. Il ne doit
 * jamais masquer une décision d'autorisation.
 *
 * Ces tests espionnent l'ORDRE des appels : la configuration de remise ne doit
 * pas être consultée pour un appelant non autorisé.
 */
import { NextRequest } from 'next/server';

const calls: string[] = [];

const actorState: { role: string; accountStatus: string } = { role: 'ADMIN', accountStatus: 'ACTIVE' };
let coreClientAvailable = true;

jest.mock('@/lib/csrf', () => ({
  checkBodySize: () => null,
  checkCsrf: () => null,
}));

jest.mock('@/lib/guards', () => ({
  isErrorResponse: (value: unknown) => value instanceof Response,
  requireAuth: async () => {
    calls.push('requireAuth');
    return { user: { id: 'session-user-1', email: 'staff@example.test' } };
  },
}));

// On conserve TOUS les exports réels (respond.ts fait `instanceof`
// CoreV2DatabaseUrlError / CoreV2DatabaseIdentityError : les remplacer par des
// classes factices casse `instanceof` et produit un faux échec).
jest.mock('@/lib/core-v2/client', () => {
  const actual = jest.requireActual('@/lib/core-v2/client');
  return {
    ...actual,
    requireCoreV2Client: async () => {
      calls.push('requireCoreV2Client');
      if (!coreClientAvailable) throw new actual.CoreV2DatabaseUrlError('unavailable');
      return {} as never;
    },
  };
});

// Mock FIDÈLE à lib/core-v2/http/actor.ts:21-28 : un acteur absent ou non actif
// lève ForbiddenError (403) ; sinon l'acteur ne porte que userId et role.
jest.mock('@/lib/core-v2/http/actor', () => ({
  resolveActor: async () => {
    calls.push('resolveActor');
    const { ForbiddenError } = jest.requireActual('@/lib/core-v2/errors');
    if (actorState.accountStatus !== 'ACTIVE') {
      throw new ForbiddenError('This account is not active in Core v2.', {
        code: 'ACTOR_NOT_ACTIVE',
        accountStatus: actorState.accountStatus,
      });
    }
    return { userId: 'core-user-1', role: actorState.role };
  },
}));

jest.mock('@/lib/core-v2/accounts/email-handoff-scheduler', () => ({
  assertAccountEmailHandoffRuntimeConfiguration: () => {
    calls.push('assertDeliveryConfiguration');
    // Comportement mesuré au SHA candidat sous V1_ONLY.
    const { CoreV2ConfigError } = jest.requireActual('@/lib/core-v2/config');
    throw new CoreV2ConfigError('ACCOUNT_EMAIL_CORE_AUTH_DISABLED');
  },
  kickAccountEmailHandoffDrain: () => undefined,
}));

jest.mock('@/lib/core-v2/services', () => ({
  inviteAccount: async () => {
    calls.push('inviteAccount');
    return {
      invitation: { id: 'inv-1', expiresAt: new Date('2026-12-31T00:00:00.000Z') },
      rawToken: 'never-returned-to-the-client',
      email: 'invitee@example.test',
      handoffId: 'handoff-1',
    };
  },
  resendInvitation: async () => {
    calls.push('resendInvitation');
    return {
      invitation: { id: 'inv-2', expiresAt: new Date('2026-12-31T00:00:00.000Z') },
      rawToken: 'never-returned-to-the-client',
      email: 'invitee@example.test',
      handoffId: 'handoff-2',
    };
  },
}));

function request(): NextRequest {
  return new NextRequest('https://nexusreussite.academy/api/v2/staff/accounts/u1/invite', {
    method: 'POST',
    headers: { origin: 'https://nexusreussite.academy', 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
}

const context = { params: Promise.resolve({ id: 'u1' }) } as never;

async function callInvite() {
  jest.resetModules();
  const mod = await import('@/app/api/v2/staff/accounts/[id]/invite/route');
  return mod.POST(request(), context);
}

describe("contrat d'autorisation des routes d'invitation sous V1_ONLY", () => {
  beforeEach(() => {
    calls.length = 0;
    coreClientAvailable = true;
    actorState.role = 'ADMIN';
    actorState.accountStatus = 'ACTIVE';
  });

  test("un acteur authentifié mais SANS capacité reçoit 403, jamais 503", async () => {
    actorState.role = 'ELEVE'; // aucune capacité back-office
    const response = await callInvite();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(response.status).not.toBe(503);
  });

  test("la configuration de remise n'est PAS consultée pour un appelant non autorisé", async () => {
    actorState.role = 'PARENT';
    await callInvite();

    expect(calls).toContain('resolveActor');
    expect(calls).not.toContain('assertDeliveryConfiguration');
    expect(calls).not.toContain('inviteAccount');
  });

  test("l'autorisation précède la configuration de remise dans l'ordre d'appel", async () => {
    actorState.role = 'ADMIN'; // autorisé : la configuration est alors légitimement consultée
    await callInvite();

    const actor = calls.indexOf('resolveActor');
    const delivery = calls.indexOf('assertDeliveryConfiguration');
    expect(actor).toBeGreaterThanOrEqual(0);
    expect(delivery).toBeGreaterThan(actor);
  });

  test("un acteur inactif reçoit 403, pas 503", async () => {
    actorState.role = 'ADMIN';
    actorState.accountStatus = 'SUSPENDED';
    const response = await callInvite();
    expect([403]).toContain(response.status);
  });

  test("Core v2 réellement indisponible reste un 503 légitime", async () => {
    coreClientAvailable = false;
    const response = await callInvite();
    expect(response.status).toBe(503);
    expect(calls).not.toContain('resolveActor');
  });

  test("aucun jeton brut n'apparaît dans la réponse d'un appel autorisé", async () => {
    actorState.role = 'ADMIN';
    const response = await callInvite();
    const text = await response.text();
    expect(text).not.toContain('never-returned-to-the-client');
  });
});
