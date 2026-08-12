import fs from 'node:fs';
import path from 'node:path';

import { BILAN_PRINT_BRAND, BILAN_PRINT_BRAND_VERSION } from '@/lib/bilans/render/brand';
import type { BilanPackSubject } from '@/lib/bilans/catalog/subjects';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { NodeProfile } from '@/lib/bilans/facts/types';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import { buildQuestionEvidence } from '@/lib/bilans/render/question-evidence';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';

/**
 * Invariants de qualité des bilans — verrouillés un par un.
 *
 * Complète `finition-typographie` (identifiants bruts, apostrophes,
 * insécables, guillemets) sur les points qu'elle ne couvrait pas : glyphes
 * mathématiques, charte nexus-lux, structure de page premium, et absence de
 * fuite technique dans le rendu servi aux familles.
 */

type RawPack = Readonly<{
  slug: string;
  status: string;
  level: string;
  subject: BilanPackSubject;
  scoring: Readonly<{ domains: readonly string[] }>;
}>;

const PROFILE_CYCLE: readonly NodeProfile[] = [
  'ERREUR_CONFIANTE', 'MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE',
];

function validatedPacks(): readonly RawPack[] {
  const directory = path.join(process.cwd(), 'data', 'bilans', 'banks');
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.json') && !name.includes('manifest'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')) as RawPack)
    .filter((pack) => pack.status === 'VALIDATED');
}

function factSheetFor(pack: RawPack): FactSheet {
  return Object.freeze({
    engineVersion: '1.0.1',
    bankSlug: pack.slug,
    bankVersion: 1,
    student: Object.freeze({ alias: 'ELEVE_QUALITE', level: pack.level }),
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
  }) as FactSheet;
}

function identityFor(pack: RawPack): RenderIdentity {
  return {
    displayName: 'ELEVE_QUALITE',
    level: pack.level,
    subject: pack.subject,
    date: '2026-08-12',
    stageLabel: buildPreRentreeStageLabel(pack.level, pack.subject),
  } as RenderIdentity;
}

/**
 * Texte tel que le lecteur le voit : balises retirées ET entités décodées.
 * `&gt;` dans la source est un échappement correct — c'est `>` à l'écran ;
 * ne pas décoder ferait passer une bonne pratique pour un défaut.
 */
const ENTITIES: Readonly<Record<string, string>> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': '’',
};

