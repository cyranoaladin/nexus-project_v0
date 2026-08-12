import { z } from 'zod';

/**
 * Schéma de sortie du brief enseignant — version teacher-brief.v1.
 *
 * Validation zod STRICTE : une sortie non conforme est rejetée, jamais
 * rafistolée. Le contenu habille le diagnostic déterministe ; il ne porte
 * ni score ni profil recalculé — les profils n'y figurent que comme rappel
 * du fait mesuré, injecté par NOS soins dans le payload, jamais réinventé.
 */

export const TEACHER_BRIEF_PROMPT_VERSION = 'teacher-brief.v1' as const;

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

const erreurTypiqueSchema = z.object({
  constat: nonEmpty(400),
  origine: nonEmpty(400),
  itemIds: z.array(nonEmpty(64)).min(1).max(4),
}).strict();

const phaseSchema = z.object({
  nom: nonEmpty(80),
  dureeMin: z.number().int().min(2).max(40),
  consigne: nonEmpty(600),
}).strict();

const activiteSchema = z.object({
  titre: nonEmpty(160),
  objectif: nonEmpty(300),
  materiel: nonEmpty(300),
  deroule: z.array(phaseSchema).min(3).max(5),
  differenciation: nonEmpty(400),
}).strict();

const domaineBriefSchema = z.object({
  domainId: nonEmpty(64),
  erreursTypiques: z.array(erreurTypiqueSchema).min(1).max(3),
  prerequisAVerifier: z.array(nonEmpty(240)).min(1).max(4),
  activite: activiteSchema,
  indicateurProgres: nonEmpty(300),
}).strict();

export const teacherBriefSchema = z.object({
  version: z.literal(TEACHER_BRIEF_PROMPT_VERSION),
  domaines: z.array(domaineBriefSchema).min(2).max(4),
}).strict();

export type TeacherBriefContent = z.infer<typeof teacherBriefSchema>;

/** Schéma JSON transmis au modèle (consigne de format, versionné avec le prompt). */
export const TEACHER_BRIEF_JSON_SHAPE = Object.freeze({
  version: TEACHER_BRIEF_PROMPT_VERSION,
  domaines: [{
    domainId: 'identifiant exact fourni',
    erreursTypiques: [{ constat: 'texte', origine: 'texte', itemIds: ['identifiant d’item fourni'] }],
    prerequisAVerifier: ['texte'],
    activite: {
      titre: 'texte',
      objectif: 'texte',
      materiel: 'texte',
      deroule: [{ nom: 'texte', dureeMin: 10, consigne: 'texte' }],
      differenciation: 'texte',
    },
    indicateurProgres: 'texte',
  }],
});
