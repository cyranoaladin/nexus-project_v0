/**
 * Cohérence intégrale de bout en bout (post-arbitrage seuil "3 partout", 2026-07-24) :
 * pour CHAQUE niveau, les matières doivent être EXACTEMENT les mêmes entre :
 *   1) la grille JSON scellée (data/campaigns/pre-rentree-2026.json → schedule),
 *   2) le fichier d'incompatibilités (ne référence jamais une matière hors grille),
 *   3) le sélecteur de planning front (dto.subjects, source consommée par StagePlanningSelector),
 *   4) le PDF Planning publié,
 *   5) la page publique (subjectIdsByLevel du DTO public-surface réellement affiché).
 * Toute divergence = échec, sans exception.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

maybe('Pré-rentrée 2026 — cohérence intégrale par niveau (JSON / incompatibilités / sélecteur / PDF / page)', () => {
  const schedule = getPreRentreeSchedule();
  const dto = getPreRentreeLandingDTO();
  const incompatibilities = computeSubjectIncompatibilities(schedule);
  const pageDto = compilePreRentreeReviewSurfaceDTO();
  const pdfText = execFileSync('pdftotext', ['-layout', PDF, '-'], { encoding: 'utf8' });

  const gridSubjectsByLevel = new Map<EntryLevelCode, Set<string>>();
  for (const session of schedule) {
    const set = gridSubjectsByLevel.get(session.level) ?? new Set<string>();
    set.add(session.subject);
    gridSubjectsByLevel.set(session.level, set);
  }

  it.each(LEVELS)('niveau %s : grille JSON, incompatibilités, sélecteur, PDF et page s’accordent sur les mêmes matières', (level) => {
    const gridSubjects = gridSubjectsByLevel.get(level) ?? new Set<string>();
    expect(gridSubjects.size).toBeGreaterThan(0);

    // 2) Incompatibilités : ne référence jamais une matière absente de la grille pour ce niveau.
    const incompatSubjects = incompatibilities
      .filter((entry) => entry.level === level)
      .flatMap((entry) => [entry.subjectA, entry.subjectB]);
    for (const subject of incompatSubjects) {
      expect(gridSubjects.has(subject)).toBe(true);
    }

    // 3) Sélecteur front : dto.subjects filtré par niveau (source réelle de StagePlanningSelector).
    const selectorSubjects = new Set(
      dto.subjects.filter((subject) => subject.levels.includes(level)).map((subject) => subject.id),
    );
    expect(selectorSubjects).toEqual(gridSubjects);

    // 4) PDF Planning : chaque matière de la grille apparaît dans le document publié.
    for (const subjectId of gridSubjects) {
      expect(pdfText).toContain(GENERIC_LABEL[subjectId]);
    }

    // 5) Page publique : subjectIdsByLevel du DTO public-surface (ce que /stages/pre-rentree-2026 affiche).
    const pageSubjects = new Set(pageDto.subjectIdsByLevel[level]);
    expect(pageSubjects).toEqual(gridSubjects);
  });
});
