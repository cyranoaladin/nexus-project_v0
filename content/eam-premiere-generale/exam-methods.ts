import type { EamPremiereMethod } from "./types";

export const eamPremiereExamMethods: EamPremiereMethod[] = [
  {
    id: "time-boxing",
    title: "Gestion du temps",
    rule: "QCM en 18 minutes maximum, puis questions ouvertes en privilegiant les points surs.",
    checklist: ["Marquer les questions faciles", "Ne pas bloquer plus de 4 minutes", "Garder 8 minutes de relecture"],
  },
  {
    id: "minimal-writing",
    title: "Redaction minimale efficace",
    rule: "Une reponse ouverte doit contenir la formule, le calcul utile et la phrase finale.",
    checklist: ["Nommer la methode", "Garder les etapes visibles", "Conclure avec unite ou lieu"],
  },
  {
    id: "qcm-strategy",
    title: "QCM",
    rule: "Chercher l'elimination rapide, verifier les ordres de grandeur et ne pas sur-commenter.",
    checklist: ["Lire toutes les propositions", "Tester les pieges de signe", "Reporter proprement"],
  },
  {
    id: "final-review",
    title: "Relecture finale",
    rule: "Relire domaines, unites, arrondis, nature des extrema et probabilites totales.",
    checklist: ["Domaine correct", "Somme des probabilites controlee", "Phrase finale presente"],
  },
];
