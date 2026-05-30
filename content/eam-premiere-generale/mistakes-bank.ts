import type { EamPremiereMistake } from "./types";

export const eamPremiereMistakesBank: EamPremiereMistake[] = [
  {
    id: "domain-table",
    domain: "Fonctions",
    trap: "Tableau de signes ou de variations plus large que le domaine donne.",
    repair: "Ecrire l'intervalle d'etude avant le tableau, puis borner toutes les colonnes.",
  },
  {
    id: "extrema-location",
    domain: "Fonctions",
    trap: "Donner la valeur d'un extremum sans dire ou elle est atteinte.",
    repair: "Toujours ecrire : valeur, abscisse, et type local ou absolu.",
  },
  {
    id: "conditional-denominator",
    domain: "Probabilites",
    trap: "Diviser par l'intersection au lieu de la condition.",
    repair: "Dans P_A(B), le denominateur est toujours P(A).",
  },
  {
    id: "successive-rates",
    domain: "Automatismes",
    trap: "Additionner deux taux successifs.",
    repair: "Transformer chaque taux en coefficient, multiplier les coefficients, puis revenir en taux.",
  },
  {
    id: "expectation-meaning",
    domain: "Variables aleatoires",
    trap: "Calculer une esperance sans phrase d'interpretation.",
    repair: "Ajouter une phrase : sur un grand nombre de parties, le gain moyen vaut ...",
  },
  {
    id: "silent-jump",
    domain: "Redaction",
    trap: "Sauter une etape evidente pour soi mais invisible pour le correcteur.",
    repair: "Appliquer la regle du correcteur muet : chaque ligne doit se deduire de la precedente.",
  },
];
