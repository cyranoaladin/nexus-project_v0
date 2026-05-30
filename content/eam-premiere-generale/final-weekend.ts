import type { EamPremiereWeekendDay } from "./types";

export const EAM_PREMIERE_FINAL_WEEKEND: EamPremiereWeekendDay[] = [
  {
    date: "2026-06-06",
    label: "Samedi 6 juin",
    intent: "Reactivation courte et controlee.",
    actions: [
      "Refaire les automatismes rates deux fois pendant le sprint.",
      "Relire la grille de relecture finale.",
      "Traiter un mini-sujet de 45 minutes sans chercher la difficulte maximale.",
    ],
    forbidden: ["Demarrer un nouveau chapitre", "Faire trois heures de suite", "Corriger sans noter l'erreur type"],
  },
  {
    date: "2026-06-07",
    label: "Dimanche 7 juin",
    intent: "Consolidation legere et baisse de charge.",
    actions: [
      "Relire les fiches methodes.",
      "Faire 10 questions faciles pour rester fluide.",
      "Preparer materiel, heure de depart et strategie de temps.",
    ],
    forbidden: ["Sujet blanc complet tardif", "Revision panique", "Changer toute la methode"],
  },
];
