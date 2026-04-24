import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "stmg-parcours-deploy-v3";
const LINE_BREAK = String.fromCharCode(10);

const MODULES = [
  {
    id: "calculs",
    title: "Décimaux et calculs de base",
    emoji: "🧠",
    hero: "from-rose-500 via-orange-400 to-amber-300",
    soft: "from-rose-50 to-orange-50",
    short: "Reprendre les bases calmement",
    objective: "Savoir additionner, soustraire et manipuler des nombres simples sans blocage.",
    memoryRule: "J’aligne les virgules, je calcule étape par étape et je vérifie si mon résultat paraît logique.",
    method: [
      "Je recopie le calcul proprement.",
      "J’aligne les virgules si besoin.",
      "Je calcule lentement.",
      "Je relis pour vérifier la cohérence."
    ],
    flashcards: [
      "1 + 0,2 = 1,2",
      "0,5 = la moitié",
      "0,25 = le quart",
      "Multiplier par 10 décale la virgule d’un rang vers la droite."
    ],
    exercises: [
      {
        id: "calc-1",
        prompt: "Calcule : 1 + 0,2",
        answer: "1.2",
        accepted: ["1,2"],
        hint1: "0,2 signifie deux dixièmes.",
        hint2: "1 entier + 2 dixièmes donne 1,2.",
        methodText: "On part de 1. Ajouter 0,2 donne 1,2."
      },
      {
        id: "calc-2",
        prompt: "Calcule : 3,5 + 1,4",
        answer: "4.9",
        accepted: ["4,9"],
        hint1: "Aligne 3,5 et 1,4.",
        hint2: "5 dixièmes + 4 dixièmes = 9 dixièmes.",
        methodText: "3 + 1 = 4 et 0,5 + 0,4 = 0,9, donc 4,9."
      },
      {
        id: "calc-3",
        prompt: "Calcule : 8 - 2,7",
        answer: "5.3",
        accepted: ["5,3"],
        hint1: "Écris 8 sous la forme 8,0.",
        hint2: "8,0 - 2,7 = 5,3.",
        methodText: "Je transforme 8 en 8,0 puis je soustrais colonne par colonne."
      },
      {
        id: "calc-4",
        prompt: "Calcule : 0,25 de 40",
        answer: "10",
        hint1: "0,25 correspond à un quart.",
        hint2: "Le quart de 40 vaut 10.",
        methodText: "0,25 de 40 signifie prendre un quart de 40."
      }
    ]
  },
  {
    id: "pourcentages",
    title: "Pourcentages et coefficients",
    emoji: "📈",
    hero: "from-amber-500 via-yellow-400 to-lime-300",
    soft: "from-amber-50 to-yellow-50",
    short: "Les points les plus rentables",
    objective: "Reconnaître immédiatement une hausse, une baisse et le coefficient multiplicateur associé.",
    memoryRule: "Augmenter de p pour cent = multiplier par 1 + p sur 100. Diminuer de p pour cent = multiplier par 1 - p sur 100.",
    method: [
      "Je repère s’il s’agit d’une hausse ou d’une baisse.",
      "Je transforme le pourcentage en coefficient.",
      "Je multiplie la valeur de départ.",
      "Je conclus avec une phrase claire."
    ],
    flashcards: [
      "+20 pour cent donne fois 1,2",
      "-10 pour cent donne fois 0,9",
      "25 pour cent = 0,25 = 1 sur 4",
      "50 pour cent = 0,5 = 1 sur 2"
    ],
    exercises: [
      {
        id: "pct-1",
        prompt: "Un article coûte 400 euros. Son prix augmente de 20 pour cent. Nouveau prix ?",
        answer: "480",
        hint1: "Augmenter de 20 pour cent signifie multiplier par 1,2.",
        hint2: "400 fois 1,2 donne 480.",
        methodText: "On applique le coefficient multiplicateur 1,2 au prix initial."
      },
      {
        id: "pct-2",
        prompt: "Un sac coûte 130 euros. Son prix baisse de 10 pour cent. Nouveau prix ?",
        answer: "117",
        hint1: "Baisser de 10 pour cent signifie multiplier par 0,9.",
        hint2: "130 fois 0,9 donne 117.",
        methodText: "On garde 90 pour cent du prix, soit 0,9 fois le prix de départ."
      },
      {
        id: "pct-3",
        prompt: "25 pour cent de 80 = ?",
        answer: "20",
        hint1: "25 pour cent = un quart.",
        hint2: "Le quart de 80 vaut 20.",
        methodText: "Prendre 25 pour cent revient à prendre un quart."
      },
      {
        id: "pct-4",
        prompt: "Quel coefficient multiplicateur correspond à une baisse de 30 pour cent ?",
        answer: "0.7",
        accepted: ["0,7"],
        hint1: "Baisser de 30 pour cent signifie garder 70 pour cent.",
        hint2: "70 pour cent = 0,7.",
        methodText: "On calcule 1 - 0,30 = 0,70."
      }
    ]
  },
  {
    id: "conversions",
    title: "Durées et conversions",
    emoji: "⏱️",
    hero: "from-sky-500 via-cyan-400 to-blue-300",
    soft: "from-sky-50 to-cyan-50",
    short: "Éviter les erreurs simples",
    objective: "Passer d’une unité à une autre sans confusion.",
    memoryRule: "Pour les durées, je repère l’unité de départ et l’unité d’arrivée. Pour les minutes vers les heures, je divise par 60.",
    method: [
      "Je repère l’unité de départ.",
      "Je repère l’unité d’arrivée.",
      "J’utilise l’égalité utile.",
      "Je contrôle l’ordre de grandeur."
    ],
    flashcards: [
      "1 heure = 60 minutes",
      "1 kilomètre = 1000 mètres",
      "1 kilogramme = 1000 grammes",
      "75 minutes = 1,25 heure"
    ],
    exercises: [
      {
        id: "conv-1",
        prompt: "Convertis 75 minutes en heures.",
        answer: "1.25",
        accepted: ["1,25"],
        hint1: "On divise par 60.",
        hint2: "75 divisé par 60 donne 1,25.",
        methodText: "Comme 1 heure correspond à 60 minutes, on divise 75 par 60."
      },
      {
        id: "conv-2",
        prompt: "Convertis 2,5 heures en minutes.",
        answer: "150",
        hint1: "On multiplie par 60.",
        hint2: "2,5 fois 60 donne 150.",
        methodText: "Passer des heures aux minutes revient à multiplier par 60."
      },
      {
        id: "conv-3",
        prompt: "Convertis 3,2 kilogrammes en grammes.",
        answer: "3200",
        hint1: "1 kilogramme = 1000 grammes.",
        hint2: "3,2 fois 1000 donne 3200.",
        methodText: "Pour passer de kilogrammes à grammes, on multiplie par 1000."
      },
      {
        id: "conv-4",
        prompt: "Convertis 1200 mètres en kilomètres.",
        answer: "1.2",
        accepted: ["1,2"],
        hint1: "1000 mètres = 1 kilomètre.",
        hint2: "1200 mètres = 1,2 kilomètre.",
        methodText: "Pour passer de mètres à kilomètres, on divise par 1000."
      }
    ]
  },
  {
    id: "equations",
    title: "Équations simples",
    emoji: "🎯",
    hero: "from-emerald-500 via-lime-400 to-green-300",
    soft: "from-emerald-50 to-lime-50",
    short: "Une méthode unique à répéter",
    objective: "Isoler x et sécuriser les équations les plus courantes.",
    memoryRule: "Je veux x tout seul. Je fais la même opération des deux côtés ou je transforme l’égalité en produit simple.",
    method: [
      "Je recopie l’équation.",
      "Je déplace ce qui gêne.",
      "J’isole x.",
      "Je vérifie rapidement."
    ],
    flashcards: [
      "3x = 0 donne x = 0",
      "5x = 20 donne x = 4",
      "ab = 0 donne a = 0 ou b = 0",
      "144 sur x = 9 donne 144 = 9x"
    ],
    exercises: [
      {
        id: "eq-1",
        prompt: "Résous : 3x = 0",
        answer: "0",
        hint1: "Divise par 3.",
        hint2: "0 divisé par 3 donne 0.",
        methodText: "On divise les deux membres par 3."
      },
      {
        id: "eq-2",
        prompt: "Résous : 5x = 20",
        answer: "4",
        hint1: "Divise par 5.",
        hint2: "20 divisé par 5 donne 4.",
        methodText: "On isole x en divisant par 5."
      },
      {
        id: "eq-3",
        prompt: "Résous : 144 sur x = 9",
        answer: "16",
        hint1: "Si 144 sur x = 9, alors 144 = 9x.",
        hint2: "x = 144 sur 9 = 16.",
        methodText: "On transforme l’égalité en produit : 144 = 9x."
      },
      {
        id: "eq-4",
        prompt: "Résous : (x - 1)(x - 5) = 0. Réponds par les deux solutions.",
        answer: "1;5",
        accepted: ["1 et 5", "1 ; 5", "5 et 1", "5;1"],
        hint1: "Un produit est nul si l’un des facteurs est nul.",
        hint2: "x - 1 = 0 ou x - 5 = 0.",
        methodText: "On applique la propriété du produit nul : x = 1 ou x = 5."
      }
    ]
  },
  {
    id: "moyennes",
    title: "Moyennes et tableaux",
    emoji: "🧮",
    hero: "from-violet-500 via-fuchsia-400 to-pink-300",
    soft: "from-violet-50 to-fuchsia-50",
    short: "Méthodes guidées et rentables",
    objective: "Calculer une moyenne simple, une moyenne pondérée et retrouver une valeur manquante.",
    memoryRule: "Pour une moyenne pondérée : somme des notes multipliées par leurs coefficients, puis division par la somme des coefficients.",
    method: [
      "Je lis les données une ligne à la fois.",
      "Je calcule note fois coefficient si besoin.",
      "J’additionne.",
      "Je divise par le total des coefficients."
    ],
    flashcards: [
      "Moyenne = somme divisée par nombre de valeurs",
      "Avec des coefficients, certaines notes comptent davantage",
      "Dans un tableau, une case manquante se retrouve souvent par différence",
      "Je peux traduire une moyenne par une équation"
    ],
    exercises: [
      {
        id: "moy-1",
        prompt: "Calcule la moyenne de 10, 14 et 16.",
        answer: "13.333",
        accepted: ["13,33", "13.33", "13,3", "13.3", "40 sur 3", "40/3"],
        hint1: "On additionne puis on divise par 3.",
        hint2: "10 + 14 + 16 = 40.",
        methodText: "Une moyenne simple se calcule en divisant la somme par le nombre de valeurs."
      },
      {
        id: "moy-2",
        prompt: "Complète : 45 + x = 75. Quelle est la valeur de x ?",
        answer: "30",
        hint1: "x = 75 - 45.",
        hint2: "x = 30.",
        methodText: "Une case manquante s’obtient souvent par différence avec le total."
      },
      {
        id: "moy-3",
        prompt: "Notes 10, 13, 12 avec coefficients 1, 1, 1 et une note x coefficient 2. Si la moyenne vaut 15, quelle note faut-il pour x ?",
        answer: "20",
        hint1: "Écris : (10 + 13 + 12 + 2x) sur 5 = 15.",
        hint2: "35 + 2x = 75.",
        methodText: "On traduit d’abord la moyenne par une équation."
      },
      {
        id: "moy-4",
        prompt: "Un élève a 12 avec coefficient 2 et 16 avec coefficient 3. Quelle est sa moyenne ?",
        answer: "14.4",
        accepted: ["14,4"],
        hint1: "Calcule 12 fois 2 et 16 fois 3.",
        hint2: "24 + 48 = 72 puis 72 sur 5 = 14,4.",
        methodText: "On additionne les produits note fois coefficient, puis on divise par 5."
      }
    ]
  },
  {
    id: "graphiques",
    title: "Lire un graphique et une droite",
    emoji: "📉",
    hero: "from-blue-600 via-indigo-500 to-sky-400",
    soft: "from-blue-50 to-indigo-50",
    short: "Un point lu correctement vaut des points",
    objective: "Lire une image, des antécédents, une ordonnée à l’origine et un coefficient directeur simple.",
    memoryRule: "Image : je pars de x puis je lis y. Antécédent : je pars de y puis je lis x.",
    method: [
      "Je repère les axes.",
      "Je lis les graduations.",
      "Je pars de la bonne valeur.",
      "Je rédige avec le bon vocabulaire."
    ],
    flashcards: [
      "f(0) est l’ordonnée du point d’abscisse 0",
      "Les antécédents de 0 sont les abscisses où la courbe coupe l’axe des x",
      "Dans y = ax + b, b est l’ordonnée à l’origine",
      "Si a est négatif, la droite descend vers la droite"
    ],
    exercises: [
      {
        id: "graph-1",
        prompt: "Pour la droite y = -2x + 5, quelle est l’ordonnée à l’origine ?",
        answer: "5",
        hint1: "Dans y = ax + b, l’ordonnée à l’origine est b.",
        hint2: "Ici b = 5.",
        methodText: "On lit directement la constante b dans l’équation réduite."
      },
      {
        id: "graph-2",
        prompt: "Pour y = -2x + 5, calcule y quand x = 0.",
        answer: "5",
        hint1: "Remplace x par 0.",
        hint2: "y = -2 fois 0 + 5 = 5.",
        methodText: "L’image de 0 se calcule en remplaçant x par 0."
      },
      {
        id: "graph-3",
        prompt: "Une fonction coupe l’axe des abscisses en x = 1 et x = 5. Quels sont les antécédents de 0 ?",
        answer: "1;5",
        accepted: ["1 et 5", "1 ; 5", "5 et 1", "5;1"],
        hint1: "Antécédents de 0 = solutions de f(x) = 0.",
        hint2: "On lit les points où la courbe coupe l’axe horizontal.",
        methodText: "Les antécédents de 0 sont les zéros de la fonction."
      },
      {
        id: "graph-4",
        prompt: "Dans y = -2x + 5, le coefficient directeur est-il positif ou négatif ? Réponds par positif ou négatif.",
        answer: "negatif",
        accepted: ["négatif"],
        hint1: "Le coefficient directeur est a dans y = ax + b.",
        hint2: "Ici a = -2.",
        methodText: "Le signe du coefficient directeur se lit devant x."
      }
    ]
  },
  {
    id: "probas",
    title: "Probabilités et tableaux croisés",
    emoji: "🎲",
    hero: "from-teal-500 via-emerald-400 to-green-300",
    soft: "from-teal-50 to-emerald-50",
    short: "Questions fréquentes et accessibles",
    objective: "Calculer une probabilité simple, une probabilité conditionnelle et lire un tableau croisé.",
    memoryRule: "Probabilité = nombre de cas favorables divisé par nombre de cas possibles. Quand on lit ‘sachant que’, le total change.",
    method: [
      "Je lis exactement ce qu’on cherche.",
      "Je repère le bon effectif.",
      "Je repère le bon total.",
      "J’écris le quotient et je simplifie si possible."
    ],
    flashcards: [
      "Une probabilité est entre 0 et 1",
      "Ni lundi ni jeudi = absent les deux jours",
      "Sachant que change le dénominateur",
      "Je peux lister les issues si la situation est simple"
    ],
    exercises: [
      {
        id: "prob-1",
        prompt: "Sur 100 adhérents, 5 ne sont venus ni le lundi ni le jeudi. Quelle est la probabilité d’en choisir un qui n’est venu aucun jour ?",
        answer: "0.05",
        accepted: ["0,05", "5 sur 100", "5/100", "5%"],
        hint1: "Cas favorables : 5. Total : 100.",
        hint2: "5 sur 100 = 0,05.",
        methodText: "On divise l’effectif recherché par l’effectif total."
      },
      {
        id: "prob-2",
        prompt: "45 élèves sont venus lundi et jeudi, et 75 sont venus le lundi. Quelle est la probabilité d’être venu le jeudi sachant qu’on est venu le lundi ?",
        answer: "0.6",
        accepted: ["0,6", "45 sur 75", "45/75", "60%"],
        hint1: "Le mot important est ‘sachant que’. Le total devient 75.",
        hint2: "45 sur 75 = 0,6.",
        methodText: "En probabilité conditionnelle, on se limite au groupe indiqué après ‘sachant que’."
      },
      {
        id: "prob-3",
        prompt: "On lance deux pièces équilibrées. Probabilité d’obtenir deux fois le même côté ?",
        answer: "0.5",
        accepted: ["0,5", "1 sur 2", "1/2", "50%"],
        hint1: "Issues possibles : PP, PF, FP, FF.",
        hint2: "Favorables : PP et FF, soit 2 sur 4.",
        methodText: "On peut lister les issues équiprobables."
      },
      {
        id: "prob-4",
        prompt: "Dans un tableau, 45 + x = 75 pour la ligne du lundi. Quelle est la valeur de x ?",
        answer: "30",
        hint1: "x = 75 - 45.",
        hint2: "x = 30.",
        methodText: "On complète une ligne ou une colonne par différence avec le total."
      }
    ]
  },
  {
    id: "suites",
    title: "Suites : reconnaître le modèle",
    emoji: "🪜",
    hero: "from-orange-500 via-rose-400 to-pink-300",
    soft: "from-orange-50 to-rose-50",
    short: "Très rentable dans les sujets type bac",
    objective: "Distinguer une évolution additive constante d’une évolution multiplicative constante.",
    memoryRule: "On ajoute toujours la même quantité : suite arithmétique. On multiplie toujours par le même nombre : suite géométrique.",
    method: [
      "Je lis le contexte.",
      "Je cherche si on ajoute ou si on multiplie.",
      "Je calcule le terme demandé.",
      "Je formule la nature de la suite."
    ],
    flashcards: [
      "+5 par an donne une arithmétique de raison 5",
      "-10 pour cent par an donne une géométrique de raison 0,9",
      "u suivant = u + r : modèle arithmétique",
      "u suivant = q fois u : modèle géométrique"
    ],
    exercises: [
      {
        id: "suite-1",
        prompt: "Le nombre d’adhérents augmente de 5 chaque année. La suite est-elle arithmétique ou géométrique ?",
        answer: "arithmetique",
        accepted: ["arithmétique"],
        hint1: "On ajoute toujours la même valeur.",
        hint2: "Ici on ajoute 5.",
        methodText: "Une augmentation absolue constante correspond à une suite arithmétique."
      },
      {
        id: "suite-2",
        prompt: "Une population baisse de 10 pour cent chaque année. Quel est le coefficient multiplicateur annuel ?",
        answer: "0.9",
        accepted: ["0,9"],
        hint1: "Baisser de 10 pour cent signifie garder 90 pour cent.",
        hint2: "90 pour cent = 0,9.",
        methodText: "Une baisse de 10 pour cent correspond au coefficient 1 - 0,10 = 0,90."
      },
      {
        id: "suite-3",
        prompt: "Si u0 = 100 et que la suite augmente de 5 par an, combien vaut u1 ?",
        answer: "105",
        hint1: "On ajoute 5.",
        hint2: "100 + 5 = 105.",
        methodText: "Dans une suite arithmétique, on ajoute la raison."
      },
      {
        id: "suite-4",
        prompt: "Suite arithmétique de raison 0,5 avec u50 = 1000. Que vaut u60 ?",
        answer: "1005",
        hint1: "Il y a 10 pas entre 50 et 60.",
        hint2: "10 fois 0,5 donne 5.",
        methodText: "On ajoute 10 fois la raison : 1000 + 5 = 1005."
      }
    ]
  },
  {
    id: "strategie",
    title: "Stratégie d’épreuve",
    emoji: "🏁",
    hero: "from-slate-700 via-slate-600 to-slate-500",
    soft: "from-slate-50 to-zinc-50",
    short: "Ne pas se perdre le jour J",
    objective: "Apprendre à chercher d’abord les points utiles et à rédiger même quand on doute.",
    memoryRule: "Je commence par ce qui rapporte vite. Je lis les mots-clés. J’écris une démarche simple plutôt que de laisser vide.",
    method: [
      "Je commence par le QCM.",
      "Je fais ensuite les questions les plus courtes.",
      "Je souligne les mots-clés.",
      "Je garde quelques minutes pour relire."
    ],
    flashcards: [
      "Le QCM peut sécuriser des points très vite",
      "Image, antécédent, sachant que, augmente, diminue : mots-clés à repérer",
      "Une démarche simple vaut mieux qu’une page blanche",
      "Je relis toujours les signes et les unités"
    ],
    exercises: [
      {
        id: "strat-1",
        prompt: "Que faut-il faire en premier pendant l’épreuve ? Réponds par QCM ou exercice long.",
        answer: "qcm",
        accepted: ["QCM"],
        hint1: "Il faut commencer par ce qui peut rapporter vite.",
        hint2: "Le QCM d’automatismes est prioritaire.",
        methodText: "Le QCM permet souvent de sécuriser des points dès le début."
      },
      {
        id: "strat-2",
        prompt: "Faut-il laisser une question vide si l’on peut au moins écrire une méthode ? Réponds par oui ou non.",
        answer: "non",
        accepted: ["Non"],
        hint1: "Une démarche peut rapporter des points.",
        hint2: "Mieux vaut écrire quelque chose de pertinent que rien.",
        methodText: "Une copie totalement vide n’apporte aucun point."
      },
      {
        id: "strat-3",
        prompt: "Doit-on garder quelques minutes pour relire ? Réponds par oui ou non.",
        answer: "oui",
        accepted: ["Oui"],
        hint1: "Une relecture évite les erreurs simples.",
        hint2: "Même 5 à 10 minutes peuvent sauver des points.",
        methodText: "La relecture finale permet de corriger les oublis et les signes."
      },
      {
        id: "strat-4",
        prompt: "Quand tu lis ‘sachant que’, le total change-t-il ? Réponds par oui ou non.",
        answer: "oui",
        accepted: ["Oui"],
        hint1: "Cette expression apparaît souvent en probabilité conditionnelle.",
        hint2: "On se limite alors à un sous-groupe.",
        methodText: "Le dénominateur devient le total du groupe indiqué par ‘sachant que’."
      }
    ]
  }
];

