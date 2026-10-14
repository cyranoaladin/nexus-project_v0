/** Static role ceilings and eight meta-invariants. These are NOT HTTP runs. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { createAccessInventory, type ObservedGate } from '@/scripts/core-v2/access-policy-inventory';
import { CAPABILITIES, STAFF_ROLES, capabilitiesForRole, assertCapabilityClassificationIsExhaustive } from '@/lib/core-v2/rbac';
const ROOT = process.cwd();
const ROLES = ['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const;
type Role = typeof ROLES[number];
type Policy = { handler_id: string; roles_allowed: Role[]; access_class: string; refusal_status: number;
  declared_but_not_implemented?: string[]; enforced_restrictions?: string[];
  implementation?: { status: string; hooks: string[]; tests: string[] }; contextual_requirements?: string[] };
const policy = JSON.parse(readFileSync(join(ROOT, 'docs/core-v2/access-policy.json'), 'utf8')) as
  { handlers_covered: number; policies: Policy[] };
const inventory = createAccessInventory(ROOT);
const observed = new Map(inventory.handlers.map(handler => [handler.id, handler]));
function passes(role: Role, gate: ObservedGate) {
  switch (gate.kind) {
    case 'CAPABILITY': return (capabilitiesForRole(role) as readonly string[]).includes(gate.value);
    case 'ROLE_SELF_SERVICE': return role === gate.value;
    case 'ROLE_STAFF': return (STAFF_ROLES as readonly string[]).includes(role);
    case 'CREDENTIAL_AUTHORITY_IS_V1': return false;
    case 'BOUNDARY_AUTH':
    case 'BOUNDARY_CORE': return true;
    case 'BOUNDARY_SELF_METADATA': return true;
    case 'BOUNDARY_HANDLER': return true;
    case 'BOUNDARY_PRIVATE_V1':
    case 'BOUNDARY_V1_LEASE':
    case 'BOUNDARY_V1_RELEASE':
    case 'BOUNDARY_FRESH_CORE': return true;
  }
}
function hasCall(id: string, source: string, name: string) {
  return observed.get(id)?.calls.some(call => call.source === source && call.name === name);
}
function literalStrings(id: string) {
  const range = observed.get(id)?.bodyRange; if (!range) return [];
  const source = readFileSync(join(ROOT, range.file), 'utf8').slice(range.start, range.end);
  const ast = ts.createSourceFile('body.ts', source, ts.ScriptTarget.Latest, true);
  const values: string[] = []; function visit(node: ts.Node) { if (ts.isStringLiteralLike(node)) values.push(node.text); ts.forEachChild(node, visit); }
  visit(ast); return values;
}
describe('eight access-policy meta-invariants', () => {
  test('META_1_EXACT_EXPORT_COVERAGE — every export has one normative decision', () => {
    expect(policy.policies).toHaveLength(policy.handlers_covered);
    expect(new Set(policy.policies.map(entry => entry.handler_id)).size).toBe(policy.handlers_covered);
    expect([...observed.keys()].sort()).toEqual(policy.policies.map(entry => entry.handler_id).sort());
  });
  test('META_2_PRIVATE_BOUNDARY — each private export resolves its own authentication and guards', () => {
    for (const entry of policy.policies.filter(entry => entry.access_class === 'ROLE_OR_CAPABILITY')) {
      const handler = observed.get(entry.handler_id)!;
      expect({ id: entry.handler_id, unguarded: handler.unguardedPath, unresolved: handler.unresolved })
        .toEqual({ id: entry.handler_id, unguarded: false, unresolved: [] });
      expect(handler.boundaryPaths.length).toBeGreaterThan(0);
      for(const path of handler.boundaryPaths) expect(path.some((gate,index)=>gate.kind==='BOUNDARY_AUTH'
        && path.slice(index+1).some(next=>next.kind==='BOUNDARY_CORE'&&next.value===gate.value))).toBe(true);
    }
    const ariaIds = [
      'GET /api/v2/aria/cockpit', 'GET /api/v2/aria/cockpit/profile',
      'GET /api/v2/aria/conversations', 'GET /api/v2/aria/conversations/[conversationId]/messages',
      'GET /api/v2/aria/curriculum', 'POST /api/v2/aria/chat', 'POST /api/v2/aria/feedback',
      'POST /api/v2/aria/turns/[turnId]/cancel', 'PUT /api/v2/aria/cockpit/profile',
    ];
    expect(inventory.handlers.filter(value => value.id.includes(' /api/v2/aria/'))
      .map(value => value.id).sort()).toEqual(ariaIds);
    expect(policy.policies.filter(value => ariaIds.includes(value.handler_id))
      .every(value => value.access_class === 'ROLE_OR_CAPABILITY')).toBe(true);
    for (const id of ariaIds) for (const path of observed.get(id)!.boundaryPaths) {
      const freshIndices = path.flatMap((gate, index) => gate.kind === 'BOUNDARY_FRESH_CORE' ? [index] : []);
      expect(freshIndices.length).toBeGreaterThan(0);
      for (const freshIndex of freshIndices) {
        const fresh = path[freshIndex], core = path[freshIndex - 1];
        expect(core?.kind).toBe('BOUNDARY_CORE');
        expect(core?.callSite).toEqual(fresh.callSite);
        expect(fresh.declaration.file).toBe('lib/core-v2/http/actor.ts');
        const priorLeaseEvents = path.slice(0, freshIndex).flatMap((gate, index) =>
          gate.value === fresh.value && ['BOUNDARY_V1_LEASE', 'BOUNDARY_V1_RELEASE'].includes(gate.kind)
            ? [{ gate, index }] : []);
        const retained = priorLeaseEvents[priorLeaseEvents.length - 1];
        expect({ id, lease: retained?.gate.kind }).toEqual({ id, lease: 'BOUNDARY_V1_LEASE' });
        expect(retained?.gate.declaration.file).toBe('lib/auth/v1-session-authority.ts');
        const privateCaptures = path.slice(0, retained!.index).flatMap((gate, index) =>
          gate.kind === 'BOUNDARY_PRIVATE_V1' && gate.value === fresh.value ? [{ gate, index }] : []);
        expect(privateCaptures.length).toBeGreaterThan(0);
        const original = privateCaptures[privateCaptures.length - 1];
        expect(original.gate.declaration.file).toBe('lib/auth/private-v1-session.ts');
        expect(path.slice(0, original.index).some(gate =>
          gate.kind === 'BOUNDARY_AUTH' && gate.value === core.value)).toBe(true);
      }
    }
    const self = policy.policies.filter(entry => entry.access_class === 'SELF_MEMBERSHIP_METADATA');
    expect(self.map(entry => entry.handler_id)).toEqual(['GET /api/v2/self/membership']);
    const handler = observed.get(self[0].handler_id)!;
    expect(handler.unresolved).toEqual([]);
    expect(handler.unguardedPath).toBe(false);
    expect(handler.boundaryPaths.length).toBeGreaterThan(0);
    for (const path of handler.boundaryPaths) expect(path.some((gate, index) => gate.kind === 'BOUNDARY_AUTH'
      && path.slice(index + 1).some(next => next.kind === 'BOUNDARY_SELF_METADATA' && next.value === gate.value))).toBe(true);
    expect(handler.guards.some(gate => gate.kind === 'BOUNDARY_CORE' || gate.kind === 'CAPABILITY')).toBe(false);
  });
  test('META_3_PUBLIC_METHOD_BOUNDARY — previews and mutations have their own protections', () => {
    for (const entry of policy.policies.filter(entry => entry.access_class === 'PUBLIC_RATE_LIMITED')) {
      expect(hasCall(entry.handler_id, 'lib/rate-limit/sensitive.ts', 'guardSensitiveRateLimit')).toBe(true);
      if (entry.handler_id.startsWith('GET ')) {
        expect(literalStrings(entry.handler_id)).toContain('private, no-store, max-age=0');
        expect(observed.get(entry.handler_id)?.guards.some(gate => gate.kind === 'CAPABILITY')).toBe(false);
      } else expect(hasCall(entry.handler_id, 'lib/csrf.ts', 'checkCsrf')).toBe(true);
    }
  });
  test('META_4_V1_CREDENTIAL_AUTHORITY — legacy Core credential mutations are closed under V1_ONLY', () => {
    for (const entry of policy.policies.filter(entry => entry.access_class === 'CORE_V2_SESSION_ONLY')) {
      const literals = literalStrings(entry.handler_id);
      expect(literals).toContain('UNAUTHENTICATED'); expect(literals).toContain('WRONG_AUTHORITY'); expect(literals).toContain('V1_ONLY');
      expect(entry.roles_allowed).toEqual([]); expect(entry.refusal_status).toBe(403);
    }
    for (const id of ['POST /api/v2/auth/activate', 'POST /api/v2/auth/password-reset/confirm'])
      expect(hasCall(id, 'lib/core-v2/accounts/v1-authority.ts', 'assertCoreMayHoldCredentials')).toBe(true);
  });
  test('META_5_KNOWN_CAPABILITIES — every resolved capability is classified exhaustively', () => {
    expect(() => assertCapabilityClassificationIsExhaustive()).not.toThrow();
    for (const handler of inventory.handlers) for (const gate of handler.guards)
      if (gate.kind === 'CAPABILITY') expect(CAPABILITIES as readonly string[]).toContain(gate.value);
  });
  test('META_6_CONTEXTUAL_HOOKS — invitation scope has canonical hooks and named behavioral tests', () => {
    const entries = policy.policies.filter(entry => /\/(invite|resend-invitation)$/.test(entry.handler_id));
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(hasCall(entry.handler_id, 'lib/core-v2/accounts/invitation-scope.ts', 'assertInvitationScope')).toBe(true);
      expect(entry.contextual_requirements?.length).toBeGreaterThan(0);
      expect(entry.implementation?.status).toBe('IMPLEMENTED');
      for (const file of [...entry.implementation!.hooks.map(hook => hook.split('#')[0]), ...entry.implementation!.tests])
        expect(existsSync(join(ROOT, file))).toBe(true);
    }
  });
  test('META_7_OPEN_REQUIREMENTS — no known missing implementation is concealed by the policy', () => {
    expect(policy.policies.flatMap(entry => entry.declared_but_not_implemented ?? [])).toEqual([]);
    expect(policy.policies.find(entry => entry.handler_id.endsWith('/promote-admin'))?.roles_allowed).toEqual(['ADMIN']);
    expect(hasCall('POST /api/v2/staff/accounts/[id]/promote-admin', 'lib/auth/private-v1-session.ts', 'readBoundPrivateV1Session')).toBe(true);
  });
  test('META_8_NON_VACUOUS_RESOLVER — independent exports and all guard families are actually measured', () => {
    const kinds = new Set(inventory.handlers.flatMap(handler => handler.guards.map(gate => gate.kind)));
    for (const kind of ['CAPABILITY', 'ROLE_STAFF', 'ROLE_SELF_SERVICE', 'CREDENTIAL_AUTHORITY_IS_V1']) expect(kinds).toContain(kind);
    expect(inventory.handlers.length).toBe(policy.handlers_covered);
    expect(hasCall('POST /api/v2/auth/activate', 'lib/csrf.ts', 'checkCsrf')).toBe(true);
    expect(hasCall('GET /api/v2/auth/activate', 'lib/csrf.ts', 'checkCsrf')).toBe(false);
  });
});
describe('static normative role ceilings (not HTTP or contextual authorization)', () => {
  for (const entry of policy.policies) for (const role of ROLES)
    test(`${entry.handler_id} — ${role} ${entry.roles_allowed.includes(role) ? 'autorisé' : 'refusé'}`, () => {
      if (!['ROLE_OR_CAPABILITY', 'SELF_MEMBERSHIP_METADATA'].includes(entry.access_class)) { expect(entry.roles_allowed.includes(role)).toBe(false); return; }
      const handler = observed.get(entry.handler_id)!;
      expect(handler.unguardedPath).toBe(false);
      const actual = handler.gatePaths.some(path => path.length > 0 && path.every(gate => passes(role, gate)));
      expect({ id: entry.handler_id, role, actual }).toEqual({ id: entry.handler_id, role, actual: entry.roles_allowed.includes(role) });
    });
});
