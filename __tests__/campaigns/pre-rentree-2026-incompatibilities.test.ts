/**
 * Règles de non-cumul calculées depuis la grille (jamais saisies à la main), pour
 * alimenter la détection de conflit en direct du sélecteur de planning (Volet 2).
 */
import { getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';
import {
  areSubjectsIncompatible,
  computeSubjectIncompatibilities,
} from '@/lib/campaigns/pre-rentree-2026/incompatibilities';

describe('Pré-rentrée 2026 — règles de non-cumul (calculées depuis la grille)', () => {
  const incompatibilities = computeSubjectIncompatibilities(getPreRentreeSchedule());

  // Arbitrage du 14/08/2026 : la SVT est fermée en Terminale. L'unique
  // incompatibilité du niveau (NSI/SVT au bloc C) disparaît donc avec elle, et
  // les deux groupes de maths étant alternatifs, aucune paire ne peut plus se
  // chevaucher. On vérifie l'absence, sinon la fermeture d'une matière pourrait
  // masquer une incompatibilité réellement introduite par une grille future.
  it('Terminale ne produit plus aucune incompatibilité depuis la fermeture de la SVT', () => {
    expect(incompatibilities.filter((entry) => entry.level === 'TERMINALE')).toEqual([]);
  });

  it('Terminale Maths et Physique-Chimie ne sont PAS incompatibles (blocs B/C vs bloc D)', () => {
    expect(areSubjectsIncompatible(incompatibilities, 'TERMINALE', 'MATHEMATIQUES', 'PHYSIQUE_CHIMIE')).toBe(false);
  });

  it('Première Français (fenêtre 1) et Physique-Chimie (week-end) ne sont PAS incompatibles malgré le bloc B partagé, car leurs dates ne se recoupent jamais', () => {
    expect(areSubjectsIncompatible(incompatibilities, 'PREMIERE', 'FRANCAIS', 'PHYSIQUE_CHIMIE')).toBe(false);
  });

  it('Première SVT et Physique-Chimie ne sont PAS incompatibles (bloc A vs bloc B, mêmes jours)', () => {
    expect(areSubjectsIncompatible(incompatibilities, 'PREMIERE', 'SVT', 'PHYSIQUE_CHIMIE')).toBe(false);
  });

  it('ne génère aucune incompatibilité pour les niveaux mono-bloc (3e, 2de)', () => {
    expect(incompatibilities.some((entry) => entry.level === 'TROISIEME')).toBe(false);
    expect(incompatibilities.some((entry) => entry.level === 'SECONDE')).toBe(false);
  });

  it('ne produit jamais deux fois la même paire pour un niveau', () => {
    const keys = incompatibilities.map((entry) => `${entry.level}|${entry.subjectA}|${entry.subjectB}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