const DEFAULT_STATE = {
  profile: {
    started: false,
    name: "",
    className: "Première STMG",
    target: "Prendre confiance et gagner des points utiles",
    dailyGoal: 12
  },
  currentView: "home",
  currentModule: "calculs",
  answers: {},
  feedback: {},
  hintsOpen: {},
  hintsUsed: {},
  attempts: {},
  mastered: [],
  needsReview: [],
  mistakenEver: [],
  completedModules: [],
  notes: {},
  journal: "",
  xp: 0,
  streak: 0,
  lastPracticeDate: null,
  sessions: 0,
  totalChecks: 0,
  exportsCount: 0,
  perfectExercises: [],
  focusMode: false
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function updateStreak(previousDate, currentStreak) {
  const today = todayString();
  if (!previousDate) return 1;
  if (previousDate === today) return currentStreak;
  const prev = new Date(previousDate + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  const diff = Math.round((now - prev) / 86400000);
  if (diff === 1) return currentStreak + 1;
  return 1;
}

function removeAccents(text) {
  return String(text || "")
    .normalize("NFD")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code < 768 || code > 879;
    })
    .join("");
}

function normalize(value) {
  const base = removeAccents(String(value == null ? "" : value).trim().toLowerCase().split(",").join("."));
  return base
    .split(" ")
    .filter((part) => part !== "")
    .join(" ");
}

