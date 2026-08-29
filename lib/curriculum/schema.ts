/**
 * Schéma du catalogue d'enseignements (`data/curriculum/v1/*.json`).
 *
 * Le catalogue est de la DONNÉE VERSIONNÉE, pas du TypeScript : les faits
 * scolaires vivent dans `data/curriculum/`, le code reste générique. Ce schéma
 * est la frontière de validation ; il est strict pour qu'une donnée malformée
 * échoue bruyamment plutôt que de produire une carte scolaire fausse.
 */

import { z } from 'zod';

/** Clé stable d'enseignement : kebab-case ASCII, sans séparateur de chemin. */
export const COURSE_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Nature d'un enseignement.
 *
 * La distinction est structurante et n'admet aucune approximation :
 * un enseignement de tronc commun n'est PAS une spécialité, et un module de
 * voie technologique n'est pas une spécialité non plus.
 */
export const courseKindSchema = z.enum(['CORE', 'SPECIALTY', 'OPTION', 'TRACK_MODULE']);
export type CourseKind = z.infer<typeof courseKindSchema>;

/**
 * Nature d'une source.
 *
 * `OFFICIAL_*` n'est utilisable que pour une référence réellement officielle.
 * Un programme cartographié par Nexus ou un périmètre commercial ne peuvent
 * jamais se présenter comme une source du ministère.
 */
export const sourceKindSchema = z.enum([
  /** Programme publié par le ministère (BO / Eduscol), avec URL. */
  'OFFICIAL_PROGRAMME',
  /** Document officiel présent dans le dépôt, provenance vérifiée sur le fichier. */
  'REPO_OFFICIAL_DOCUMENT',
  /** Politique d'examen versionnée du dépôt, qui porte ses propres sources. */
  'OFFICIAL_EXAM_POLICY',
  /** Cartographie de programme produite par Nexus. N'est pas une source officielle. */
  'NEXUS_PROGRAMME_MAPPING',
  /** Périmètre commercial Nexus. N'est pas une source de programme. */
  'NEXUS_COMMERCIAL_SCOPE',
]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

/** Une source doit être atteignable : soit une URL, soit un fichier du dépôt. */
export const curriculumSourceSchema = z
  .object({
    id: z.string().regex(COURSE_KEY_PATTERN),
    kind: sourceKindSchema,
    label: z.string().min(1),
    publisher: z.string().min(1),
    url: z.string().url().optional(),
    repoRef: z.string().min(1).optional(),
    derivedFrom: z.string().min(1).optional(),
    note: z.string().optional(),
  })
  .strict()
  .refine((source) => source.url !== undefined || source.repoRef !== undefined, {
    message: 'Une source doit porter au moins une URL ou une référence de fichier du dépôt',
  });

export type CurriculumSource = z.infer<typeof curriculumSourceSchema>;

export const curriculumSourcesFileSchema = z
  .object({
    version: z.string().min(1),
    description: z.string().min(1),
    sources: z.array(curriculumSourceSchema).min(1),
  })
  .strict();

export const courseSchema = z
  .object({
    courseKey: z.string().regex(COURSE_KEY_PATTERN),
    label: z.string().min(1),
    longLabel: z.string().min(1),
    gradeLevel: z.enum([
      'QUATRIEME',
      'TROISIEME',
      'SECONDE',
      'PREMIERE',
      'TERMINALE',
      'POSTBAC',
      'AUTRE',
    ]),
    tracks: z
      .array(
        z.enum([
          'COLLEGE',
          'EDS_GENERALE',
          'STMG',
          'STI2D',
          'ST2S',
          'STL',
          'STD2A',
          'STMG_NON_LYCEEN',
        ]),
      )
      .min(1),
    kind: courseKindSchema,
    /**
     * Matière générique la plus proche, UNIQUEMENT pour l'interopérabilité avec
     * les données historiques indexées par l'enum `Subject` (bilans, documents).
     * Elle ne doit JAMAIS servir à router un chat ni une recherche documentaire :
     * c'est précisément cette confusion qui faisait passer SGN pour du SES.
     * `null` signifie « aucune matière générique ne représente ce cours ».
     */
    legacySubject: z
      .enum([
        'MATHEMATIQUES',
        'MATHS_EXPERTES',
        'NSI',
        'FRANCAIS',
        'PHILOSOPHIE',
        'HISTOIRE_GEO',
        'ANGLAIS',
        'ESPAGNOL',
        'PHYSIQUE_CHIMIE',
        'SVT',
        'SES',
      ])
      .nullable(),
    /** Clé d'une définition diagnostique compilée, si un graphe existe. */
    skillGraphRef: z.string().min(1).nullable(),
    /** Au moins une source : un cours non sourçable n'entre pas au catalogue. */
    sourceRefs: z.array(z.string().regex(COURSE_KEY_PATTERN)).min(1),
    /** Épreuves du baccalauréat rattachées, telles que nommées par la politique d'examen. */
    examEpreuveIds: z.array(z.string().min(1)).optional(),
    /**
     * Sélecteur vers le registre de programmes versionnés
     * (`lib/curriculum/registry`), qui porte les références BO datées et la
     * validité par année scolaire.
     *
     * Les identifiants de ce registre embarquent l'année du programme
     * (`fr-maths-premiere-speciality-2019` puis `-2026`) : ils changent à chaque
     * republication et ne peuvent donc pas servir de clé d'inscription. Le
     * catalogue porte la clé stable, le registre porte la version applicable —
     * ce sélecteur relie les deux sans les confondre.
     */
    programmeSelector: z
      .object({
        subject: z.enum(['MATHEMATICS', 'PHYSICS_CHEMISTRY', 'FRENCH', 'NSI', 'SNT']),
        level: z.enum(['TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE']),
        track: z.enum(['COLLEGE', 'GENERAL_TECHNOLOGICAL', 'GENERAL', 'TECHNOLOGICAL']),
        subjectVariant: z.enum([
          'COMMON',
          'SPECIALITY',
          'INTEGRATED_SCIENCE',
          'COMPLEMENTARY',
          'EXPERT_OVERLAY',
          'SNT_READINESS',
          'TRANSVERSAL_EXPRESSION',
        ]),
      })
      .strict()
      .optional(),
    /** Parcours STMG concernés. Absent = tous les parcours de la voie. */
    stmgPathways: z.array(z.enum(['RHC', 'MERCATIQUE', 'GF', 'SIG', 'INDETERMINE'])).optional(),
    /** Cours dont cette option dépend (ex. Maths expertes exige la spécialité Maths). */
    requiresCourseKey: z.string().regex(COURSE_KEY_PATTERN).optional(),
    note: z.string().optional(),
  })
  .strict();

export type CourseRecord = z.infer<typeof courseSchema>;

export const specialtyRuleSchema = z
  .object({
    maxSpecialties: z.number().int().min(1).max(5),
    sourceRefs: z.array(z.string().regex(COURSE_KEY_PATTERN)).min(1),
    note: z.string().optional(),
  })
  .strict();

export const curriculumCoursesFileSchema = z
  .object({
    version: z.string().min(1),
    description: z.string().min(1),
    specialtyRules: z.record(z.string(), specialtyRuleSchema),
    courses: z.array(courseSchema).min(1),
  })
  .strict();

export type CurriculumCoursesFile = z.infer<typeof curriculumCoursesFileSchema>;
