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
import { ForbiddenError } from '@/lib/core-v2/errors';
import { STAFF_ROLES, assertStaffRole } from '@/lib/core-v2/rbac';

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
