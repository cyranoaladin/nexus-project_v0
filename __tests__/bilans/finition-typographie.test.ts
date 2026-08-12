import fs from 'node:fs';
import path from 'node:path';

import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { NodeProfile } from '@/lib/bilans/facts/types';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import { domainLabel } from '@/lib/bilans/render/domain-labels';
import { frenchTypography, mathNotation, NBSP } from '@/lib/bilans/render/typography';
import type { BilanPackSubject } from '@/lib/bilans/catalog/subjects';

/**
 * Finition premium — exigence explicite du chantier : aucun identifiant
 * technique brut ni défaut typographique dans un texte destiné à un humain,
 * sur les TROIS audiences et pour les DIX-SEPT packs actifs.
 */

type RawPack = Readonly<{
  slug: string;
  status: string;
  level: string;
  subject: BilanPackSubject;
  scoring: Readonly<{ domains: readonly string[] }>;
}>;

const PROFILE_CYCLE: readonly NodeProfile[] = [
  'ERREUR_CONFIANTE', 'MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'NON_TRAITE', 'ERREUR_CONFIANTE',
];

function loadValidatedPacks(): readonly RawPack[] {
  const banksDirectory = path.join(process.cwd(), 'data', 'bilans', 'banks');
  return fs.readdirSync(banksDirectory)
    .filter((name) => name.endsWith('.json') && !name.includes('manifest'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(banksDirectory, name), 'utf8')) as RawPack)
    .filter((pack) => pack.status === 'VALIDATED');
}

function syntheticFactSheet(pack: RawPack): FactSheet {
  return Object.freeze({
    engineVersion: '1.0.1',
    bankSlug: pack.slug,
    bankVersion: 1,
    student: Object.freeze({ alias: 'ELEVE_TYPOGRAPHIE', level: pack.level }),
    globalScore: 54,
    coverage: 92,
    calibrationIndex: 48,
    domains: Object.freeze(pack.scoring.domains.map((id, index) => Object.freeze({
      id,
      score: (index * 17 + 23) % 101,
      profile: PROFILE_CYCLE[index % PROFILE_CYCLE.length],
    }))),
    nodes: Object.freeze([]),
    flags: Object.freeze([]),
    groupBand: 'CONSOLIDATION_STANDARD' as const,
  });
}

