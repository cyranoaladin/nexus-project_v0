import { createHash } from 'node:crypto';

import { bilanPackSubjectLabel } from '../catalog/subjects';
import type { FactSheet } from '../facts/fact-sheet';
import type { NodeProfile } from '../facts/types';
import { domainLabel, domainWithArticle, enumerateFr } from './domain-labels';
import { buildLearningPath, groupStepsBySession, type LearningPath } from './learning-path';
import {
  PROFILE_FAMILY_LABELS,
  PROFILE_GESTURES,
  buildProfiledNarrative,
  domainVariantIndex,
  orderPriorityDomains,
  renderProfileNarrativeEntry,
  type ReportAudience,
} from './profile-copy';
import { buildCalibrationSentence } from './calibration-prose';
import { assertPseudonymousRenderIdentity, type RenderIdentity } from './render-identity';
import { numberWordFr } from './stage-constants';

export const BILAN_REPORT_TEMPLATE_VERSION = 'nexus-bilan-profile-v3' as const;

/**
 * Cadre collectif du stage, côté parents. La formulation « cinq séances de
 * deux heures » doit rester alignée sur STAGE_SESSION_COUNT — un test le
 * vérifie.
 */
export const PARENT_GROUP_CONSTRUCTION_COPY = 'Ce travail se déroule sur cinq séances de deux heures, en petit groupe constitué après lecture collective des bilans : les repères observés chez votre enfant y sont croisés avec ceux du groupe pour régler l’ordre, le rythme et la profondeur de chaque séance. Aucun module n’est fixé avant cette lecture collective.';

/** Nombre maximal d'actions personnelles listées dans le plan élève. */
export const STUDENT_ACTION_PLAN_MAX = 3;

type PublicLearningPathStep = Omit<LearningPath['steps'][number], 'profil'> & Readonly<{
  profileLabel: string;
}>;

type NexusLearningPathStep = LearningPath['steps'][number] & Readonly<{ score: number }>;

export type RenderedLearningPath = Readonly<{
  version: LearningPath['version'];
  steps: readonly (PublicLearningPathStep | NexusLearningPathStep)[];
}>;

export type DeterministicBilanReport = Readonly<{
  status: 'REPORT_PENDING_REVIEW';
  audience: ReportAudience;
  templateVersion: typeof BILAN_REPORT_TEMPLATE_VERSION;
  identity: RenderIdentity;
  contextChecksum: string;
  content: Readonly<{
    narrative: Readonly<{
      headline: string;
      introduction: string;
      /** Explication réussite × confiance — la méthode Nexus, par audience. */
      methodNote: string;
      strengths: readonly string[];
      priorities: readonly string[];
      actionPlan: readonly string[];
      /** Lecture de la fiabilité de l'auto-évaluation. */
      calibration: string;
      conclusion: string;
    }>;
    domains: readonly Readonly<{
      id: string;
      title: string;
      profileLabel: string;
      gesture: string;
      profile?: NodeProfile;
      score?: number;
      narrative: string;
    }>[];
    learningPath: RenderedLearningPath;
    internalFacts?: Readonly<{
      globalScore: number;
      coverage: number;
      calibrationIndex: number | null;
      domainScores: readonly Readonly<{ id: string; score: number }>[];
    }>;
  }>;
}>;

export type DeterministicBilanReportBundle = Readonly<Record<ReportAudience, DeterministicBilanReport>>;

/* -------------------------------------------------------------------------- */
/* Cadre par audience                                                          */
/* -------------------------------------------------------------------------- */

