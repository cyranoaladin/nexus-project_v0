/**
 * Bibliothèque de ressources UTICA 2026 (P3 §8-9) — modèle riche, distinct
 * du `DemoResource` existant (types.ts, P1B, liste "Mes ressources" simple,
 * inchangé pour ne pas perturber ce fold déjà accepté). Ce catalogue
 * alimente le nouveau mini-hub bibliothèque, la vue de détail par slug et le
 * pont ARIA.
 *
 * Provenance (P3 §1/§22) — chaque entrée `origin: 'NEXUS_CONTENT'` est une
 * ADAPTATION fidèle d'un chapitre réel de `app/programme/maths-terminale/
 * data.ts` (Terminale Spé Maths, EDS) ou du référentiel de compétences réel
 * `programmes/generated/nsi_terminale.skills.generated.json`, jamais
 * inventée. Le contenu LaTeX/HTML source n'est pas rendu tel quel ici
 * (`app/programme/maths-terminale` charge MathJax depuis un CDN externe —
 * incompatible avec l'invariant "0 dépendance réseau critique" du
 * démonstrateur, vérifié dès P0) : chaque texte est retranscrit en Unicode
 * lisible, sans dangerouslySetInnerHTML — voir
 * `__tests__/demo/utica-2026/resource-provenance.test.ts` pour la preuve de
 * traçabilité vers le fichier source réel.
 *
 * `sourceRef` est un identifiant interne de test, jamais affiché au
 * visiteur (P3 §22) — seul `sourceLabel` (libellé sobre) est rendu.
 */
import type { DemoResource as LegacyDemoResource } from './types';

export type ResourceSubject = 'MATHEMATIQUES' | 'NSI' | 'FRANCAIS' | 'METHODE';
export type ResourceType = 'COURSE' | 'METHOD' | 'EXERCISE' | 'QCM' | 'CHECKLIST' | 'INTERACTIVE' | 'EXTERNAL_PLATFORM';
export type ResourceOrigin = 'NEXUS_CONTENT' | 'NEXUS_CREATED_FOR_PATH' | 'OFFICIAL_PUBLIC' | 'EAF_PLATFORM';

export interface ResourceSection {
  heading: string;
  paragraphs: string[];
}

export interface ResourceQcmQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ResourceChecklistItem {
  id: string;
  label: string;
}

export interface ResourceGuidedExercise {
  enonce: string;
  attendu: string;
  correction: string;
}

export interface CatalogResource {
  id: string;
  slug: string;
  title: string;
  subject: ResourceSubject;
  level: string;
  type: ResourceType;
  origin: ResourceOrigin;
  /** Compétences ciblées (P1C : resource → competencyIds), jamais une ressource orpheline. */
  competencyIds: string[];
  /** Relie la ressource au focus pédagogique central quand applicable. */
  focusId?: string;
  durationMinutes?: number;
  description: string;
  /** Réponse courte à "Pourquoi cette ressource ?" (P3 §28). */
  preview: string;
  sections?: ResourceSection[];
  qcm?: ResourceQcmQuestion[];
  checklist?: ResourceChecklistItem[];
  exercise?: ResourceGuidedExercise;
  /** Identifiant interne de traçabilité — jamais affiché au visiteur. */
  sourceRef: string;
  /** Libellé sobre affiché au visiteur (P3 §22). */
  sourceLabel: string;
  cta: string;
  /** Phrase courte pour le pont ARIA (P3 §13). */
  ariaContext: string;
  externalUrl?: string;
}

const FOCUS_SIGNE_DERIVEE = 'focus-maths-signe-derivee';

