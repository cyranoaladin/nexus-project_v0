/**
 * Les 410 décisions d'accès, EXÉCUTÉES.
 *
 * `docs/core-v2/access-policy.json` est normatif : il dit quels rôles doivent
 * franchir chaque handler, et il doit pouvoir contredire l'implémentation.
 * Jusqu'ici il n'était confronté à rien — un document, pas une garde.
 *
 * Cette suite résout, pour chacun des 82 handlers, la garde RÉELLEMENT posée
 * dans les sources (dans la route, ou dans le service qu'elle appelle, en
 * suivant les appels), calcule l'ensemble des rôles qui la franchissent d'après
 * `lib/core-v2/rbac.ts`, et le compare à `roles_allowed`. Soit 82 × 5 = 410
 * décisions, une assertion chacune.
 *
 * Elle attrape trois classes de défaut que rien ne voyait :
 *   — une garde qui laisse passer un rôle que la politique refuse ;
 *   — une garde qui refuse un rôle que la politique autorise ;
 *   — un handler SANS garde résoluble, c'est-à-dire sans décision d'accès.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CAPABILITIES, STAFF_ROLES, capabilitiesForRole, type Capability } from '@/lib/core-v2/rbac';

const ROOT = process.cwd();
const ROLES = ['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const;
type Role = (typeof ROLES)[number];

const policy = JSON.parse(
  readFileSync(join(ROOT, 'docs/core-v2/access-policy.json'), 'utf8'),
) as {
  handlers_covered: number;
  policies: Array<{
    handler_id: string;
    roles_allowed: Role[];
    refusal_status: number;
    access_class: 'ROLE_OR_CAPABILITY' | 'PUBLIC_RATE_LIMITED' | 'CORE_V2_SESSION_ONLY';
    enforced_restrictions?: string[];
    declared_but_not_implemented?: string[];
  }>;
};

type Gate =
  | { kind: 'CAPABILITY'; value: Capability }
  | { kind: 'ROLE_SELF_SERVICE'; value: Role }
  | { kind: 'ROLE_STAFF' }
  /** Sous V1_ONLY, Core v1 détient les identifiants : ces chemins sont clos. */
  | { kind: 'CREDENTIAL_AUTHORITY_IS_V1' };

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (full.endsWith('.ts')) yield full;
  }
}

/** Corps de toutes les fonctions de la couche service, exportées ou non. */
function indexFunctionBodies(): Map<string, string[]> {
  const bodies = new Map<string, string[]>();
  const push = (name: string, body: string) => {
    const list = bodies.get(name) ?? [];
    list.push(body);
    bodies.set(name, list);
  };
  for (const file of walk(join(ROOT, 'lib/core-v2'))) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g)) {
      push(m[1]!, source.slice(m.index! + m[0].length, m.index! + m[0].length + 3000));
    }
    for (const m of source.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g)) {
      push(m[1]!, source.slice(m.index! + m[0].length, m.index! + m[0].length + 3000));
    }
  }
  return bodies;
}

