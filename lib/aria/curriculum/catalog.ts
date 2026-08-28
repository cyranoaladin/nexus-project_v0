/**
 * ARIA Curriculum Catalog — registre canonique versionné (P0).
 *
 * SOURCE DE VÉRITÉ UNIQUE des cours connus d'ARIA. Aucun composant React ni
 * aucune route ne doit redéfinir sa propre liste de matières.
 *
 * ── Règle anti-fake ──────────────────────────────────────────────────────────
 * Chaque capacité déclarée ici est adossée à un artefact réellement présent
 * dans le dépôt, à la date du P0 :
 *
 *  • `skillGraph`  → une définition compilée existe dans
 *                    `lib/diagnostics/definitions` (8 définitions au total :
 *                    maths/nsi × première/terminale, + 4 modules STMG première).
 *  • `rag`         → `lib/rag-client.ts` déclare le `RAGSubject` correspondant
 *                    (maths, nsi, physique_chimie, francais, svt, ses). Aucune
 *                    autre matière n'a de capacité RAG prouvée.
 *  • `resources`   → le Hub élève (`buildHub`) produit réellement une ressource
 *                    pour ce cours. `OFFICIAL_PDFS` étant un stub vide à ce
 *                    jour, seules les ressources INTERACTIVE_PROGRAM comptent.
 *  • `chat`        → l'enum `Subject` de `types/enums.ts` — celui que consomme
 *                    `/api/aria/chat` — contient une valeur pour ce cours.
 *
 * ── Vocabulaire de support réservé ───────────────────────────────────────────
 * `EXTERNAL` et `RESOURCES_ONLY` font partie du vocabulaire mais ne sont
 * attribués à aucun cours en P0 : aucun cours du dépôt ne remplit ces
 * conditions aujourd'hui. Ils ne sont pas inventés pour « remplir » le modèle.
 */

