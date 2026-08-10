import { normalizeParentPhone } from '@/lib/contact/parent-phone';

describe('normalizeParentPhone', () => {
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

  test.each([
    '',
    '9919282',
    '991928290',
    '+33 6 12 34 56 78',
    '00 216 parent',
    '00192829',
  ])('refuse le format invalide %j', (input) => {
    expect(() => normalizeParentPhone(input)).toThrow('PARENT_PHONE_INVALID');
  });
});