function gateIn(text: string): Gate | null {
  const cap = /assertCapability\(\s*[^,]+,\s*'([A-Z_]+)'/.exec(text);
  if (cap) return { kind: 'CAPABILITY', value: cap[1] as Capability };
  const self = /assertSelfServiceRole\(\s*[^,]+,\s*'([A-Z]+)'/.exec(text);
  if (self) return { kind: 'ROLE_SELF_SERVICE', value: self[1] as Role };
  if (/assertStaffRole\(/.test(text)) return { kind: 'ROLE_STAFF' };
  if (/assertCoreMayHoldCredentials\(/.test(text)) return { kind: 'CREDENTIAL_AUTHORITY_IS_V1' };
  return null;
}

const BODIES = indexFunctionBodies();

/** Suit les appels jusqu'à trouver la garde, en profondeur bornée. */
function resolveGate(text: string, depth: number, seen: Set<string>): Gate | null {
  const here = gateIn(text);
  if (here) return here;
  if (depth >= 3) return null;
  for (const m of text.matchAll(/\b([a-z][A-Za-z0-9]{3,})\s*\(/g)) {
    const name = m[1]!;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const body of BODIES.get(name) ?? []) {
      const found = resolveGate(body, depth + 1, seen);
      if (found) return found;
    }
  }
  return null;
}

/** Les rôles qui franchissent réellement cette garde, d'après rbac.ts. */
function rolesPassing(gate: Gate): Role[] {
  switch (gate.kind) {
    case 'CAPABILITY':
      return ROLES.filter((role) => (capabilitiesForRole(role) as readonly string[]).includes(gate.value));
    case 'ROLE_SELF_SERVICE':
      return ROLES.filter((role) => role === gate.value);
    case 'ROLE_STAFF':
      return ROLES.filter((role) => (STAFF_ROLES as readonly string[]).includes(role));
    case 'CREDENTIAL_AUTHORITY_IS_V1':
      // Aucun rôle n'y accède sous V1_ONLY : Core v1 est l'autorité.
      return [];
  }
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Garde résolue par handler, mesurée une seule fois. */
const observed = new Map<string, Gate | null>();
for (const file of walk(join(ROOT, 'app/api/v2'))) {
  if (!file.endsWith('route.ts')) continue;
  const source = readFileSync(file, 'utf8');
  const route = `/${file.slice(ROOT.length + 1).replace(/^app\//, '').replace(/\/route\.ts$/, '')}`;
  const gate = resolveGate(source, 0, new Set());
  for (const method of METHODS) {
    if (new RegExp(`^export\\s+(?:const|async\\s+function|function)\\s+${method}\\b`, 'm').test(source)) {
      observed.set(`${method} ${route}`, gate);
    }
  }
}

describe('la politique d’accès porte réellement sur 82 handlers', () => {
  test('le document couvre exactement les handlers présents dans les sources', () => {
    expect(policy.policies).toHaveLength(policy.handlers_covered);
    const declared = new Set(policy.policies.map((p) => p.handler_id));
    const present = new Set(observed.keys());
    // Un handler ajouté sans décision, ou une décision qui survit à la
    // suppression de son handler, sont tous deux des défauts.
    expect([...present].filter((h) => !declared.has(h)).sort()).toEqual([]);
    expect([...declared].filter((h) => !present.has(h)).sort()).toEqual([]);
    expect(present.size).toBe(82);
  });

  test('tout handler sans garde de rôle est déclaré PUBLIC, jamais par omission', () => {
    // Un handler peut légitimement n’avoir aucune garde de rôle — une demande de
    // réinitialisation est publique. Mais cela doit Être DIT dans la politique :
    // une absence de garde silencieuse est indiscernable d’un oubli.
    const declared = new Map(policy.policies.map((e) => [e.handler_id, e.access_class]));
    const ungatedButNotDeclared = [...observed.entries()]
      .filter(([h, g]) => g === null && declared.get(h) === 'ROLE_OR_CAPABILITY')
      .map(([h]) => h).sort();
    expect(ungatedButNotDeclared).toEqual([]);
  });

  test('un chemin déclaré PUBLIC exige même origine ET limitation de débit', () => {
    // « Public » ne veut pas dire « sans protection » : sans ces deux gardes, un
    // point d’entrée anonyme est un amplificateur.
    const missing: string[] = [];
    for (const entry of policy.policies.filter((e) => e.access_class === 'PUBLIC_RATE_LIMITED')) {
      const route = entry.handler_id.replace(/^[A-Z]+ \/api\/v2/, 'app/api/v2') + '/route.ts';
      const source = readFileSync(join(ROOT, route), 'utf8');
      if (!/checkCsrf\(/.test(source)) missing.push(`${entry.handler_id}: checkCsrf`);
      if (!/guardSensitiveRateLimit\(/.test(source)) missing.push(`${entry.handler_id}: rate-limit`);
    }
    expect(missing).toEqual([]);
  });

  test('le chemin à session Core v2 refuse tout rôle sous V1_ONLY', () => {
    for (const entry of policy.policies.filter((e) => e.access_class === 'CORE_V2_SESSION_ONLY')) {
      const route = entry.handler_id.replace(/^[A-Z]+ \/api\/v2/, 'app/api/v2') + '/route.ts';
      const source = readFileSync(join(ROOT, route), 'utf8');
      // Mesuré dans la source : 401 sans session, 403 WRONG_AUTHORITY sous V1_ONLY.
      expect(source).toContain("'UNAUTHENTICATED'");
      expect(source).toContain("'WRONG_AUTHORITY'");
      expect(source).toMatch(/getAuthRolloutMode\(\)\s*===\s*'V1_ONLY'/);
      expect(entry.roles_allowed).toEqual([]);
      expect(entry.refusal_status).toBe(403);
    }
  });

  test('aucune garde ne nomme une capacité absente de rbac.ts', () => {
    // Ce contrôle manquait : la politique citait sept capacités inexistantes,
    // sur 65 de ses 82 entrées. Un nom fantôme n’est confrontable à rien.
    const phantom = [...observed.values()]
      .filter((g): g is Extract<Gate, { kind: 'CAPABILITY' }> => g?.kind === 'CAPABILITY')
      .map((g) => g.value)
      .filter((c) => !(CAPABILITIES as readonly string[]).includes(c));
    expect([...new Set(phantom)].sort()).toEqual([]);
  });

  test('le plafond de rôle annoncé comme imposé l’est réellement', () => {
    // Une restriction listee dans `enforced_restrictions` doit etre trouvable
    // dans le code. L'inverse — annoncer un controle absent — est le defaut que
    // ce test existe pour rendre impossible.
    const entries = policy.policies.filter((e) => (e.enforced_restrictions ?? []).length > 0);
    expect(entries.length).toBeGreaterThan(0);
    const gateway = readFileSync(join(ROOT, 'lib/auth/v1-account-invitation.ts'), 'utf8');
    const provisioning = readFileSync(join(ROOT, 'lib/core-v2/accounts/v1-provisioning.ts'), 'utf8');
    // Le plafond est pose aux deux points d'entree, pas a un seul.
    expect((gateway.match(/isInvitableRole\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(provisioning).toContain('isInvitableRole(');
  });

  test('toute exigence non tenue est nommée, jamais passee sous silence', () => {
    // Le perimetre de l'emetteur est exige par la politique et absent du code.
    // Il doit figurer en clair : une intention prise pour un controle est un
    // faux sentiment de securite.
    const unimplemented = policy.policies.flatMap((e) => e.declared_but_not_implemented ?? []);
    expect(unimplemented.length).toBeGreaterThan(0);
    // Et la mesure qui le motive : aucun controle de perimetre dans le chemin.
    const account = readFileSync(join(ROOT, 'lib/core-v2/services/account.ts'), 'utf8');
    expect(account).not.toMatch(/assertScope\(|withinScope\(|assertPerimeter\(/);
  });

  test('la mesure voit réellement des gardes de chaque famille', () => {
    // Plancher : sans lui, un résolveur cassé rendrait tout `null` et les
    // comparaisons ci-dessous deviendraient vides.
    const kinds = new Set([...observed.values()].map((g) => g?.kind));
    expect(kinds).toContain('CAPABILITY');
    expect(kinds).toContain('ROLE_STAFF');
    expect(kinds).toContain('ROLE_SELF_SERVICE');
  });
});

describe('410 décisions : la garde réelle vaut exactement ce que la politique exige', () => {
  for (const entry of policy.policies) {
    for (const role of ROLES) {
      const expectedAllowed = entry.roles_allowed.includes(role);
      test(`${entry.handler_id} — ${role} ${expectedAllowed ? 'autorisé' : 'refusé'}`, () => {
        const gate = observed.get(entry.handler_id);
        if (entry.access_class !== 'ROLE_OR_CAPABILITY') {
          // Classes publique et session-Core : aucun rôle ne franchit une garde
          // de rôle, puisqu'il n'y en a pas. Leurs protections propres sont
          // vérifiées par les deux tests dédiés ci-dessus.
          expect(expectedAllowed).toBe(false);
          return;
        }
        expect(gate).not.toBeNull();
        expect(rolesPassing(gate!).includes(role)).toBe(expectedAllowed);
      });
    }
  }
});
