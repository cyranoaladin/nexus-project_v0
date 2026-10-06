/**
 * Identifiant de connexion de l'espace pédagogique (ex. `adam.c`).
 *
 * Forme stockée = forme normalisée (minuscules, ASCII). L'unicité en base porte
 * donc directement sur la valeur normalisée : `Adam.C` et `adam.c` sont le même
 * compte. On n'accepte volontairement ni `@`, ni espace, ni caractère non ASCII :
 * un identifiant ne doit pouvoir ni ressembler à un email (flux distinct), ni
 * produire deux comptes visuellement identiques.
 */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.normalize('NFKC').trim().toLowerCase();
  return USERNAME_PATTERN.test(candidate) ? candidate : null;
}
