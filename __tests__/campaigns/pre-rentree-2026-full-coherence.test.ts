/**
 * Cohérence intégrale de bout en bout (post-arbitrage Seconde = Maths+Français, 2026-07-24) :
 * pour CHAQUE niveau, les matières doivent être EXACTEMENT les mêmes entre TOUTES les surfaces
 * qui les exposent, aussi bien techniques que commerciales :
 *   1) la grille JSON scellée (data/campaigns/pre-rentree-2026.json → schedule),
 *   2) le fichier d'incompatibilités (ne référence jamais une matière hors grille),
 *   3) le catalogue commercial par tier (content/pre-rentree-2026/offers.json, exposé en dto.offers),
 *   4) le contrat commercial public (content/pre-rentree-2026/commercial-contract.fr.json,
 *      getCommercialPublicOffers() — les offres réellement vendues),
 *   5) le sélecteur de planning front (dto.subjects, source consommée par StagePlanningSelector),
 *   6) le PDF Planning publié,
 *   7) la page publique (subjectIdsByLevel du DTO public-surface réellement affiché — lui-même
 *      dérivé du contrat commercial, vérifié ici indépendamment en (4) pour ne jamais dépendre
 *      silencieusement d'un futur changement de dérivation dans public-surface.ts).
 * Toute divergence = échec, sans exception. C'est ce test qui aurait dû détecter plus tôt le
 * désalignement Seconde (commercial-contract.fr.json vendant encore Physique-Chimie et
 * Informatique-SNT après la redéfinition de la grille) — les surfaces (3) et (4) ont été
 * ajoutées explicitement pour fermer ce type d'angle mort à l'avenir (voir SEPARATION_STAGES_ANNUEL.md §1bis).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { getCommercialPublicOffers } from '@/lib/campaigns/pre-rentree-2026/commercial-contract';
import { getPreRentreeLandingDTO, getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';
import { computeSubjectIncompatibilities } from '@/lib/campaigns/pre-rentree-2026/incompatibilities';
import { compilePreRentreeReviewSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

const PDF = join(
  process.cwd(),
  'assets/campaigns/pre-rentree-2026/documents-final/NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf',
);

const GENERIC_LABEL: Record<string, string> = {
  MATHEMATIQUES: 'Mathématiques',
  FRANCAIS: 'Français',
  NSI: 'NSI',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'SVT',
  MATHS_EXPERTES: 'Mathématiques expertes',
};

const LEVELS: EntryLevelCode[] = ['TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'];

const maybe = existsSync(PDF) ? describe : describe.skip;

maybe('Pré-rentrée 2026 — cohérence intégrale par niveau (JSON / catalogue / contrat commercial / sélecteur / PDF / page)', () => {
  const schedule = getPreRentreeSchedule();
  const dto = getPreRentreeLandingDTO();
  const incompatibilities = computeSubjectIncompatibilities(schedule);
  const pageDto = compilePreRentreeReviewSurfaceDTO();
  const commercialOffers = getCommercialPublicOffers();
  const pdfText = execFileSync('pdftotext', ['-layout', PDF, '-'], { encoding: 'utf8' });

  const gridSubjectsByLevel = new Map<EntryLevelCode, Set<string>>();
  for (const session of schedule) {
    const set = gridSubjectsByLevel.get(session.level) ?? new Set<string>();
    set.add(session.subject);
    gridSubjectsByLevel.set(session.level, set);
  }

  // 3) offers.json (content/pre-rentree-2026/offers.json, catalogue par tier Fondations/Premium).
  const offersJsonSubjectsByLevel = new Map<EntryLevelCode, Set<string>>(
    dto.offers.map((entry) => [entry.level as EntryLevelCode, new Set(entry.subjects)]),
  );

  // 4) commercial-contract.fr.json (offres publiques réellement vendues, contrat commercial canonique).
  const commercialSubjectsByLevel = new Map<EntryLevelCode, Set<string>>();
  for (const offer of commercialOffers) {
    const set = commercialSubjectsByLevel.get(offer.level as EntryLevelCode) ?? new Set<string>();
    for (const subject of offer.subjects) set.add(subject);
    commercialSubjectsByLevel.set(offer.level as EntryLevelCode, set);
  }

  it.each(LEVELS)(
    'niveau %s : grille JSON, offers.json, contrat commercial, incompatibilités, sélecteur, PDF et page s’accordent sur les mêmes matières',
    (level) => {
      const gridSubjects = gridSubjectsByLevel.get(level) ?? new Set<string>();
      expect(gridSubjects.size).toBeGreaterThan(0);

      // 2) Incompatibilités : ne référence jamais une matière absente de la grille pour ce niveau.
      const incompatSubjects = incompatibilities
        .filter((entry) => entry.level === level)
        .flatMap((entry) => [entry.subjectA, entry.subjectB]);
      for (const subject of incompatSubjects) {
        expect(gridSubjects.has(subject)).toBe(true);
      }

      // 3) offers.json : catalogue commercial par tier (Fondations/Premium), consommé par le DTO.
      expect(offersJsonSubjectsByLevel.get(level)).toEqual(gridSubjects);

      // 4) commercial-contract.fr.json : offres publiques réellement vendues (getCommercialPublicOffers()).
      expect(commercialSubjectsByLevel.get(level) ?? new Set()).toEqual(gridSubjects);

      // 5) Sélecteur front : dto.subjects filtré par niveau (source réelle de StagePlanningSelector).
      const selectorSubjects = new Set(
        dto.subjects.filter((subject) => subject.levels.includes(level)).map((subject) => subject.id),
      );
      expect(selectorSubjects).toEqual(gridSubjects);

      // 6) PDF Planning : chaque matière de la grille apparaît dans le document publié.
      for (const subjectId of gridSubjects) {
        expect(pdfText).toContain(GENERIC_LABEL[subjectId]);
      }

      // 7) Page publique : subjectIdsByLevel du DTO public-surface (ce que /stages/pre-rentree-2026 affiche).
      const pageSubjects = new Set(pageDto.subjectIdsByLevel[level]);
      expect(pageSubjects).toEqual(gridSubjects);
    },
  );
});
