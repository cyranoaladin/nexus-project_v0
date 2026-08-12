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

export const FRENCH_TYPOGRAPHY_VERSION = 'french-typography.v2' as const;

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Notation mathématique : les banques écrivent puissances et indices en
 * notation machine (`3^5`, `v_0`) parce que le JSON source se saisit au
 * clavier. Un document premium doit afficher `3⁵` et `v₀`.
 *
 * Portée volontairement étroite, pour ne jamais abîmer un extrait de code :
 * seuls les CHIFFRES sont convertis, et uniquement collés à leur base (sans
 * espace autour). `5 ^ 3` (ou-exclusif en Python) et `5 * 2` restent intacts.
 * Les exposants LITTÉRAUX (`e^x`) ne sont pas convertis : la couverture de
 * glyphe des exposants de lettres n'est pas garantie à l'impression — même
 * réserve que celle retenue pour U+202F.
 */
export function mathNotation(value: string): string {
  return value
    .replace(/([\p{L}\p{N})\]])\^(\d+)/gu, (_match, base: string, digits: string) => (
      base + [...digits].map((digit) => SUPERSCRIPT_DIGITS[Number(digit)]).join('')
    ))
    .replace(/(\p{L})_(\d)/gu, (_match, base: string, digit: string) => (
      base + SUBSCRIPT_DIGITS[Number(digit)]
    ));
}

export const NBSP = '\u00A0';

export function frenchTypography(value: string): string {
  return mathNotation(value)
    .replace(/'/g, '’')
    .replace(/[ \u00A0]+([:;!?%])/g, `${NBSP}$1`)
    .replace(/«[ \u00A0]+/g, `«${NBSP}`)
    .replace(/[ \u00A0]+»/g, `${NBSP}»`)
    .replace(/ — /g, `${NBSP}— `);
}