function audienceFrame(audience: ReportAudience, identity: RenderIdentity): Readonly<{
  headline: string;
  introduction: string;
  methodNote: string;
  conclusion: string;
}> {
  const subject = bilanPackSubjectLabel(identity.subject);
  if (audience === 'ELEVE') {
    return Object.freeze({
      headline: 'Ton bilan de positionnement',
      introduction: 'Ce bilan fait le point, domaine par domaine : ce qui est solide, ce qui se consolide, ce qui se corrige — et l’ordre dans lequel le stage va s’y prendre.',
      methodNote: 'Ce bilan ne donne pas de note. Il croise deux informations : ce que tu réussis, et la confiance avec laquelle tu réponds. C’est ce croisement qui distingue un point solide, un point à consolider, une notion à installer — et une certitude à revoir. Les certitudes à revoir passent en premier : tant qu’on croit juste une idée fausse, on ne la corrige pas seul.',
      conclusion: 'Ce bilan n’est pas une note : c’est une carte. Elle dit où appuyer l’effort pour que l’année démarre du bon pied.',
    });
  }
  if (audience === 'PARENTS') {
    return Object.freeze({
      headline: 'Bilan de positionnement de votre enfant',
      introduction: `Votre enfant a passé un bilan de positionnement en ${subject}. Ce compte rendu présente ce qui est acquis, ce qui reste fragile et ce que le stage traitera en priorité.`,
      methodNote: 'Nous ne mesurons pas seulement si votre enfant réussit : nous mesurons s’il sait où il en est. Chaque domaine croise la réussite observée et la confiance déclarée. Réussir avec assurance signale un acquis ; réussir en hésitant appelle une consolidation ; se tromper en le sentant appelle un apprentissage ; se tromper avec certitude — le cas le plus prioritaire — appelle une rectification guidée, car une conviction erronée ne se corrige pas seule. C’est cette lecture qui guide le stage.',
      conclusion: 'Aucune note, aucun classement : ce compte rendu sert uniquement à cibler l’accompagnement de votre enfant. L’équipe Nexus reste à votre disposition pour le commenter avec vous.',
    });
  }
  return Object.freeze({
    headline: 'Synthèse pédagogique Nexus',
    introduction: 'Lecture technique des profils, priorités et phases didactiques.',
    methodNote: 'Le score d’un domaine mesure la réussite (0–100). Le profil qualifie la relation à la notion : croisement réussite × confiance, hérité du pire nœud du domaine. Un domaine peut donc afficher un score honorable avec un profil sévère — le profil désigne le point à traiter, le score situe l’ampleur. Priorisation : ERREUR_CONFIANTE (confronter), puis LACUNE_CONSCIENTE (installer), puis MAITRISE_FRAGILE (consolider), puis NON_TRAITE (diagnostiquer).',
    conclusion: 'Document interne : faits de mesure et priorisation, sans interprétation ajoutée. La revue humaine reste obligatoire avant publication.',
  });
}

/* -------------------------------------------------------------------------- */
/* Synthèse de répartition                                                     */
/* -------------------------------------------------------------------------- */

const DISTRIBUTION_BUCKETS: readonly Readonly<{ profile: NodeProfile; label: string }>[] = Object.freeze([
  { profile: 'MAITRISE', label: 'acquis' },
  { profile: 'MAITRISE_FRAGILE', label: 'à consolider' },
  { profile: 'LACUNE_CONSCIENTE', label: 'à installer' },
  { profile: 'ERREUR_CONFIANTE', label: 'à rectifier en priorité' },
  { profile: 'NON_TRAITE', label: 'à situer' },
]);

function distributionSentence(domains: FactSheet['domains']): string {
  const parts = DISTRIBUTION_BUCKETS
    .map(({ profile, label }) => ({ label, count: domains.filter((domain) => domain.profile === profile).length }))
    .filter(({ count }) => count > 0)
    .map(({ label, count }) => `${numberWordFr(count)} ${label}`);
  return `Sur les ${numberWordFr(domains.length)} domaines évalués : ${parts.join(', ')}.`;
}

/* -------------------------------------------------------------------------- */
/* Forces — jamais une section vide                                            */
/* -------------------------------------------------------------------------- */

