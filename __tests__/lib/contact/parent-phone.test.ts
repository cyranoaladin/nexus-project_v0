import { normalizeParentPhone } from '@/lib/contact/parent-phone';

describe('normalizeParentPhone — Tunisie (compatibilité historique impérative)', () => {
  test.each([
    '99 19 28 29',
    '+216 99 19 28 29',
    '00216 99 19 28 29',
    '21699192829',
    '99-19-28-29',
  ])('normalise %s vers les huit chiffres locaux', (input) => {
    expect(normalizeParentPhone(input)).toEqual({
      display: '99 19 28 29',
      normalized: '99192829',
    });
  });
});

describe('normalizeParentPhone — international (E.164 générique)', () => {
  it.each([
    ['+97466298752', 'Qatar, +'],
    ['+974 66 29 87 52', 'Qatar, + avec espaces'],
    ['00974 66 29 87 52', 'Qatar, 00 avec espaces'],
    ['97466298752', 'Qatar, chiffres nus'],
  ])('normalise %s (%s) vers le même numéro qatari canonique', (input) => {
    expect(normalizeParentPhone(input)).toEqual({
      display: '+97466298752',
      normalized: '97466298752',
    });
  });

  it('normalise un numéro français', () => {
    expect(normalizeParentPhone('+33 6 12 34 56 78')).toEqual({
      display: '+33612345678',
      normalized: '33612345678',
    });
  });

  it('normalise un numéro émirati', () => {
    expect(normalizeParentPhone('+971 50 123 4567')).toEqual({
      display: '+971501234567',
      normalized: '971501234567',
    });
  });

  it('normalise un numéro saoudien', () => {
    expect(normalizeParentPhone('+966 50 123 4567')).toEqual({
      display: '+966501234567',
      normalized: '966501234567',
    });
  });

  it('accepte la limite maximale E.164 de 15 chiffres', () => {
    const fifteenDigits = '123456789012345';
    expect(normalizeParentPhone(`+${fifteenDigits}`)).toEqual({
      display: `+${fifteenDigits}`,
      normalized: fifteenDigits,
    });
  });

  it('refuse un numéro dépassant 15 chiffres', () => {
    expect(() => normalizeParentPhone('+1234567890123456')).toThrow('PARENT_PHONE_INVALID');
  });
});

describe('normalizeParentPhone — formats invalides', () => {
  test.each([
    ['', 'chaîne vide'],
    ['9919282', 'tunisien trop court (7 chiffres)'],
    ['991928290', 'nu, ambigu, trop court pour être international (9 chiffres)'],
    ['00 216 parent', 'lettres'],
    ['00192829', '00 non tunisien, trop court'],
    ['+216+99192829', 'deux signes +'],
    ['216+99192829', 'signe + ailleurs qu’au début'],
    ['+0123456789', 'indicatif impossible +0'],
    ['9919282a', 'lettre mêlée aux chiffres'],
    ['+216 99 19 28 29 ext 12', 'extension textuelle non gérée'],
    ['+216/99192829', 'caractère non autorisé (/)'],
  ])('refuse le format invalide %j (%s)', (input) => {
    expect(() => normalizeParentPhone(input)).toThrow('PARENT_PHONE_INVALID');
  });
});