export const resourceCatalog: CatalogResource[] = [
  // ── Mathématiques — ressource principale, alignée sur le focus de Lina ──
  {
    id: 'maths-b3-derivation',
    slug: 'complements-derivation-variations',
    title: 'Compléments dérivation — variations, tangentes, convexité',
    subject: 'MATHEMATIQUES',
    level: 'Terminale',
    type: 'COURSE',
    origin: 'NEXUS_CONTENT',
    competencyIds: ['c-maths-signe-derivee', 'c-maths-derivees'],
    focusId: FOCUS_SIGNE_DERIVEE,
    durationMinutes: 15,
    description: 'Signe de f\', f\'\', tangente, point d\'inflexion.',
    preview: 'Relié directement à ton point de travail actuel : le signe de la dérivée.',
    sections: [
      {
        heading: 'Rappel',
        paragraphs: [
          'Les variations d\'une fonction se lisent sur le signe de sa dérivée f\'.',
          'Équation de la tangente au point d\'abscisse a : y = f\'(a)·(x − a) + f(a).',
          'La convexité se lit sur le signe de la dérivée seconde f\'\'.',
        ],
      },
      {
        heading: 'Méthode',
        paragraphs: [
          '1. Calculer f\', puis la factoriser si possible.',
          '2. Étudier le signe de f\' pour construire le tableau de variations.',
          '3. Étudier f\'\' pour repérer un éventuel point d\'inflexion.',
        ],
      },
      {
        heading: 'Erreurs classiques',
        paragraphs: [
          'Résoudre « ln x = 0 » au lieu de l\'équation réellement posée par f\'.',
          'Oublier le domaine de définition (ici x > 0).',
          'Se tromper dans le calcul de f\'\'.',
          'Formuler une tangente sans repartir de la vraie formule.',
        ],
      },
    ],
    exercise: {
      enonce: 'f(x) = x² · ln(x) sur ]0 ; +∞[. Étudier les variations de f.',
      attendu: 'Calculer f\'(x), la factoriser, puis étudier son signe.',
      correction:
        'f\'(x) = x·(2 ln x + 1). f décroît sur ]0 ; e^(−1/2)], puis croît sur [e^(−1/2) ; +∞[.',
    },
    sourceRef: 'app/programme/maths-terminale/data.ts#B3-derivation',
    sourceLabel: 'Programme Terminale — Analyse',
    cta: 'Ouvrir le chapitre',
    ariaContext: 'Compléments dérivation — variations, tangentes, convexité',
  },
  {
    id: 'maths-fiche-signe-derivee',
    slug: 'fiche-methode-signe-derivee',
    title: 'Fiche méthode — passer du signe de f\' au tableau de variations',
    subject: 'MATHEMATIQUES',
    level: 'Terminale',
    type: 'METHOD',
    origin: 'NEXUS_CREATED_FOR_PATH',
    competencyIds: ['c-maths-signe-derivee'],
    focusId: FOCUS_SIGNE_DERIVEE,
    durationMinutes: 8,
    description: 'Fiche courte, créée par Nexus pour ce point de travail précis.',
    preview: 'Une version condensée de la méthode, pour réviser juste avant l\'exercice.',
    sections: [
      {
        heading: 'Les 3 réflexes',
        paragraphs: [
          '① f\'(x) > 0 sur un intervalle ⇒ f croissante sur cet intervalle.',
          '② f\'(x) < 0 sur un intervalle ⇒ f décroissante sur cet intervalle.',
          '③ f\'(x) = 0 en un point isolé ⇒ extremum local (à confirmer par le tableau de signe).',
        ],
      },
      {
        heading: 'Checklist avant de conclure',
        paragraphs: [
          'Le domaine de définition est-il posé avant de commencer ?',
          'f\' est-elle factorisée avant l\'étude de signe ?',
          'Le tableau de variations reprend-il exactement les bornes du domaine ?',
        ],
      },
    ],
    sourceRef: 'derived:app/programme/maths-terminale/data.ts#B3-derivation:methodesHtml',
    sourceLabel: 'Contenu Nexus',
    cta: 'Ouvrir la fiche',
    ariaContext: 'Fiche méthode — signe de f\' et tableau de variations',
  },
  {
    id: 'maths-qcm-signe-derivee',
    slug: 'mini-qcm-signe-derivee',
    title: 'Mini-QCM — signe de la dérivée',
    subject: 'MATHEMATIQUES',
    level: 'Terminale',
    type: 'QCM',
    origin: 'NEXUS_CREATED_FOR_PATH',
    competencyIds: ['c-maths-signe-derivee'],
    focusId: FOCUS_SIGNE_DERIVEE,
    durationMinutes: 5,
    description: '3 questions pour vérifier le réflexe signe → variations.',
    preview: 'Un test rapide, créé par Nexus, pour confirmer que le réflexe est acquis.',
    qcm: [
      {
        id: 'q1',
        question: 'Si f\'(x) < 0 sur un intervalle I, que peut-on dire de f sur I ?',
        options: ['f est croissante sur I', 'f est décroissante sur I', 'f est constante sur I', 'On ne peut rien dire'],
        correctIndex: 1,
        explanation: 'Le signe négatif de f\' sur I signifie que f est décroissante sur I.',
      },
      {
        id: 'q2',
        question: 'Pour f(x) = x²·ln(x), quelle est la première étape correcte ?',
        options: [
          'Résoudre ln(x) = 0',
          'Calculer et factoriser f\'(x)',
          'Tracer directement la courbe',
          'Calculer f\'\'(x) en premier',
        ],
        correctIndex: 1,
        explanation: 'On calcule toujours f\' en premier, puis on la factorise pour étudier son signe.',
      },
      {
        id: 'q3',
        question: 'f\'(x) = x·(2 ln x + 1) sur ]0 ; +∞[. Où f\' s\'annule-t-elle ?',
        options: ['x = 0', 'x = e^(−1/2)', 'x = e', 'Jamais'],
        correctIndex: 1,
        explanation: '2 ln x + 1 = 0 ⇔ ln x = −1/2 ⇔ x = e^(−1/2) (x = 0 est exclu du domaine).',
      },
    ],
    sourceRef: 'derived:app/programme/maths-terminale/data.ts#B3-derivation',
    sourceLabel: 'Contenu Nexus',
    cta: 'Faire le QCM',
    ariaContext: 'Mini-QCM — signe de la dérivée',
  },
  {
    id: 'maths-checklist-etude-fonction',
    slug: 'checklist-bac-etude-fonction',
    title: 'Checklist Bac — étude de fonction',
    subject: 'MATHEMATIQUES',
    level: 'Terminale',
    type: 'CHECKLIST',
    origin: 'NEXUS_CONTENT',
    competencyIds: ['c-maths-signe-derivee', 'c-maths-derivees'],
    durationMinutes: 3,
    description: 'Les points de vigilance systématiquement attendus le jour du Bac.',
    preview: 'Une checklist réelle du programme, à cocher avant de rendre une copie.',
    checklist: [
      { id: 'domaine', label: 'Domaine de définition écrit explicitement' },
      { id: 'theoreme', label: 'Théorème ou propriété utilisé cité' },
      { id: 'equation', label: 'Équation exacte posée puis résolue' },
      { id: 'conclusion', label: 'Conclusion rédigée en français' },
      { id: 'arrondi', label: 'Arrondi conforme à la consigne' },
      { id: 'point-final', label: 'Réponse finale clairement donnée' },
    ],
    sourceRef: 'app/programme/maths-terminale/data.ts#checklistBase',
    sourceLabel: 'Programme Terminale — Analyse',
    cta: 'Ouvrir la checklist',
    ariaContext: 'Checklist Bac — étude de fonction',
  },
  {
    id: 'maths-b2-limites',
    slug: 'limites-de-fonctions',
    title: 'Limites de fonctions',
    subject: 'MATHEMATIQUES',
    level: 'Terminale',
    type: 'COURSE',
    origin: 'NEXUS_CONTENT',
    competencyIds: ['c-maths-derivees'],
    durationMinutes: 12,
    description: 'Limites en un point ou à l\'infini, asymptotes, formes indéterminées.',
    preview: 'Un chapitre prérequis utile pour bien poser une étude de fonction complète.',
    sections: [
      {
        heading: 'Rappel',
        paragraphs: [
          'Asymptote verticale : limite infinie en un point.',
          'Asymptote horizontale : limite finie en +∞ ou −∞.',
          'Formes 0/0 ou ∞/∞ : traiter par transformation (terme dominant, factorisation…).',
        ],
      },
      {
        heading: 'Méthode',
        paragraphs: [
          '1. Identifier la forme de la limite.',
          '2. Transformer l\'expression (terme dominant, quantité conjuguée…).',
          '3. Conclure et donner l\'équation de l\'asymptote si utile.',
        ],
      },
    ],
    exercise: {
      enonce: 'Calculer la limite en +∞ de (3x² − 1) / (2x² + 5).',
      attendu: 'Diviser numérateur et dénominateur par x².',
      correction: 'La limite vaut 3/2 ; la courbe admet l\'asymptote horizontale y = 3/2.',
    },
    sourceRef: 'app/programme/maths-terminale/data.ts#B2-limites',
    sourceLabel: 'Programme Terminale — Analyse',
    cta: 'Ouvrir le chapitre',
    ariaContext: 'Limites de fonctions',
  },
  {
    id: 'maths-b1-suites',
    slug: 'suites-convergence-limites',
    title: 'Suites : convergence, limites, seuils',
    subject: 'MATHEMATIQUES',
    level: 'Terminale',
    type: 'COURSE',
    origin: 'NEXUS_CONTENT',
    competencyIds: ['c-maths-derivees'],
    durationMinutes: 12,
    description: 'Monotonie, bornes, point fixe, seuils.',
    preview: 'Un autre chapitre du programme, utile pour varier les types de raisonnement travaillés.',
    sections: [
      {
        heading: 'Rappel',
        paragraphs: [
          'Une suite croissante et majorée converge.',
          'Pour une récurrence u(n+1) = f(u(n)) : étudier stabilité de l\'intervalle puis monotonie.',
          'Si u(n) tend vers ℓ, alors ℓ = f(ℓ) (point fixe).',
        ],
      },
      {
        heading: 'Méthode',
        paragraphs: [
          '1. Montrer l\'encadrement (intervalle stable).',
          '2. Montrer la monotonie de la suite.',
          '3. Conclure par le point fixe, en excluant les limites impossibles.',
        ],
      },
    ],
    sourceRef: 'app/programme/maths-terminale/data.ts#B1-suites',
    sourceLabel: 'Programme Terminale — Analyse',
    cta: 'Ouvrir le chapitre',
    ariaContext: 'Suites : convergence, limites, seuils',
  },

  // ── NSI — cohérent avec le chapitre suivi par Lina (Structures de données) ──
  //
  // Provenance auditée (P3.1 §4-6) : programmes/mapping/nsi_terminale.
  // skills.map.yml et son dérivé programmes/generated/nsi_terminale.skills.
  // generated.json sont un mapping de compétences INTERNE à Nexus (utilisé
  // par le diagnostic pré-stage — voir l'en-tête du YAML), sans aucun champ
  // source/url/référence BO-Éduscol dans leur schéma ou leurs métadonnées
  // (vérifié : programmes/mapping/skills.schema.json ne modélise aucun tel
  // champ). Aucun claim "officiel" n'est donc fait ici — origin reste
  // NEXUS_CONTENT, jamais OFFICIAL_PUBLIC — voir
  // resource-provenance.test.ts::nsi-provenance pour la preuve négative.
  {
    id: 'nsi-programme-structures-donnees',
    slug: 'programme-nsi-structures-donnees',
    title: 'NSI Terminale — Structures de données',
    subject: 'NSI',
    level: 'Terminale',
    type: 'COURSE',
    origin: 'NEXUS_CONTENT',
    competencyIds: ['c-nsi-types-construits', 'c-nsi-listes-chainees', 'c-nsi-piles-files'],
    durationMinutes: 6,
    description: 'Compétences et notions du parcours Nexus pour le chapitre actuellement suivi par Lina.',
    preview: 'Le référentiel de compétences du chapitre en cours, pour situer où en est le travail.',
    sections: [
      {
        heading: 'Compétences du domaine',
        paragraphs: [
          'Types de base & construits',
          'Tables de vérité / Booléens',
          'Représentation binaire/héxa',
          'Traitement de données (CSV)',
          'Arbres binaires',
          'Graphes (DFS/BFS)',
          'Listes chaînées',
          'Piles & Files',
        ],
      },
    ],
    sourceRef: 'programmes/mapping/nsi_terminale.skills.map.yml#data_structures',
    sourceLabel: 'NSI Terminale — compétences du parcours Nexus',
    cta: 'Voir le programme',
    ariaContext: 'NSI Terminale — Structures de données',
  },
  {
    id: 'nsi-fiche-piles-files',
    slug: 'fiche-reactivation-piles-files',
    title: 'Fiche de réactivation — piles et files',
    subject: 'NSI',
    level: 'Terminale',
    type: 'METHOD',
    origin: 'NEXUS_CREATED_FOR_PATH',
    competencyIds: ['c-nsi-piles-files'],
    durationMinutes: 6,
    description: 'Fiche courte créée par Nexus pour réactiver la compétence "Piles et files".',
    preview: 'La prochaine étape prévue pour Lina en NSI : reprendre piles et files.',
    sections: [
      {
        heading: 'À retenir',
        paragraphs: [
          'Une pile (stack) fonctionne en LIFO : dernier entré, premier sorti.',
          'Une file (queue) fonctionne en FIFO : premier entré, premier sorti.',
          'Opérations clés : empiler/défiler (push/pop) pour une pile, enfiler/défiler (enqueue/dequeue) pour une file.',
        ],
      },
      {
        heading: 'Erreur classique',
        paragraphs: ['Confondre l\'ordre de sortie d\'une pile (LIFO) et celui d\'une file (FIFO).'],
      },
    ],
    sourceRef: 'derived:programmes/generated/nsi_terminale.skills.generated.json#data_structures:Piles & Files',
    sourceLabel: 'Contenu Nexus',
    cta: 'Ouvrir la fiche',
    ariaContext: 'Fiche de réactivation — piles et files',
  },

  // ── Passerelle EAF (P3 §18-20) ──
  {
    id: 'eaf-plateforme',
    slug: 'plateforme-eaf',
    title: 'Français — EAF',
    subject: 'FRANCAIS',
    level: 'Première / Terminale',
    type: 'EXTERNAL_PLATFORM',
    origin: 'EAF_PLATFORM',
    competencyIds: [],
    description: 'Plateforme Nexus Réussite dédiée à l\'épreuve anticipée de français.',
    preview: 'Une plateforme Nexus séparée, dédiée à l\'écrit et à l\'oral de l\'EAF.',
    sections: [
      {
        heading: 'Ce que propose la plateforme',
        paragraphs: [
          'Écrit — dépôt de production, correction structurée.',
          'Oral — format officiel, barème /2 /8 /2 /8.',
          'Corpus et citations — sources officielles (BO, Éduscol, rapports de jury).',
          'Langue et quiz adaptatif — ciblés sur les points faibles identifiés.',
        ],
      },
    ],
    sourceRef: 'external:https://eaf.nexusreussite.academy',
    sourceLabel: 'Plateforme EAF Nexus',
    cta: 'Ouvrir la plateforme EAF',
    ariaContext: 'Plateforme EAF Nexus',
    externalUrl: 'https://eaf.nexusreussite.academy',
  },
];

