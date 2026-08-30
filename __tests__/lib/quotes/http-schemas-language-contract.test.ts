jest.mock('server-only', () => ({}));

import { situationSchema } from '@/lib/quotes/http-schemas';
import { SPECIALITY_CODES } from '@/lib/exams/specialities';

const BASE = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
} as const;

test.each([
  { ...BASE, specialites: ['ARABE', 'NSI'] },
  { ...BASE, specialiteAbandonnee: 'ARABE' },
])('refuse une langue forgee comme specialite: %p', (situation) => {
  expect(situationSchema.safeParse(situation).success).toBe(false);
});

test('accepte les six langues uniquement dans LVA/LVB', () => {
  for (const langueA of ['ARABE', 'ANGLAIS', 'ESPAGNOL', 'ITALIEN', 'RUSSE', 'ALLEMAND']) {
    expect(situationSchema.safeParse({ ...BASE, langueA, langueB: langueA === 'ARABE' ? 'ALLEMAND' : 'ARABE' }).success).toBe(true);
  }
});

test.each(['PORTUGAIS', 'MATHEMATIQUES'])('refuse %s dans langueA et langueB', (value) => {
  expect(situationSchema.safeParse({ ...BASE, langueA: value }).success).toBe(false);
  expect(situationSchema.safeParse({ ...BASE, langueB: value }).success).toBe(false);
});

test('la whitelist EDS V1 contient exactement cinq specialites', () => {
  expect(SPECIALITY_CODES).toEqual(['MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT', 'SES']);
});

test.each(['MATHS_EXPERTES', 'FRANCAIS', 'PHILOSOPHIE', 'HISTOIRE_GEO'])(
  'refuse %s comme specialite hors whitelist V1',
  (specialite) => {
    expect(situationSchema.safeParse({ ...BASE, specialites: [specialite, 'NSI'] }).success).toBe(false);
    expect(situationSchema.safeParse({ ...BASE, specialiteAbandonnee: specialite }).success).toBe(false);
  },
);

test('refuse une LVA et une LVB identiques avec un message stable sur langueB', () => {
  const parsed = situationSchema.safeParse({ ...BASE, langueA: 'RUSSE', langueB: 'RUSSE' });
  expect(parsed.success).toBe(false);
  if (!parsed.success) {
    expect(parsed.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: ['langueB'],
        message: 'La LVA et la LVB doivent être deux langues différentes.',
      }),
    ]));
  }
});