function nearestSupportFallback(
  factSheet: FactSheet,
  audience: Exclude<ReportAudience, 'NEXUS'>,
  subject: RenderIdentity['subject'],
): string {
  const best = (profile: NodeProfile) => factSheet.domains
    .filter((domain) => domain.profile === profile)
    .slice()
    .sort((left, right) => right.score - left.score)[0];

  const fragile = best('MAITRISE_FRAGILE');
  if (fragile !== undefined) {
    const article = domainWithArticle(fragile.id, subject);
    return audience === 'ELEVE'
      ? `Aucun domaine n’est encore complètement stabilisé — c’est exactement ce que le stage vient faire. Ton point d’appui le plus proche est ${article} : la réussite y est déjà réelle, il reste à l’affermir.`
      : `Aucun domaine n’est encore complètement stabilisé — c’est précisément l’objet du stage. Le point d’appui le plus proche est ${article} : la réussite y est déjà réelle, il reste à l’affermir.`;
  }
  const lucid = best('LACUNE_CONSCIENTE');
  if (lucid !== undefined) {
    const forms = domainLabel(lucid.id, subject);
    return audience === 'ELEVE'
      ? `Pas encore de domaine stabilisé, mais un vrai atout : tu sais dire où ça coince, notamment ${forms.en}. Cette lucidité est le meilleur point de départ pour progresser vite.`
      : `Aucun domaine n’est stabilisé à ce jour, mais votre enfant sait identifier ce qui lui manque, notamment ${forms.en}. Cette lucidité est un levier réel : elle rend le travail immédiatement efficace.`;
  }
  return audience === 'ELEVE'
    ? 'Le bilan ne fait pas encore apparaître de point stabilisé — c’est une photographie de départ, pas un verdict. L’avoir passé sérieusement est déjà un appui : on sait exactement par où commencer.'
    : 'Le bilan ne fait pas encore apparaître de point stabilisé : c’est une photographie de départ, pas un verdict. Elle donne au stage un avantage réel — savoir exactement par où commencer.';
}

/* -------------------------------------------------------------------------- */
/* Plan d'action élève — entre les séances, jamais une redite du parcours      */
/* -------------------------------------------------------------------------- */

type StudentAction = (article: string, en: string) => string;

const STUDENT_ACTIONS: Readonly<Record<Exclude<NodeProfile, 'MAITRISE'>, readonly StudentAction[]>> = Object.freeze({
  ERREUR_CONFIANTE: [
    (_a, en) => `D’ici la première séance, repère une question ${en} dont la réponse te paraît évidente : on la mettra à l’épreuve ensemble.`,
    (_a, en) => `Note deux ou trois réflexes que tu utilises ${en} : les écrire permettra de voir lequel bifurque.`,
    (_a, en) => `Ne cherche pas à « réviser plus » ${en} : viens avec tes certitudes, ce sont elles qu’on va tester.`,
  ],
  LACUNE_CONSCIENTE: [
    (_a, en) => `Relis la fiche de cours ${en} et note ce qui reste flou : tes questions feront gagner du temps à tout le monde.`,
    (_a, en) => `Prépare la liste de ce qui te manque ${en} — tu l’as déjà en partie repérée, elle guidera l’installation.`,
    (_a, en) => `Retrouve un exercice raté ${en} : on partira de lui pour installer les bons repères.`,
  ],
  MAITRISE_FRAGILE: [
    (_a, en) => `Refais régulièrement un exercice court ${en}, même réussi : c’est la répétition espacée qui transforme « je crois » en « je sais ».`,
    (_a, en) => `Chronomètre-toi sur un exercice simple ${en} : l’aisance, pas seulement la justesse, est l’objectif.`,
    (_a, en) => `Après chaque exercice ${en}, dis à voix haute la règle utilisée : nommer le geste l’ancre durablement.`,
  ],
  NON_TRAITE: [
    (article) => `Prévois d’aborder ${article} sans a priori au démarrage : quelques questions suffiront à te situer.`,
    (_a, en) => `Pas de préparation particulière ${en} : on établira le point de départ ensemble.`,
    (article) => `Garde ${article} pour la séance dédiée : mieux vaut un diagnostic propre qu’une révision à l’aveugle.`,
  ],
});

const STUDENT_ACTION_CLOSING = 'Et pendant tout le stage, garde le réflexe du bilan : avant de valider une réponse, demande-toi « j’en suis sûr, ou je crois l’être ? ».';