function visibleText(html: string): string {
  const stripped = html
    .replace(/<style>[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return stripped.replace(/&[a-z]+;|&#\d+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

const PACKS = validatedPacks();
const FAMILY_AUDIENCES = ['ELEVE', 'PARENTS'] as const;

describe('Qualité des bilans — charte et mise en page', () => {
  it('chaque document porte la charte nexus-lux : jetons, polices, version de marque', () => {
    const pack = PACKS[0];
    for (const audience of ['ELEVE', 'PARENTS', 'NEXUS'] as const) {
      const html = renderDeterministicBilanHtml(factSheetFor(pack), audience, identityFor(pack));
      // Les jetons de couleur officiels sont déclarés, pas réinventés.
      for (const [token, value] of Object.entries(BILAN_PRINT_BRAND.tokens)) {
        expect(html).toContain(`${token}:${value}`);
      }
      // Encre et or de la charte.
      expect(html).toContain('#071A3A');
      expect(html).toContain('#BFA06A');
      // Les deux familles typographiques de la charte.
      expect(html).toContain(BILAN_PRINT_BRAND.fonts.display);
      expect(html).toContain(BILAN_PRINT_BRAND.fonts.body);
    }
    expect(BILAN_PRINT_BRAND_VERSION).toBe('nexus-lux-print.v1');
  });

  it('GARDE : aucune couleur écrite en dur hors de la charte dans le rendu', () => {
    const html = renderDeterministicBilanHtml(factSheetFor(PACKS[0]), 'PARENTS', identityFor(PACKS[0]));
    const chartValues = new Set(
      Object.values(BILAN_PRINT_BRAND.tokens).map((value) => value.toUpperCase()),
    );
    const used = new Set((html.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((c) => c.toUpperCase()));
    const horsCharte = [...used].filter((color) => !chartValues.has(color));
    expect(horsCharte).toEqual([]);
  });

  it('structure premium : document complet, titré, en français, avec les sections attendues', () => {
    for (const audience of FAMILY_AUDIENCES) {
      const html = renderDeterministicBilanHtml(factSheetFor(PACKS[0]), audience, identityFor(PACKS[0]));
      expect(html).toMatch(/^<!DOCTYPE html>/i);
      expect(html).toContain('lang="fr"');
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      expect(html).toMatch(/<h1[\s>]/);
      // La couverture chiffrée est rendue — en « X sur Y » quand le détail des
      // réponses est disponible, en pourcentage sinon — et la réussite par
      // domaine est toujours présente.
      const text = visibleText(html);
      expect(text).toMatch(/questions traitées|\b\d{1,3}\s*%/);
      expect(text).toMatch(/Réussite par domaine/i);
    }
  });
});

describe('Qualité des bilans — glyphes mathématiques', () => {
  /**
   * Le détail des réponses reprend les énoncés de banque : ils doivent
   * arriver au lecteur avec les vrais signes (×, −, ², ÷), jamais leurs
   * substituts machine (`*`, `^2`, `x` multiplicatif) ni une entité brute.
   */
  it.each(PACKS.map((pack) => [pack.slug, pack] as const))(
    '%s : les énoncés rendus n’utilisent aucun substitut machine',
    (_slug, rawPack) => {
      const pack = loadBilanPack(path.join('data', 'bilans', 'banks', `${rawPack.slug}.json`));
      const answers: Record<string, { optionId: string; confidence: 1 | 2 | 3 | 4 }> = {};
      for (const item of pack.questionnaire.items) {
        const wrong = item.options.find((option) => !option.isCorrect);
        if (wrong !== undefined) answers[item.id] = { optionId: wrong.id, confidence: 4 };
      }
      const evidence = buildQuestionEvidence(pack, answers);
      const html = renderDeterministicBilanHtml(
        factSheetFor(rawPack), 'ELEVE', identityFor(rawPack), undefined, evidence,
      );
      const text = visibleText(html);

      // Le vrai défaut serait un DOUBLE échappement : après décodage, plus
      // aucune entité ne doit subsister (« &amp;gt; » afficherait « &gt; »).
      expect(text).not.toMatch(/&[a-z]+;|&#\d+;/i);
      // Aucune puissance ni indice en notation machine : `3^5` doit sortir
      // « 3⁵ », `v_0` doit sortir « v₀ ».
      expect(text).not.toMatch(/[\p{L}\p{N}]\^\d/u);
      expect(text).not.toMatch(/\p{L}_\d/u);

      // En NSI, l'astérisque est la multiplication de Python : elle est
      // légitime dans un énoncé de code. Partout ailleurs, elle trahit une
      // notation machine laissée telle quelle.
      if (rawPack.subject !== 'NSI') expect(text).not.toMatch(/\d\s*\*\s*\d/);
    },
  );

  it('les signes mathématiques réels traversent le rendu sans être altérés', () => {
    const pack = PACKS.find((candidate) => candidate.subject === 'MATHS') ?? PACKS[0];
    const loaded = loadBilanPack(path.join('data', 'bilans', 'banks', `${pack.slug}.json`));
    const source = JSON.stringify(loaded.questionnaire.items);
    const answers: Record<string, { optionId: string; confidence: 1 | 2 | 3 | 4 }> = {};
    for (const item of loaded.questionnaire.items) {
      const wrong = item.options.find((option) => !option.isCorrect);
      if (wrong !== undefined) answers[item.id] = { optionId: wrong.id, confidence: 4 };
    }
    const text = visibleText(renderDeterministicBilanHtml(
      factSheetFor(pack), 'ELEVE', identityFor(pack), undefined,
      buildQuestionEvidence(loaded, answers),
    ));
    // Tout glyphe mathématique présent dans la banque doit survivre au rendu.
    for (const glyph of ['×', '−', '÷', '²', '³', '√', '≤', '≥']) {
      if (source.includes(glyph)) expect(text).toContain(glyph);
    }
  });
});

describe('Qualité des bilans — aucune fuite technique côté familles', () => {
  it.each(PACKS.map((pack) => [pack.slug, pack] as const))(
    '%s : ni identifiant de pack, ni version de moteur, ni jargon interne',
    (_slug, pack) => {
      for (const audience of FAMILY_AUDIENCES) {
        const text = visibleText(
          renderDeterministicBilanHtml(factSheetFor(pack), audience, identityFor(pack)),
        );
        expect(text).not.toContain(pack.slug);
        expect(text).not.toMatch(/engineVersion|bankSlug|globalScore|calibrationIndex|groupBand/);
        expect(text).not.toMatch(/CONSOLIDATION_|RENFORCEMENT|APPROFONDISSEMENT/);
        expect(text).not.toMatch(/undefined|null|NaN|\[object Object\]/);
      }
    },
  );
});
