import {
  assertPseudonymousRenderIdentity,
  assertRenderIdentity,
  type RenderIdentity,
} from '@/lib/bilans/render/render-identity';

/**
 * The whole RGPD posture of the bilan chain rests on a single property: the
 * append-only rows (`canonical_report_revisions.content`,
 * `canonical_report_audience_artifacts.html`/`.pdf`) never contain a real
 * identity, only the `ELEVE_XXXX` pseudonym derived from the attempt id.
 *
 * That property currently holds by construction, but nothing enforced it:
 * `assertRenderIdentity` only checked for non-empty strings, so a future change
 * assigning `displayName: student.firstName` would have silently baked real
 * names into rows that no DELETE or UPDATE can ever repair (append-only
 * triggers). These tests lock the property at the one chokepoint every render
 * and materialization path funnels through.
 */

const VALID: RenderIdentity = Object.freeze({
  displayName: 'ELEVE_LYDEIFKVRKDB',
  level: 'SECONDE',
  subject: 'MATHS',
  date: '2026-08-07',
  stageLabel: 'Pré-rentrée 2026',
});

describe('assertPseudonymousRenderIdentity — pseudonymity of the immutable chain', () => {
  it('accepts a pseudonymous displayName', () => {
    expect(assertPseudonymousRenderIdentity(VALID).displayName).toBe('ELEVE_LYDEIFKVRKDB');
  });

  it.each([
    ['a real full name', 'Amine Ben Salah'],
    ['a real first name only', 'Amine'],
    ['a pseudonym with a name appended', 'ELEVE_ABC Amine'],
    ['a lowercase lookalike', 'eleve_abcdef'],
    ['a digit-bearing lookalike', 'ELEVE_ABC123'],
    ['an email address', 'parent@example.com'],
    ['an empty-ish placeholder', 'ELEVE_'],
  ])('rejects %s as displayName', (_label, displayName) => {
    expect(() => assertPseudonymousRenderIdentity({ ...VALID, displayName } as RenderIdentity))
      .toThrow('RENDER_IDENTITY_NOT_PSEUDONYMOUS:displayName');
  });

  it('still rejects empty or blank fields before checking pseudonymity', () => {
    expect(() => assertPseudonymousRenderIdentity({ ...VALID, displayName: '   ' } as RenderIdentity))
      .toThrow('RENDER_IDENTITY_INVALID:displayName');
    expect(() => assertPseudonymousRenderIdentity({ ...VALID, stageLabel: '' } as RenderIdentity))
      .toThrow('RENDER_IDENTITY_INVALID:stageLabel');
  });

  it('rejects any uncontrolled duration marker', () => {
    expect(() => assertPseudonymousRenderIdentity({
      ...VALID,
      durationMeasurement: 'MEASURED' as never,
    })).toThrow('RENDER_IDENTITY_INVALID:durationMeasurement');
  });

  it('matches the alias format enforced upstream by buildFactSheet', () => {
    // buildFactSheet (lib/bilans/facts/fact-sheet.ts) rejects any alias that is
    // not /^ELEVE_[A-Z]+$/. The render boundary must not be laxer than the
    // fact-sheet boundary, otherwise the guarantee has a gap between them.
    expect(() => assertPseudonymousRenderIdentity({ ...VALID, displayName: 'ELEVE_ABC_DEF' } as RenderIdentity))
      .toThrow('RENDER_IDENTITY_NOT_PSEUDONYMOUS:displayName');
  });
});

describe('assertRenderIdentity — deliberately permissive for non-persisted renders', () => {
  /**
   * The coach group plan reuses RenderIdentity with a group label such as
   * "Groupe de 4 élèves", and legitimately names students in its own
   * GroupMember[] field. It is rendered on demand and never written to the
   * canonical append-only tables, so the pseudonymity rule must NOT apply to it.
   * If this ever starts being persisted, it must switch to the strict variant.
   */
  it('accepts a non-pseudonymous group label', () => {
    const groupIdentity = { ...VALID, displayName: 'Groupe de 4 élèves' } as RenderIdentity;
    expect(assertRenderIdentity(groupIdentity).displayName).toBe('Groupe de 4 élèves');
  });

  it('still rejects blank fields', () => {
    expect(() => assertRenderIdentity({ ...VALID, displayName: '' } as RenderIdentity))
      .toThrow('RENDER_IDENTITY_INVALID:displayName');
  });
});
