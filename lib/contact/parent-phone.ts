export type NormalizedParentPhone = Readonly<{
  display: string;
  normalized: string;
}>;

const TUNISIA_PREFIX = '216';
const TUNISIA_LOCAL_PATTERN = /^[1-9]\d{7}$/;

// E.164 hard ceiling: country code + subscriber number, no more than 15 digits.
const E164_MAX_DIGITS = 15;
// A '+' or '00' prefix is an explicit, unambiguous international marker, so a
// short-but-plausible significant number is accepted below it. Kept strictly
// above 8 so a prefixed number can never collide with the 8-digit Tunisian
// legacy shape that WhatsApp link building (lib/whatsapp.ts) relies on to
// decide whether to prepend '216'.
const INTERNATIONAL_PREFIXED_MIN_DIGITS = 9;
// Without any prefix at all, a short digit string is far more likely to be a
// malformed local number than a genuine international one written without its
// '+'. Require two digits more than the Tunisian 8-digit format so a stray
// extra digit on a local number (e.g. a mistyped 9-digit Tunisian number)
// still gets rejected rather than silently accepted as "international".
const INTERNATIONAL_BARE_MIN_DIGITS = 10;

function normalizeTunisianLocal(local: string): NormalizedParentPhone {
  if (!TUNISIA_LOCAL_PATTERN.test(local)) throw new Error('PARENT_PHONE_INVALID');
  return Object.freeze({
    display: local.replace(/(\d{2})(?=\d)/g, '$1 ').trim(),
    normalized: local,
  });
}

function normalizeInternational(digits: string, minDigits: number): NormalizedParentPhone {
  if (digits.length < minDigits || digits.length > E164_MAX_DIGITS || !/^[1-9]/.test(digits)) {
    throw new Error('PARENT_PHONE_INVALID');
  }
  return Object.freeze({ display: `+${digits}`, normalized: digits });
}

/**
 * Normalise un numéro de téléphone parent.
 *
 * Tunisie (compatibilité historique impérative — ne pas modifier) : `display`
 * et `normalized` restent les 8 chiffres locaux sans indicatif, quelle que
 * soit l'écriture saisie (+216, 00216, ou locale nue). C'est la forme déjà
 * stockée pour tous les foyers existants ; la changer romprait le
 * rapprochement anti-doublon et les liens wa.me (lib/whatsapp.ts) sans
 * migration.
 *
 * Tout autre pays : forme canonique E.164 sans « + », `display` = « + » suivi
 * de ces mêmes chiffres. Aucune validation par indicatif réel (pas de
 * dépendance type libphonenumber) — seulement une forme générique plausible.
 */
export function normalizeParentPhone(value: string): NormalizedParentPhone {
  const input = value.trim();
  if (!input || !/^[\d\s()+.-]+$/.test(input)) throw new Error('PARENT_PHONE_INVALID');

  const plusCount = input.split('+').length - 1;
  if (plusCount > 1 || (plusCount === 1 && !input.startsWith('+'))) {
    throw new Error('PARENT_PHONE_INVALID');
  }

  if (input.startsWith('+')) {
    const digits = input.slice(1).replace(/\D/g, '');
    if (digits.startsWith(TUNISIA_PREFIX)) return normalizeTunisianLocal(digits.slice(TUNISIA_PREFIX.length));
    return normalizeInternational(digits, INTERNATIONAL_PREFIXED_MIN_DIGITS);
  }

  if (input.startsWith('00')) {
    const digits = input.slice(2).replace(/\D/g, '');
    if (digits.startsWith(TUNISIA_PREFIX)) return normalizeTunisianLocal(digits.slice(TUNISIA_PREFIX.length));
    return normalizeInternational(digits, INTERNATIONAL_PREFIXED_MIN_DIGITS);
  }

  const digits = input.replace(/\D/g, '');
  if (TUNISIA_LOCAL_PATTERN.test(digits)) return normalizeTunisianLocal(digits);
  if (digits.length === 11 && digits.startsWith(TUNISIA_PREFIX)) {
    return normalizeTunisianLocal(digits.slice(TUNISIA_PREFIX.length));
  }
  return normalizeInternational(digits, INTERNATIONAL_BARE_MIN_DIGITS);
}