function buildStudentActionPlan(factSheet: FactSheet, subject: RenderIdentity['subject']): readonly string[] {
  const priorities = orderPriorityDomains(factSheet.domains).slice(0, STUDENT_ACTION_PLAN_MAX);
  const occurrences = new Map<NodeProfile, number>();
  const actions = priorities.map((domain) => {
    const profile = domain.profile as Exclude<NodeProfile, 'MAITRISE'>;
    const occurrence = occurrences.get(profile) ?? 0;
    occurrences.set(profile, occurrence + 1);
    const variants = STUDENT_ACTIONS[profile];
    const forms = domainLabel(domain.id, subject);
    return variants[occurrence % variants.length](forms.article, forms.en);
  });
  if (actions.length === 0) {
    return Object.freeze(['Ton bilan ne signale aucune priorité : le stage servira à prolonger tes acquis. Choisis un domaine que tu veux pousser plus loin — on partira de là.', STUDENT_ACTION_CLOSING]);
  }
  return Object.freeze([...actions, STUDENT_ACTION_CLOSING]);
}

/* -------------------------------------------------------------------------- */
/* Plan d'action parents — ce que le stage fait, concrètement                  */
/* -------------------------------------------------------------------------- */

const PARENT_PHASE_DIGEST: readonly Readonly<{ profile: NodeProfile; gesture: string }>[] = Object.freeze([
  { profile: 'ERREUR_CONFIANTE', gesture: 'rectifier ce qui est aujourd’hui tenu pour juste à tort' },
  { profile: 'LACUNE_CONSCIENTE', gesture: 'installer ce qui manque' },
  { profile: 'MAITRISE_FRAGILE', gesture: 'consolider les presque-acquis' },
  { profile: 'NON_TRAITE', gesture: 'situer ce qui n’a pas encore pu être évalué' },
]);

const PARENT_DIGEST_CONNECTORS = ['D’abord', 'Ensuite', 'Puis', 'Enfin'] as const;

function buildParentActionPlan(factSheet: FactSheet, subject: RenderIdentity['subject']): readonly string[] {
  const ordered = orderPriorityDomains(factSheet.domains);
  const phases = PARENT_PHASE_DIGEST
    .map(({ profile, gesture }) => ({
      gesture,
      titles: ordered
        .filter((domain) => domain.profile === profile)
        .map((domain) => domainWithArticle(domain.id, subject)),
    }))
    .filter(({ titles }) => titles.length > 0);

  const lines = phases.map(({ gesture, titles }, index) => {
    const connector = PARENT_DIGEST_CONNECTORS[Math.min(index, PARENT_DIGEST_CONNECTORS.length - 1)];
    return `${connector}, ${gesture} : ${enumerateFr(titles)}.`;
  });

  if (lines.length === 0) {
    return Object.freeze([
      'Le bilan ne signale aucune priorité de rattrapage : le stage servira à prolonger les acquis et à préparer les premières notions de l’année.',
      PARENT_GROUP_CONSTRUCTION_COPY,
    ]);
  }
  return Object.freeze([...lines, PARENT_GROUP_CONSTRUCTION_COPY]);
}

/* -------------------------------------------------------------------------- */
/* Plan Nexus — les cinq séances                                               */
/* -------------------------------------------------------------------------- */

function buildNexusActionPlan(learningPath: LearningPath): readonly string[] {
  return Object.freeze(groupStepsBySession(learningPath.steps).map((session) => {
    if (session.steps.length === 0) {
      return `${session.seanceLabel} — Consolidation d’ensemble et mesure des progrès.`;
    }
    const detail = session.steps
      .map((step) => `${step.phaseDidactique} : ${step.domainTitle} (${step.profil})`)
      .join(' · ');
    return `${session.seanceLabel} — ${detail}.`;
  }));
}

/* -------------------------------------------------------------------------- */
/* Parcours rendu                                                              */
/* -------------------------------------------------------------------------- */

function renderLearningPath(
  learningPath: LearningPath,
  factSheet: FactSheet,
  audience: ReportAudience,
): RenderedLearningPath {
  const scores = new Map(factSheet.domains.map(({ id, score }) => [id, score]));
  const steps = learningPath.steps.map((step) => {
    if (audience === 'NEXUS') {
      return Object.freeze({ ...step, score: scores.get(step.domainId) ?? 0 });
    }
    const { profil, ...publicStep } = step;
    return Object.freeze({ ...publicStep, profileLabel: PROFILE_FAMILY_LABELS[profil] });
  });
  return Object.freeze({ version: learningPath.version, steps: Object.freeze(steps) });
}

