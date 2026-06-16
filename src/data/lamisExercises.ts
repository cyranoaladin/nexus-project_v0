import type { LamisExercise, LamisExerciseLevel, LamisExerciseType } from "@/lib/lamis/types";

type Draft = Omit<LamisExercise, "hint1" | "hint2" | "correction" | "explanation" | "expectedTimeSeconds" | "competence"> & {
  correction?: string;
  explanation?: string;
  competence?: string;
};

const timeByType: Record<LamisExerciseType, number> = {
  qcm: 4,
  number: 8,
  text: 8,
  justification: 15,
};

function exercise(draft: Draft): LamisExercise {
  const expected = draft.correctAnswers.join(" ou ");
  const expectedTimeSeconds = draft.theme === "Calcul mental" ? 4 : timeByType[draft.type];
  return {
    ...draft,
    hint1: draft.type === "number" ? "Écris le calcul avant de donner le résultat." : "Repère les mots importants de la consigne.",
    hint2: draft.type === "qcm" ? "Élimine les réponses impossibles puis choisis une seule réponse." : `La réponse attendue ressemble à : ${expected}.`,
    correction: draft.correction ?? `Réponse attendue : ${expected}. On applique directement la méthode du thème ${draft.theme}.`,
    explanation: draft.explanation ?? "C’est un point rentable : le jour de l’épreuve, il faut reconnaître le réflexe et l’appliquer calmement.",
    expectedTimeSeconds,
    competence: draft.competence ?? draft.theme,
  };
}

function numberExercise(id: string, day: 1 | 2, block: string, theme: string, statement: string, answer: string, level: LamisExerciseLevel = "facile", tolerance = 0.01): LamisExercise {
  return exercise({ id, day, block, theme, level, type: "number", statement, correctAnswers: [answer], tolerance });
}

function textExercise(id: string, day: 1 | 2, block: string, theme: string, statement: string, answers: string[], level: LamisExerciseLevel = "moyen", type: LamisExerciseType = "text"): LamisExercise {
  return exercise({ id, day, block, theme, level, type, statement, correctAnswers: answers });
}

function qcmExercise(id: string, day: 1 | 2, block: string, theme: string, statement: string, choices: string[], answer: string, level: LamisExerciseLevel = "facile"): LamisExercise {
  return exercise({ id, day, block, theme, level, type: "qcm", statement, choices, correctAnswers: [answer] });
}

const percentages: LamisExercise[] = [
  numberExercise("pct-hausse-200-10", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "Augmenter 200 de 10 %.", "220"),
  numberExercise("pct-baisse-400-20", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "Diminuer 400 de 20 %.", "320"),
  numberExercise("pct-coef-hausse-30", 1, "Pourcentages et coefficients multiplicateurs", "Coefficient multiplicateur", "Quel coefficient correspond à une hausse de 30 % ?", "1.3"),
  numberExercise("pct-coef-baisse-25", 1, "Pourcentages et coefficients multiplicateurs", "Coefficient multiplicateur", "Quel coefficient correspond à une baisse de 25 % ?", "0.75"),
  numberExercise("pct-hausse-150-20", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "Augmenter 150 de 20 %.", "180"),
  numberExercise("pct-baisse-80-25", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "Diminuer 80 de 25 %.", "60"),
  numberExercise("pct-hausse-60-50", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "Augmenter 60 de 50 %.", "90"),
  numberExercise("pct-baisse-90-10", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "Diminuer 90 de 10 %.", "81"),
  numberExercise("pct-coef-hausse-10", 1, "Pourcentages et coefficients multiplicateurs", "Coefficient multiplicateur", "Coefficient d’une hausse de 10 %.", "1.1"),
  numberExercise("pct-coef-baisse-20", 1, "Pourcentages et coefficients multiplicateurs", "Coefficient multiplicateur", "Coefficient d’une baisse de 20 %.", "0.8"),
  numberExercise("pct-valeur-120-coef-1-2", 1, "Pourcentages et coefficients multiplicateurs", "Coefficient multiplicateur", "Calculer 120 × 1,2.", "144"),
  numberExercise("pct-valeur-500-coef-0-9", 1, "Pourcentages et coefficients multiplicateurs", "Coefficient multiplicateur", "Calculer 500 × 0,9.", "450"),
  qcmExercise("pct-qcm-hausse-formule", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "Pour une hausse de t %, on multiplie par :", ["1 + t/100", "1 - t/100", "t/100"], "1 + t/100"),
  qcmExercise("pct-qcm-baisse-formule", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "Pour une baisse de t %, on multiplie par :", ["1 + t/100", "1 - t/100", "100 - t"], "1 - t/100"),
  numberExercise("pct-75-20", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "20 % de 75.", "15"),
  numberExercise("pct-240-25", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "25 % de 240.", "60"),
  numberExercise("pct-320-50", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "50 % de 320.", "160"),
  numberExercise("pct-90-10", 1, "Pourcentages et coefficients multiplicateurs", "Pourcentages", "10 % de 90.", "9"),
  textExercise("pct-justify-1", 1, "Pourcentages et coefficients multiplicateurs", "Coefficient multiplicateur", "Justifie le coefficient d’une baisse de 10 %.", ["0.9 baisse 10", "1-10/100=0.9"], "moyen", "justification"),
  textExercise("pct-justify-2", 1, "Pourcentages et coefficients multiplicateurs", "Coefficient multiplicateur", "Justifie le coefficient d’une hausse de 50 %.", ["1.5 hausse 50", "1+50/100=1.5"], "moyen", "justification"),
];

