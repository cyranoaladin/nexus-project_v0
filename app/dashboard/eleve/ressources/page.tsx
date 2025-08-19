"use client";

import { Subject } from "@/types/enums";

const SUBJECTS_OPTIONS = [
  { value: "all", label: "Toutes les matières" },
  { value: Subject.MATHEMATIQUES, label: "Mathématiques" },
  { value: Subject.NSI, label: "NSI" },
  { value: Subject.FRANCAIS, label: "Français" },
  { value: Subject.PHILOSOPHIE, label: "Philosophie" },
  { value: Subject.HISTOIRE_GEO, label: "Histoire-Géographie" },
  { value: Subject.ANGLAIS, label: "Anglais" },
  { value: Subject.ESPAGNOL, label: "Espagnol" },
  { value: Subject.PHYSIQUE_CHIMIE, label: "Physique-Chimie" },
  { value: Subject.SVT, label: "SVT" },
  { value: Subject.SES, label: "SES" }
];

const MOCK_RESOURCES = [
  {
    id: "1",
    title: "Fiche de révision : Les dérivées",
    subject: Subject.MATHEMATIQUES,
    type: "Fiche",
    description: "Toutes les formules et méthodes essentielles",
    lastUpdated: "Il y a 2 jours",
    downloads: 156
  },
  {
    id: "2",
    title: "Exercices corrigés : Algorithmes Python",
    subject: Subject.NSI,
    type: "Exercices",
    description: "20 exercices progressifs avec corrections détaillées",
    lastUpdated: "Il y a 1 semaine",
    downloads: 89
  },
  {
    id: "3",
    title: "Méthodologie : La dissertation",
    subject: Subject.FRANCAIS,
    type: "Méthode",
    description: "Plan type et conseils pour réussir",
    lastUpdated: "Il y a 3 jours",
    downloads: 234
  },
  {
    id: "4",
    title: "Quiz interactif : Fonctions exponentielles",
    subject: Subject.MATHEMATIQUES,
    type: "Quiz",
    description: "15 questions pour tester vos connaissances",
    lastUpdated: "Il y a 5 jours",
    downloads: 67
  }
];

interface Resource {
  id: string;
  title: string;
  description: string;
  subject: string;
  type: string;
  fileUrl: string;
  thumbnailUrl?: string;
  downloads: number;
  lastUpdated: string;
  isDownloaded: boolean;
}

export default function EleveRessourcesPage() {
  return (
    <div>
      <h1>Ressources Pédagogiques</h1>
      <p>Cette page est en cours de construction.</p>
    </div>
  );
}