function levelInfo(xp) {
  if (xp >= 1200) return { level: 6, label: "Prête à tenir l’épreuve" };
  if (xp >= 900) return { level: 5, label: "Solide progression" };
  if (xp >= 650) return { level: 4, label: "Tu consolides" };
  if (xp >= 400) return { level: 3, label: "Tu avances bien" };
  if (xp >= 180) return { level: 2, label: "Les bases reviennent" };
  return { level: 1, label: "On reconstruit pas à pas" };
}

function progressPercent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function csvCell(value) {
  return "\"" + String(value == null ? "" : value).split("\"").join("\"\"") + "\"";
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeName(value) {
  const source = removeAccents(String(value || "eleve").toLowerCase());
  const allowed = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  let lastDash = false;
  for (const char of source) {
    const next = allowed.includes(char) ? char : "-";
    if (next === "-") {
      if (!lastDash) {
        out += next;
        lastDash = true;
      }
    } else {
      out += next;
      lastDash = false;
    }
  }
  while (out.startsWith("-")) out = out.slice(1);
  while (out.endsWith("-")) out = out.slice(0, -1);
  return out || "eleve";
}

function buildPreviewText(state, earnedBadges, currentLevel, globalProgress, masteredCount, totalExercises, reviewCount) {
  const lines = [
    "Nom : " + (state.profile.name || "Non renseigné"),
    "Classe : " + state.profile.className,
    "Objectif : " + state.profile.target,
    "Niveau : " + currentLevel.level + " - " + currentLevel.label,
    "XP : " + state.xp,
    "Progression globale : " + globalProgress + "% (" + masteredCount + "/" + totalExercises + ")",
    "Série de jours : " + state.streak,
    "Séances focus : " + state.sessions,
    "Exercices à revoir : " + reviewCount,
    "Badges : " + (earnedBadges.map((badge) => badge.emoji + " " + badge.label).join(" | ") || "Aucun pour le moment"),
    "",
    "Notes de l’élève :"
  ];
  for (const module of MODULES) {
    lines.push("- " + module.title + " : " + (state.notes[module.id] || "(aucune note)"));
  }
  lines.push("");
  lines.push("Journal :");
  lines.push(state.journal || "(aucun journal pour le moment)");
  return lines.join(LINE_BREAK);
}

function App() {
  const [state, setState] = useState(DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setState({
        ...DEFAULT_STATE,
        ...parsed,
        profile: {
          ...DEFAULT_STATE.profile,
          ...(parsed.profile || {})
        }
      });
    } catch {
      setState(DEFAULT_STATE);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const totalExercises = useMemo(() => MODULES.reduce((sum, module) => sum + module.exercises.length, 0), []);

  const moduleSummaries = useMemo(() => {
    return MODULES.map((module, index) => {
      const masteredCount = module.exercises.filter((exercise) => state.mastered.includes(exercise.id)).length;
      const previousModule = MODULES[index - 1];
      const locked = index > 0 && !state.completedModules.includes(previousModule.id);
      return {
        ...module,
        masteredCount,
        progress: progressPercent(masteredCount, module.exercises.length),
        locked
      };
    });
  }, [state.completedModules, state.mastered]);

  const currentModule = moduleSummaries.find((module) => module.id === state.currentModule) || moduleSummaries[0];

  const reviewExercises = useMemo(() => {
    const reviewSet = new Set(state.needsReview);
    const list = [];
    for (const module of MODULES) {
      for (const exercise of module.exercises) {
        if (reviewSet.has(exercise.id)) {
          list.push({
            ...exercise,
            moduleId: module.id,
            moduleTitle: module.title,
            moduleEmoji: module.emoji
          });
        }
      }
    }
    return list;
  }, [state.needsReview]);

  const masteredCount = state.mastered.length;
  const globalProgress = progressPercent(masteredCount, totalExercises);
  const currentLevel = levelInfo(state.xp);
  const resolvedReviewsCount = state.mistakenEver.filter((id) => state.mastered.includes(id)).length;
  const notesCount = Object.values(state.notes).filter((value) => String(value || "").trim().length > 0).length;
  const firstAvailableModule = moduleSummaries.find((module) => !module.locked && !state.completedModules.includes(module.id)) || moduleSummaries[0];

  const recommendation = useMemo(() => {
    if (reviewExercises.length > 0) return "À retravailler en priorité : " + reviewExercises[0].moduleTitle + ".";
    if (firstAvailableModule) return "Prochaine étape conseillée : " + firstAvailableModule.title + ".";
    return "Tu peux maintenant refaire les exercices les plus fragiles pour consolider durablement.";
  }, [reviewExercises, firstAvailableModule]);

  const badges = useMemo(() => {
    const allDone = state.completedModules.length === MODULES.length;
    return [
      { id: "starter", emoji: "🌱", label: "Premier pas", description: "Atteindre 20 XP", earned: state.xp >= 20 },
      { id: "regular", emoji: "🔥", label: "Régularité", description: "3 jours d’affilée", earned: state.streak >= 3 },
      { id: "writer", emoji: "📝", label: "Carnet vivant", description: "Écrire au moins 3 notes ou un vrai journal", earned: notesCount >= 3 || String(state.journal).trim().length >= 120 },
      { id: "survivor", emoji: "🛡️", label: "Sauve les meubles", description: "Valider 3 modules", earned: state.completedModules.length >= 3 },
      { id: "focus", emoji: "🎧", label: "Mode élève", description: "Lancer 3 séances focus", earned: state.sessions >= 3 },
      { id: "rebound", emoji: "🔁", label: "Rebond", description: "Corriger au moins 5 erreurs anciennes", earned: resolvedReviewsCount >= 5 },
      { id: "perfect", emoji: "💎", label: "Réponse nette", description: "8 exercices réussis du premier coup sans aide", earned: state.perfectExercises.length >= 8 },
      { id: "coach-ready", emoji: "📦", label: "Export prêt", description: "Exporter les résultats au moins une fois", earned: state.exportsCount >= 1 },
      { id: "final", emoji: "🏆", label: "Cap terminal", description: "Terminer tous les modules", earned: allDone }
    ];
  }, [notesCount, resolvedReviewsCount, state.completedModules.length, state.exportsCount, state.journal, state.perfectExercises.length, state.sessions, state.streak, state.xp]);

  const earnedBadges = badges.filter((badge) => badge.earned);

  const dailyChallenge = useMemo(() => {
    const flat = [];
    for (const module of MODULES) {
      for (const exercise of module.exercises) {
        flat.push({ ...exercise, moduleTitle: module.title, moduleId: module.id });
      }
    }
    const index = new Date().getDate() % flat.length;
    return flat[index];
  }, []);

  function updateProfile(field, value) {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, [field]: value }
    }));
  }

  function startStudentMode() {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, started: true },
      currentView: "home"
    }));
  }

  function beginFocusSession() {
    setState((prev) => ({
      ...prev,
      focusMode: true,
      sessions: prev.sessions + 1,
      currentView: "module",
      currentModule: firstAvailableModule.id,
      streak: updateStreak(prev.lastPracticeDate, prev.streak),
      lastPracticeDate: todayString(),
      xp: prev.xp + 8
    }));
  }

  function stopFocusSession() {
    setState((prev) => ({ ...prev, focusMode: false }));
  }

  function goToModule(moduleId) {
    setState((prev) => ({ ...prev, currentModule: moduleId, currentView: "module" }));
  }

  function openReview() {
    setState((prev) => ({ ...prev, currentView: "review" }));
  }

  function openExports() {
    setState((prev) => ({ ...prev, currentView: "exports" }));
  }

  function setHome() {
    setState((prev) => ({ ...prev, currentView: "home" }));
  }

  function onAnswerChange(exerciseId, value) {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [exerciseId]: value }
    }));
  }

  function openHint(exerciseId, level) {
    setState((prev) => ({
      ...prev,
      hintsOpen: { ...prev.hintsOpen, [exerciseId]: Math.max(prev.hintsOpen[exerciseId] || 0, level) },
      hintsUsed: { ...prev.hintsUsed, [exerciseId]: Math.max(prev.hintsUsed[exerciseId] || 0, level) },
      xp: prev.xp + 1,
      streak: updateStreak(prev.lastPracticeDate, prev.streak),
      lastPracticeDate: todayString()
    }));
  }

  function checkExercise(moduleId, exercise) {
    const userAnswer = normalize(state.answers[exercise.id]);
    const acceptedAnswers = [normalize(exercise.answer), ...((exercise.accepted || []).map((value) => normalize(value)))];
    const isCorrect = acceptedAnswers.includes(userAnswer);

    setState((prev) => {
      const attemptsBefore = prev.attempts[exercise.id] || 0;
      const attempts = { ...prev.attempts, [exercise.id]: attemptsBefore + 1 };
      const feedback = { ...prev.feedback, [exercise.id]: isCorrect ? "correct" : "incorrect" };
      const hintsCount = prev.hintsUsed[exercise.id] || 0;

      let mastered = prev.mastered;
      let needsReview = prev.needsReview;
      let mistakenEver = prev.mistakenEver;
      let perfectExercises = prev.perfectExercises;
      let xp = prev.xp;

      if (isCorrect) {
        if (!mastered.includes(exercise.id)) mastered = [...mastered, exercise.id];
        needsReview = needsReview.filter((id) => id !== exercise.id);
        xp += attemptsBefore === 0 ? 18 : 10;
        if (attemptsBefore === 0 && hintsCount === 0 && !perfectExercises.includes(exercise.id)) {
          perfectExercises = [...perfectExercises, exercise.id];
          xp += 4;
        }
      } else {
        if (!needsReview.includes(exercise.id)) needsReview = [...needsReview, exercise.id];
        if (!mistakenEver.includes(exercise.id)) mistakenEver = [...mistakenEver, exercise.id];
        xp += 2;
      }

      const module = MODULES.find((item) => item.id === moduleId);
      const moduleDone = module.exercises.every((item) => mastered.includes(item.id));
      const completedModules = moduleDone && !prev.completedModules.includes(moduleId)
        ? [...prev.completedModules, moduleId]
        : prev.completedModules;

      return {
        ...prev,
        attempts,
        feedback,
        mastered,
        needsReview,
        mistakenEver,
        perfectExercises,
        completedModules,
        xp,
        totalChecks: prev.totalChecks + 1,
        streak: updateStreak(prev.lastPracticeDate, prev.streak),
        lastPracticeDate: todayString()
      };
    });
  }

  function saveNote(moduleId, value) {
    setState((prev) => ({
      ...prev,
      notes: { ...prev.notes, [moduleId]: value }
    }));
  }

  function buildExportPayload() {
    return {
      exportedAt: new Date().toISOString(),
      profile: state.profile,
      stats: {
        xp: state.xp,
        level: currentLevel.level,
        levelLabel: currentLevel.label,
        globalProgress,
        masteredCount,
        totalExercises,
        streak: state.streak,
        sessions: state.sessions,
        reviewCount: state.needsReview.length
      },
      badges: earnedBadges.map((badge) => badge.emoji + " " + badge.label),
      modules: MODULES.map((module) => ({
        id: module.id,
        title: module.title,
        note: state.notes[module.id] || "",
        progress: progressPercent(module.exercises.filter((exercise) => state.mastered.includes(exercise.id)).length, module.exercises.length),
        exercises: module.exercises.map((exercise) => ({
          id: exercise.id,
          status: state.mastered.includes(exercise.id)
            ? "maîtrisé"
            : state.needsReview.includes(exercise.id)
            ? "à revoir"
            : "non traité",
          answer: state.answers[exercise.id] || "",
          attempts: state.attempts[exercise.id] || 0,
          hintLevel: state.hintsUsed[exercise.id] || 0
        }))
      })),
      journal: state.journal
    };
  }

  function exportJson() {
    const payload = buildExportPayload();
    downloadFile("resultats-stmg-" + safeName(state.profile.name || "eleve") + ".json", JSON.stringify(payload, null, 2), "application/json");
    setState((prev) => ({ ...prev, exportsCount: prev.exportsCount + 1, xp: prev.xp + 10 }));
  }

  function exportCsv() {
    const payload = buildExportPayload();
    const lines = [
      ["nom", payload.profile.name],
      ["classe", payload.profile.className],
      ["objectif", payload.profile.target],
      ["xp", payload.stats.xp],
      ["niveau", payload.stats.level],
      ["progression", payload.stats.globalProgress],
      ["exercices_maitrises", payload.stats.masteredCount],
      ["exercices_total", payload.stats.totalExercises],
      ["streak", payload.stats.streak],
      ["sessions", payload.stats.sessions],
      ["revisions_en_attente", payload.stats.reviewCount],
      ["badges", payload.badges.join(" | ")],
      [],
      ["module", "exercice", "statut", "reponse", "tentatives", "indice_utilise"]
    ];

    payload.modules.forEach((module) => {
      module.exercises.forEach((exercise) => {
        lines.push([
          module.title,
          exercise.id,
          exercise.status,
          String(exercise.answer).split(";").join(", "),
          exercise.attempts,
          exercise.hintLevel
        ]);
      });
    });

    const csv = lines.map((row) => row.map((cell) => csvCell(cell)).join(";")).join(LINE_BREAK);
    downloadFile("resultats-stmg-" + safeName(state.profile.name || "eleve") + ".csv", csv, "text/csv;charset=utf-8");
    setState((prev) => ({ ...prev, exportsCount: prev.exportsCount + 1, xp: prev.xp + 10 }));
  }

  function resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_STATE);
  }

  if (!state.profile.started) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 shadow-2xl">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-6 md:p-10 lg:p-12">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90">
                  <span>✨</span>
                  <span>Parcours interactif mémorisé · Première STMG</span>
                </div>
                <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-5xl">
                  Une version complète, gamifiée et vraiment utile pour accompagner l’élève.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 md:text-lg">
                  Cette interface ne remplace pas le livret : elle le transforme en parcours actif. L’élève avance étape par étape, garde la trace de ses progrès, retravaille ses erreurs et peut exporter un bilan clair pour l’enseignant.
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["🧭", "Vrai mode élève", "Accueil personnalisé, séance focus et progression mémorisée."],
                    ["🎮", "Gamification utile", "XP, niveaux, badges et objectifs journaliers."],
                    ["🧠", "Révision intelligente", "Les erreurs sont stockées puis retravaillées ciblée par ciblée."],
                    ["📦", "Export enseignant", "Téléchargement JSON ou CSV pour suivre l’élève."]
                  ].map(([emoji, title, text]) => (
                    <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="text-2xl">{emoji}</div>
                      <p className="mt-3 text-base font-semibold">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/10 bg-white/5 p-6 md:p-10 lg:border-l lg:border-t-0">
                <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 backdrop-blur">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">Mode élève</p>
                  <h2 className="mt-3 text-2xl font-bold">Configurer le parcours</h2>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Quelques informations suffisent pour personnaliser l’expérience et mémoriser les progrès.
                  </p>
                  <div className="mt-6 space-y-4">
                    <Field label="Prénom de l’élève">
                      <input
                        value={state.profile.name}
                        onChange={(e) => updateProfile("name", e.target.value)}
                        placeholder="Ex. Inès"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/35"
                      />
                    </Field>
                    <Field label="Classe">
                      <input
                        value={state.profile.className}
                        onChange={(e) => updateProfile("className", e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/35"
                      />
                    </Field>
                    <Field label="Objectif de travail">
                      <input
                        value={state.profile.target}
                        onChange={(e) => updateProfile("target", e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/35"
                      />
                    </Field>
                    <Field label="Objectif quotidien en XP">
                      <input
                        type="number"
                        min="5"
                        max="50"
                        value={state.profile.dailyGoal}
                        onChange={(e) => updateProfile("dailyGoal", Number(e.target.value || 12))}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                      />
                    </Field>
                  </div>
                  <button
                    onClick={startStudentMode}
                    className="mt-6 w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 px-5 py-4 text-base font-semibold text-white shadow-lg transition hover:scale-[1.01]"
                  >
                    Entrer dans le parcours élève
                  </button>
                  <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
                    <strong>Ce mode est pensé pour un profil fragile :</strong> moins de dispersion, plus de guidage, plus de mémoire des progrès, et des exercices immédiatement exploitables.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
        <TopBar
          state={state}
          currentLevel={currentLevel}
          globalProgress={globalProgress}
          masteredCount={masteredCount}
          totalExercises={totalExercises}
          earnedBadges={earnedBadges}
          onHome={setHome}
          onReview={openReview}
          onExports={openExports}
          onStartFocus={beginFocusSession}
          onStopFocus={stopFocusSession}
        />
        <div className={"mt-6 grid gap-6 " + (state.focusMode ? "grid-cols-1" : "lg:grid-cols-[320px_1fr]") }>
          {!state.focusMode && (
            <Sidebar
              state={state}
              modules={moduleSummaries}
              currentModule={currentModule}
              onHome={setHome}
              onReview={openReview}
              onExports={openExports}
              onOpenModule={goToModule}
              onReset={resetAll}
            />
          )}
          <div className="min-w-0">
            {state.currentView === "home" && (
              <HomeScreen
                state={state}
                currentLevel={currentLevel}
                globalProgress={globalProgress}
                reviewExercises={reviewExercises}
                badges={badges}
                earnedBadges={earnedBadges}
                recommendation={recommendation}
                dailyChallenge={dailyChallenge}
                modules={moduleSummaries}
                onOpenModule={goToModule}
                onOpenReview={openReview}
                onJournalChange={(value) => setState((prev) => ({ ...prev, journal: value }))}
              />
            )}
            {state.currentView === "module" && (
              <ModuleScreen
                module={currentModule}
                state={state}
                focusMode={state.focusMode}
                onAnswerChange={onAnswerChange}
                onOpenHint={openHint}
                onCheck={checkExercise}
                onSaveNote={saveNote}
                onGoReview={openReview}
              />
            )}
            {state.currentView === "review" && (
              <ReviewScreen
                reviewExercises={reviewExercises}
                state={state}
                onAnswerChange={onAnswerChange}
                onOpenHint={openHint}
                onCheck={checkExercise}
              />
            )}
            {state.currentView === "exports" && (
              <ExportScreen
                state={state}
                earnedBadges={earnedBadges}
                currentLevel={currentLevel}
                globalProgress={globalProgress}
                masteredCount={masteredCount}
                totalExercises={totalExercises}
                reviewExercises={reviewExercises}
                onExportJson={exportJson}
                onExportCsv={exportCsv}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar({ state, currentLevel, globalProgress, masteredCount, totalExercises, earnedBadges, onHome, onReview, onExports, onStartFocus, onStopFocus }) {
  const goal = Math.max(1, state.profile.dailyGoal);
  const goalProgress = Math.min(100, Math.round(((state.xp % goal) / goal) * 100));
  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl">
      <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-800 p-6 text-white md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                <span>Mode élève actif</span>
              </div>
              <h1 className="mt-3 text-3xl font-black md:text-4xl">Bonjour {state.profile.name || "élève"}, on avance pas à pas.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80 md:text-base">
                Objectif : {state.profile.target}. Ici, on cherche d’abord les points utiles, on mémorise les règles essentielles et on transforme les erreurs en révision ciblée.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
              <div className="text-sm text-white/70">Niveau</div>
              <div className="text-3xl font-black">{currentLevel.level}</div>
              <div className="text-xs text-white/70">{currentLevel.label}</div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <StatCard title="XP" value={state.xp} subtitle="points gagnés" dark />
            <StatCard title="Maîtrisés" value={masteredCount + "/" + totalExercises} subtitle="exercices validés" dark />
            <StatCard title="Série" value={state.streak} subtitle="jour(s) d’affilée" dark />
            <StatCard title="Badges" value={earnedBadges.length} subtitle="débloqués" dark />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-white/80">
                <span>Progression globale</span>
                <span>{globalProgress}%</span>
              </div>
              <ProgressBar value={globalProgress} dark />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-white/80">
                <span>Objectif du jour</span>
                <span>{state.profile.dailyGoal} XP</span>
              </div>
              <ProgressBar value={goalProgress} dark />
            </div>
          </div>
        </div>
        <div className="p-6 md:p-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton label="Accueil" sublabel="Tableau de bord élève" onClick={onHome} emoji="🏠" />
            <ActionButton label="Révision" sublabel={state.needsReview.length + " exercice(s) à revoir"} onClick={onReview} emoji="🔁" />
            <ActionButton label="Exports" sublabel="Bilan enseignant" onClick={onExports} emoji="📦" />
            {state.focusMode ? (
              <ActionButton label="Quitter focus" sublabel="Retour au mode complet" onClick={onStopFocus} emoji="🧘" accent />
            ) : (
              <ActionButton label="Séance focus" sublabel="Version concentrée élève" onClick={onStartFocus} emoji="🎧" accent />
            )}
          </div>
          <div className="mt-5 rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Pourquoi cette version est meilleure pour l’élève ?</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
              <li>• parcours mémorisé automatiquement ;</li>
              <li>• révision intelligente des erreurs ;</li>
              <li>• mode focus pour limiter la dispersion ;</li>
              <li>• exports lisibles pour l’enseignant.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ state, modules, currentModule, onHome, onReview, onExports, onOpenModule, onReset }) {
  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Navigation</p>
            <h2 className="mt-1 text-xl font-bold">Parcours</h2>
          </div>
          <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{state.profile.className}</div>
        </div>
        <div className="mt-4 space-y-2">
          <NavButton label="Accueil" emoji="🏠" active={state.currentView === "home"} onClick={onHome} />
          <NavButton label={"Révision ciblée (" + state.needsReview.length + ")"} emoji="🔁" active={state.currentView === "review"} onClick={onReview} />
          <NavButton label="Exports enseignant" emoji="📦" active={state.currentView === "exports"} onClick={onExports} />
        </div>
      </Panel>
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Modules</p>
        <div className="mt-4 space-y-3">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => !module.locked && onOpenModule(module.id)}
              className={"w-full rounded-3xl border p-4 text-left transition " + (
                module.locked
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : currentModule.id === module.id && state.currentView === "module"
                  ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                  : "border-slate-200 bg-white hover:shadow-sm"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={"mt-0.5 text-2xl " + (module.locked ? "opacity-50" : "")}>{module.locked ? "🔒" : module.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-5">{module.title}</p>
                    <span className={"rounded-full px-2 py-1 text-xs font-semibold " + (currentModule.id === module.id && state.currentView === "module" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700")}>
                      {module.masteredCount}/{module.exercises.length}
                    </span>
                  </div>
                  <p className={"mt-1 text-xs leading-5 " + (currentModule.id === module.id && state.currentView === "module" ? "text-slate-200" : "text-slate-500")}>{module.short}</p>
                  <div className="mt-3">
                    <ProgressBar value={module.progress} dark={currentModule.id === module.id && state.currentView === "module"} />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <p className="text-sm font-semibold text-slate-800">Conseil d’utilisation</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">Quand une question bloque, ouvre d’abord l’indice 1, puis l’indice 2. Garde la méthode complète pour la fin.</p>
        <button onClick={onReset} className="mt-4 w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100">
          Réinitialiser tout le parcours
        </button>
      </Panel>
    </div>
  );
}

function HomeScreen({ state, currentLevel, globalProgress, reviewExercises, badges, earnedBadges, recommendation, dailyChallenge, modules, onOpenModule, onOpenReview, onJournalChange }) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-lg">
        <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-6 text-white md:p-8">
            <div className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">Mode élève personnalisé</div>
            <h2 className="mt-4 text-3xl font-black md:text-4xl">Tableau de bord de {state.profile.name || "l’élève"}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/85 md:text-base">
              Tu n’as pas besoin de tout savoir. Tu as besoin d’un chemin clair, de répétition, d’aides intelligentes et d’une progression visible. C’est exactement ce que cette version te donne.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <PremiumStat title="Niveau" value={currentLevel.level} subtitle={currentLevel.label} />
              <PremiumStat title="Progression" value={globalProgress + "%"} subtitle="du parcours total" />
              <PremiumStat title="Révisions" value={reviewExercises.length} subtitle="à reprendre" />
            </div>
          </div>
          <div className="p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mission du jour</p>
            <div className="mt-3 rounded-3xl bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-500">Défi conseillé</div>
              <div className="mt-2 text-base font-semibold leading-7 text-slate-900">{dailyChallenge.prompt}</div>
              <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                <strong>Orientation :</strong> {recommendation}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => onOpenModule(dailyChallenge.moduleId)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Aller au bon module</button>
                <button onClick={onOpenReview} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Revoir mes erreurs</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Badges</p>
          <h3 className="mt-1 text-2xl font-bold">Récompenses et motivation</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {badges.map((badge) => (
              <div key={badge.id} className={"rounded-3xl border p-4 " + (badge.earned ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 opacity-70") }>
                <div className="text-2xl">{badge.emoji}</div>
                <p className="mt-2 font-semibold">{badge.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{badge.description}</p>
                <div className={"mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold " + (badge.earned ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700") }>
                  {badge.earned ? "Débloqué" : "À gagner"}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>Badges gagnés :</strong> {earnedBadges.length} / {badges.length}
          </div>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Carnet de bord</p>
          <h3 className="mt-1 text-2xl font-bold">Ce que je retiens</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Écris les règles que tu veux retenir. Une phrase simple suffit souvent à mieux mémoriser.</p>
          <textarea
            value={state.journal}
            onChange={(e) => onJournalChange(e.target.value)}
            placeholder="Exemple : Baisser de 10 pour cent signifie multiplier par 0,9. Quand je lis sachant que, le total change."
            className="mt-4 min-h-[240px] w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none transition focus:border-slate-400"
          />
        </Panel>
      </div>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Feuille de route</p>
            <h3 className="mt-1 text-2xl font-bold">Modules du parcours</h3>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {modules.filter((module) => module.progress === 100).length} module(s) terminés
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module, index) => (
            <button key={module.id} onClick={() => !module.locked && onOpenModule(module.id)} className={"rounded-3xl border p-5 text-left transition " + (module.locked ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md") }>
              <div className={"rounded-3xl bg-gradient-to-r " + module.soft + " p-4"}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-3xl">{module.locked ? "🔒" : module.emoji}</div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Étape {index + 1}</div>
                </div>
                <p className="mt-4 text-lg font-bold text-slate-900">{module.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{module.objective}</p>
                <div className="mt-4">
                  <ProgressBar value={module.progress} />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">{module.masteredCount}/{module.exercises.length} validés</p>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ModuleScreen({ module, state, focusMode, onAnswerChange, onOpenHint, onCheck, onSaveNote, onGoReview }) {
  const masteredCount = module.exercises.filter((exercise) => state.mastered.includes(exercise.id)).length;
  const moduleProgress = progressPercent(masteredCount, module.exercises.length);
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-lg">
        <div className={"bg-gradient-to-r " + module.hero + " p-6 text-white md:p-8"}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">{focusMode ? "Mode focus élève" : "Module actif"}</div>
              <h2 className="mt-4 text-3xl font-black md:text-4xl">{module.emoji} {module.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/85 md:text-base">{module.objective}</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 text-center backdrop-blur">
              <div className="text-xs uppercase tracking-[0.18em] text-white/70">Progression</div>
              <div className="mt-1 text-3xl font-black">{moduleProgress}%</div>
              <div className="text-sm text-white/70">{masteredCount}/{module.exercises.length} validés</div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
              <p className="text-sm font-semibold">Règle-clé à retenir</p>
              <p className="mt-2 text-base leading-7">{module.memoryRule}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {module.method.map((step, index) => (
                <div key={step} className="rounded-3xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Étape {index + 1}</div>
                  <p className="mt-2 text-sm leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={"grid gap-6 " + (focusMode ? "grid-cols-1" : "xl:grid-cols-[0.95fr_1.05fr]") }>
        {!focusMode && (
          <Panel>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cartes mémoire</p>
            <h3 className="mt-1 text-2xl font-bold">Je retiens</h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {module.flashcards.map((card) => (
                <div key={card} className={"rounded-3xl bg-gradient-to-r " + module.soft + " p-4 text-sm leading-6 text-slate-700"}>{card}</div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Mes notes sur ce module</p>
              <textarea
                value={state.notes[module.id] || ""}
                onChange={(e) => onSaveNote(module.id, e.target.value)}
                placeholder="Écris ici la règle que tu veux retenir avec tes propres mots."
                className="mt-3 min-h-[180px] w-full rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-6 outline-none transition focus:border-slate-400"
              />
            </div>
          </Panel>
        )}
        <div className="space-y-4">
          {module.exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              moduleId={module.id}
              moduleSoft={module.soft}
              exercise={exercise}
              index={index}
              answer={state.answers[exercise.id] || ""}
              feedback={state.feedback[exercise.id] || ""}
              hintOpen={state.hintsOpen[exercise.id] || 0}
              hintsUsed={state.hintsUsed[exercise.id] || 0}
              attempts={state.attempts[exercise.id] || 0}
              mastered={state.mastered.includes(exercise.id)}
              onAnswerChange={onAnswerChange}
              onOpenHint={onOpenHint}
              onCheck={onCheck}
            />
          ))}
          {state.needsReview.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-base font-semibold text-amber-950">Des erreurs ont été repérées.</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">Elles ont été placées dans la révision ciblée pour être retravaillées plus tard, sans te noyer dans tout le reste.</p>
              <button onClick={onGoReview} className="mt-4 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white">Ouvrir la révision ciblée</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ moduleId, moduleSoft, exercise, index, answer, feedback, hintOpen, hintsUsed, attempts, mastered, onAnswerChange, onOpenHint, onCheck }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Exercice {index + 1}</span>
          {mastered && <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Validé</span>}
          {feedback === "incorrect" && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">À revoir</span>}
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{attempts} tentative{attempts > 1 ? "s" : ""} · indice max {hintsUsed}</div>
      </div>
      <div className={"mt-4 rounded-3xl bg-gradient-to-r " + moduleSoft + " p-4"}>
        <p className="text-base font-semibold leading-7 text-slate-900">{exercise.prompt}</p>
      </div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          value={answer}
          onChange={(e) => onAnswerChange(exercise.id, e.target.value)}
          placeholder="Écris ta réponse"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
        />
        <button onClick={() => onCheck(moduleId, exercise)} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Vérifier</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <HintButton label="Indice 1" onClick={() => onOpenHint(exercise.id, 1)} />
        <HintButton label="Indice 2" onClick={() => onOpenHint(exercise.id, 2)} />
        <HintButton label="Méthode" onClick={() => onOpenHint(exercise.id, 3)} />
      </div>
      <div className="mt-4 space-y-3">
        {hintOpen >= 1 && <HintPanel tone="amber" title="Indice 1">{exercise.hint1}</HintPanel>}
        {hintOpen >= 2 && <HintPanel tone="orange" title="Indice 2">{exercise.hint2}</HintPanel>}
        {hintOpen >= 3 && <HintPanel tone="blue" title="Méthode modèle">{exercise.methodText}</HintPanel>}
      </div>
    </div>
  );
}

function ReviewScreen({ reviewExercises, state, onAnswerChange, onOpenHint, onCheck }) {
  return (
    <div className="space-y-6">
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Révision intelligente</p>
        <h2 className="mt-1 text-3xl font-black">Reprendre seulement ce qui bloque</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">Cette zone évite de tout recommencer et cible uniquement les exercices déjà repérés comme difficiles.</p>
      </Panel>
      {reviewExercises.length === 0 ? (
        <Panel>
          <div className="rounded-3xl bg-emerald-50 p-6 text-emerald-950">
            <p className="text-lg font-semibold">Aucune erreur en attente.</p>
            <p className="mt-2 text-sm leading-6">Tu peux poursuivre le parcours principal ou refaire volontairement des exercices déjà maîtrisés pour renforcer les automatismes.</p>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          {reviewExercises.map((exercise, index) => (
            <div key={exercise.id} className="rounded-[28px] border border-amber-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Erreur ciblée {index + 1}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{exercise.moduleEmoji} {exercise.moduleTitle}</span>
                </div>
                {state.mastered.includes(exercise.id) && <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Corrigé</span>}
              </div>
              <div className="mt-4 rounded-3xl bg-amber-50 p-4 text-base font-semibold leading-7 text-amber-950">{exercise.prompt}</div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input
                  value={state.answers[exercise.id] || ""}
                  onChange={(e) => onAnswerChange(exercise.id, e.target.value)}
                  placeholder="Nouvelle tentative"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
                <button onClick={() => onCheck(exercise.moduleId, exercise)} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Vérifier</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <HintButton label="Indice 1" onClick={() => onOpenHint(exercise.id, 1)} />
                <HintButton label="Indice 2" onClick={() => onOpenHint(exercise.id, 2)} />
                <HintButton label="Méthode" onClick={() => onOpenHint(exercise.id, 3)} />
              </div>
              <div className="mt-4 space-y-3">
                {(state.hintsOpen[exercise.id] || 0) >= 1 && <HintPanel tone="amber" title="Indice 1">{exercise.hint1}</HintPanel>}
                {(state.hintsOpen[exercise.id] || 0) >= 2 && <HintPanel tone="orange" title="Indice 2">{exercise.hint2}</HintPanel>}
                {(state.hintsOpen[exercise.id] || 0) >= 3 && <HintPanel tone="blue" title="Méthode modèle">{exercise.methodText}</HintPanel>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportScreen({ state, earnedBadges, currentLevel, globalProgress, masteredCount, totalExercises, reviewExercises, onExportJson, onExportCsv }) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-lg">
        <div className="grid gap-0 xl:grid-cols-[1fr_1fr]">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-white md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Exports enseignant</p>
            <h2 className="mt-2 text-3xl font-black md:text-4xl">Bilan exportable de l’élève</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80 md:text-base">
              Cette zone permet de générer un résumé exploitable par l’enseignant. Les exports sont locaux, simples et lisibles. Ils peuvent être archivés, transmis ou comparés dans le temps.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <PremiumStat title="Niveau" value={currentLevel.level} subtitle={currentLevel.label} dark />
              <PremiumStat title="Progression" value={globalProgress + "%"} subtitle={masteredCount + "/" + totalExercises + " exercices"} dark />
              <PremiumStat title="Révisions" value={reviewExercises.length} subtitle="encore en attente" dark />
              <PremiumStat title="Badges" value={earnedBadges.length} subtitle="débloqués" dark />
            </div>
          </div>
          <div className="p-6 md:p-8">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-700">Résumé rapide</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <p><strong>Élève :</strong> {state.profile.name || "Non renseigné"}</p>
                <p><strong>Classe :</strong> {state.profile.className}</p>
                <p><strong>Objectif :</strong> {state.profile.target}</p>
                <p><strong>XP :</strong> {state.xp}</p>
                <p><strong>Série actuelle :</strong> {state.streak} jour(s)</p>
                <p><strong>Séances focus :</strong> {state.sessions}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button onClick={onExportJson} className="rounded-2xl bg-slate-900 px-4 py-4 text-sm font-semibold text-white">Export JSON</button>
              <button onClick={onExportCsv} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700">Export CSV</button>
            </div>
            <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              <strong>Utilité pédagogique :</strong> l’export synthétise la progression, les exercices maîtrisés, les erreurs récurrentes, les badges obtenus et les notes saisies par l’élève.
            </div>
          </div>
        </div>
      </div>
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aperçu enseignant</p>
        <textarea readOnly value={buildPreviewText(state, earnedBadges, currentLevel, globalProgress, masteredCount, totalExercises, reviewExercises.length)} className="mt-4 min-h-[320px] w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 outline-none" />
      </Panel>
    </div>
  );
}

function Panel({ children }) {
  return <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">{children}</div>;
}

function ProgressBar({ value, dark = false }) {
  return (
    <div className={"h-3 w-full overflow-hidden rounded-full " + (dark ? "bg-white/20" : "bg-slate-200")}>
      <div className={"h-full rounded-full " + (dark ? "bg-white" : "bg-slate-900")} style={{ width: Math.max(0, Math.min(100, value)) + "%" }} />
    </div>
  );
}

function StatCard({ title, value, subtitle, dark = false }) {
  return (
    <div className={"rounded-3xl p-4 " + (dark ? "border border-white/10 bg-white/10" : "bg-slate-50")}>
      <div className={"text-xs font-semibold uppercase tracking-[0.18em] " + (dark ? "text-white/70" : "text-slate-500")}>{title}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className={"mt-1 text-sm " + (dark ? "text-white/70" : "text-slate-500")}>{subtitle}</div>
    </div>
  );
}

function PremiumStat({ title, value, subtitle, dark = false }) {
  return (
    <div className={"rounded-3xl p-4 " + (dark ? "border border-white/10 bg-white/10" : "border border-slate-200 bg-white")}>
      <div className={"text-xs font-semibold uppercase tracking-[0.18em] " + (dark ? "text-white/70" : "text-slate-500")}>{title}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className={"mt-1 text-sm " + (dark ? "text-white/75" : "text-slate-500")}>{subtitle}</div>
    </div>
  );
}

function ActionButton({ label, sublabel, onClick, emoji, accent = false }) {
  return (
    <button onClick={onClick} className={"rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md " + (accent ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white")}>
      <div className="text-2xl">{emoji}</div>
      <div className="mt-3 text-base font-semibold text-slate-900">{label}</div>
      <div className="mt-1 text-sm leading-6 text-slate-600">{sublabel}</div>
    </button>
  );
}

function NavButton({ label, emoji, active, onClick }) {
  return (
    <button onClick={onClick} className={"flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition " + (active ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100")}>
      <span className="text-lg">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

function HintButton({ label, onClick }) {
  return <button onClick={onClick} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">{label}</button>;
}

function HintPanel({ tone, title, children }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    orange: "border-orange-200 bg-orange-50 text-orange-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950"
  };
  return <div className={"rounded-3xl border p-4 text-sm leading-6 " + tones[tone]}><strong>{title} :</strong> {children}</div>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-white/80">{label}</div>
      {children}
    </label>
  );
}

export default App;
