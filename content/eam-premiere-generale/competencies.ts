import type { EamPremiereCompetency } from "./types";

export const eamPremiereCompetencies: EamPremiereCompetency[] = [
  {
    id: "automatismes",
    label: "Automatismes",
    target: "QCM sans calculatrice : pourcentages, equations, signes, probabilites directes.",
    level: 82,
    checkpoint: "12 questions en 18 minutes avec justification mentale rapide.",
  },
  {
    id: "fonctions",
    label: "Fonctions",
    target: "Lire, deriver, dresser un tableau et conclure sur variations ou extrema.",
    level: 74,
    checkpoint: "Un tableau borne sur le bon domaine et une conclusion complete.",
  },
  {
    id: "suites",
    label: "Suites",
    target: "Identifier le modele, ecrire le terme general, gerer un seuil par boucle ou tableau.",
    level: 72,
    checkpoint: "Nature, premier terme, raison et interpretation du rang.",
  },
  {
    id: "probabilites",
    label: "Probabilites",
    target: "Arbre pondere, intersection, conditionnement et probabilites totales.",
    level: 76,
    checkpoint: "Chaque probabilite rattachee a un chemin ou a une formule.",
  },
  {
    id: "variables-aleatoires",
    label: "Variables aleatoires",
    target: "Construire une loi, calculer esperance et interpreter le gain moyen.",
    level: 68,
    checkpoint: "Tableau complet et somme des probabilites controlee.",
  },
  {
    id: "lecture-graphique",
    label: "Lecture graphique",
    target: "Distinguer intersection simple, contact tangent, maximum et minimum.",
    level: 70,
    checkpoint: "Nommer la nature du point lu, pas seulement sa valeur.",
  },
  {
    id: "redaction",
    label: "Redaction",
    target: "Ecrire court, exact, sans saut logique et avec les mots attendus.",
    level: 66,
    checkpoint: "Une derniere phrase ferme chaque reponse ouverte.",
  },
  {
    id: "strategie-examen",
    label: "Strategie d'examen",
    target: "Prendre les points surs, gerer le temps et relire les unites.",
    level: 80,
    checkpoint: "QCM en 18 minutes, puis questions rentables avant blocages.",
  },
];
