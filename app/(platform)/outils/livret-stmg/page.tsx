"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  Calculator, 
  BookOpen, 
  Trophy, 
  Clock, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Zap,
  Target,
  Brain,
  Star,
  FileText,
  BarChart2,
  TrendingUp,
  Settings,
  HelpCircle,
  ArrowRight,
  Flame,
  Award,
  Timer,
  ShieldCheck
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";

// --- TYPES ---
interface Exercise {
  id: string;
  prompt: string;
  answer: string;
  accepted?: string[];
  hint1: string;
  hint2: string;
  methodText: string;
  isQcm?: boolean;
  options?: string[];
}

interface Module {
  id: string;
  title: string;
  emoji: string;
  hero: string; // Gradient class
  soft: string; // Soft background class
  short: string;
  objective: string;
  memoryRule: string;
  method: string[];
  flashcards: string[];
  exercises: Exercise[];
}

interface State {
  profile: {
    started: boolean;
    name: string;
    className: string;
    target: string;
    dailyGoal: number;
  };
  currentView: string;
  currentModule: string;
  answers: Record<string, string>;
  feedback: Record<string, "correct" | "incorrect" | null>;
  hintsOpen: Record<string, boolean>;
  hintsUsed: Record<string, number>;
  attempts: Record<string, number>;
  mastered: string[];
  needsReview: string[];
  mistakenEver: string[];
  completedModules: string[];
  notes: Record<string, string>;
  journal: string;
  xp: number;
  streak: number;
  lastPracticeDate: string | null;
  sessions: number;
  totalChecks: number;
  exportsCount: number;
  perfectExercises: string[];
  focusMode: boolean;
}

// --- CONSTANTS ---
const STORAGE_KEY = "nexus-stmg-v1";