const mental: LamisExercise[] = [
  numberExercise("mental-10p-250", 1, "Calcul mental utile", "Calcul mental", "10 % de 250.", "25"),
  numberExercise("mental-25p-80", 1, "Calcul mental utile", "Calcul mental", "25 % de 80.", "20"),
  numberExercise("mental-50p-120", 1, "Calcul mental utile", "Calcul mental", "50 % de 120.", "60"),
  numberExercise("mental-20p-300", 1, "Calcul mental utile", "Calcul mental", "20 % de 300.", "60"),
  numberExercise("mental-10p-430", 1, "Calcul mental utile", "Calcul mental", "10 % de 430.", "43"),
  numberExercise("mental-20p-90", 1, "Calcul mental utile", "Calcul mental", "20 % de 90.", "18"),
  numberExercise("mental-25p-200", 1, "Calcul mental utile", "Calcul mental", "25 % de 200.", "50"),
  numberExercise("mental-50p-38", 1, "Calcul mental utile", "Calcul mental", "50 % de 38.", "19"),
  numberExercise("mental-double-37", 1, "Calcul mental utile", "Calcul mental", "Le double de 37.", "74"),
  numberExercise("mental-moitie-86", 1, "Calcul mental utile", "Calcul mental", "La moitié de 86.", "43"),
  numberExercise("mental-quart-64", 1, "Calcul mental utile", "Calcul mental", "Le quart de 64.", "16"),
  numberExercise("mental-3x-12", 1, "Calcul mental utile", "Calcul mental", "3 × 12.", "36"),
  numberExercise("mental-7x-8", 1, "Calcul mental utile", "Calcul mental", "7 × 8.", "56"),
  numberExercise("mental-45-plus-19", 1, "Calcul mental utile", "Calcul mental", "45 + 19.", "64"),
  numberExercise("mental-100-moins-27", 1, "Calcul mental utile", "Calcul mental", "100 - 27.", "73"),
];

const equations: LamisExercise[] = [
  numberExercise("eq-2x-6", 1, "Équations simples", "Équations", "Résoudre 2x - 6 = 0.", "3"),
  numberExercise("eq-3x-15", 1, "Équations simples", "Équations", "Résoudre 3x - 15 = 0.", "5"),
  numberExercise("eq-x-plus-7-12", 1, "Équations simples", "Équations", "Résoudre x + 7 = 12.", "5"),
  numberExercise("eq-4x-20", 1, "Équations simples", "Équations", "Résoudre 4x - 20 = 0.", "5"),
  numberExercise("eq-5x-plus-10", 1, "Équations simples", "Équations", "Résoudre 5x + 10 = 0.", "-2"),
  numberExercise("eq-x-moins-9-0", 1, "Équations simples", "Équations", "Résoudre x - 9 = 0.", "9"),
  numberExercise("eq-2x-plus-8", 1, "Équations simples", "Équations", "Résoudre 2x + 8 = 0.", "-4"),
  numberExercise("eq-10x-50", 1, "Équations simples", "Équations", "Résoudre 10x - 50 = 0.", "5"),
  numberExercise("eq-6x-18", 1, "Équations simples", "Équations", "Résoudre 6x - 18 = 0.", "3"),
  textExercise("eq-justify", 1, "Équations simples", "Équations", "Explique pourquoi 2x - 6 = 0 donne x = 3.", ["2x=6 x=3", "on ajoute 6 puis divise par 2"], "moyen", "justification"),
];

const miniQcmBank: Array<[string, string[], string]> = [
  ["Une baisse de 20 % correspond au coefficient :", ["0,8", "1,2", "20"], "0,8"],
  ["Une hausse de 10 % de 100 donne :", ["110", "90", "10"], "110"],
  ["25 % signifie :", ["un quart", "la moitié", "le double"], "un quart"],
  ["Dans 3x - 15 = 0, on obtient :", ["x = 5", "x = -5", "x = 15"], "x = 5"],
];

const miniQcm: LamisExercise[] = Array.from({ length: 12 }, (_, index) => {
  const n = index + 1;
  const statements = miniQcmBank[index % miniQcmBank.length];
  return qcmExercise(`qcm-final-${n}`, 1, "Mini-QCM final", "QCM final", statements[0], statements[1], statements[2]);
});