// Import TYPE-ONLY : les énumérations viennent du schéma Prisma (SSoT), et les
// valeurs sont écrites en littéraux — ce fichier reste importable côté client
// sans embarquer le client Prisma.
import type { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@prisma/client';
import {
  ARIA_CURRICULUM_VERSION,
  type AriaCapabilityProvenance,
  type AriaCourse,
  type AriaCourseCapabilities,
  type AriaCourseKey,
  type AriaCourseRole,
  type AriaCourseSupport,
  type AriaFeatureKey,
  type AriaRagSubject,
} from '@/lib/aria/contracts';

export const ARIA_CATALOG_VERSION = ARIA_CURRICULUM_VERSION;

/** Toutes les voies du lycée (tronc commun commun à toutes les séries). */
const ALL_LYCEE_TRACKS: readonly AcademicTrack[] = [
  'EDS_GENERALE',
  'STMG',
  'STMG_NON_LYCEEN',
  'STI2D',
  'ST2S',
  'STL',
  'STD2A',
];

/** Voies technologiques hors STMG (aucun module dédié catalogué en P0). */
const AUTRES_VOIES_TECHNO: readonly AcademicTrack[] = [
  'STI2D',
  'ST2S',
  'STL',
  'STD2A',
];

const STMG_TRACKS: readonly AcademicTrack[] = [
  'STMG',
  'STMG_NON_LYCEEN',
];

/**
 * DETTE P1 — mapping d'entitlement actuel, reproduit à l'identique.
 * `lib/access/features.ts` ne connaît que deux feature keys ARIA :
 * NSI → `aria_nsi`, tout le reste → `aria_maths`. P0 ne change rien.
 */
function featureFor(chatSubject: Subject | null): AriaFeatureKey {
  return chatSubject === 'NSI' ? 'aria_nsi' : 'aria_maths';
}

/** Dérive le niveau de support à partir des seules capacités prouvées. */
function deriveSupport(caps: AriaCourseCapabilities): AriaCourseSupport {
  const hasAnything = caps.skillGraph || caps.rag || caps.resources || caps.chat;
  if (!hasAnything) return 'COMING_SOON';

  if (caps.skillGraph && caps.rag && caps.chat) {
    return caps.chatSubjectIsApproximate ? 'PARTIAL' : 'FULL';
  }
  if (caps.skillGraph) return 'PARTIAL';
  if (caps.rag && caps.chat) {
    return caps.resources || caps.chatSubjectIsApproximate ? 'PARTIAL' : 'RAG_ONLY';
  }
  if (caps.rag) return 'RAG_ONLY';
  if (caps.resources) return 'RESOURCES_ONLY';
  // Chat généraliste seul : support réel mais sans aucune base Nexus.
  return 'PARTIAL';
}

function provenanceFor(caps: AriaCourseCapabilities): AriaCapabilityProvenance[] {
  const out: AriaCapabilityProvenance[] = ['NATIONAL_CURRICULUM'];
  if (caps.skillGraph) out.push('COMPILED_SKILL_GRAPH');
  if (caps.rag) out.push('RAG_CAPABILITY');
  if (caps.resources) out.push('HUB_RESOURCE');
  if (caps.chat) out.push('ARIA_CHAT_SUBJECT');
  return out;
}

interface CourseInput {
  key: AriaCourseKey;
  label: string;
  shortLabel: string;
  gradeLevel: GradeLevel;
  tracks: readonly AcademicTrack[];
  role: AriaCourseRole;
  specialty?: Subject;
  stmgPathways?: readonly StmgPathway[];
  chatSubject?: Subject | null;
  definitionKey?: string | null;
  ragSubject?: AriaRagSubject | null;
  hubResourceIds?: readonly string[];
  /** Vrai quand la matière chat/RAG est plus grossière que le cours réel. */
  approximate?: boolean;
  note?: string;
}

function makeCourse(input: CourseInput): AriaCourse {
  const chatSubject = input.chatSubject ?? null;
  const definitionKey = input.definitionKey ?? null;
  const ragSubject = input.ragSubject ?? null;
  const hubResourceIds = input.hubResourceIds ?? [];

  const capabilities: AriaCourseCapabilities = {
    skillGraph: definitionKey !== null,
    rag: ragSubject !== null,
    resources: hubResourceIds.length > 0,
    chat: chatSubject !== null,
    chatSubjectIsApproximate: input.approximate === true,
  };

  return {
    key: input.key,
    label: input.label,
    shortLabel: input.shortLabel,
    gradeLevel: input.gradeLevel,
    tracks: input.tracks,
    role: input.role,
    specialty: input.specialty,
    stmgPathways: input.stmgPathways,
    chatSubject,
    definitionKey,
    ragSubject,
    requiredFeature: featureFor(chatSubject),
    hubResourceIds,
    support: {
      level: deriveSupport(capabilities),
      capabilities,
      provenance: provenanceFor(capabilities),
      note: input.note,
    },
  };
}

/**
 * Note standard pour les cours dont le RAG existe mais n'est pas filtré par
 * niveau. Bug réel documenté (§26) : `ragSearch()` retombe sur la collection
 * `ressources_pedagogiques_terminale` par défaut. Correction prévue en P1.
 */
const NOTE_RAG_NIVEAU =
  "Base documentaire disponible, mais la recherche n'est pas encore filtrée par niveau (correctif prévu).";

const NOTE_CHAT_SEUL =
  "ARIA peut échanger sur cette matière, sans base documentaire Nexus ni graphe de compétences.";

const NOTE_AUCUN_SUPPORT =
  "Matière suivie en classe, pas encore outillée par ARIA.";

const NOTE_MODULE_STMG_APPROX =
  "Module STMG : le contexte transmis à ARIA reste la matière SES, plus large que le module.";

// ─── Collège ─────────────────────────────────────────────────────────────────

const COLLEGE_COURSES: AriaCourse[] = [
  makeCourse({
    key: 'maths-quatrieme',
    label: 'Mathématiques — Quatrième',
    shortLabel: 'Mathématiques',
    gradeLevel: 'QUATRIEME',
    tracks: ['COLLEGE'],
    role: 'CORE',
    note: NOTE_AUCUN_SUPPORT,
  }),
  makeCourse({
    key: 'francais-quatrieme',
    label: 'Français — Quatrième',
    shortLabel: 'Français',
    gradeLevel: 'QUATRIEME',
    tracks: ['COLLEGE'],
    role: 'CORE',
    note: NOTE_AUCUN_SUPPORT,
  }),
  makeCourse({
    key: 'maths-troisieme',
    label: 'Mathématiques — Troisième',
    shortLabel: 'Mathématiques',
    gradeLevel: 'TROISIEME',
    tracks: ['COLLEGE'],
    role: 'CORE',
    note: NOTE_AUCUN_SUPPORT,
  }),
  makeCourse({
    key: 'francais-troisieme',
    label: 'Français — Troisième',
    shortLabel: 'Français',
    gradeLevel: 'TROISIEME',
    tracks: ['COLLEGE'],
    role: 'CORE',
    note: NOTE_AUCUN_SUPPORT,
  }),
];

// ─── Seconde ─────────────────────────────────────────────────────────────────

const SECONDE_COURSES: AriaCourse[] = [
  makeCourse({
    key: 'maths-seconde',
    label: 'Mathématiques — Seconde',
    shortLabel: 'Mathématiques',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'MATHEMATIQUES',
    ragSubject: 'maths',
    note: NOTE_RAG_NIVEAU,
  }),
  makeCourse({
    key: 'francais-seconde',
    label: 'Français — Seconde',
    shortLabel: 'Français',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'FRANCAIS',
    ragSubject: 'francais',
    note: NOTE_RAG_NIVEAU,
  }),
  makeCourse({
    key: 'physique-chimie-seconde',
    label: 'Physique-Chimie — Seconde',
    shortLabel: 'Physique-Chimie',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'PHYSIQUE_CHIMIE',
    ragSubject: 'physique_chimie',
    note: NOTE_RAG_NIVEAU,
  }),
  makeCourse({
    key: 'svt-seconde',
    label: 'Sciences de la vie et de la Terre — Seconde',
    shortLabel: 'SVT',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'SVT',
    ragSubject: 'svt',
    note: NOTE_RAG_NIVEAU,
  }),
  makeCourse({
    key: 'ses-seconde',
    label: 'Sciences économiques et sociales — Seconde',
    shortLabel: 'SES',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'SES',
    ragSubject: 'ses',
    note: NOTE_RAG_NIVEAU,
  }),
  makeCourse({
    key: 'histoire-geo-seconde',
    label: 'Histoire-Géographie — Seconde',
    shortLabel: 'Histoire-Géo',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'HISTOIRE_GEO',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'anglais-seconde',
    label: 'Anglais — Seconde',
    shortLabel: 'Anglais',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'ANGLAIS',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'espagnol-seconde',
    label: 'Espagnol — Seconde',
    shortLabel: 'Espagnol',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'ESPAGNOL',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'emc-seconde',
    label: 'Enseignement moral et civique — Seconde',
    shortLabel: 'EMC',
    gradeLevel: 'SECONDE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    note: NOTE_AUCUN_SUPPORT,
  }),
];

// ─── Tronc commun Première (toutes voies) ────────────────────────────────────

const PREMIERE_CORE_COURSES: AriaCourse[] = [
  makeCourse({
    key: 'francais-premiere',
    label: 'Français — Première (épreuves anticipées)',
    shortLabel: 'Français / EAF',
    gradeLevel: 'PREMIERE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'FRANCAIS',
    ragSubject: 'francais',
    note: `${NOTE_RAG_NIVEAU} La préparation EAF dispose par ailleurs d'une plateforme Nexus dédiée.`,
  }),
  makeCourse({
    key: 'histoire-geo-premiere',
    label: 'Histoire-Géographie — Première',
    shortLabel: 'Histoire-Géo',
    gradeLevel: 'PREMIERE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'HISTOIRE_GEO',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'anglais-premiere',
    label: 'Anglais — Première',
    shortLabel: 'Anglais',
    gradeLevel: 'PREMIERE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'ANGLAIS',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'espagnol-premiere',
    label: 'Espagnol — Première',
    shortLabel: 'Espagnol',
    gradeLevel: 'PREMIERE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'ESPAGNOL',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'emc-premiere',
    label: 'Enseignement moral et civique — Première',
    shortLabel: 'EMC',
    gradeLevel: 'PREMIERE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    note: NOTE_AUCUN_SUPPORT,
  }),
];

// ─── Spécialités EDS ─────────────────────────────────────────────────────────

/**
 * Les 10 spécialités autorisées proviennent de `EDS_SPECIALTIES`
 * (`lib/validation/users.ts`) : c'est la liste réellement acceptée par la
 * validation du profil élève, donc la seule qui puisse apparaître dans
 * `Student.specialties`.
 */
interface SpecialtySpec {
  subject: Subject;
  slug: string;
  label: string;
  shortLabel: string;
  ragSubject?: AriaRagSubject;
  definitionKeyPremiere?: string;
  definitionKeyTerminale?: string;
}

const EDS_SPECIALTY_SPECS: readonly SpecialtySpec[] = [
  {
    subject: 'MATHEMATIQUES',
    slug: 'maths',
    label: 'Mathématiques',
    shortLabel: 'Maths',
    ragSubject: 'maths',
    definitionKeyPremiere: 'maths-premiere-p2',
    definitionKeyTerminale: 'maths-terminale-p2',
  },
  {
    subject: 'NSI',
    slug: 'nsi',
    label: 'Numérique et sciences informatiques',
    shortLabel: 'NSI',
    ragSubject: 'nsi',
    definitionKeyPremiere: 'nsi-premiere-p2',
    definitionKeyTerminale: 'nsi-terminale-p2',
  },
  {
    subject: 'PHYSIQUE_CHIMIE',
    slug: 'physique-chimie',
    label: 'Physique-Chimie',
    shortLabel: 'Physique-Chimie',
    ragSubject: 'physique_chimie',
  },
  {
    subject: 'SVT',
    slug: 'svt',
    label: 'Sciences de la vie et de la Terre',
    shortLabel: 'SVT',
    ragSubject: 'svt',
  },
  {
    subject: 'SES',
    slug: 'ses',
    label: 'Sciences économiques et sociales',
    shortLabel: 'SES',
    ragSubject: 'ses',
  },
  {
    subject: 'FRANCAIS',
    slug: 'francais',
    label: 'Français — spécialité',
    shortLabel: 'Français (spé)',
    ragSubject: 'francais',
  },
  {
    subject: 'PHILOSOPHIE',
    slug: 'philosophie',
    label: 'Philosophie — spécialité',
    shortLabel: 'Philosophie (spé)',
  },
  {
    subject: 'HISTOIRE_GEO',
    slug: 'histoire-geo',
    label: 'Histoire-Géographie — spécialité',
    shortLabel: 'Histoire-Géo (spé)',
  },
  {
    subject: 'ANGLAIS',
    slug: 'anglais',
    label: 'Anglais — spécialité',
    shortLabel: 'Anglais (spé)',
  },
  {
    subject: 'ESPAGNOL',
    slug: 'espagnol',
    label: 'Espagnol — spécialité',
    shortLabel: 'Espagnol (spé)',
  },
];

function buildSpecialtyCourses(
  gradeLevel: GradeLevel & ('PREMIERE' | 'TERMINALE'),
): AriaCourse[] {
  const suffix = gradeLevel === 'PREMIERE' ? 'premiere' : 'terminale';
  const levelLabel = gradeLevel === 'PREMIERE' ? 'Première' : 'Terminale';

  return EDS_SPECIALTY_SPECS.map((spec) => {
    const definitionKey =
      gradeLevel === 'PREMIERE'
        ? (spec.definitionKeyPremiere ?? null)
        : (spec.definitionKeyTerminale ?? null);

    const note = definitionKey
      ? gradeLevel === 'PREMIERE'
        ? NOTE_RAG_NIVEAU
        : undefined
      : spec.ragSubject
        ? NOTE_RAG_NIVEAU
        : NOTE_CHAT_SEUL;

    return makeCourse({
      key: `${spec.slug}-${suffix}-eds`,
      label: `${spec.label} — ${levelLabel} (spécialité)`,
      shortLabel: spec.shortLabel,
      gradeLevel,
      tracks: ['EDS_GENERALE'],
      role: 'SPECIALTY',
      specialty: spec.subject,
      chatSubject: spec.subject,
      definitionKey,
      ragSubject: spec.ragSubject ?? null,
      note,
    });
  });
}

// ─── Tronc commun Terminale ──────────────────────────────────────────────────

const TERMINALE_CORE_COURSES: AriaCourse[] = [
  makeCourse({
    key: 'philosophie-terminale',
    label: 'Philosophie — Terminale',
    shortLabel: 'Philosophie',
    gradeLevel: 'TERMINALE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'PHILOSOPHIE',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'histoire-geo-terminale',
    label: 'Histoire-Géographie — Terminale',
    shortLabel: 'Histoire-Géo',
    gradeLevel: 'TERMINALE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'HISTOIRE_GEO',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'anglais-terminale',
    label: 'Anglais — Terminale',
    shortLabel: 'Anglais',
    gradeLevel: 'TERMINALE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'ANGLAIS',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'espagnol-terminale',
    label: 'Espagnol — Terminale',
    shortLabel: 'Espagnol',
    gradeLevel: 'TERMINALE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    chatSubject: 'ESPAGNOL',
    note: NOTE_CHAT_SEUL,
  }),
  makeCourse({
    key: 'emc-terminale',
    label: 'Enseignement moral et civique — Terminale',
    shortLabel: 'EMC',
    gradeLevel: 'TERMINALE',
    tracks: ALL_LYCEE_TRACKS,
    role: 'CORE',
    note: NOTE_AUCUN_SUPPORT,
  }),
];

// ─── Options Terminale générale ──────────────────────────────────────────────

const TERMINALE_OPTION_COURSES: AriaCourse[] = [
  makeCourse({
    key: 'maths-complementaires-terminale',
    label: 'Mathématiques complémentaires — Terminale',
    shortLabel: 'Maths complémentaires',
    gradeLevel: 'TERMINALE',
    tracks: ['EDS_GENERALE'],
    role: 'OPTION',
    chatSubject: 'MATHEMATIQUES',
    ragSubject: 'maths',
  }),
  makeCourse({
    key: 'maths-expertes-terminale',
    label: 'Mathématiques expertes — Terminale',
    shortLabel: 'Maths expertes',
    gradeLevel: 'TERMINALE',
    tracks: ['EDS_GENERALE'],
    role: 'OPTION',
    // DETTE : `MATHS_EXPERTES` existe dans l'enum Prisma mais PAS dans
    // `types/enums.ts`, qui est l'enum consommé par /api/aria/chat.
    // La matière n'est donc pas transmissible au chat en l'état.
    note: "Option non encore transmissible au chat ARIA (matière absente de l'énumération utilisée par l'API).",
  }),
];

// ─── Modules STMG ────────────────────────────────────────────────────────────

const STMG_PREMIERE_COURSES: AriaCourse[] = [
  makeCourse({
    key: 'maths-premiere-stmg',
    label: 'Mathématiques — Première STMG',
    shortLabel: 'Maths STMG',
    gradeLevel: 'PREMIERE',
    tracks: STMG_TRACKS,
    role: 'TRACK_MODULE',
    chatSubject: 'MATHEMATIQUES',
    definitionKey: 'maths-premiere-stmg-p2',
    ragSubject: 'maths',
    hubResourceIds: [
      'interactive:maths-stmg',
      'interactive:maths-stmg-qcm',
      'interactive:maths-stmg-skill-graph',
    ],
    note: NOTE_RAG_NIVEAU,
  }),
  makeCourse({
    key: 'sgn-premiere-stmg',
    label: 'Sciences de gestion et numérique — Première STMG',
    shortLabel: 'SGN',
    gradeLevel: 'PREMIERE',
    tracks: STMG_TRACKS,
    role: 'TRACK_MODULE',
    chatSubject: 'SES',
    definitionKey: 'sgn-premiere-stmg-p2',
    ragSubject: 'ses',
    hubResourceIds: ['interactive:sgn-stmg'],
    approximate: true,
    note: NOTE_MODULE_STMG_APPROX,
  }),
  makeCourse({
    key: 'management-premiere-stmg',
    label: 'Management — Première STMG',
    shortLabel: 'Management',
    gradeLevel: 'PREMIERE',
    tracks: STMG_TRACKS,
    role: 'TRACK_MODULE',
    chatSubject: 'SES',
    definitionKey: 'management-premiere-stmg-p2',
    ragSubject: 'ses',
    hubResourceIds: ['interactive:management-stmg'],
    approximate: true,
    note: NOTE_MODULE_STMG_APPROX,
  }),
  makeCourse({
    key: 'droit-eco-premiere-stmg',
    label: 'Droit et Économie — Première STMG',
    shortLabel: 'Droit-Éco',
    gradeLevel: 'PREMIERE',
    tracks: STMG_TRACKS,
    role: 'TRACK_MODULE',
    chatSubject: 'SES',
    definitionKey: 'droit-eco-premiere-stmg-p2',
    ragSubject: 'ses',
    hubResourceIds: ['interactive:droit-eco-stmg'],
    approximate: true,
    note: NOTE_MODULE_STMG_APPROX,
  }),
];

const STMG_TERMINALE_COURSES: AriaCourse[] = [
  makeCourse({
    key: 'maths-terminale-stmg',
    label: 'Mathématiques — Terminale STMG',
    shortLabel: 'Maths STMG',
    gradeLevel: 'TERMINALE',
    tracks: STMG_TRACKS,
    role: 'TRACK_MODULE',
    chatSubject: 'MATHEMATIQUES',
    ragSubject: 'maths',
  }),
  makeCourse({
    key: 'management-sgn-terminale-stmg',
    label: 'Management, sciences de gestion et numérique — Terminale STMG',
    shortLabel: 'MSGN',
    gradeLevel: 'TERMINALE',
    tracks: STMG_TRACKS,
    role: 'TRACK_MODULE',
    chatSubject: 'SES',
    ragSubject: 'ses',
    approximate: true,
    note: NOTE_MODULE_STMG_APPROX,
  }),
  makeCourse({
    key: 'droit-eco-terminale-stmg',
    label: 'Droit et Économie — Terminale STMG',
    shortLabel: 'Droit-Éco',
    gradeLevel: 'TERMINALE',
    tracks: STMG_TRACKS,
    role: 'TRACK_MODULE',
    chatSubject: 'SES',
    ragSubject: 'ses',
    approximate: true,
    note: NOTE_MODULE_STMG_APPROX,
  }),
];

/** Parcours STMG de Terminale : visibles seulement pour le parcours de l'élève. */
const STMG_PATHWAY_COURSES: AriaCourse[] = (
  [
    ['RHC', 'rhc', 'Ressources humaines et communication'],
    ['MERCATIQUE', 'mercatique', 'Mercatique (marketing)'],
    ['GF', 'gf', 'Gestion et finance'],
    ['SIG', 'sig', "Systèmes d'information de gestion"],
  ] as const
).map(([pathway, slug, label]) =>
  makeCourse({
    key: `parcours-${slug}-terminale-stmg`,
    label: `${label} — Terminale STMG`,
    shortLabel: label,
    gradeLevel: 'TERMINALE',
    tracks: STMG_TRACKS,
    role: 'TRACK_MODULE',
    stmgPathways: [pathway],
    note: NOTE_AUCUN_SUPPORT,
  }),
);

// ─── Voies technologiques hors STMG ──────────────────────────────────────────

const AUTRES_TECHNO_COURSES: AriaCourse[] = [
  makeCourse({
    key: 'maths-premiere-techno',
    label: 'Mathématiques — Première technologique',
    shortLabel: 'Mathématiques',
    gradeLevel: 'PREMIERE',
    tracks: AUTRES_VOIES_TECHNO,
    role: 'TRACK_MODULE',
    chatSubject: 'MATHEMATIQUES',
    ragSubject: 'maths',
    note: NOTE_RAG_NIVEAU,
  }),
  makeCourse({
    key: 'maths-terminale-techno',
    label: 'Mathématiques — Terminale technologique',
    shortLabel: 'Mathématiques',
    gradeLevel: 'TERMINALE',
    tracks: AUTRES_VOIES_TECHNO,
    role: 'TRACK_MODULE',
    chatSubject: 'MATHEMATIQUES',
    ragSubject: 'maths',
  }),
];

// ─── Registre ────────────────────────────────────────────────────────────────

const ALL_COURSES: readonly AriaCourse[] = Object.freeze([
  ...COLLEGE_COURSES,
  ...SECONDE_COURSES,
  ...PREMIERE_CORE_COURSES,
  ...buildSpecialtyCourses('PREMIERE'),
  ...STMG_PREMIERE_COURSES,
  ...TERMINALE_CORE_COURSES,
  ...buildSpecialtyCourses('TERMINALE'),
  ...TERMINALE_OPTION_COURSES,
  ...STMG_TERMINALE_COURSES,
  ...STMG_PATHWAY_COURSES,
  ...AUTRES_TECHNO_COURSES,
]);

const COURSES_BY_KEY: ReadonlyMap<AriaCourseKey, AriaCourse> = new Map(
  ALL_COURSES.map((course) => [course.key, course]),
);

// Garde-fou : l'unicité des clés est une invariante du registre.
if (COURSES_BY_KEY.size !== ALL_COURSES.length) {
  const seen = new Set<string>();
  const duplicates = ALL_COURSES.map((c) => c.key).filter((k) => {
    if (seen.has(k)) return true;
    seen.add(k);
    return false;
  });
  throw new Error(`ARIA curriculum catalog: clés de cours dupliquées: ${duplicates.join(', ')}`);
}

// ─── API publique ────────────────────────────────────────────────────────────

/** Tous les cours du catalogue, dans l'ordre canonique. */
export function listAriaCourses(): readonly AriaCourse[] {
  return ALL_COURSES;
}

/** Recherche par clé. `null` si la clé est inconnue (jamais d'exception). */
export function getAriaCourse(key: string): AriaCourse | null {
  return COURSES_BY_KEY.get(key) ?? null;
}

/** `true` si la clé appartient au catalogue. Utilisé pour valider les entrées. */
export function isKnownAriaCourseKey(key: string): boolean {
  return COURSES_BY_KEY.has(key);
}

/** Ensemble des clés connues, pour validation Zod. */
export function listAriaCourseKeys(): readonly AriaCourseKey[] {
  return ALL_COURSES.map((course) => course.key);
}

/** Cours d'un couple (niveau × voie), indépendamment des spécialités suivies. */
export function listCoursesForGradeAndTrack(
  gradeLevel: GradeLevel,
  academicTrack: AcademicTrack,
): readonly AriaCourse[] {
  return ALL_COURSES.filter(
    (course) => course.gradeLevel === gradeLevel && course.tracks.includes(academicTrack),
  );
}

/** Matrice (niveau × voie) → nombre de cours catalogués. Utilisé par la doc et les tests. */
export function buildSupportedGradeTrackMatrix(): Record<string, number> {
  const matrix: Record<string, number> = {};
  for (const course of ALL_COURSES) {
    for (const track of course.tracks) {
      const key = `${course.gradeLevel}/${track}`;
      matrix[key] = (matrix[key] ?? 0) + 1;
    }
  }
  return matrix;
}

/** Répartition des cours par niveau de support. Utilisé par la doc et les tests. */
export function countCoursesBySupport(): Record<AriaCourseSupport, number> {
  const counts: Record<AriaCourseSupport, number> = {
    FULL: 0,
    PARTIAL: 0,
    RESOURCES_ONLY: 0,
    RAG_ONLY: 0,
    EXTERNAL: 0,
    COMING_SOON: 0,
  };
  for (const course of ALL_COURSES) counts[course.support.level] += 1;
  return counts;
}