const MODULES: Module[] = [
  {
    id: "calculs",
    title: "Décimaux et calculs de base",
    emoji: "🧠",
    hero: "from-rose-500 via-orange-400 to-amber-300",
    soft: "from-rose-500/10 to-orange-500/10",
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
    soft: "from-amber-500/10 to-yellow-500/10",
    short: "Les points les plus rentables",
    objective: "Reconnaître immédiatement une hausse, une baisse et le coefficient multiplicateur associé.",
    memoryRule: "Augmenter de p % = multiplier par (1 + p/100). Diminuer de p % = multiplier par (1 - p/100).",
    method: [
      "Je repère s’il s’agit d’une hausse ou d’une baisse.",
      "Je transforme le pourcentage en coefficient.",
      "Je multiplie la valeur de départ.",
      "Je conclus avec une phrase claire."
    ],
    flashcards: [
      "+20% donne fois 1,2",
      "-10% donne fois 0,9",
      "25% = 0,25 = 1/4",
      "50% = 0,5 = 1/2"
    ],
    exercises: [
      {
        id: "pct-1",
        prompt: "Un article coûte 400€. Son prix augmente de 20%. Nouveau prix ?",
        answer: "480",
        hint1: "Augmenter de 20% signifie multiplier par 1,2.",
        hint2: "400 x 1,2 = 480.",
        methodText: "On applique le coefficient multiplicateur 1,2 au prix initial."
      },
      {
        id: "pct-2",
        prompt: "Un sac coûte 130€. Son prix baisse de 10%. Nouveau prix ?",
        answer: "117",
        hint1: "Baisser de 10% signifie multiplier par 0,9.",
        hint2: "130 x 0,9 = 117.",
        methodText: "On garde 90% du prix, soit 0,9 fois le prix de départ."
      },
      {
        id: "pct-3",
        prompt: "25% de 80 = ?",
        answer: "20",
        hint1: "25% = un quart.",
        hint2: "Le quart de 80 vaut 20.",
        methodText: "Prendre 25% revient à prendre un quart."
      },
      {
        id: "pct-4",
        prompt: "Coefficient multiplicateur pour une baisse de 30% ?",
        answer: "0.7",
        accepted: ["0,7"],
        hint1: "Baisser de 30% signifie garder 70%.",
        hint2: "70% = 0,7.",
        methodText: "On calcule 1 - 0,30 = 0,70."
      }
    ]
  },
  {
    id: "puissances",
    title: "Puissances et notation scientifique",
    emoji: "🔢",
    hero: "from-indigo-500 via-blue-400 to-cyan-300",
    soft: "from-indigo-500/10 to-blue-500/10",
    short: "Maîtriser les grands et petits nombres",
    objective: "Maîtriser les puissances de 10 et l'écriture scientifique pour les questions d'automatismes.",
    memoryRule: "10^n : je décale la virgule de n rangs vers la droite. 10^-n : je décale de n rangs vers la gauche.",
    method: [
      "Je repère l'exposant (le petit chiffre en haut).",
      "S'il est positif, le nombre devient grand.",
      "S'il est négatif, le nombre devient petit (0,00...).",
      "Pour la notation scientifique, je ne garde qu'un chiffre (pas 0) avant la virgule."
    ],
    flashcards: [
      "10^3 = 1 000",
      "10^2 = 100",
      "10^-1 = 0,1",
      "10^-2 = 0,01"
    ],
    exercises: [
      {
        id: "pui-1",
        prompt: "Calcule 10^3",
        answer: "1000",
        hint1: "C'est un 1 suivi de 3 zéros.",
        hint2: "10 x 10 x 10 = 1000.",
        methodText: "10^3 = 10 x 10 x 10 = 1000."
      },
      {
        id: "pui-2",
        prompt: "Calcule 10^-2",
        answer: "0.01",
        accepted: ["0,01"],
        hint1: "L'exposant est négatif, le résultat commence par 0,0...",
        hint2: "Le 1 est en 2ème position après la virgule.",
        methodText: "10^-2 = 1 / 10^2 = 1 / 100 = 0,01."
      },
      {
        id: "pui-3",
        prompt: "Donne l'écriture scientifique de 32 000",
        answer: "3.2*10^4",
        accepted: ["3,2*10^4", "3.2x10^4", "3,2x10^4", "3.2*10**4"],
        hint1: "Place la virgule après le 3.",
        hint2: "Combien de rangs pour aller de 3,2 à 32 000 ? (Réponse: 4)",
        methodText: "32 000 = 3,2 x 10 000 = 3,2 x 10^4."
      },
      {
        id: "pui-4",
        prompt: "Calcule 5,4 x 10^2",
        answer: "540",
        hint1: "Décale la virgule de 2 rangs vers la droite.",
        hint2: "5,4 x 100 = 540.",
        methodText: "On multiplie par 100."
      }
    ]
  },
  {
    id: "conversions",
    title: "Durées et conversions",
    emoji: "⏱️",
    hero: "from-sky-500 via-cyan-400 to-blue-300",
    soft: "from-sky-500/10 to-cyan-500/10",
    short: "Éviter les erreurs simples",
    objective: "Passer d’une unité à une autre sans confusion.",
    memoryRule: "Pour les durées : minutes vers heures, je divise par 60. Heures vers minutes, je multiplie par 60.",
    method: [
      "Je repère l’unité de départ.",
      "Je repère l’unité d’arrivée.",
      "J’utiliserai l’égalité utile (ex: 1h = 60min).",
      "Je contrôle l’ordre de grandeur."
    ],
    flashcards: [
      "1 heure = 60 minutes",
      "1 km = 1000 m",
      "1 kg = 1000 g",
      "75 min = 1,25 h"
    ],
    exercises: [
      {
        id: "conv-1",
        prompt: "Convertis 75 minutes en heures.",
        answer: "1.25",
        accepted: ["1,25"],
        hint1: "On divise par 60.",
        hint2: "75 / 60 = 1,25.",
        methodText: "75 min = (60 + 15) min = 1h + 15min = 1h + 0,25h = 1,25h."
      },
      {
        id: "conv-2",
        prompt: "Convertis 2,5 heures en minutes.",
        answer: "150",
        hint1: "On multiplie par 60.",
        hint2: "2,5 x 60 = 150.",
        methodText: "2h = 120min et 0,5h = 30min, donc 150min."
      },
      {
        id: "conv-3",
        prompt: "Convertis 3,2 kg en grammes.",
        answer: "3200",
        hint1: "1 kg = 1000 g.",
        hint2: "3,2 x 1000 = 3200.",
        methodText: "On multiplie par 1000."
      },
      {
        id: "conv-4",
        prompt: "Convertis 1200 m en km.",
        answer: "1.2",
        accepted: ["1,2"],
        hint1: "1000 m = 1 km.",
        hint2: "1200 / 1000 = 1,2.",
        methodText: "On divise par 1000."
      }
    ]
  },
  {
    id: "equations",
    title: "Équations simples",
    emoji: "🎯",
    hero: "from-emerald-500 via-lime-400 to-green-300",
    soft: "from-emerald-500/10 to-lime-500/10",
    short: "Une méthode unique à répéter",
    objective: "Isoler x et sécuriser les équations les plus courantes.",
    memoryRule: "Je veux x tout seul. Ce qui multiplie à gauche divise à droite.",
    method: [
      "Je recopie l’équation.",
      "Je déplace ce qui gêne.",
      "J’isole x.",
      "Je vérifie rapidement."
    ],
    flashcards: [
      "3x = 0 => x = 0",
      "5x = 20 => x = 4",
      "Produit nul : (x-a)(x-b)=0 => x=a ou x=b",
      "144/x = 9 => 144 = 9x"
    ],
    exercises: [
      {
        id: "eq-1",
        prompt: "Résous : 3x = 0",
        answer: "0",
        hint1: "Divise par 3.",
        hint2: "0 / 3 = 0.",
        methodText: "On divise les deux membres par 3."
      },
      {
        id: "eq-2",
        prompt: "Résous : 5x = 20",
        answer: "4",
        hint1: "Divise par 5.",
        hint2: "20 / 5 = 4.",
        methodText: "On isole x en divisant par 5."
      },
      {
        id: "eq-3",
        prompt: "Résous : 144 / x = 9",
        answer: "16",
        hint1: "Multiplie par x pour avoir 144 = 9x.",
        hint2: "x = 144 / 9 = 16.",
        methodText: "On transforme l’égalité en produit : 144 = 9x."
      },
      {
        id: "eq-4",
        prompt: "Résous : (x - 1)(x - 5) = 0 (Réponds '1;5')",
        answer: "1;5",
        accepted: ["1 et 5", "1 ; 5", "5 et 1", "5;1"],
        hint1: "Un produit est nul si l’un des facteurs est nul.",
        hint2: "x - 1 = 0 ou x - 5 = 0.",
        methodText: "Propriété du produit nul : x = 1 ou x = 5."
      }
    ]
  },
  {
    id: "moyennes",
    title: "Moyennes et tableaux",
    emoji: "📊",
    hero: "from-violet-500 via-fuchsia-400 to-pink-300",
    soft: "from-violet-500/10 to-fuchsia-500/10",
    short: "Méthodes guidées et rentables",
    objective: "Calculer une moyenne simple, une moyenne pondérée et retrouver une valeur manquante.",
    memoryRule: "Moyenne pondérée : somme des (valeur x coeff) / somme des coeffs.",
    method: [
      "Je lis les données.",
      "Je calcule note x coefficient.",
      "J’additionne tout.",
      "Je divise par le total des coefficients."
    ],
    flashcards: [
      "Moyenne = somme / effectif total",
      "Case manquante = Total - (Somme des autres cases)",
      "Traduire une moyenne par une équation",
      "Le coefficient indique le poids de la note"
    ],
    exercises: [
      {
        id: "moy-1",
        prompt: "Moyenne de 10, 14 et 16 ?",
        answer: "13.333",
        accepted: ["13,33", "13.33", "13,3", "13.3", "40/3"],
        hint1: "Somme = 40. Divise par 3.",
        hint2: "40 / 3 approx 13,33.",
        methodText: "Moyenne = (10+14+16)/3 = 40/3."
      },
      {
        id: "moy-2",
        prompt: "Complète : 45 + x = 75. x = ?",
        answer: "30",
        hint1: "x = 75 - 45.",
        hint2: "x = 30.",
        methodText: "On soustrait pour trouver la valeur manquante."
      },
      {
        id: "moy-3",
        prompt: "Notes 10, 13, 12 (coeffs 1). Faut combien à x (coeff 2) pour avoir 15 de moyenne ?",
        answer: "20",
        hint1: "Équation : (35 + 2x) / 5 = 15.",
        hint2: "35 + 2x = 75 => 2x = 40.",
        methodText: "(10+13+12 + 2x)/5 = 15 => 35 + 2x = 75 => 2x = 40 => x = 20."
      },
      {
        id: "moy-4",
        prompt: "Note 12 (coeff 2) et 16 (coeff 3). Moyenne ?",
        answer: "14.4",
        accepted: ["14,4"],
        hint1: "Somme pondérée : 12x2 + 16x3 = 24 + 48 = 72.",
        hint2: "Divise par (2+3) = 5.",
        methodText: "(12*2 + 16*3)/5 = 72/5 = 14,4."
      }
    ]
  },
  {
    id: "graphiques",
    title: "Lire un graphique et une droite",
    emoji: "📉",
    hero: "from-blue-600 via-indigo-500 to-sky-400",
    soft: "from-blue-600/10 to-indigo-500/10",
    short: "Un point lu correctement vaut des points",
    objective: "Lire une image, des antécédents, une ordonnée à l’origine et un coefficient directeur.",
    memoryRule: "y = ax + b. b est l'ordonnée à l'origine (où ça coupe l'axe vertical). a est la pente.",
    method: [
      "Je repère les axes (x horizontal, y vertical).",
      "Je lis les graduations.",
      "Image de x : je monte de x vers la courbe, puis je vais vers y.",
      "Antécédent de y : je pars de y vers la courbe, puis je descends vers x."
    ],
    flashcards: [
      "f(0) = ordonnée à l'origine",
      "a > 0 => droite monte",
      "a < 0 => droite descend",
      "L'axe des x est l'axe des abscisses"
    ],
    exercises: [
      {
        id: "graph-1",
        prompt: "Pour y = -2x + 5, ordonnée à l'origine ?",
        answer: "5",
        hint1: "C'est la valeur de b dans y = ax + b.",
        hint2: "C'est aussi y quand x = 0.",
        methodText: "On lit directement la constante 5."
      },
      {
        id: "graph-2",
        prompt: "Pour y = -2x + 5, image de 0 ?",
        answer: "5",
        hint1: "Remplace x par 0.",
        hint2: "-2 * 0 + 5 = 5.",
        methodText: "f(0) = -2(0) + 5 = 5."
      },
      {
        id: "graph-3",
        prompt: "Courbe coupe x en 1 et 5. Antécédents de 0 ?",
        answer: "1;5",
        accepted: ["1 et 5", "5;1", "1 ; 5"],
        hint1: "Ce sont les valeurs de x où y = 0.",
        hint2: "On lit sur l'axe horizontal.",
        methodText: "Les points d'intersection avec l'axe des abscisses."
      },
      {
        id: "graph-4",
        prompt: "y = -2x + 5. Coefficient directeur positif ou negatif ?",
        answer: "negatif",
        accepted: ["négatif"],
        hint1: "Regarde le signe devant le x.",
        hint2: "Ici c'est -2.",
        methodText: "Le coefficient directeur est -2, donc négatif."
      }
    ]
  },
  {
    id: "derivee",
    title: "Dérivée : tangente et variations",
    emoji: "📈",
    hero: "from-teal-600 via-emerald-500 to-green-400",
    soft: "from-teal-600/10 to-emerald-500/10",
    short: "Le lien entre pente et sens",
    objective: "Comprendre le lien entre signe de la dérivée et variations de la fonction.",
    memoryRule: "Dérivée positive (+) => Fonction monte (croissante). Dérivée négative (-) => Fonction descend (décroissante).",
    method: [
      "Je repère l'intervalle où la fonction monte ou descend.",
      "Si f monte, f'(x) est positive.",
      "Si f descend, f'(x) est négative.",
      "Le nombre dérivé f'(a) est le coefficient directeur de la tangente en a."
    ],
    flashcards: [
      "f'(x) > 0 <=> f est croissante",
      "f'(x) < 0 <=> f est décroissante",
      "f'(a) = pente de la tangente au point d'abscisse a",
      "Si f'(x) s'annule en changeant de signe, il y a un extremum."
    ],
    exercises: [
      {
        id: "der-1",
        prompt: "Si f'(x) est toujours positive sur [0;10], f est-elle croissante ou décroissante ?",
        answer: "croissante",
        hint1: "Relis la règle : dérivée positive = ?",
        hint2: "Plus de dérivée, plus de pente positive, donc ça monte.",
        methodText: "Par théorème, si la dérivée est positive, la fonction est croissante."
      },
      {
        id: "der-2",
        prompt: "La tangente en x=2 est horizontale. Que vaut f'(2) ?",
        answer: "0",
        hint1: "Quelle est la pente d'une droite horizontale ?",
        hint2: "Une droite 'plate' n'a pas de pente.",
        methodText: "Une tangente horizontale signifie que le coefficient directeur (la dérivée) est nul."
      },
      {
        id: "der-3",
        prompt: "f'(x) = -3x + 6. Quel est le signe de f'(0) ?",
        answer: "positif",
        hint1: "Calcule -3 * 0 + 6.",
        hint2: "6 est-il positif ou négatif ?",
        methodText: "f'(0) = 6, ce qui est positif."
      },
      {
        id: "der-4",
        prompt: "Si f'(x) < 0, la fonction f : monte ou descend ?",
        answer: "descend",
        accepted: ["elle descend", "décroissante"],
        hint1: "Dérivée négative = ?",
        hint2: "La pente est négative.",
        methodText: "Une dérivée négative indique une fonction décroissante (elle descend)."
      }
    ]
  },
  {
    id: "probas",
    title: "Probabilités et Bernoulli",
    emoji: "🎲",
    hero: "from-teal-500 via-emerald-400 to-green-300",
    soft: "from-teal-500/10 to-emerald-500/10",
    short: "Questions fréquentes et accessibles",
    objective: "Calculer une probabilité simple, conditionnelle et comprendre Bernoulli.",
    memoryRule: "Proba = Cas favorables / Cas possibles. Bernoulli = 2 issues (Succès/Échec).",
    method: [
      "Je liste les issues si possible.",
      "Je repère le total (dénominateur).",
      "'Sachant que' : je change le total pour celui du groupe cité.",
      "Arbre : on multiplie les probabilités sur les branches."
    ],
    flashcards: [
      "Proba entre 0 et 1",
      "Epreuve de Bernoulli : 2 issues possibles",
      "p + q = 1 (Succès + Echec)",
      "'Sachant B' : P_B(A) = P(A inter B) / P(B)"
    ],
    exercises: [
      {
        id: "prob-1",
        prompt: "Sur 100 élèves, 5 sont absents. Proba de choisir un absent ?",
        answer: "0.05",
        accepted: ["0,05", "5/100", "5%"],
        hint1: "5 sur 100.",
        hint2: "5 / 100 = 0,05.",
        methodText: "Proba = Effectif / Total = 5 / 100 = 0,05."
      },
      {
        id: "prob-2",
        prompt: "45 élèves font du sport ET de la musique. 75 font du sport. Proba de faire de la musique SACHANT qu'on fait du sport ?",
        answer: "0.6",
        accepted: ["0,6", "45/75"],
        hint1: "Total devient 75.",
        hint2: "45 / 75 = 0,6.",
        methodText: "P(M sachant S) = P(M et S) / P(S) = 45 / 75 = 0,6."
      },
      {
        id: "prob-3",
        prompt: "Une épreuve de Bernoulli a un succès de p=0,3. Quelle est la proba de l'échec q ?",
        answer: "0.7",
        accepted: ["0,7"],
        hint1: "p + q = 1.",
        hint2: "1 - 0,3 = 0,7.",
        methodText: "q = 1 - p = 1 - 0,3 = 0,7."
      },
      {
        id: "prob-4",
        prompt: "On lance 2 fois une pièce. Proba d'avoir Face-Face ?",
        answer: "0.25",
        accepted: ["0,25", "1/4"],
        hint1: "Issues: PP, PF, FP, FF.",
        hint2: "1 issue sur 4.",
        methodText: "P(F) x P(F) = 0,5 x 0,5 = 0,25."
      }
    ]
  },
  {
    id: "suites",
    title: "Suites et Sommes",
    emoji: "🪜",
    hero: "from-orange-500 via-rose-400 to-pink-300",
    soft: "from-orange-500/10 to-rose-500/10",
    short: "Le modèle de l'évolution",
    objective: "Distinguer arithmétique (+ constant) et géométrique (x constant). Calculer des sommes.",
    memoryRule: "Arithmétique : u_n = u_0 + n*r. Géométrique : u_n = u_0 * q^n.",
    method: [
      "Je cherche si on ajoute ou multiplie.",
      "Augmentation fixe (+5) => Arithmétique.",
      "Augmentation % (x1.05) => Géométrique.",
      "Somme arithmétique : n * (Premier + Dernier) / 2."
    ],
    flashcards: [
      "Raison r (arith) ou q (géo)",
      "u_n+1 = u_n + r",
      "u_n+1 = u_n * q",
      "Somme de 1 à 10 = 10 * 11 / 2 = 55"
    ],
    exercises: [
      {
        id: "suite-1",
        prompt: "+5 par an. Arithmetique ou geometrique ?",
        answer: "arithmetique",
        accepted: ["arithmétique"],
        hint1: "On ajoute la même chose.",
        hint2: "Modèle additif.",
        methodText: "Ajouter une constante = suite arithmétique."
      },
      {
        id: "suite-2",
        prompt: "Baisse de 10% par an. Raison q ?",
        answer: "0.9",
        accepted: ["0,9"],
        hint1: "1 - 10/100.",
        hint2: "Multiplier par 0,9.",
        methodText: "Diminuer de 10% = multiplier par 0,9."
      },
      {
        id: "suite-3",
        prompt: "u0=100, raison r=5. u1 = ?",
        answer: "105",
        hint1: "u0 + r.",
        hint2: "100 + 5.",
        methodText: "u1 = u0 + r = 100 + 5 = 105."
      },
      {
        id: "suite-4",
        prompt: "Somme des entiers de 1 à 10 ?",
        answer: "55",
        hint1: "n * (n+1) / 2.",
        hint2: "10 * 11 / 2.",
        methodText: "S = 10 * (1 + 10) / 2 = 110 / 2 = 55."
      }
    ]
  },
  {
    id: "strategie",
    title: "Stratégie d'épreuve (QCM)",
    emoji: "🏁",
    hero: "from-slate-700 via-slate-600 to-slate-500",
    soft: "from-slate-700/10 to-slate-500/10",
    short: "Identifier pour gagner",
    objective: "Reconnaître le type de question pour appliquer la bonne méthode immédiatement.",
    memoryRule: "Je repère les mots-clés : 'image', 'sachant', 'coefficient', 'raison'.",
    method: [
      "Je lis la question sans regarder les réponses.",
      "J'identifie le chapitre concerné.",
      "Je cherche la formule mentale.",
      "Je vérifie si une réponse correspond."
    ],
    flashcards: [
      "QCM Automatismes : 20 min max",
      "Ne pas laisser de blanc si pas de point négatif",
      "Vérifier la cohérence (ex: prix < 0 impossible)",
      "Un dessin rapide peut aider en proba ou graphique"
    ],
    exercises: [
      {
        id: "strat-1",
        prompt: "Question: 'Quelle est la raison de l'évolution ?'. On parle de : Probabilités ou Suites ?",
        answer: "suites",
        isQcm: true,
        options: ["Probabilités", "Suites"],
        hint1: "Le mot raison est utilisé pour l'évolution régulière.",
        hint2: "C'est le pas d'une suite.",
        methodText: "La raison est le paramètre central d'une suite."
      },
      {
        id: "strat-2",
        prompt: "Question: 'Donne l'image de 3'. On cherche : x ou y ?",
        answer: "y",
        isQcm: true,
        options: ["x", "y"],
        hint1: "L'image est le résultat.",
        hint2: "C'est sur l'axe vertical.",
        methodText: "L'image est la valeur f(x), donc y."
      },
      {
        id: "strat-3",
        prompt: "Faut-il commencer par le QCM d'automatismes ? Oui ou Non ?",
        answer: "oui",
        isQcm: true,
        options: ["Oui", "Non"],
        hint1: "Ce sont les points les plus faciles.",
        hint2: "C'est prioritaire.",
        methodText: "Le QCM automatismes sécurise des points rapidement."
      },
      {
        id: "strat-4",
        prompt: "Si on lit 'Sachant que', on change : le total ou le numérateur ?",
        answer: "le total",
        isQcm: true,
        options: ["le total", "le numérateur"],
        hint1: "Conditionnelle.",
        hint2: "Le groupe de référence change.",
        methodText: "Le dénominateur (total) est restreint au groupe cité."
      }
    ]
  }
];