const day1Review: LamisExercise[] = Array.from({ length: 8 }, (_, index) =>
  numberExercise(`review-d1-${index + 1}`, 1, "Reprise des erreurs", "À refaire", `Question de reprise ${index + 1} : calculer ${10 * (index + 2)} augmenté de 10 %.`, String(11 * (index + 2)), "facile")
);

const sequences: LamisExercise[] = [
  textExercise("suite-ari-100-105", 2, "Suites arithmétiques et géométriques", "Suites", "100, 105, 110, ... Donner le terme suivant, la nature et la raison.", ["115 arithmetique r=5", "115 arithmétique raison 5"]),
  textExercise("suite-geo-1000-900", 2, "Suites arithmétiques et géométriques", "Suites", "1000, 900, 810, ... Donner le terme suivant, la nature et la raison.", ["729 geometrie q=0.9", "729 géométrique q=0,9"]),
  textExercise("suite-stock-800", 2, "Suites arithmétiques et géométriques", "Suites", "Un stock de 800 baisse de 10 % par jour. Donner u1, u2, u3.", ["720 648 583.2", "720;648;583,2"]),
  ...Array.from({ length: 12 }, (_, index) => {
    const start = 20 + index * 5;
    return textExercise(`suite-auto-${index + 1}`, 2, "Suites arithmétiques et géométriques", "Suites", `${start}, ${start + 4}, ${start + 8}, ... Nature, raison et terme suivant.`, [`${start + 12} arithmetique r=4`, `${start + 12} arithmétique raison 4`], index < 7 ? "facile" : "moyen");
  }),
];

const probabilities: LamisExercise[] = [
  numberExercise("proba-bus", 2, "Probabilités et tableaux croisés", "Probabilités", "Tableau : 60 élèves prennent le bus sur 100. Probabilité de prendre le bus ?", "0.6"),
  numberExercise("proba-fille-bus", 2, "Probabilités et tableaux croisés", "Probabilités", "Parmi les filles, 32 prennent le bus sur 50. Probabilité ?", "0.64"),
  numberExercise("proba-pasbus-fille", 2, "Probabilités et tableaux croisés", "Probabilités", "Parmi les 40 élèves sans bus, 18 sont des filles. Probabilité ?", "0.45"),
  ...Array.from({ length: 12 }, (_, index) => {
    const total = 100;
    const value = 20 + index * 5;
    return numberExercise(`proba-auto-${index + 1}`, 2, "Probabilités et tableaux croisés", "Probabilités", `${value} élèves sur ${total} vérifient l’événement A. Donner P(A) en décimal.`, String(value / total), index < 8 ? "facile" : "moyen");
  }),
];

const functions: LamisExercise[] = [
  numberExercise("fonc-2x1-f3", 2, "Fonctions simples", "Fonctions", "Si f(x) = 2x + 1, calculer f(3).", "7"),
  numberExercise("fonc-quad-f0", 2, "Fonctions simples", "Fonctions", "Si f(x) = -x² + 6x - 5, calculer f(0).", "-5"),
  textExercise("fonc-racines-2-5", 2, "Fonctions simples", "Fonctions", "Si f(x) = (x - 2)(x - 5), donner les racines.", ["2 5", "2 et 5"]),
  ...Array.from({ length: 12 }, (_, index) => {
    const a = index % 2 === 0 ? 2 : -1;
    const b = index + 1;
    const x = index % 4;
    return numberExercise(`fonc-auto-${index + 1}`, 2, "Fonctions simples", "Fonctions", `Si f(x) = ${a}x + ${b}, calculer f(${x}).`, String(a * x + b), index < 8 ? "facile" : "moyen");
  }),
];

const express: LamisExercise[] = Array.from({ length: 10 }, (_, index) => {
  if (index % 2 === 0) {
    return qcmExercise(`express-qcm-${index + 1}`, 2, "Sujet express", "Sujet express", "Dans un tableau, le mot “parmi” indique :", ["une probabilité conditionnelle", "une racine", "une raison"], "une probabilité conditionnelle", "moyen");
  }
  return textExercise(`express-justif-${index + 1}`, 2, "Sujet express", "Sujet express", "Justifie en une phrase pourquoi une suite qui ajoute toujours 3 est arithmétique.", ["arithmetique ajoute 3", "raison 3"], "moyen", "justification");
});

const day2Review: LamisExercise[] = Array.from({ length: 8 }, (_, index) =>
  textExercise(`review-d2-${index + 1}`, 2, "Reprise des erreurs", "À refaire", `Question de reprise ${index + 1} : ${50 + index}, ${55 + index}, ${60 + index}, ... Nature et raison.`, ["arithmetique r=5", "arithmétique raison 5"], "facile")
);

export const lamisExercises: LamisExercise[] = [
  ...percentages,
  ...mental,
  ...equations,
  ...miniQcm,
  ...day1Review,
  ...sequences,
  ...probabilities,
  ...functions,
  ...express,
  ...day2Review,
];

export const lamisBlocks = Array.from(new Set(lamisExercises.map((exerciseItem) => exerciseItem.block)));
