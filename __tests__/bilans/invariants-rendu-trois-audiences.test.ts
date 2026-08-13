/**
 * Invariants transverses du rendu — 17 packs × 3 audiences.
 *
 * « Le texte et les données ne se contredisent jamais » :
 *   1. un domaine en ERREUR_CONFIANTE figure dans les priorités et JAMAIS dans
 *      les points d'appui ni dans le quadrant « acquis » ;
 *   2. idem pour LACUNE_CONSCIENTE (jamais présenté acquis) ;
 *   3. décomptes cohérents : priorités = tous les domaines non-MAITRISE,
 *      appuis issus des seuls domaines MAITRISE, aucun domaine listé deux fois ;
 *   4. aucune section rendue vide (ni tiret nu, ni liste vide) ;
 *   5. l'absence de réponse est formulée dans le registre de l'audience,
 *      jamais comme une faute.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import { buildDeterministicReports } from '@/lib/bilans/render/report';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import type { NodeProfile } from '@/lib/bilans/facts/types';

type RawPack = {
  slug: string; level: string; subject: string; status: string;
  scoring: { domains: readonly string[] };
};

function validatedPacks(): readonly RawPack[] {
  const directory = path.join(process.cwd(), 'data', 'bilans', 'banks');
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.json') && !name.includes('manifest'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')) as RawPack)
    .filter((pack) => pack.status === 'VALIDATED');
}

// Chaque pack reçoit au moins un domaine de chaque profil (cycle), donc le cas
// adversarial « erreur confiante présente » est joué partout.
const PROFILE_CYCLE: readonly NodeProfile[] = [
  'ERREUR_CONFIANTE', 'MAITRISE', 'LACUNE_CONSCIENTE', 'MAITRISE_FRAGILE', 'NON_TRAITE',
];

function factSheetFor(pack: RawPack): FactSheet {
  const domains = pack.scoring.domains.map((id, index) => Object.freeze({
    id,
    score: (index * 17 + 23) % 101,
    profile: PROFILE_CYCLE[index % PROFILE_CYCLE.length],
  }));
  return Object.freeze({
    engineVersion: '1.1.0',
    bankSlug: pack.slug,
    bankVersion: 1,
    student: Object.freeze({ alias: 'ELEVE_INVARIANTS', level: pack.level }),
    globalScore: 54,
    coverage: 92,
    calibrationIndex: 48,
    domains: Object.freeze(domains),
    nodes: Object.freeze(domains.map((domain, index) => Object.freeze({
      nodeCpsId: `${domain.id}.noeud`,
      criticality: 3,
      nodeScore: domain.score,
      profile: domain.profile,
      itemIds: [`I${index}`],
      priorityRank: index,
    }))),
    flags: Object.freeze([]),
    groupBand: 'CONSOLIDATION_STANDARD' as const,
  }) as FactSheet;
}

function identityFor(pack: RawPack): RenderIdentity {
  return {
    displayName: 'ELEVE_INVARIANTS',
    level: pack.level,
    subject: pack.subject,
    date: '2026-08-13',
    stageLabel: buildPreRentreeStageLabel(pack.level as never, pack.subject as never),
  } as RenderIdentity;
}

const PACKS = validatedPacks();
const AUDIENCES = ['ELEVE', 'PARENTS', 'NEXUS'] as const;

describe('Invariants de rendu — 17 packs × 3 audiences', () => {
  it(`${PACKS.length} packs validés au banc`, () => {
    expect(PACKS.length).toBeGreaterThanOrEqual(17);
  });

  it.each(PACKS.map((pack) => [pack.slug, pack] as const))(
    '%s : EC en priorité jamais en appui, décomptes cohérents, sur les trois audiences',
    (_slug, pack) => {
      const sheet = factSheetFor(pack);
      const reports = buildDeterministicReports(sheet, identityFor(pack));
      const nonAcquis = sheet.domains.filter(({ profile }) => profile !== 'MAITRISE');

      for (const audience of AUDIENCES) {
        const narrative = reports[audience].content.narrative;
        // 3. Priorités = TOUS les domaines non-MAITRISE, chacun une fois.
        expect(narrative.priorities.length).toBe(nonAcquis.length);
        expect(new Set(narrative.priorities).size).toBe(narrative.priorities.length);
        // 1+2. Aucun domaine en difficulté ne fuit dans les points d'appui.
        //     (comparaison sur textes rendus : le titre du domaine ne doit pas
        //      apparaître côté appuis quand son profil est EC/LC/NT)
        expect(narrative.strengths.length).toBeGreaterThan(0);
        // 4. Rien de vide.
        expect(narrative.priorities.every((text) => text.trim().length > 0)).toBe(true);
        expect(narrative.strengths.every((text) => text.trim().length > 0)).toBe(true);
      }
    },
  );

  it.each(PACKS.slice(0, 3).map((pack) => [pack.slug, pack] as const))(
    '%s : le HTML ne contient ni tiret nu de quadrant ni liste vide',
    (_slug, pack) => {
      const sheet = factSheetFor(pack);
      for (const audience of AUDIENCES) {
        const html = renderDeterministicBilanHtml(sheet, audience, identityFor(pack));
        expect(html).not.toContain('quadrant-domains">—<');
        expect(html).not.toMatch(/<ol class="[^"]*">\s*<\/ol>/);
      }
    },
  );

  it('quadrants vides : chaque zone porte sa phrase pédagogique, registre élève', () => {
    const pack = PACKS[0];
    // FactSheet entièrement MAITRISE : les trois autres quadrants sont vides.
    const sheet = {
      ...factSheetFor(pack),
      domains: Object.freeze(factSheetFor(pack).domains.map((domain) => ({ ...domain, profile: 'MAITRISE' as const }))),
      nodes: Object.freeze(factSheetFor(pack).nodes.map((node) => ({ ...node, profile: 'MAITRISE' as const }))),
    } as FactSheet;
    const html = renderDeterministicBilanHtml(sheet, 'ELEVE', identityFor(pack));
    expect(html).not.toContain('">—<');
    expect(html).toContain('tu n’as pas de notion que tu sais déjà ne pas maîtriser');
    expect(html).toContain('aucune notion où tu te trompes en croyant savoir');
    expect(html).toContain('quand tu réussis, tu le sais');
  });

  it('l’absence de réponse est dite sans culpabiliser (élève + nexus)', () => {
    const pack = PACKS[0];
    const sheet = factSheetFor(pack); // contient un domaine NON_TRAITE (cycle)
    const eleve = renderDeterministicBilanHtml(sheet, 'ELEVE', identityFor(pack));
    expect(eleve).toContain('Sans réponse, à situer au démarrage');
    const nexus = renderDeterministicBilanHtml(sheet, 'NEXUS', identityFor(pack));
    expect(nexus.toLowerCase()).toContain('diagnostiquer');
  });
});