function visibleText(html: string): string {
  return html
    .replace(/<style>[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/**
 * Identifiants « déguisés » : ceux qui ne sont pas un mot français légitime
 * (tiret, accent manquant). « grammaire » ou « fractions » sont à la fois
 * identifiant et mot correct — seuls les identifiants dont AUCUNE forme
 * humaine ne contient le token brut sont interdits dans un texte rendu.
 */
const ALL_LABEL_TEXT = loadValidatedPacks()
  .flatMap((pack) => pack.scoring.domains.map((domainId) => {
    const forms = domainLabel(domainId, pack.subject);
    return `${forms.title} ${forms.article} ${forms.en}`;
  }))
  .join(' ')
  .toLocaleLowerCase('fr-FR');

const FORBIDDEN_DOMAIN_IDS = [...new Set(loadValidatedPacks().flatMap((pack) => pack.scoring.domains))]
  .filter((domainId) => !ALL_LABEL_TEXT.includes(domainId.toLocaleLowerCase('fr-FR')));

describe('Finition premium — typographie et libellés sur les 17 packs', () => {
  const packs = loadValidatedPacks();
  const audiences = ['ELEVE', 'PARENTS', 'NEXUS'] as const;

  it.each(packs.map((pack) => [pack.slug, pack] as const))('%s : aucun identifiant brut, typographie française', (_slug, pack) => {
    const factSheet = syntheticFactSheet(pack);
    const identity: RenderIdentity = {
      displayName: factSheet.student.alias,
      level: pack.level,
      subject: pack.subject,
      date: '2026-08-12',
      stageLabel: buildPreRentreeStageLabel(pack.level, pack.subject),
    };
    for (const audience of audiences) {
      const html = renderDeterministicBilanHtml(factSheet, audience, identity);
      const text = visibleText(html);

      // 1. Aucun domainId brut — le défaut fondateur du chantier.
      for (const domainId of FORBIDDEN_DOMAIN_IDS) {
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}-])${domainId}([^\\p{L}\\p{N}-]|$)`, 'u');
        expect(`${audience}:${pattern.test(text) ? domainId : ''}`).toBe(`${audience}:`);
      }

      // 2. Apostrophes typographiques uniquement.
      expect(text).not.toContain("'");
      expect(text).not.toContain('&#39;');

      // 3. Espaces insécables avant la ponctuation haute (jamais une espace simple).
      expect(text).not.toMatch(/\S [:;!?]/);

      // 4. Guillemets français correctement espacés.
      expect(text).not.toMatch(/« /);
      expect(text).not.toMatch(/ »/);

      // 5. Aucun vocabulaire technique de profil côté familles.
      if (audience !== 'NEXUS') {
        expect(text).not.toMatch(/MAITRISE|ERREUR_CONFIANTE|LACUNE_CONSCIENTE|NON_TRAITE/);
        expect(text).not.toMatch(/\bscore\b/i);
      }
    }
  });

  it('ne répète jamais mot pour mot la même phrase pour deux domaines de même profil', () => {
    const pack = packs.find((candidate) => candidate.scoring.domains.length >= 6);
    if (pack === undefined) throw new Error('PACK_FIXTURE_MISSING');
    const factSheet = Object.freeze({
      ...syntheticFactSheet(pack),
      domains: Object.freeze(pack.scoring.domains.map((id, index) => Object.freeze({
        id,
        score: 10 + index,
        profile: 'ERREUR_CONFIANTE' as const,
      }))),
    });
    const identity: RenderIdentity = {
      displayName: 'ELEVE_REPETITION',
      level: pack.level,
      subject: pack.subject,
      date: '2026-08-12',
      stageLabel: buildPreRentreeStageLabel(pack.level, pack.subject),
    };
    const html = renderDeterministicBilanHtml(factSheet, 'ELEVE', identity);
    const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([, body]) => body);
    const priorityBodies = items.filter((item) => item.length > 40);
    // Les corps de phrase (hors libellé de domaine) doivent varier.
    const bodies = priorityBodies.map((item) => item.replace(/^[^—]*—/, '').trim());
    const distinct = new Set(bodies.slice(0, 3));
    expect(distinct.size).toBe(Math.min(3, bodies.length));
  });

  it('applique la typographie française de façon idempotente', () => {
    const raw = "L'élève dit : « c'est sûr ! » ; vraiment ?";
    const once = frenchTypography(raw);
    expect(frenchTypography(once)).toBe(once);
    expect(once).toContain(`«${NBSP}`);
    expect(once).toContain(`${NBSP}»`);
    expect(once).toContain(`${NBSP}:`);
    expect(once).toContain(`${NBSP}!`);
    expect(once).toContain(`${NBSP};`);
    expect(once).toContain(`${NBSP}?`);
    expect(once).not.toContain("'");
  });

  describe('notation mathématique', () => {
    it('convertit puissances et indices collés à leur base', () => {
      expect(mathNotation('v_0 × 3^4 puis 3^5')).toBe('v₀ × 3⁴ puis 3⁵');
      expect(mathNotation('x^12')).toBe('x¹²');
      expect(mathNotation('(a+b)^2')).toBe('(a+b)²');
    });

    it('est idempotente et traverse la typographie française', () => {
      const once = frenchTypography('u_1 vaut 2^3 !');
      expect(frenchTypography(once)).toBe(once);
      expect(once).toContain('u₁');
      expect(once).toContain('2³');
    });

    it('GARDE : ne touche jamais à un extrait de code ni aux exposants littéraux', () => {
      // Ou-exclusif Python (espaces autour) et multiplication : intacts.
      expect(mathNotation('5 ^ 3')).toBe('5 ^ 3');
      expect(mathNotation('f(5) calcule 5 * 2')).toBe('f(5) calcule 5 * 2');
      // Exposant littéral : laissé tel quel, faute de glyphe garanti à l'impression.
      expect(mathNotation('e^x = 0')).toBe('e^x = 0');
      // Un identifiant technique suivi d'une lettre n'est pas un indice.
      expect(mathNotation('snake_case')).toBe('snake_case');
    });
  });
});
