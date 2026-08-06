import { BILAN_PACK_SUBJECT_LABELS, type BilanPackSubject } from '../catalog/subjects';
import type { FactSheet } from '../facts/fact-sheet';
import type { NodeProfile } from '../facts/types';
import { orderPriorityDomains } from './profile-copy';
import type { RenderIdentity } from './render-identity';

export const LEARNING_PATH_VERSION = 'learning-path.v1' as const;

export const DIDACTIC_PHASE_BY_PROFILE = Object.freeze({
  ERREUR_CONFIANTE: 'Confronter',
  LACUNE_CONSCIENTE: 'Installer',
  MAITRISE_FRAGILE: 'Consolider',
  NON_TRAITE: 'Diagnostiquer',
} satisfies Readonly<Record<Exclude<NodeProfile, 'MAITRISE'>, DidacticPhase>>);

const SESSION_SEQUENCE = Object.freeze({ label: 'Séance', firstPosition: 1 });

export type DidacticPhase = 'Confronter' | 'Installer' | 'Consolider' | 'Diagnostiquer';

export type LearningPathStep = Readonly<{
  domainId: string;
  profil: Exclude<NodeProfile, 'MAITRISE'>;
  phaseDidactique: DidacticPhase;
  objectif: string;
  demarche: string;
  seanceLabel: string;
}>;

export type LearningPath = Readonly<{
  version: typeof LEARNING_PATH_VERSION;
  steps: readonly LearningPathStep[];
}>;

type PhaseTemplate = Readonly<{
  objectif: (subjectLabel: string, domainId: string) => string;
  demarche: (subjectLabel: string, domainId: string) => string;
}>;

const PHASE_TEMPLATES: Readonly<Record<DidacticPhase, PhaseTemplate>> = Object.freeze({
  Confronter: Object.freeze({
    objectif: (subject: string, domain: string) => `Lever une représentation incorrecte en ${subject}, sur ${domain}.`,
    demarche: (subject: string, domain: string) => `Créer un conflit cognitif en ${subject}, faire verbaliser le raisonnement sur ${domain}, puis reconstruire la notion avant tout entraînement.`,
  }),
  Installer: Object.freeze({
    objectif: (subject: string, domain: string) => `Installer les repères indispensables en ${subject}, sur ${domain}.`,
    demarche: (subject: string, domain: string) => `Poser les définitions utiles en ${subject}, montrer des exemples sur ${domain}, puis proposer un entraînement court et répété.`,
  }),
  Consolider: Object.freeze({
    objectif: (subject: string, domain: string) => `Stabiliser l'acquis encore fragile en ${subject}, sur ${domain}.`,
    demarche: (subject: string, domain: string) => `Organiser un entraînement espacé en ${subject} sur ${domain}, sans réenseigner ce qui est déjà compris.`,
  }),
  Diagnostiquer: Object.freeze({
    objectif: (subject: string, domain: string) => `Établir le niveau réel en ${subject}, sur ${domain}, avant de choisir une remédiation.`,
    demarche: (subject: string, domain: string) => `Commencer par un test ciblé en ${subject} sur ${domain}, puis décider du travail à engager à partir des observations.`,
  }),
});

function subjectLabel(subject: BilanPackSubject): string {
  return BILAN_PACK_SUBJECT_LABELS[subject];
}

export function buildLearningPath(factSheet: FactSheet, identity: RenderIdentity): LearningPath {
  const discipline = subjectLabel(identity.subject);
  const steps = orderPriorityDomains(factSheet.domains).map((domain, index) => {
    const profil = domain.profile as Exclude<NodeProfile, 'MAITRISE'>;
    const phaseDidactique = DIDACTIC_PHASE_BY_PROFILE[profil];
    const template = PHASE_TEMPLATES[phaseDidactique];
    return Object.freeze({
      domainId: domain.id,
      profil,
      phaseDidactique,
      objectif: template.objectif(discipline, domain.id),
      demarche: template.demarche(discipline, domain.id),
      seanceLabel: `${SESSION_SEQUENCE.label} ${SESSION_SEQUENCE.firstPosition + index}`,
    });
  });

  return Object.freeze({ version: LEARNING_PATH_VERSION, steps: Object.freeze(steps) });
}
