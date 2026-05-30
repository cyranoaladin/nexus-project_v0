import type { EamPremiereQcmItem } from "./types";

export const eamPremiereQcmAutomatismes: EamPremiereQcmItem[] = [
  {
    id: "qcm-rate-1",
    prompt: "Une quantite baisse de 20 %, puis augmente de 25 %. Quel est le taux global ?",
    answer: "0 %",
    correction: "Les coefficients sont 0,80 puis 1,25 ; leur produit vaut 1.",
    competency: "automatismes",
  },
  {
    id: "qcm-slope-1",
    prompt: "La droite passant par A(1 ; 2) et B(3 ; 8) a quel coefficient directeur ?",
    answer: "3",
    correction: "Variation verticale 6, variation horizontale 2, donc 6/2.",
    competency: "lecture-graphique",
  },
  {
    id: "qcm-proba-1",
    prompt: "Si P(A)=0,4 et P_A(B)=0,7, combien vaut P(A inter B) ?",
    answer: "0,28",
    correction: "Intersection = probabilite de A fois probabilite de B sachant A.",
    competency: "probabilites",
  },
  {
    id: "qcm-square-1",
    prompt: "Solutions de x^2=7 dans R ?",
    answer: "-√7 et √7",
    correction: "Un carre positif donne deux solutions opposees.",
    competency: "automatismes",
  },
  {
    id: "qcm-derivative-1",
    prompt: "Si f'(x)>0 sur [1;4], que peut-on conclure ?",
    answer: "f est croissante sur [1;4]",
    correction: "Le signe de la derivee donne le sens de variation sur l'intervalle.",
    competency: "fonctions",
  },
];
