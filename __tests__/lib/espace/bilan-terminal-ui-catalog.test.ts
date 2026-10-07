import { ACTIVITIES, getLessonSteps } from '@/lib/espace/catalog';

it.each([['NSI', 'NSI'], ['Mathématiques', 'MATHEMATIQUES']])('propose un bilan Terminale %s dans la bonne matière avec les huit rubriques', (label, subject) => {
  const activity = ACTIVITIES.find(a => /Terminale/.test(a.title) && a.subject === subject && /bilan/i.test(a.title));
  expect(activity).toMatchObject({ subject, kind: 'RESOURCE_PACK', stepsTotal: 8 });
  expect(activity?.title).toContain(label);
  expect(getLessonSteps(activity!.slug).map(s => s.id)).toEqual(['scope', 'mastery', 'evidence', 'methods', 'experience', 'growth', 'next', 'review']);
});
