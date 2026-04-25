import type { QcmQuestion } from './types';

const choices = (correct: string, distractors: string[]) => [
  { letter: 'A' as const, text: correct },
  { letter: 'B' as const, text: distractors[0] ?? 'Autre reponse' },
  { letter: 'C' as const, text: distractors[1] ?? 'Autre reponse' },
  { letter: 'D' as const, text: distractors[2] ?? 'Autre reponse' },
];

export const QCM_BANK: QcmQuestion[] = [
  { id: 'sujet0_v1_q1', number: 1, source: 'sujet_0_v1', category: 'ROUGE', enonce: 'Proportion d une proportion : 25 % de 80 %.', choices: choices('20 %', ['25 %', '80 %', '105 %']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q2', number: 2, source: 'sujet_0_v1', category: 'ORANGE', reflexId: 'reflex_1', enonce: 'Retrouver le taux initial apres une baisse de 50 %.', choices: choices('100 %', ['50 %', '25 %', '150 %']), correctAnswer: 'A', exclusionTip: 'Une baisse de 50 % divise par 2 : pour revenir, il faut doubler.' },
  { id: 'sujet0_v1_q3', number: 3, source: 'sujet_0_v1', category: 'VERT', reflexId: 'reflex_1', enonce: 'Coefficient multiplicateur de 250 vers 200.', choices: choices('0,8', ['1,25', '0,2', '1,8']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q4', number: 4, source: 'sujet_0_v1', category: 'ROUGE', enonce: 'Puissances : (2^-4)^3.', choices: choices('2^-12', ['2^-1', '2^12', '6^-12']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q5', number: 5, source: 'sujet_0_v1', category: 'ROUGE', enonce: 'Ecriture scientifique multipliee par 2000.', choices: choices('ecriture scientifique correcte', ['reponse piege 1', 'reponse piege 2', 'reponse piege 3']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q6', number: 6, source: 'sujet_0_v1', category: 'ROUGE', enonce: 'Comparaison d ecritures scientifiques.', choices: choices('la plus grande valeur', ['valeur proche 1', 'valeur proche 2', 'valeur proche 3']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q7', number: 7, source: 'sujet_0_v1', category: 'VERT', reflexId: 'reflex_6', enonce: 'Simplifier x + 3x + x^2.', choices: choices('x^2 + 4x', ['4x^2', '5x', '3x^2']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q8', number: 8, source: 'sujet_0_v1', category: 'ORANGE', reflexId: 'reflex_5', enonce: 'Lecture graphique de f(x) <= g(x).', choices: choices('intervalle lu sur le graphique', ['intervalle inverse', 'aucune solution', 'tout R']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q9', number: 9, source: 'sujet_0_v1', category: 'VERT', reflexId: 'reflex_5', enonce: 'Nombre de solutions de f(x)=0 sur un graphique.', choices: choices('2', ['0', '1', '3']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q10', number: 10, source: 'sujet_0_v1', category: 'ROUGE', enonce: 'Identifier une fonction affine dans un tableau.', choices: choices('fonction affine', ['non affine', 'quadratique', 'constante']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q11', number: 11, source: 'sujet_0_v1', category: 'ROUGE', enonce: 'Isoler t dans C = (1+t)^2.', choices: choices('t = racine(C) - 1', ['t = C - 1', 't = C^2 - 1', 't = 1 - racine(C)']), correctAnswer: 'A' },
  { id: 'sujet0_v1_q12', number: 12, source: 'sujet_0_v1', category: 'VERT', reflexId: 'reflex_5', enonce: 'Lecture d un diagramme en barres.', choices: choices('valeur lue', ['valeur voisine', 'total', 'moyenne']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q1', number: 1, source: 'sujet_0_v2', category: 'VERT', reflexId: 'reflex_1', enonce: 'Hausse de 20 % sur 400 euros.', choices: choices('480 euros', ['420 euros', '500 euros', '320 euros']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q2', number: 2, source: 'sujet_0_v2', category: 'VERT', reflexId: 'reflex_1', enonce: 'Baisse de 10 % : reconnaitre le coefficient.', choices: choices('0,9', ['1,1', '0,1', '9']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q3', number: 3, source: 'sujet_0_v2', category: 'ORANGE', reflexId: 'reflex_1', enonce: 'Deux hausses successives de 20 %.', choices: choices('1,44', ['1,40', '0,64', '2,40']), correctAnswer: 'A', exclusionTip: 'Deux hausses de 20 % ne font pas +40 % exactement.' },
  { id: 'sujet0_v2_q4', number: 4, source: 'sujet_0_v2', category: 'ROUGE', enonce: 'Election avec fractions et reste.', choices: choices('reste correct', ['quart', 'tiers', 'cinquieme']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q5', number: 5, source: 'sujet_0_v2', category: 'ROUGE', enonce: 'Calcul fractionnaire complexe.', choices: choices('fraction simplifiee correcte', ['fraction piege 1', 'fraction piege 2', 'fraction piege 3']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q6', number: 6, source: 'sujet_0_v2', category: 'ORANGE', enonce: 'Calculer 1/100 + 1/1000.', choices: choices('0,011', ['0,11', '0,0011', '0,101']), correctAnswer: 'A', pedagogicalHint: 'A memoriser directement : 0,01 + 0,001 = 0,011.' },
  { id: 'sujet0_v2_q7', number: 7, source: 'sujet_0_v2', category: 'VERT', enonce: 'Convertir 75 minutes en heures decimales.', choices: choices('1,25 h', ['1,15 h', '0,75 h', '1,75 h']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q8', number: 8, source: 'sujet_0_v2', category: 'ROUGE', enonce: 'Approximer 10^30 + 10^-30.', choices: choices('10^30', ['0', '10^0', '10^-30']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q9', number: 9, source: 'sujet_0_v2', category: 'ORANGE', reflexId: 'reflex_5', enonce: 'Reconnaitre la droite y = -2x + 5.', choices: choices('droite decroissante qui coupe 5', ['droite croissante', 'droite horizontale', 'parabole']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q10', number: 10, source: 'sujet_0_v2', category: 'VERT', reflexId: 'reflex_6', enonce: 'Resoudre 3x = 0.', choices: choices('x = 0', ['x = 3', 'x = 1/3', 'impossible']), correctAnswer: 'A' },
  { id: 'sujet0_v2_q11', number: 11, source: 'sujet_0_v2', category: 'ORANGE', reflexId: 'reflex_6', enonce: 'Resoudre 144/x = 9.', choices: choices('x = 16', ['x = 9', 'x = 144', 'x = 153']), correctAnswer: 'A', pedagogicalHint: '144 = 16 x 9.' },
  { id: 'sujet0_v2_q12', number: 12, source: 'sujet_0_v2', category: 'ROUGE', enonce: 'Moyenne ponderee avec inconnue.', choices: choices('valeur correcte', ['moyenne simple', 'total', 'ecart']), correctAnswer: 'A' },
];

// TODO: Shark fournira 30 questions simulees additionnelles dans une seconde iteration.
