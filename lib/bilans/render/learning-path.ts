import type { FactSheet } from '../facts/fact-sheet';
import type { NodeProfile } from '../facts/types';
import { domainLabel, type DomainLabelForms } from './domain-labels';
import { orderPriorityDomains } from './profile-copy';
import type { RenderIdentity } from './render-identity';
import { STAGE_SESSION_COUNT, sessionLabel } from './stage-constants';

export const LEARNING_PATH_VERSION = 'learning-path.v2' as const;

export const DIDACTIC_PHASE_BY_PROFILE = Object.freeze({
  ERREUR_CONFIANTE: 'Confronter',
  LACUNE_CONSCIENTE: 'Installer',
  MAITRISE_FRAGILE: 'Consolider',
  NON_TRAITE: 'Diagnostiquer',
} satisfies Readonly<Record<Exclude<NodeProfile, 'MAITRISE'>, DidacticPhase>>);

export type DidacticPhase = 'Confronter' | 'Installer' | 'Consolider' | 'Diagnostiquer';

export type LearningPathStep = Readonly<{
  domainId: string;
  domainTitle: string;
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

type PhaseVariant = (t: DomainLabelForms) => string;

/**
 * Objectifs et démarches par phase didactique, en trois variantes tournées
 * par rang de séance : deux séances de même phase ne répètent jamais la même
 * formulation. Aucune variante ne cite la matière (le document entier porte
 * sur une seule discipline) ni un identifiant technique.
 */
const PHASE_TEMPLATES: Readonly<Record<DidacticPhase, Readonly<{
  objectif: readonly PhaseVariant[];
  demarche: readonly PhaseVariant[];
}>>> = Object.freeze({
  Confronter: Object.freeze({
    objectif: [
      (t: DomainLabelForms) => `Rectifier une certitude erronée ${t.en}.`,
      (t: DomainLabelForms) => `Faire apparaître, puis lever, l’idée fausse installée ${t.en}.`,
      (t: DomainLabelForms) => `Reconstruire une notion tenue pour acquise ${t.en}.`,
    ],
    demarche: [
      () => 'Partir d’un cas qui met la conviction en défaut, faire verbaliser le raisonnement, puis reconstruire la notion avant tout entraînement.',
      () => 'Provoquer le conflit cognitif sur un exemple choisi, comparer les deux raisonnements, puis stabiliser la version juste.',
      () => 'Faire verbaliser la règle utilisée, la confronter à un contre-exemple, puis reconstruire pas à pas.',
    ],
  }),
  Installer: Object.freeze({
    objectif: [
      (t: DomainLabelForms) => `Installer les repères indispensables ${t.en}.`,
      (t: DomainLabelForms) => `Poser les définitions et les gestes de base ${t.en}.`,
      (t: DomainLabelForms) => `Construire les premiers automatismes ${t.en}.`,
    ],
    demarche: [
      () => 'Poser les définitions utiles, montrer des exemples résolus, puis proposer un entraînement court et répété.',
      () => 'Avancer du simple vers le composé : un repère, un exemple, un essai — puis répéter.',
      () => 'Installer la notion par petites étapes vérifiées, avant un entraînement bref à la séance suivante.',
    ],
  }),
  Consolider: Object.freeze({
    objectif: [
      (t: DomainLabelForms) => `Stabiliser l’acquis encore fragile ${t.en}.`,
      (t: DomainLabelForms) => `Transformer la réussite hésitante ${t.en} en réflexe.`,
      (t: DomainLabelForms) => `Ancrer durablement ce qui est déjà compris ${t.en}.`,
    ],
    demarche: [
      () => 'Organiser un entraînement espacé, sans réenseigner ce qui est déjà compris.',
      () => 'Faire refaire en autonomie, à intervalle espacé, et faire nommer le geste qui réussit.',
      () => 'Alterner exercices courts et retours immédiats jusqu’à l’automatisme.',
    ],
  }),
  Diagnostiquer: Object.freeze({
    objectif: [
      (t: DomainLabelForms) => `Établir le niveau réel ${t.en} avant de choisir une remédiation.`,
      (t: DomainLabelForms) => `Situer précisément le point de départ ${t.en}.`,
      (t: DomainLabelForms) => `Mesurer ce qui est disponible ${t.en} avant d’engager le travail.`,
    ],
    demarche: [
      () => 'Commencer par un test ciblé, puis décider du travail à engager à partir des observations.',
      () => 'Poser quelques questions étalonnées, observer les démarches, puis trancher sur la suite.',
      () => 'Vérifier les prérequis un à un, et n’engager la remédiation qu’à partir de ce constat.',
    ],
  }),
});

/**
 * Répartition des domaines prioritaires sur les cinq séances réelles du
 * stage. Les priorités arrivent déjà triées par sévérité ; les premières
 * séances reçoivent les domaines les plus urgents. Quand il y a plus de
 * domaines que de séances, les séances de tête en portent deux ; quand il y
 * en a moins, les dernières séances restent libres pour la consolidation
 * d'ensemble (complétées à l'affichage, jamais inventées ici).
 */
export function sessionPositionsFor(stepCount: number): readonly number[] {
  if (stepCount <= 0) return Object.freeze([]);
  if (stepCount <= STAGE_SESSION_COUNT) {
    return Object.freeze(Array.from({ length: stepCount }, (_, index) => index + 1));
  }
  const base = Math.floor(stepCount / STAGE_SESSION_COUNT);
  const remainder = stepCount % STAGE_SESSION_COUNT;
  const positions: number[] = [];
  for (let session = 1; session <= STAGE_SESSION_COUNT; session += 1) {
    const size = base + (session <= remainder ? 1 : 0);
    for (let i = 0; i < size; i += 1) positions.push(session);
  }
  return Object.freeze(positions);
}

export function buildLearningPath(factSheet: FactSheet, identity: RenderIdentity): LearningPath {
  const ordered = orderPriorityDomains(factSheet.domains);
  const positions = sessionPositionsFor(ordered.length);
  const phaseOccurrences = new Map<DidacticPhase, number>();
  const steps = ordered.map((domain, index) => {
    const profil = domain.profile as Exclude<NodeProfile, 'MAITRISE'>;
    const phaseDidactique = DIDACTIC_PHASE_BY_PROFILE[profil];
    const occurrence = phaseOccurrences.get(phaseDidactique) ?? 0;
    phaseOccurrences.set(phaseDidactique, occurrence + 1);
    const template = PHASE_TEMPLATES[phaseDidactique];
    const forms = domainLabel(domain.id, identity.subject);
    return Object.freeze({
      domainId: domain.id,
      domainTitle: forms.title,
      profil,
      phaseDidactique,
      objectif: template.objectif[occurrence % template.objectif.length](forms),
      demarche: template.demarche[occurrence % template.demarche.length](forms),
      seanceLabel: sessionLabel(positions[index]),
    });
  });

  return Object.freeze({ version: LEARNING_PATH_VERSION, steps: Object.freeze(steps) });
}

export type SessionGroup = Readonly<{
  position: number;
  seanceLabel: string;
  steps: readonly LearningPathStep[];
}>;

/** Les cinq séances, dans l'ordre, y compris celles restées libres. */
export function groupStepsBySession(steps: readonly LearningPathStep[]): readonly SessionGroup[] {
  return Object.freeze(Array.from({ length: STAGE_SESSION_COUNT }, (_, index) => {
    const position = index + 1;
    const label = sessionLabel(position);
    return Object.freeze({
      position,
      seanceLabel: label,
      steps: Object.freeze(steps.filter((step) => step.seanceLabel === label)),
    });
  }));
}