const QCM_POOL = [
  { q: "10 + 0,5 ?", a: "10,5", options: ["10,05", "10,5", "15", "11"] },
  { q: "Hausse de 20% = fois ?", a: "1,2", options: ["0,2", "0,8", "1,2", "2"] },
  { q: "Baisse de 30% = fois ?", a: "0,7", options: ["0,3", "0,7", "1,3", "0,6"] },
  { q: "120 min = ? heures", a: "2", options: ["1,2", "1,5", "2", "3"] },
  { q: "10^2 ?", a: "100", options: ["10", "20", "100", "1000"] },
  { q: "3x = 12 => x = ?", a: "4", options: ["3", "4", "9", "36"] },
  { q: "Moyenne de 10 et 20 ?", a: "15", options: ["10", "15", "20", "30"] },
  { q: "f'(x) > 0 => f est ?", a: "croissante", options: ["croissante", "décroissante", "constante", "nulle"] },
  { q: "q = 1 - p. Si p=0,4, q=?", a: "0,6", options: ["0,4", "0,6", "1", "0,5"] },
  { q: "u0=10, r=2. u1=?", a: "12", options: ["10", "11", "12", "20"] },
  { q: "75/60 = ?", a: "1,25", options: ["1,15", "1,25", "1,35", "1,45"] },
  { q: "25% de 400 ?", a: "100", options: ["25", "50", "100", "200"] }
];

