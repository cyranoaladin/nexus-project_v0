/**
 * Garde-fou éditorial : aucun bilan généré ne doit contenir un terme prohibé
 * par AGENTS.md, ni exposer un score brut aux audiences ELEVE et PARENT.
 *
 * Spec : docs/specs/bilans/06-plan-de-tests.md §4
 * Source : data/bilans/lexique-interdit.json
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildBilan, type Audience, type FragmentCatalog } from '@/lib/bilans/render/select-blocks';
import { normalizeText, score } from '@/lib/bilans/facts/compute-facts';
import type { ScoringInput } from '@/lib/bilans/facts/types';

interface Lexique {
  categories: Record<string, string[]>;
  regex_interdits: Array<{ id: string; pattern: string; audiences: Audience[]; motif: string }>;
}

const lexique = JSON.parse(
  readFileSync(join(__dirname, '../../data/bilans/lexique-interdit.json'), 'utf8'),
) as Lexique;

const golden = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/golden-cases.json'), 'utf8'),
) as { cases: Record<string, { input: ScoringInput }> };

/**
 * Catalogue de test volontairement « piégé » : il ne contient aucun terme interdit.
 * Le vrai catalogue de production sera soumis au même test.
 */
const catalog: FragmentCatalog = {
  nodeLabel: (id) => `Compétence ${id}`,
  nodeShortCorrection: (id) => `Reprendre la méthode associée à ${id}, étape par étape.`,
  nodeAction: (id) => ({ verb: 'Refaire', object: `deux exercices sur ${id}`, durationMin: 15 }),
  nodeModule: () => 'Module 2 — méthodes transversales',
};

const AUDIENCES: Audience[] = ['ELEVE', 'PARENT', 'NEXUS'];

/** Concatène toutes les chaînes d'une structure, quelle que soit sa profondeur. */
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') acc.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, acc));
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((v) => collectStrings(v, acc));
  }
  return acc;
}

const forbiddenTerms = Object.values(lexique.categories).flat();

describe('lexique interdit dans les bilans générés', () => {
  for (const [caseName, c] of Object.entries(golden.cases)) {
    for (const audience of AUDIENCES) {
      it(`${caseName} / ${audience} : aucun terme prohibé`, () => {
        const payload = buildBilan(score(c.input), audience, catalog);
        const haystack = normalizeText(collectStrings(payload).join(' | '));
        const hits = forbiddenTerms.filter((t) => haystack.includes(normalizeText(t)));
        expect(hits).toEqual([]);
      });
    }
  }

  for (const rule of lexique.regex_interdits) {
    for (const audience of rule.audiences) {
      it(`${rule.id} / ${audience} : ${rule.motif}`, () => {
        const re = new RegExp(rule.pattern, 'g');
        for (const c of Object.values(golden.cases)) {
          const payload = buildBilan(score(c.input), audience, catalog);
          const text = collectStrings(payload).join(' | ');
          expect(text.match(re)).toBeNull();
        }
      });
    }
  }
});

describe('cloisonnement des audiences', () => {
  it("les bilans ELEVE et PARENT ne contiennent aucun bloc de données brutes", () => {
    for (const c of Object.values(golden.cases)) {
      const result = score(c.input);
      for (const audience of ['ELEVE', 'PARENT'] as const) {
        const payload = buildBilan(result, audience, catalog);
        expect(payload.blocks.some((b) => b.kind === 'raw')).toBe(false);
        // Aucun score brut sérialisé, même sous forme numérique.
        const serialized = JSON.stringify(payload);
        expect(serialized).not.toContain('globalScore');
        expect(serialized).not.toContain('groupBand');
        expect(serialized).not.toContain('calibrationIndex');
      }
    }
  });

  it('le bilan NEXUS contient bien les données brutes', () => {
    const result = score(golden.cases['mixed-realistic'].input);
    const payload = buildBilan(result, 'NEXUS', catalog);
    expect(payload.blocks.some((b) => b.kind === 'raw')).toBe(true);
  });
});
