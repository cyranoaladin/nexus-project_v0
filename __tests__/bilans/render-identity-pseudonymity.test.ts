import {
  assertPseudonymousRenderIdentity,
  assertRenderIdentity,
  type RenderIdentity,
} from '@/lib/bilans/render/render-identity';
import { buildHumanRenderIdentity } from '@/lib/bilans/render/human-identity';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import { ENTRY_RECIPE_FACT_SHEETS } from '@/__tests__/bilans/fixtures/recipe-fact-sheets';

/**
 * The whole RGPD posture of the bilan chain rests on a single property: the
 * append-only snapshot and revision content never contain a real identity,
 * only the `ELEVE_XXXX` pseudonym derived from the attempt id. Human documents
 * may project the real name in their header, but only through the separate
 * presentation identity exercised below.
 *
 * That property currently holds by construction, but nothing enforced it:
 * `assertRenderIdentity` only checked for non-empty strings, so a future change
 * assigning `displayName: student.firstName` would silently bake real names
 * into the canonical engine input. These tests lock the property at the one
 * chokepoint every render and materialization path funnels through.
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

  it.each(['ELEVE', 'PARENTS', 'NEXUS'] as const)(
    'keeps the immutable alias while projecting the real student name only in the %s header',
    (audience) => {
      const immutableSnapshot = ENTRY_RECIPE_FACT_SHEETS[0];
      const immutableRevision = Object.freeze({
        NEXUS: Object.freeze({ identity: Object.freeze({ ...VALID }) }),
      });
      const humanIdentity = buildHumanRenderIdentity({ firstName: 'Élise', lastName: 'Ben Salah' });

      const html = renderDeterministicBilanHtml(
        immutableSnapshot,
        audience,
        VALID,
        humanIdentity,
      );

      expect(immutableSnapshot.student.alias).toMatch(/^ELEVE_[A-Z]+$/);
      expect(immutableRevision.NEXUS.identity.displayName).toBe('ELEVE_LYDEIFKVRKDB');
      expect(VALID.displayName).toBe('ELEVE_LYDEIFKVRKDB');
      expect(html).toContain('<strong>Élise Ben Salah</strong>');
      expect(html).not.toContain('ELEVE_LYDEIFKVRKDB');
    },
  );
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