const BADGES = [
  { id: "starter", emoji: "🌱", label: "Premier pas", description: "Atteindre 20 XP", icon: Calculator },
  { id: "regular", emoji: "🔥", label: "Régularité", description: "3 jours d’affilée", icon: Flame },
  { id: "writer", emoji: "📝", label: "Carnet vivant", description: "3 notes ou journal long", icon: FileText },
  { id: "survivor", emoji: "🛡️", label: "Sauve les meubles", description: "Valider 3 modules", icon: ShieldCheck },
  { id: "focus", emoji: "🎧", label: "Mode élève", description: "3 séances focus", icon: Zap },
  { id: "rebound", emoji: "🔁", label: "Rebond", description: "5 erreurs corrigées", icon: RotateCcw },
  { id: "perfect", emoji: "💎", label: "Réponse nette", description: "8 exercices parfaits", icon: Star },
  { id: "coach-ready", emoji: "📦", label: "Export prêt", description: "1 export réalisé", icon: Trophy },
  { id: "final", emoji: "🏆", label: "Cap terminal", description: "Tout terminer", icon: Award }
];

// --- HELPERS ---
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function updateStreak(previousDate: string | null, currentStreak: number) {
  const today = todayString();
  if (!previousDate) return 1;
  if (previousDate === today) return currentStreak;
  const prev = new Date(previousDate + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  const diff = Math.round((now.getTime() - prev.getTime()) / 86400000);
  if (diff === 1) return currentStreak + 1;
  return 1;
}

function normalize(value: string | number) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".");
}

