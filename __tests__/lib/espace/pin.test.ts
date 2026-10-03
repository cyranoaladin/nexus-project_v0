import { PIN_ALPHABET, formatPin, generatePin, hashPin, normalizePin, verifyPin } from '@/lib/espace/pin';

describe('code personnel', () => {
  it('génère 8 caractères dans un alphabet sans caractères ambigus', () => {
    for (let i = 0; i < 200; i += 1) {
      const pin = generatePin();
      expect(pin).toHaveLength(8);
      for (const ch of pin) expect(PIN_ALPHABET).toContain(ch);
    }
    for (const ambiguous of ['0', 'O', '1', 'I', 'L']) expect(PIN_ALPHABET).not.toContain(ambiguous);
  });

  it('ne produit pas deux fois la même valeur sur un petit échantillon', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generatePin()));
    expect(seen.size).toBe(500);
  });

  it('formate par blocs de 4 pour la lecture', () => {
    expect(formatPin('ABCD2345')).toBe('ABCD-2345');
  });

  it('normalise la saisie : casse, espaces et tirets sont indifférents', () => {
    expect(normalizePin(' abcd-2345 ')).toBe('ABCD2345');
    expect(normalizePin('abcd 2345')).toBe('ABCD2345');
  });

  it('refuse une saisie vide, non textuelle ou démesurée', () => {
    expect(normalizePin('')).toBeNull();
    expect(normalizePin(undefined)).toBeNull();
    expect(normalizePin(12345678)).toBeNull();
    expect(normalizePin('A'.repeat(200))).toBeNull();
  });

  it('hache puis vérifie ; une autre valeur échoue', async () => {
    const pin = generatePin();
    const hash = await hashPin(pin);
    expect(hash).not.toContain(pin);
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPin(pin, hash)).toBe(true);
    expect(await verifyPin(formatPin(pin).toLowerCase(), hash)).toBe(true);
    expect(await verifyPin('ZZZZ9999', hash)).toBe(false);
  });
});
