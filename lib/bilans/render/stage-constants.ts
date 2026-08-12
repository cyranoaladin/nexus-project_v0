/**
 * Réalité du stage de pré-rentrée : CINQ séances de DEUX heures.
 *
 * Seule source de ce comptage. Le parcours généré, le plan Nexus et les
 * mentions rédigées (« cinq séances de deux heures ») doivent tous en
 * découler — un test vérifie la cohérence entre le nombre et sa forme
 * rédigée. Toute évolution du format du stage se fait ICI, nulle part
 * ailleurs.
 */

export const STAGE_SESSION_COUNT = 5 as const;

export const STAGE_SESSION_COUNT_WORD = 'cinq' as const;

export const STAGE_SESSION_DURATION_WORD = 'deux heures' as const;

/** Forme rédigée complète, utilisée telle quelle dans les textes parents. */
export const STAGE_SESSIONS_SENTENCE_FRAGMENT = 'cinq séances de deux heures' as const;

const NUMBER_WORDS: Readonly<Record<number, string>> = Object.freeze({
  1: 'un', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six', 7: 'sept', 8: 'huit',
  9: 'neuf', 10: 'dix', 11: 'onze', 12: 'douze',
});

/** Forme rédigée d'un petit nombre, au féminin (« une séance », « cinq séances »). */
export function sessionCountWord(count: number): string {
  if (count === 1) return 'une';
  return NUMBER_WORDS[count] ?? String(count);
}

/** Forme rédigée générique, au masculin (« un acquis », « trois domaines »). */
export function numberWordFr(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

export function sessionLabel(position: number): string {
  return `Séance ${position}`;
}