function getLevel(xp: number) {
  if (xp >= 1500) return { level: 6, label: "Prête pour le Bac", next: null };
  if (xp >= 1000) return { level: 5, label: "Expert STMG", next: 1500 };
  if (xp >= 600) return { level: 4, label: "Solide", next: 1000 };
  if (xp >= 300) return { level: 3, label: "En progression", next: 600 };
  if (xp >= 100) return { level: 2, label: "Apprenti", next: 300 };
  return { level: 1, label: "Débutante", next: 100 };
}

// --- COMPONENTS ---

const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-slate-900/40 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-6 ${className}`}>
    {children}
  </div>
);

const ProgressBar = ({ value, color = "bg-indigo-500" }: { value: number, color?: string }) => (
  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${value}%` }}
      className={`h-full ${color}`}
    />
  </div>
);

// --- MAIN PAGE ---
export default function LivretSTMGPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [state, setState] = useState<State>({
    profile: { started: false, name: "", className: "Première STMG", target: "Sauver les meubles", dailyGoal: 10 },
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
  });

  // Load from storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error("Error loading state", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to storage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  // Calculations
  const masteredCount = state.mastered.length;
  const totalExercises = useMemo(() => MODULES.reduce((acc, m) => acc + m.exercises.length, 0), []);
  const globalProgress = Math.round((masteredCount / totalExercises) * 100);
  const currentLevel = getLevel(state.xp);
  
  const earnedBadges = useMemo(() => {
    const list: string[] = [];
    if (state.xp >= 20) list.push("starter");
    if (state.streak >= 3) list.push("regular");
    if (Object.values(state.notes).filter(n => n.length > 20).length >= 3) list.push("writer");
    if (state.completedModules.length >= 3) list.push("survivor");
    if (state.sessions >= 3) list.push("focus");
    if (state.mastered.filter(id => state.mistakenEver.includes(id)).length >= 5) list.push("rebound");
    if (state.perfectExercises.length >= 8) list.push("perfect");
    if (state.exportsCount >= 1) list.push("coach-ready");
    if (state.completedModules.length === MODULES.length) list.push("final");
    return list;
  }, [state]);

  // Handlers
  const addXP = useCallback((amount: number) => {
    setState((prev: State) => ({ ...prev, xp: prev.xp + amount }));
  }, []);

  const navigate = (view: string, moduleId?: string) => {
    setState((prev: State) => ({ 
      ...prev, 
      currentView: view, 
      currentModule: moduleId || prev.currentModule,
      focusMode: view === "module"
    }));
  };

  // --- VIEWS ---

  if (!isLoaded) return null;

  if (!state.profile.started) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Panel className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator size={40} />
            </div>
            <h1 className="text-3xl font-bold text-white font-display">Livret STMG Interactif</h1>
            <p className="text-slate-400">Prépare ton EAM 2026 sereinement. On reprend tout, pas à pas.</p>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Ton prénom" 
                className="w-full bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
                value={state.profile.name}
                onChange={e => setState((p: State) => ({ ...p, profile: { ...p.profile, name: e.target.value } }))}
              />
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 rounded-xl font-bold text-lg"
                onClick={() => setState((p: State) => ({ ...p, profile: { ...p.profile, started: true } }))}
                disabled={!state.profile.name}
              >
                Commencer l'aventure <ArrowRight className="ml-2" />
              </Button>
            </div>
          </Panel>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header Stat Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Panel className="py-4 flex items-center gap-4">
          <div className="p-3 bg-orange-500/20 text-orange-500 rounded-xl">
            <Flame size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{state.streak} j</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Série actuelle</div>
          </div>
        </Panel>
        <Panel className="py-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-500/20 text-yellow-500 rounded-xl">
            <Star size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{state.xp}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">XP Total</div>
          </div>
        </Panel>
        <Panel className="py-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 text-indigo-500 rounded-xl">
            <Trophy size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">Niv. {currentLevel.level}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{currentLevel.label}</div>
          </div>
        </Panel>
        <Panel className="py-4 flex items-center gap-4">
          <div className="p-3 bg-teal-500/20 text-teal-500 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{globalProgress}%</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Progression</div>
          </div>
        </Panel>
      </div>

      <AnimatePresence mode="wait">
        {state.currentView === "home" && <HomeView state={state} navigate={navigate} earnedBadges={earnedBadges} />}
        {state.currentView === "module" && <ModuleView state={state} setState={setState} navigate={navigate} addXP={addXP} />}
        {state.currentView === "qcm" && <QcmChronoView state={state} navigate={navigate} addXP={addXP} />}
        {state.currentView === "badges" && <BadgesView earnedBadges={earnedBadges} navigate={navigate} />}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-VIEWS ---

