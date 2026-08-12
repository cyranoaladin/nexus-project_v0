/**
 * Typographie française des documents rendus.
 *
 * Les textes du catalogue sont écrits avec une ponctuation simple ; cette
 * passe unique applique les règles françaises au moment du rendu, pour que
 * chaque chaîne visible — y compris les fragments dynamiques (libellés,
 * énoncés de banque) — sorte irréprochable :
 *
 * - apostrophe typographique « ’ » à la place de l'apostrophe droite ;
 * - espace insécable avant : ; ! ? et % ;
 * - espaces insécables à l'intérieur des guillemets « … » ;
 * - espace insécable avant le tiret cadratin entouré d'espaces.
 *
 * La fonction est idempotente : l'appliquer deux fois ne change rien.
 * L'insécable est U+00A0 (couvert par DM Sans et Fraunces), jamais
 * U+202F dont la couverture de glyphe n'est pas garantie à l'impression.
 */

export const FRENCH_TYPOGRAPHY_VERSION = 'french-typography.v1' as const;

export const NBSP = '\u00A0';

export function frenchTypography(value: string): string {
  return value
    .replace(/'/g, '’')
    .replace(/[ \u00A0]+([:;!?%])/g, `${NBSP}$1`)
    .replace(/«[ \u00A0]+/g, `«${NBSP}`)
    .replace(/[ \u00A0]+»/g, `${NBSP}»`)
    .replace(/ — /g, `${NBSP}— `);
}