export function getResourceCatalog(): CatalogResource[] {
  return resourceCatalog;
}

/** Allowlist stricte : jamais de lecture arbitraire de fichier depuis un slug. */
export function getResourceBySlug(slug: string): CatalogResource | undefined {
  return resourceCatalog.find((r) => r.slug === slug);
}

export function getResourceById(id: string): CatalogResource | undefined {
  return resourceCatalog.find((r) => r.id === id);
}

/** Ressource recommandée pour le focus pédagogique central (P1C : focus → resource). */
export function getRecommendedCatalogResource(): CatalogResource {
  const byFocus = resourceCatalog.find((r) => r.focusId === FOCUS_SIGNE_DERIVEE && r.type === 'COURSE');
  if (!byFocus) {
    throw new Error('Aucune ressource ne cible le focus pédagogique central — catalogue incohérent.');
  }
  return byFocus;
}

const CATALOG_TYPE_TO_LEGACY_TYPE: Record<ResourceType, LegacyDemoResource['type']> = {
  COURSE: 'FICHE',
  METHOD: 'FICHE',
  EXERCISE: 'EXERCICE',
  QCM: 'QCM',
  CHECKLIST: 'FICHE',
  INTERACTIVE: 'EXERCICE',
  EXTERNAL_PLATFORM: 'FICHE',
};

/**
 * Projection P3.1 §3 (source unique de vérité) — dérive la forme "résumé"
 * consommée par l'ancienne liste simple (StudentResourcesCard,
 * `demoScenario.resources`, P1B) à partir d'une `CatalogResource` réelle.
 * Élimine la duplication manuelle de titre/compétences entre les deux
 * systèmes : `demoScenario.resources` n'écrit plus lui-même ces champs pour
 * toute ressource ayant un équivalent dans le catalogue riche — voir
 * scenario.ts.
 */
export function catalogResourceToStudentSummary(resource: CatalogResource): LegacyDemoResource {
  return {
    id: resource.id,
    subject: resource.subject as LegacyDemoResource['subject'],
    title: resource.title,
    type: CATALOG_TYPE_TO_LEGACY_TYPE[resource.type],
    recommendedBecause: resource.preview,
    competencyIds: resource.competencyIds,
  };
}
