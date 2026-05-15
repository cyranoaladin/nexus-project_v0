import type { FiveDay } from './types';

export const fiveDayPlan: FiveDay[] = [
  {
    day: 'J-5',
    label: 'J-5',
    theme: 'Listes, dicos, filtrage + récursion',
    slots: [
      {
        period: 'Matin',
        duration: '90 min',
        tasks: [
          {
            label: 'Sujets 1, 2, 4 (listes, dicos, filtrage)',
            subjectIds: [1, 2, 4],
            type: 'new',
          },
        ],
      },
      {
        period: 'Après-midi',
        duration: '90 min',
        tasks: [
          {
            label: 'Sujets 5, 10 (récursion, séries temporelles)',
            subjectIds: [5, 10],
            type: 'new',
          },
        ],
      },
      {
        period: 'Soir',
        duration: '30 min',
        tasks: [
          {
            label: 'Relire les 5 mnémoniques du jour',
            type: 'mnemonics',
          },
        ],
      },
    ],
  },
  {
    day: 'J-4',
    label: 'J-4',
    theme: 'KNN, moyennes, anomalies',
    slots: [
      {
        period: 'Matin',
        duration: '90 min',
        tasks: [
          {
            label: 'Sujets 11, 18, 19 (KNN, moyennes, anomalies)',
            subjectIds: [11, 18, 19],
            type: 'new',
          },
        ],
      },
      {
        period: 'Après-midi',
        duration: '90 min',
        tasks: [
          {
            label: 'Refaire sujets 1 et 4 chronométré (25 min chacun)',
            subjectIds: [1, 4],
            type: 'timed',
          },
        ],
      },
      {
        period: 'Soir',
        duration: '30 min',
        tasks: [
          {
            label: 'Patrons de code à la main',
            type: 'patterns',
          },
        ],
      },
    ],
  },
  {
    day: 'J-3',
    label: 'J-3',
    theme: 'CSV, SQLite, agrégation',
    slots: [
      {
        period: 'Matin',
        duration: '90 min',
        tasks: [
          {
            label: 'Sujets 12, 13, 15, 17 (CSV, SQLite, agrégation)',
            subjectIds: [12, 13, 15, 17],
            type: 'new',
          },
        ],
      },
      {
        period: 'Après-midi',
        duration: '90 min',
        tasks: [
          {
            label: 'Refaire sujets 11 et 18 sans regarder',
            subjectIds: [11, 18],
            type: 'review',
          },
        ],
      },
      {
        period: 'Soir',
        duration: '30 min',
        tasks: [
          {
            label: 'Lecture orale des sujets 1, 4, 11',
            subjectIds: [1, 4, 11],
            type: 'oral',
          },
        ],
      },
    ],
  },
  {
    day: 'J-2',
    label: 'J-2',
    theme: 'POO, simulations + binaire',
    slots: [
      {
        period: 'Matin',
        duration: '90 min',
        tasks: [
          {
            label: 'Sujets 7, 9, 14, 21 (POO, simulations)',
            subjectIds: [7, 9, 14, 21],
            type: 'new',
          },
        ],
      },
      {
        period: 'Après-midi',
        duration: '90 min',
        tasks: [
          {
            label: 'Sujets 8, 22, 23 (binaire, BCD, trames)',
            subjectIds: [8, 22, 23],
            type: 'new',
          },
        ],
      },
      {
        period: 'Soir',
        duration: '30 min',
        tasks: [
          {
            label: 'Refaire 13 ou 17 sans regarder',
            subjectIds: [13, 17],
            type: 'review',
          },
        ],
      },
    ],
  },
  {
    day: 'J-1',
    label: 'J-1',
    theme: 'Dates, scores, seuils + sujet blanc',
    slots: [
      {
        period: 'Matin',
        duration: '90 min',
        tasks: [
          {
            label: 'Sujets 3, 6, 16, 20 (dates, scores, seuils)',
            subjectIds: [3, 6, 16, 20],
            type: 'new',
          },
        ],
      },
      {
        period: 'Après-midi',
        duration: '90 min',
        tasks: [
          {
            label: 'Sujet blanc tiré au hasard en 55 min puis oral simulé 15 min',
            type: 'mock',
          },
        ],
      },
      {
        period: 'Soir',
        duration: '30 min',
        tasks: [
          {
            label: 'Relire toutes les mnémoniques',
            type: 'mnemonics',
          },
        ],
      },
    ],
  },
];