function HomeView({ state, navigate, earnedBadges }: { state: State, navigate: any, earnedBadges: string[] }) {
  const masteredCount = state.mastered.length;
  const totalExercises = useMemo(() => MODULES.reduce((acc, m) => acc + m.exercises.length, 0), []);
  const globalProgress = Math.round((masteredCount / totalExercises) * 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Welcome & Promo Banner */}
      <div className="flex flex-col md:flex-row gap-6">
        <Panel className="flex-1 p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-slate-800 group-hover:text-indigo-500/20 transition-colors">
            <Brain size={120} />
          </div>
          <div className="relative z-10 space-y-4">
            <h2 className="text-4xl font-bold text-white font-display">Bonjour, {state.profile.name} !</h2>
            <p className="text-xl text-slate-400 max-w-lg">
              Prête pour une petite séance ? Chaque point gagné aujourd'hui est un stress en moins le jour du Bac.
            </p>
            <div className="flex gap-4 pt-4">
              <Button 
                onClick={() => navigate("qcm")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 rounded-xl font-bold"
              >
                <Timer className="mr-2" /> Mode QCM Chrono
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate("badges")}
                className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 px-6 py-6 rounded-xl"
              >
                <Award className="mr-2" /> Mes {earnedBadges.length} Badges
              </Button>
            </div>
          </div>
        </Panel>

        {globalProgress < 60 && (
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="md:w-80 bg-gradient-to-br from-orange-500 to-amber-600 p-6 rounded-2xl flex flex-col justify-between"
          >
            <div className="text-white space-y-2">
              <div className="p-2 bg-white/20 w-fit rounded-lg"><Zap size={20} /></div>
              <h3 className="text-lg font-bold">Points rapides garantis</h3>
              <p className="text-sm text-white/80">Concentre-toi sur les "Pourcentages" pour sécuriser 4 points faciles.</p>
            </div>
            <Button 
              onClick={() => navigate("module", "pourcentages")}
              className="bg-white text-orange-600 hover:bg-orange-50 w-full mt-4 font-bold"
            >
              Y aller maintenant
            </Button>
          </motion.div>
        )}
      </div>

      {/* Modules Grid */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="text-indigo-400" /> Tes Modules de Réussite
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULES.map((module) => {
            const mastered = module.exercises.filter(e => state.mastered.includes(e.id)).length;
            const progress = Math.round((mastered / module.exercises.length) * 100);
            
            return (
              <motion.div key={module.id} whileHover={{ y: -5 }}>
                <Card 
                  className={`cursor-pointer h-full border-indigo-500/20 bg-slate-900/40 hover:bg-slate-900/60 transition-all overflow-hidden ${state.currentModule === module.id ? 'ring-2 ring-indigo-500' : ''}`}
                  onClick={() => navigate("module", module.id)}
                >
                  <div className={`h-2 w-full bg-gradient-to-r ${module.hero}`} />
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className="text-3xl">{module.emoji}</div>
                    <div>
                      <CardTitle className="text-white text-lg">{module.title}</CardTitle>
                      <CardDescription className="text-slate-500 text-xs uppercase tracking-tighter">{module.short}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">{mastered} / {module.exercises.length} maîtrisés</span>
                      <span className="text-indigo-400 font-bold">{progress}%</span>
                    </div>
                    <ProgressBar value={progress} color={progress === 100 ? "bg-teal-500" : "bg-indigo-500"} />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function ModuleView({ state, setState, navigate, addXP }: { state: State, setState: any, navigate: any, addXP: any }) {
  const module = MODULES.find(m => m.id === state.currentModule) || MODULES[0];
  const [tab, setTab] = useState("method");
  const [currentIndex, setCurrentIndex] = useState(0);
  const exercise = module.exercises[currentIndex];
  
  const isMastered = state.mastered.includes(exercise.id);
  const currentAnswer = state.answers[exercise.id] || "";
  const feedback = state.feedback[exercise.id];

  const checkAnswer = () => {
    const normUser = normalize(currentAnswer);
    const normCorrect = normalize(exercise.answer);
    const accepted = (exercise.accepted || []).map(a => normalize(a));
    
    const isCorrect = normUser === normCorrect || accepted.includes(normUser);
    
    setState((prev: State) => {
      const newMastered = isCorrect && !prev.mastered.includes(exercise.id) 
        ? [...prev.mastered, exercise.id] 
        : prev.mastered;
      
      const newMistaken = !isCorrect && !prev.mistakenEver.includes(exercise.id)
        ? [...prev.mistakenEver, exercise.id]
        : prev.mistakenEver;

      const newPerfect = isCorrect && !prev.attempts[exercise.id] && !prev.hintsUsed[exercise.id] && !prev.perfectExercises.includes(exercise.id)
        ? [...prev.perfectExercises, exercise.id]
        : prev.perfectExercises;

      const newCompletedModules = [...prev.completedModules];
      const allInModuleMastered = module.exercises.every(e => newMastered.includes(e.id));
      if (allInModuleMastered && !newCompletedModules.includes(module.id)) {
        newCompletedModules.push(module.id);
      }

      return {
        ...prev,
        feedback: { ...prev.feedback, [exercise.id]: isCorrect ? "correct" : "incorrect" },
        mastered: newMastered,
        mistakenEver: newMistaken,
        perfectExercises: newPerfect,
        completedModules: newCompletedModules,
        attempts: { ...prev.attempts, [exercise.id]: (prev.attempts[exercise.id] || 0) + 1 },
        xp: prev.xp + (isCorrect ? (prev.mastered.includes(exercise.id) ? 2 : 15) : 0)
      };
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Module Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("home")} className="text-slate-400 hover:text-white">
          <ChevronLeft className="mr-2" /> Retour à l'accueil
        </Button>
        <div className="flex items-center gap-4">
          <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 px-3 py-1">
            {module.title}
          </Badge>
          <div className="flex gap-1">
            {module.exercises.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 w-6 rounded-full transition-colors ${i === currentIndex ? 'bg-indigo-500' : state.mastered.includes(module.exercises[i].id) ? 'bg-teal-500' : 'bg-slate-800'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Content/Method */}
        <div className="lg:col-span-1 space-y-6">
          <Panel className="p-0 overflow-hidden border-none shadow-2xl">
            <div className={`h-24 bg-gradient-to-r ${module.hero} p-6 flex items-end`}>
              <h3 className="text-2xl font-bold text-white drop-shadow-md">{module.emoji} {module.title}</h3>
            </div>
            <Tabs value={tab} onValueChange={setTab} className="p-6">
              <TabsList className="grid grid-cols-2 bg-slate-800/50 p-1 mb-6">
                <TabsTrigger value="method" className="data-[state=active]:bg-indigo-500 text-xs uppercase font-bold">La Méthode</TabsTrigger>
                <TabsTrigger value="memory" className="data-[state=active]:bg-orange-500 text-xs uppercase font-bold">Mémo-Règle</TabsTrigger>
              </TabsList>
              <TabsContent value="method" className="space-y-4">
                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                  <h4 className="text-indigo-400 font-bold text-sm mb-3 flex items-center gap-2"><Target size={16} /> Objectif</h4>
                  <p className="text-slate-300 text-sm italic">"{module.objective}"</p>
                </div>
                <div className="space-y-3">
                  {module.method.map((step, i) => (
                    <div key={i} className="flex gap-3 text-sm text-slate-400">
                      <span className="w-5 h-5 bg-slate-800 text-slate-500 rounded-full flex items-center justify-center text-xs flex-shrink-0">{i+1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="memory" className="space-y-6">
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6 text-orange-200 font-medium text-center">
                  "{module.memoryRule}"
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {module.flashcards.map((fc, i) => (
                    <div key={i} className="bg-slate-800/30 p-3 rounded-lg text-sm text-slate-300 border border-slate-700/50 flex items-center gap-3">
                      <Zap size={14} className="text-yellow-500" /> {fc}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Panel>
          
          <Panel className="bg-slate-900/60">
            <h4 className="text-white font-bold mb-4 flex items-center gap-2"><FileText size={18} className="text-indigo-400" /> Tes Notes</h4>
            <textarea 
              placeholder="Tes propres astuces pour ce chapitre..."
              className="w-full h-32 bg-slate-800/50 border-slate-700 text-slate-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              value={state.notes[module.id] || ""}
              onChange={e => setState((p: State) => ({ ...p, notes: { ...p.notes, [module.id]: e.target.value } }))}
            />
          </Panel>
        </div>

        {/* Right: Exercise */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div key={exercise.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <Panel className="p-8 min-h-[400px] flex flex-col">
              <div className="flex-1 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="text-slate-500 text-sm font-bold uppercase tracking-widest">Exercice {currentIndex + 1} sur {module.exercises.length}</div>
                  {isMastered && <Badge className="bg-teal-500 text-white font-bold">Maîtrisé</Badge>}
                </div>
                
                <h3 className="text-3xl font-bold text-white leading-tight">
                  {exercise.prompt}
                </h3>

                <div className="space-y-4">
                  {exercise.isQcm ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {exercise.options?.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setState((p: State) => ({ ...p, answers: { ...p.answers, [exercise.id]: opt } }));
                          }}
                          className={`p-4 rounded-xl border-2 text-left transition-all font-bold ${
                            state.answers[exercise.id] === opt 
                              ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                              : 'border-slate-800 bg-slate-800/30 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      placeholder="Ta réponse..."
                      className={`w-full bg-slate-800/80 border-2 rounded-xl px-6 py-5 text-2xl font-bold text-white focus:outline-none transition-all ${
                        feedback === "correct" ? 'border-teal-500 ring-4 ring-teal-500/10' : 
                        feedback === "incorrect" ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-700 focus:border-indigo-500'
                      }`}
                      value={currentAnswer}
                      onChange={e => setState((p: State) => ({ ...p, answers: { ...p.answers, [exercise.id]: e.target.value } }))}
                      onKeyPress={e => e.key === "Enter" && checkAnswer()}
                    />
                  )}

                  <div className="flex flex-col md:flex-row gap-3">
                    <Button 
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-8 rounded-xl text-xl font-bold shadow-lg"
                      onClick={checkAnswer}
                    >
                      Valider <ChevronRight className="ml-2" />
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-slate-700 text-slate-400 hover:bg-slate-800 py-8 rounded-xl px-8"
                      onClick={() => setState((p: State) => ({ ...p, hintsOpen: { ...p.hintsOpen, [exercise.id]: !p.hintsOpen[exercise.id] } }))}
                    >
                      <HelpCircle />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {state.hintsOpen[exercise.id] && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 pt-4 border-t border-slate-800 mt-4">
                        <Alert className="bg-indigo-500/5 border-indigo-500/20">
                          <Brain className="h-4 w-4 text-indigo-400" />
                          <AlertTitle className="text-indigo-400 font-bold">Indice 1</AlertTitle>
                          <AlertDescription className="text-slate-300">{exercise.hint1}</AlertDescription>
                        </Alert>
                        <Alert className="bg-orange-500/5 border-orange-500/20">
                          <Lightbulb className="h-4 w-4 text-orange-400" />
                          <AlertTitle className="text-orange-400 font-bold">Indice 2</AlertTitle>
                          <AlertDescription className="text-slate-300">{exercise.hint2}</AlertDescription>
                        </Alert>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {feedback === "correct" && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <Alert className="bg-teal-500/10 border-teal-500/20">
                      <CheckCircle2 className="h-4 w-4 text-teal-500" />
                      <AlertTitle className="text-teal-500 font-bold">C'est parfait !</AlertTitle>
                      <AlertDescription className="text-slate-300">
                        {exercise.methodText}
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                {feedback === "incorrect" && (
                  <motion.div initial={{ x: -10 }} animate={{ x: [10, -10, 10, 0] }}>
                    <Alert className="bg-red-500/10 border-red-500/20">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <AlertTitle className="text-red-500 font-bold">Presque...</AlertTitle>
                      <AlertDescription className="text-slate-300">Réessaie ou utilise les indices.</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </div>

              <div className="flex justify-between mt-12">
                <Button 
                  variant="ghost" 
                  disabled={currentIndex === 0} 
                  onClick={() => { setCurrentIndex(i => i - 1); setState((p: State) => ({ ...p, feedback: { ...p.feedback, [exercise.id]: null } })); }}
                  className="text-slate-500"
                >
                  <ChevronLeft /> Précédent
                </Button>
                <Button 
                  disabled={currentIndex === module.exercises.length - 1} 
                  onClick={() => { setCurrentIndex(i => i + 1); setState((p: State) => ({ ...p, feedback: { ...p.feedback, [exercise.id]: null } })); }}
                  className="bg-slate-800 text-white"
                >
                  Suivant <ChevronRight />
                </Button>
              </div>
            </Panel>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function QcmChronoView({ state, addXP, navigate }: { state: State, addXP: any, navigate: any }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isFinished, setIsFinished] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const shuffled = [...QCM_POOL].sort(() => 0.5 - Math.random()).slice(0, 12);
    setQuestions(shuffled);
  }, []);

  useEffect(() => {
    if (isFinished || questions.length === 0) return;
    if (timeLeft === 0) {
      handleNext(null);
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isFinished, questions]);

  const handleNext = (val: string | null) => {
    if (val === questions[currentIndex].a) {
      setScore(s => s + 1);
    }
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setTimeLeft(30);
      setSelected(null);
    } else {
      setIsFinished(true);
      const bonus = score === 11 && val === questions[currentIndex].a ? 50 : (score * 5);
      addXP(bonus);
    }
  };

  if (questions.length === 0) return null;

  if (isFinished) {
    return (
      <Panel className="text-center py-20 space-y-8 max-w-2xl mx-auto">
        <Trophy size={80} className="mx-auto text-yellow-500" />
        <h2 className="text-4xl font-bold text-white">Session Terminée !</h2>
        <div className="text-6xl font-black text-indigo-500">{score} / 12</div>
        <p className="text-slate-400 text-lg">Tu as gagné <span className="text-yellow-500 font-bold">{score === 12 ? 50 : score * 5} XP</span></p>
        <Button onClick={() => navigate("home")} className="bg-indigo-600 text-white px-12 py-6 rounded-xl text-lg">Retour à l'accueil</Button>
      </Panel>
    );
  }

  const q = questions[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="text-white font-bold">Question {currentIndex + 1} / 12</div>
        <div className={`text-2xl font-black px-6 py-2 rounded-xl ${timeLeft < 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-indigo-400'}`}>
          {timeLeft}s
        </div>
      </div>
      
      <ProgressBar value={(currentIndex / 12) * 100} color="bg-indigo-500" />

      <Panel className="p-12 space-y-12">
        <h3 className="text-4xl font-bold text-white text-center">{q.q}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {q.options.map((opt: string, i: number) => (
            <button
              key={i}
              onClick={() => setSelected(opt)}
              className={`p-6 rounded-2xl border-2 text-xl font-bold transition-all ${
                selected === opt 
                  ? 'border-indigo-500 bg-indigo-500/20 text-white' 
                  : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <Button 
          disabled={!selected}
          onClick={() => handleNext(selected)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-8 rounded-2xl text-2xl font-black shadow-xl"
        >
          Valider
        </Button>
      </Panel>
    </div>
  );
}

function BadgesView({ earnedBadges, navigate }: { earnedBadges: string[], navigate: any }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white flex items-center gap-2"><Award className="text-yellow-500" /> Collection de Badges</h2>
        <Button variant="ghost" onClick={() => navigate("home")} className="text-slate-400"><ChevronLeft /> Retour</Button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {BADGES.map((badge) => {
          const isEarned = earnedBadges.includes(badge.id);
          const IconComp = badge.icon;
          
          return (
            <Panel key={badge.id} className={`text-center space-y-4 transition-all ${isEarned ? 'border-yellow-500/50 bg-yellow-500/5' : 'opacity-40 grayscale'}`}>
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isEarned ? 'bg-yellow-500 text-yellow-900 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-600'}`}>
                <IconComp size={32} />
              </div>
              <div>
                <div className={`font-bold ${isEarned ? 'text-white' : 'text-slate-500'}`}>{badge.label}</div>
                <div className="text-xs text-slate-500 mt-1">{badge.description}</div>
              </div>
              {isEarned && <Badge className="bg-yellow-500/20 text-yellow-500 border-none text-[10px] uppercase">Débloqué</Badge>}
            </Panel>
          );
        })}
      </div>
    </motion.div>
  );
}


const Lightbulb = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
);
