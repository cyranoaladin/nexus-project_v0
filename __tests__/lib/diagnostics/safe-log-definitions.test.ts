/**
 * Coverage boost tests for safe-log.ts and definitions/index.ts
 * Targets uncovered branches identified in audit.
 */

import { hashPII, safeSubmissionLog, safeDiagnosticLog } from '@/lib/diagnostics/safe-log';
import {
  getDefinition,
  getDefinitionOrNull,
  listDefinitionKeys,
  listDefinitions,
  resolveDefinitionKey,
} from '@/lib/diagnostics/definitions';

/* ═══════════════════════════════════════════════════════════════════════════
   safe-log.ts — all branches
   ═══════════════════════════════════════════════════════════════════════════ */

describe('hashPII', () => {
  it('returns 8-char hex hash', () => {
    const hash = hashPII('test@example.com');
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    expect(hashPII('hello')).toBe(hashPII('hello'));
  });

  it('differs for different inputs', () => {
    expect(hashPII('a')).not.toBe(hashPII('b'));
  });
});

describe('safeSubmissionLog', () => {
  it('includes email_hash when identity.email present', () => {
    const log = safeSubmissionLog({ identity: { email: 'test@test.com', firstName: 'A', lastName: 'B' } });
    expect(log).toContain('email_hash=');
    expect(log).not.toContain('test@test.com');
  });

  it('includes name_hash when firstName+lastName present', () => {
    const log = safeSubmissionLog({ identity: { email: 'x@x.com', firstName: 'Jean', lastName: 'Dupont' } });
    expect(log).toContain('name_hash=');
    expect(log).not.toContain('Jean');
    expect(log).not.toContain('Dupont');
  });

  it('includes domain counts when competencies present', () => {
    const log = safeSubmissionLog({
      competencies: { algebra: [1, 2, 3], analysis: [1] },
    });
    expect(log).toContain('domains={algebra:3,analysis:1}');
  });

  it('handles non-array competency values', () => {
    const log = safeSubmissionLog({
      competencies: { algebra: 'not-an-array' as any },
    });
    expect(log).toContain('algebra:0');
  });

  it('includes miniTest info when examPrep present', () => {
    const log = safeSubmissionLog({
      examPrep: { miniTest: { score: 4, completedInTime: true } },
    });
    expect(log).toContain('miniTest=4/ok');
  });

  it('shows timeout when completedInTime is false', () => {
    const log = safeSubmissionLog({
      examPrep: { miniTest: { score: 2, completedInTime: false } },
    });
    expect(log).toContain('miniTest=2/timeout');
  });

  it('handles missing examPrep.miniTest gracefully', () => {
    const log = safeSubmissionLog({ examPrep: {} });
    expect(log).not.toContain('miniTest=');
  });

  it('includes version and timestamp', () => {
    const log = safeSubmissionLog({ version: '2.0' });
    expect(log).toContain('version=2.0');
    expect(log).toContain('ts=');
  });

  it('defaults version to unknown', () => {
    const log = safeSubmissionLog({});
    expect(log).toContain('version=unknown');
  });

  it('handles completely empty body', () => {
    const log = safeSubmissionLog({});
    expect(log).toContain('version=unknown');
    expect(log).toContain('ts=');
  });

  it('handles identity without email', () => {
    const log = safeSubmissionLog({ identity: { firstName: 'A' } });
    expect(log).not.toContain('email_hash=');
  });

  it('handles identity without firstName (no name_hash)', () => {
    const log = safeSubmissionLog({ identity: { email: 'x@x.com' } });
    expect(log).toContain('email_hash=');
    expect(log).not.toContain('name_hash=');
  });
});

describe('safeDiagnosticLog', () => {
  it('formats basic event log', () => {
    const log = safeDiagnosticLog('SCORED', 'diag-123');
    expect(log).toBe('[DIAG] SCORED id=diag-123');
  });

  it('includes extra fields when provided', () => {
    const log = safeDiagnosticLog('ANALYZED', 'diag-456', { duration: 3000, success: true });
    expect(log).toContain('[DIAG] ANALYZED id=diag-456');
    expect(log).toContain('duration=3000');
    expect(log).toContain('success=true');
  });

  it('handles no extra fields', () => {
    const log = safeDiagnosticLog('CREATED', 'diag-789');
    expect(log).toBe('[DIAG] CREATED id=diag-789');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   definitions/index.ts — all branches
   ═══════════════════════════════════════════════════════════════════════════ */

describe('getDefinition', () => {
  it('returns definition for valid key', () => {
    const def = getDefinition('maths-premiere-p2');
    expect(def.key).toBe('maths-premiere-p2');
    expect(def.track).toBe('maths');
  });

  it('returns definition for legacy alias', () => {
    const def = getDefinition('eds_maths_1ere');
    expect(def.key).toBe('maths-premiere-p2');
  });

  it('throws for unknown key', () => {
    expect(() => getDefinition('unknown-key')).toThrow('Unknown diagnostic definition');
  });
});

describe('getDefinitionOrNull', () => {
  it('returns definition for valid key', () => {
    const def = getDefinitionOrNull('nsi-terminale-p2');
    expect(def).not.toBeNull();
    expect(def!.track).toBe('nsi');
  });

  it('returns null for unknown key', () => {
    expect(getDefinitionOrNull('nonexistent')).toBeNull();
  });
});

describe('listDefinitionKeys', () => {
  it('returns all registered keys including legacy aliases', () => {
    const keys = listDefinitionKeys();
    expect(keys).toContain('maths-premiere-p2');
    expect(keys).toContain('nsi-terminale-p2');
    expect(keys).toContain('eds_maths_1ere');
    expect(keys.length).toBeGreaterThanOrEqual(8);
  });
});

describe('listDefinitions', () => {
  it('returns metadata for all definitions', () => {
    const defs = listDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(4);
    const first = defs[0];
    expect(first).toHaveProperty('key');
    expect(first).toHaveProperty('label');
    expect(first).toHaveProperty('track');
    expect(first).toHaveProperty('level');
    expect(first).toHaveProperty('version');
  });
});

describe('resolveDefinitionKey', () => {
  it('maps PALLIER2_MATHS to maths-premiere-p2', () => {
    expect(resolveDefinitionKey('PALLIER2_MATHS')).toBe('maths-premiere-p2');
  });

  it('maps DIAGNOSTIC_PRE_STAGE_MATHS to maths-premiere-p2', () => {
    expect(resolveDefinitionKey('DIAGNOSTIC_PRE_STAGE_MATHS')).toBe('maths-premiere-p2');
  });

  it('returns input as-is for non-legacy keys', () => {
    expect(resolveDefinitionKey('nsi-terminale-p2')).toBe('nsi-terminale-p2');
  });

  it('returns unknown input as-is (passthrough)', () => {
    expect(resolveDefinitionKey('some-future-key')).toBe('some-future-key');
  });
});