/* -------------------------------------------------------------------------- */
/* Construction                                                                */
/* -------------------------------------------------------------------------- */

export function buildDeterministicReport(
  factSheet: FactSheet,
  audience: ReportAudience,
  suppliedIdentity: RenderIdentity,
): DeterministicBilanReport {
  const identity = assertPseudonymousRenderIdentity(suppliedIdentity);
  const narrative = buildProfiledNarrative(factSheet, identity, audience);
  const learningPath = buildLearningPath(factSheet, identity);
  const frame = audienceFrame(audience, identity);
  const domains = factSheet.domains.map((domain) => {
    const entry = renderProfileNarrativeEntry(
      domain,
      audience,
      domainVariantIndex(factSheet.domains, domain.id),
      identity.subject,
    );
    return Object.freeze({
      id: domain.id,
      title: entry.domainTitle,
      profileLabel: entry.profileLabel,
      gesture: PROFILE_GESTURES[domain.profile],
      ...('profile' in entry ? { profile: entry.profile, score: entry.score } : {}),
      narrative: entry.text,
    });
  });

  const renderedPath = audience === 'PARENTS'
    ? Object.freeze({ version: learningPath.version, steps: Object.freeze([]) })
    : renderLearningPath(learningPath, factSheet, audience);

  const strengths = narrative.forces.map(({ text }) => text);
  const strengthsNeverEmpty = strengths.length > 0 || audience === 'NEXUS'
    ? strengths
    : [nearestSupportFallback(factSheet, audience, identity.subject)];

  const actionPlan = audience === 'ELEVE'
    ? buildStudentActionPlan(factSheet, identity.subject)
    : audience === 'PARENTS'
      ? buildParentActionPlan(factSheet, identity.subject)
      : buildNexusActionPlan(learningPath);

  const narrativeContent = Object.freeze({
    headline: frame.headline,
    introduction: `${frame.introduction} ${distributionSentence(factSheet.domains)}`,
    methodNote: frame.methodNote,
    strengths: Object.freeze(strengthsNeverEmpty),
    priorities: Object.freeze(narrative.priorities.map(({ text }) => text)),
    actionPlan,
    calibration: buildCalibrationSentence(factSheet.calibrationIndex, audience),
    conclusion: frame.conclusion,
  });
  const base = {
    status: 'REPORT_PENDING_REVIEW' as const,
    audience,
    templateVersion: BILAN_REPORT_TEMPLATE_VERSION,
    identity,
  };
  const contextChecksum = createHash('sha256')
    .update(JSON.stringify({ factSheet, identity, audience, templateVersion: BILAN_REPORT_TEMPLATE_VERSION }))
    .digest('hex');

  if (audience !== 'NEXUS') {
    return Object.freeze({
      ...base,
      contextChecksum,
      content: Object.freeze({
        narrative: narrativeContent,
        domains: Object.freeze(domains),
        learningPath: renderedPath,
      }),
    });
  }
  return Object.freeze({
    ...base,
    contextChecksum,
    content: Object.freeze({
      narrative: narrativeContent,
      domains: Object.freeze(domains),
      learningPath: renderedPath,
      internalFacts: Object.freeze({
        globalScore: factSheet.globalScore,
        coverage: factSheet.coverage,
        calibrationIndex: factSheet.calibrationIndex,
        domainScores: Object.freeze(factSheet.domains.map(({ id, score }) => Object.freeze({ id, score }))),
      }),
    }),
  });
}

export function buildDeterministicReports(
  factSheet: FactSheet,
  identity: RenderIdentity,
): DeterministicBilanReportBundle {
  return Object.freeze({
    ELEVE: buildDeterministicReport(factSheet, 'ELEVE', identity),
    PARENTS: buildDeterministicReport(factSheet, 'PARENTS', identity),
    NEXUS: buildDeterministicReport(factSheet, 'NEXUS', identity),
  });
}
