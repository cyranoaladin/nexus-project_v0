/**
 * `GET /api/v2/staff/me` — garde de rôle (décision normative owner §5).
 *
 * Constat au SHA candidat : la route n'a AUCUNE garde. Tout acteur Core v2 actif
 * reçoit 200, y compris PARENT et ÉLÈVE, avec `capabilities: []`.
 *
 * Politique normative : ce point d'entrée sert les interfaces back-office.
 * PARENT et ÉLÈVE n'ont aucun usage légitime et doivent recevoir 403. La réponse
 * ne doit exposer que les données du compte courant.
 *
 * `STAFF_ROLES` doit vivre dans `lib/core-v2/rbac.ts`, seul endroit de Core v2
 * autorisé à comparer une valeur de rôle (CORE_V2_NO_INLINE_RBAC) — pas dans un
 * script, sinon deux autorités coexistent.
 */
import { NextRequest } from 'next/server';
import { ForbiddenError } from '@/lib/core-v2/errors';
import { STAFF_ROLES, assertStaffRole } from '@/lib/core-v2/rbac';

// Double minimal du pipeline, calque sur celui de
// `invitation-authorization-order.test.ts` : il faut PILOTER la vraie route,
// sinon la garde qu'elle porte n'est couverte par rien.
const actorState: { role: string; accountStatus: string } = { role: 'ADMIN', accountStatus: 'ACTIVE' };

jest.mock('@/lib/csrf', () => ({ checkBodySize: () => null, checkCsrf: () => null }));
jest.mock('@/lib/guards', () => ({
  isErrorResponse: (value: unknown) => value instanceof Response,
  requireAuth: async () => ({ user: { id: 'session-user-1', email: 'staff@example.test' } }),
}));
jest.mock('@/lib/core-v2/client', () => {
  const actual = jest.requireActual('@/lib/core-v2/client');
  return {
    ...actual,
    requireCoreV2Client: async () => ({
      user: { findUnique: async () => ({ id: 'session-user-1', role: actorState.role, accountStatus: actorState.accountStatus }) },
    } as never),
  };
});

describe('autorité des rôles staff dans rbac.ts', () => {
  test('STAFF_ROLES est défini par rbac.ts et vaut ADMIN, ASSISTANTE, COACH', () => {
    expect([...STAFF_ROLES].sort()).toEqual(['ADMIN', 'ASSISTANTE', 'COACH']);
  });

  test.each(['ADMIN', 'ASSISTANTE', 'COACH'] as const)('%s est accepté comme profil staff', (role) => {
    expect(() => assertStaffRole({ userId: 'u1', role })).not.toThrow();
  });

  test.each(['PARENT', 'ELEVE'] as const)('%s est refusé par un ForbiddenError typé', (role) => {
    expect(() => assertStaffRole({ userId: 'u1', role })).toThrow(ForbiddenError);
  });

  test("le refus ne révèle ni rôle de l'appelant, ni ressource, ni foyer, ni propriétaire", () => {
    try {
      assertStaffRole({ userId: 'u1', role: 'PARENT' });
      throw new Error('aurait dû refuser');
    } catch (error) {
      const serialized = JSON.stringify({
        message: (error as Error).message,
        details: (error as ForbiddenError).details ?? null,
      });
      expect(serialized).not.toContain('PARENT');
      expect(serialized).not.toContain('u1');
      expect(serialized).not.toContain('household');
      expect(serialized).not.toContain('owner');
    }
  });

  test("le script de synchronisation n'est pas une seconde autorité de rôles", () => {
    // Importé depuis le script : doit être la MÊME référence que celle de rbac.ts.
    const script = jest.requireActual('@/scripts/core-v2/sync-staff-actors');
    expect([...script.STAFF_ROLES].sort()).toEqual([...STAFF_ROLES].sort());
    // Lire la constante ne suffit pas : un `export ... from` nu la reexporte sans
    // l'amener dans la portee du module. Il faut APPELER le code qui l'utilise.
    expect(script.isStaffRole('ADMIN')).toBe(true);
    expect(script.isStaffRole('PARENT')).toBe(false);
  });
});

describe('GET /api/v2/staff/me — la garde est réellement portée par la route', () => {
  async function call(role: string, accountStatus = 'ACTIVE') {
    actorState.role = role;
    actorState.accountStatus = accountStatus;
    const { GET } = await import('@/app/api/v2/staff/me/route');
    return GET(new NextRequest('http://localhost/api/v2/staff/me'), { params: Promise.resolve({}) } as never);
  }

  test.each(['ADMIN', 'ASSISTANTE', 'COACH'])('%s reçoit 200 et ses seules données', async (role) => {
    const response = await call(role);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.actor).toEqual({ userId: 'session-user-1', role });
    // Uniquement le compte courant : aucune autre identité ne transparaît.
    expect(JSON.stringify(body)).not.toContain('household');
  });

  test.each(['PARENT', 'ELEVE'])('%s reçoit 403, et non 200 avec des capacités vides', async (role) => {
    const response = await call(role);
    expect(response.status).toBe(403);
    const body = await response.json();
    // Le refus ne nomme ni le rôle, ni l'identifiant de l'appelant.
    expect(JSON.stringify(body)).not.toContain(role);
    expect(JSON.stringify(body)).not.toContain('session-user-1');
  });

  test('une adhésion Core non ACTIVE est refusée avant même la garde de rôle', async () => {
    const response = await call('ADMIN', 'SUSPENDED');
    expect(response.status).toBe(403);
  });
});
