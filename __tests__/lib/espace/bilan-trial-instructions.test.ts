import { getBilanSections } from '@/lib/espace/bilan-data';

it('preserves the Seconde PDF instruction for a first attempt without a course or calculator', () => {
  const intro = getBilanSections('2nde').find(section => section.id === 'trial-reflection')!.intro;
  expect(intro).toMatch(/premier essai[^.]*sans cours ni calculatrice/i);
  expect(intro).toMatch(/garde.*recherche/i);
});

it('adapts NSI first attempts to a paper prediction before execution, with later work kept separate', () => {
  const intro = getBilanSections('tle-nsi').find(section => section.id === 'trial-reflection')!.intro;
  expect(intro).toMatch(/lecture ou de trace de code/i);
  expect(intro).toMatch(/prédiction sur papier[^.]*sans exécuter/i);
  expect(intro).toMatch(/exécution.*ultérieure/i);
  expect(intro).toMatch(/séparée de ta première trace/i);
});

it('retains the individual calculator instructions for Terminale mathematics', () => {
  const intro = getBilanSections('tle-maths').find(section => section.id === 'trial-reflection')!.intro;
  expect(intro).toMatch(/consigne de chaque essai pour la calculatrice/i);
  expect(intro).not.toMatch(/sans cours ni calculatrice/i);
});
