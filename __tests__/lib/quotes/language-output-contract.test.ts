import type { Subject } from '@prisma/client';
import { buildExamProfile, formatLanguageLabels, SUBJECT_LABELS } from '@/lib/quotes/exam-profile';

test.each([
  ['ARABE', 'Arabe'],
  ['ANGLAIS', 'Anglais'],
  ['ESPAGNOL', 'Espagnol'],
  ['ITALIEN', 'Italien'],
  ['RUSSE', 'Russe'],
  ['ALLEMAND', 'Allemand'],
] as const)('humanise %s en %s', (code, label) => {
  expect(SUBJECT_LABELS[code]).toBe(label);
});

test('le profil examen nomme les langues concrètes de chaque épreuve', () => {
  const profile = buildExamProfile({
    level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'],
    langueA: 'ARABE', langueB: 'ALLEMAND',
  });

  expect(profile.find((subject) => subject.subject === 'lva')?.label).toBe('Langue vivante A — Arabe');
  expect(profile.find((subject) => subject.subject === 'lvb')?.label).toBe('Langue vivante B — Allemand');
});

test('omet tout Subject corrompu qui ne fait pas partie du canon des langues', () => {
  expect(formatLanguageLabels('MATHEMATIQUES' as Subject, 'NSI' as Subject)).toEqual([]);

  const profile = buildExamProfile({
    level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'],
    langueA: 'MATHEMATIQUES' as Subject, langueB: 'NSI' as Subject,
  });
  expect(profile.find((subject) => subject.subject === 'lva')?.label).toBe('Langue vivante A');
  expect(profile.find((subject) => subject.subject === 'lvb')?.label).toBe('Langue vivante B');
});
