import type { NodeProfile } from '../facts/types';
import type { ReportAudience } from './profile-copy';

/**
 * Catalogue de prose des bilans de positionnement.
 *
 * Toutes les phrases sont écrites à la main par la responsable pédagogique.
 * Le moteur ne rédige rien : il **sélectionne** une variante et **remplit** les
 * champs. Aucun LLM n'intervient, et le résultat est strictement déterministe —
 * mêmes faits, même texte, à chaque rendu.
 *
 * Deux garde-fous portés par la sélection elle-même :
 *
 * 1. **La prose ne dit jamais plus que la mesure.** Tout nœud du dépôt porte
 *    exactement 2 items, donc le palier prudent est le défaut absolu. Le palier
 *    affirmé n'est ouvert qu'aux thèmes réunissant au moins
 *    `AFFIRMED_ITEM_THRESHOLD` items — quatre thèmes sur cent dix aujourd'hui.
 *
 * 2. **Score et profil sont distincts.** Le profil d'un thème est le pire de ses
 *    nœuds (`worstProfile`), donc un thème peut afficher un bon score et un
 *    profil sévère. Dans ce cas la prose désigne le point précis en cause au
 *    lieu de condamner l'ensemble.
 */

export const PROSE_CATALOGUE_VERSION = 'prose-catalogue.v1' as const;

/** Nombre de variantes attendu pour chaque phrase — vérifié par test. */
export const VARIANTS_PER_PHRASE = 3;

/** Nombre d'items à partir duquel un thème autorise une affirmation d'ensemble. */
export const AFFIRMED_ITEM_THRESHOLD = 8;

/** Indice de calibration en deçà duquel un travail métacognitif est signalé. */
const CALIBRATION_THRESHOLD = 60;

/** Score au-delà duquel un profil sévère est présenté comme un point isolé. */
const HIGH_SCORE_THRESHOLD = 65;

/** Profils justifiant la nuance « bon niveau d'ensemble, un point à consolider ». */
const SEVERE_PROFILES: ReadonlySet<NodeProfile> = new Set<NodeProfile>([
  'ERREUR_CONFIANTE',
  'LACUNE_CONSCIENTE',
]);

export type ThemeProseInput = Readonly<{
  /** Identifiant machine du thème — jamais affiché. */
  domainId: string;
  /** Libellé humain (`category` de la banque) — c'est lui qui est rendu. */
  category: string;
  profile: NodeProfile;
  score: number;
  itemCount: number;
  nodeCount: number;
  /** Libellé du pire nœud, requis seulement pour la nuance multi-nœuds. */
  worstNodeLabel: string | null;
}>;

export type ThemeCounts = Readonly<{
  acquis: number;
  aSecuriser: number;
  aRevoir: number;
  aRectifier: number;
}>;

/**
 * Variantes d'une même phrase, tournées par index de thème. La rotation suppose
 * au moins deux entrées pour que deux thèmes voisins diffèrent ; le catalogue en
 * compte trois partout, ce qu'un test d'intégrité vérifie.
 */
type VariantSet = readonly string[];

/* -------------------------------------------------------------------------- */
/* §2 — Frames par quadrant, palier prudent                                    */
/* -------------------------------------------------------------------------- */

const CAUTIOUS: Readonly<Record<ReportAudience, Readonly<Record<NodeProfile, VariantSet>>>> = Object.freeze({
  ELEVE: Object.freeze({
    MAITRISE: [
      'tes deux réponses sont justes, et tu les as données avec assurance. On considère ce point acquis — c’est un appui sur lequel bâtir.',
      'juste et sûr de toi, sur les deux questions. Rien à reprendre ici pour l’instant.',
      'acquis : les réponses sont bonnes et assumées. On s’en servira comme socle.',
    ],
    MAITRISE_FRAGILE: [
      'tes réponses sont justes, mais tu hésitais. Tu sais — sans encore le savoir avec certitude. C’est précisément ce qu’une séance vient sécuriser.',
      'bon résultat, confiance encore fragile. Le fond est là ; il reste à l’ancrer pour que le doute disparaisse.',
      'juste, mais au prix d’une hésitation. On va transformer ce « je crois » en « je sais ».',
    ],
    ERREUR_CONFIANTE: [
      'ici, une réponse fausse a été donnée avec assurance. C’est le point à reprendre en premier — non parce que c’est grave, mais parce qu’une conviction fausse ne se corrige qu’une fois qu’on l’a vue.',
      'tu étais sûr, et c’était faux. Ce n’est pas une lacune, c’est une compréhension à rectifier — et c’est la plus utile à traiter tôt.',
      'erreur donnée avec certitude : le premier réflexe des séances sera de te montrer, précisément, où le raisonnement bifurque.',
    ],
    LACUNE_CONSCIENTE: [
      'la réponse était fausse, et tu le pressentais. C’est la lacune la plus simple à combler : aucune fausse certitude à défaire, juste une notion à revoir.',
      'faux, mais tu n’en étais pas sûr — c’est déjà une bonne lucidité. On comble, et ce point passe du côté des acquis.',
      'point non maîtrisé, et tu le sais : exactement le genre de lacune qu’un stage règle vite.',
    ],
    NON_TRAITE: [
      'cette partie est restée sans réponse. Une question laissée vide nous renseigne autant qu’une réponse — on la reprendra pour situer où tu en es.',
      'pas de réponse ici : on ne devine pas, on vérifiera ensemble au démarrage.',
      'cette partie est restée sans réponse. On la reprendra au démarrage pour situer où tu en es.',
    ],
  }),
  PARENTS: Object.freeze({
    MAITRISE: [
      'les réponses sont justes et assurées. Le point est acquis et servira d’appui.',
      'acquis : réponses correctes et assumées, sans reprise nécessaire à ce stade.',
      'ce point est en place et constitue un socle pour la suite.',
    ],
    MAITRISE_FRAGILE: [
      'les réponses sont justes, mais données avec hésitation. Le fond est là ; il reste à l’ancrer pour que le doute disparaisse.',
      'bon résultat, confiance encore fragile : un point à sécuriser, non à réapprendre.',
      'la notion est comprise mais pas encore automatique. C’est exactement ce qu’une séance consolide.',
    ],
    ERREUR_CONFIANTE: [
      'une réponse assurée mais erronée — le type de point que nous traitons en priorité, car il ne se corrige qu’en étant d’abord identifié.',
      'une conviction fausse est en place ici. Ce n’est pas une lacune, c’est une compréhension à rectifier, et c’est la plus utile à traiter tôt.',
      'réponse fausse donnée avec certitude : le travail commencera par montrer précisément où le raisonnement bifurque.',
    ],
    LACUNE_CONSCIENTE: [
      'la réponse est fausse, et le doute était perçu. C’est la lacune la plus simple à combler : aucune fausse certitude à défaire.',
      'point non maîtrisé, et identifié comme tel — ce que le stage traite rapidement.',
      'notion à revoir, sans obstacle de conviction : la reprise est directe.',
    ],
    NON_TRAITE: [
      'cette partie est restée sans réponse. Elle sera située au démarrage de l’accompagnement.',
      'aucune réponse ici : une vérification ciblée précédera toute décision pédagogique.',
      'partie non traitée, à évaluer au démarrage.',
    ],
  }),
  NEXUS: Object.freeze({
    MAITRISE: [
      'profil MAITRISE — maintien actif, appui possible pour la différenciation.',
      'profil MAITRISE — acquis, mobilisable comme socle.',
      'profil MAITRISE — stable, pas de reprise programmée.',
    ],
    MAITRISE_FRAGILE: [
      'profil MAITRISE_FRAGILE — consolidation espacée, réussite sans confiance.',
      'profil MAITRISE_FRAGILE — ancrage à programmer, fond acquis.',
      'profil MAITRISE_FRAGILE — automatisation incomplète.',
    ],
    ERREUR_CONFIANTE: [
      'profil ERREUR_CONFIANTE — conflit cognitif prioritaire, à traiter en premier.',
      'profil ERREUR_CONFIANTE — représentation erronée assumée, priorité de séance.',
      'profil ERREUR_CONFIANTE — rectification à provoquer explicitement.',
    ],
    LACUNE_CONSCIENTE: [
      'profil LACUNE_CONSCIENTE — installation structurée, pas d’obstacle de conviction.',
      'profil LACUNE_CONSCIENTE — notion absente, reprise directe.',
      'profil LACUNE_CONSCIENTE — comblement simple, lucidité de l’élève acquise.',
    ],
    NON_TRAITE: [
      'profil NON_TRAITE — diagnostic préalable requis.',
      'profil NON_TRAITE — aucune donnée exploitable, à situer.',
      'profil NON_TRAITE — évaluation à reprendre au démarrage.',
    ],
  }),
});

/* -------------------------------------------------------------------------- */
/* §2 bis — Palier affirmé (thèmes ≥ AFFIRMED_ITEM_THRESHOLD items)            */
/* -------------------------------------------------------------------------- */

const AFFIRMED: Readonly<Record<ReportAudience, Readonly<Record<NodeProfile, string>>>> = Object.freeze({
  ELEVE: Object.freeze({
    MAITRISE: 'sur l’ensemble des questions, tes réponses sont justes et assurées. C’est un socle solide — on peut viser plus haut que la simple consolidation.',
    ERREUR_CONFIANTE: 'le thème est suffisamment couvert pour l’affirmer : plusieurs certitudes sont à rectifier ici. C’est la priorité claire du travail à venir.',
    LACUNE_CONSCIENTE: 'sur l’ensemble, ce thème n’est pas encore en place — et tu le sens. Objectif prioritaire, et tout à fait rattrapable.',
    MAITRISE_FRAGILE: 'les bases y sont largement, mais la confiance manque encore. Un thème à sécuriser, pas à réapprendre.',
    NON_TRAITE: 'sur l’ensemble des questions, ce thème est resté sans réponse. Il sera situé au démarrage.',
  }),
  PARENTS: Object.freeze({
    MAITRISE: 'sur l’ensemble des questions, les réponses sont justes et assurées. Le socle est solide et permet de viser l’approfondissement.',
    ERREUR_CONFIANTE: 'le thème est suffisamment couvert pour l’affirmer : plusieurs certitudes sont à rectifier. C’est la priorité du travail à venir.',
    LACUNE_CONSCIENTE: 'sur l’ensemble, ce thème n’est pas encore en place. Objectif prioritaire, et tout à fait rattrapable.',
    MAITRISE_FRAGILE: 'les bases sont largement présentes, mais la confiance manque encore. Un thème à sécuriser, pas à réapprendre.',
    NON_TRAITE: 'sur l’ensemble des questions, ce thème est resté sans réponse et sera situé au démarrage.',
  }),
  NEXUS: Object.freeze({
    MAITRISE: 'profil MAITRISE sur échantillon suffisant — affirmation d’ensemble autorisée.',
    ERREUR_CONFIANTE: 'profil ERREUR_CONFIANTE sur échantillon suffisant — priorité établie, non conjecturale.',
    LACUNE_CONSCIENTE: 'profil LACUNE_CONSCIENTE sur échantillon suffisant — thème non installé.',
    MAITRISE_FRAGILE: 'profil MAITRISE_FRAGILE sur échantillon suffisant — sécurisation, pas réapprentissage.',
    NON_TRAITE: 'profil NON_TRAITE sur échantillon suffisant — aucune donnée exploitable.',
  }),
});

/* -------------------------------------------------------------------------- */
/* §2 ter — Nuance multi-nœuds : bon score, profil sévère                      */
/* -------------------------------------------------------------------------- */

const SCORE_BAND_LABEL: readonly Readonly<{ min: number; label: string }>[] = Object.freeze([
  { min: 85, label: 'très bon' },
  { min: 65, label: 'correct' },
  { min: 40, label: 'en construction' },
  { min: 0, label: 'encore fragile' },
]);

function scoreBandLabel(score: number): string {
  return SCORE_BAND_LABEL.find(({ min }) => score >= min)?.label ?? 'encore fragile';
}

function multiNodeFrame(input: ThemeProseInput, audience: ReportAudience): string {
  const band = scoreBandLabel(input.score);
  const node = input.worstNodeLabel ?? input.category;
  if (audience === 'NEXUS') {
    return `score ${input.score} (${band}) mais profil ${input.profile} porté par un seul nœud : ${node}. Cibler ce nœud, pas le thème.`;
  }
  const effort = audience === 'ELEVE'
    ? 'C’est là qu’ira l’effort, sans remettre en cause le reste.'
    : 'L’effort portera précisément là, sans remettre en cause le reste.';
  return `le niveau d’ensemble est ${band}, mais un point précis, ${node}, reste à consolider. ${effort}`;
}

/* -------------------------------------------------------------------------- */
/* Sélection                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Retourne la phrase d'un thème, préfixée de son libellé humain.
 *
 * @param themeIndex Position du thème dans l'ordre officiel. Sert à la rotation
 *   déterministe des variantes : deux thèmes voisins n'ont jamais la même.
 */
export function selectThemeProse(
  input: ThemeProseInput,
  audience: ReportAudience,
  themeIndex: number,
): string {
  const body = selectThemeBody(input, audience, themeIndex);
  return `${input.category} — ${body}`;
}

function selectThemeBody(
  input: ThemeProseInput,
  audience: ReportAudience,
  themeIndex: number,
): string {
  const isSevereButScoring = input.nodeCount > 1
    && input.score >= HIGH_SCORE_THRESHOLD
    && SEVERE_PROFILES.has(input.profile);
  if (isSevereButScoring) return multiNodeFrame(input, audience);

  if (input.itemCount >= AFFIRMED_ITEM_THRESHOLD) return AFFIRMED[audience][input.profile];

  const variants = CAUTIOUS[audience][input.profile];
  const safeIndex = ((themeIndex % variants.length) + variants.length) % variants.length;
  return variants[safeIndex];
}

/* -------------------------------------------------------------------------- */
/* §3 — Synthèse d'ouverture                                                   */
/* -------------------------------------------------------------------------- */

const OPENING: readonly Readonly<{ min: number; eleve: string; parents: string; nexus: string }>[] = Object.freeze([
  {
    min: 85,
    eleve: 'Ton bilan est solide : l’essentiel est en place. Les séances viseront l’approfondissement plutôt que le rattrapage.',
    parents: 'Le bilan est solide : l’essentiel est en place. Les séances viseront l’approfondissement plutôt que le rattrapage.',
    nexus: 'Bande APPROFONDISSEMENT — socle en place, viser l’extension.',
  },
  {
    min: 65,
    eleve: 'De bonnes bases, avec quelques points à renforcer que les séances cibleront précisément.',
    parents: 'De bonnes bases, avec quelques points à renforcer que les séances cibleront précisément.',
    nexus: 'Bande RENFORCEMENT — bases acquises, points ciblés à renforcer.',
  },
  {
    min: 40,
    eleve: 'Des acquis réels et des zones à consolider — c’est exactement ce qu’un stage de pré-rentrée traite.',
    parents: 'Des acquis réels et des zones à consolider — c’est exactement ce qu’un stage de pré-rentrée traite.',
    nexus: 'Bande CONSOLIDATION_STANDARD — acquis partiels, consolidation à programmer.',
  },
  {
    min: 0,
    eleve: 'Plusieurs points fondamentaux sont à reprendre. C’est un point de départ, pas un jugement — et on y répondra un par un.',
    parents: 'Plusieurs points fondamentaux sont à reprendre. C’est un point de départ, pas un jugement — ils seront traités un par un.',
    nexus: 'Bande CONSOLIDATION_PRIORITAIRE — fondamentaux à reprendre.',
  },
]);

export function buildOpeningSynthesis(
  globalScore: number,
  counts: ThemeCounts,
  audience: ReportAudience,
): string {
  const band = OPENING.find(({ min }) => globalScore >= min) ?? OPENING[OPENING.length - 1];
  const opening = audience === 'ELEVE' ? band.eleve : audience === 'PARENTS' ? band.parents : band.nexus;
  const total = counts.acquis + counts.aSecuriser + counts.aRevoir + counts.aRectifier;
  const distribution = `Sur les ${total} thèmes évalués : ${counts.acquis} acquis, ${counts.aSecuriser} à sécuriser, ${counts.aRevoir} à revoir, ${counts.aRectifier} à rectifier en priorité.`;
  return `${opening} ${distribution}`;
}

/* -------------------------------------------------------------------------- */
/* §4 — Plan de travail priorisé                                               */
/* -------------------------------------------------------------------------- */

const WORK_PLAN_SECTIONS: readonly Readonly<{ profile: NodeProfile; eleve: string; parents: string; nexus: string }>[] = Object.freeze([
  {
    profile: 'ERREUR_CONFIANTE',
    eleve: 'les convictions à corriger d’abord',
    parents: 'les convictions à corriger d’abord',
    nexus: 'ERREUR_CONFIANTE — conflit cognitif prioritaire',
  },
  {
    profile: 'LACUNE_CONSCIENTE',
    eleve: 'les notions à revoir',
    parents: 'les notions à revoir',
    nexus: 'LACUNE_CONSCIENTE — installation structurée',
  },
  {
    profile: 'MAITRISE_FRAGILE',
    eleve: 'ce qui est presque acquis, juste à sécuriser',
    parents: 'ce qui est presque acquis, juste à sécuriser',
    nexus: 'MAITRISE_FRAGILE — consolidation espacée',
  },
  {
    profile: 'NON_TRAITE',
    eleve: 'à situer au démarrage',
    parents: 'à situer au démarrage',
    nexus: 'NON_TRAITE — diagnostic préalable',
  },
]);

/**
 * Lignes du plan de travail, dans l'ordre de sévérité. Une section sans thème
 * est omise plutôt que rendue vide, et les thèmes acquis n'y figurent jamais.
 */
export function buildWorkPlan(
  themes: readonly ThemeProseInput[],
  audience: ReportAudience,
): readonly string[] {
  const lines: string[] = [];
  for (const section of WORK_PLAN_SECTIONS) {
    const matching = themes.filter((theme) => theme.profile === section.profile);
    if (matching.length === 0) continue;
    const label = audience === 'ELEVE' ? section.eleve : audience === 'PARENTS' ? section.parents : section.nexus;
    lines.push(`${label} : ${matching.map((theme) => theme.category).join(', ')}.`);
  }
  return Object.freeze(lines);
}

export const WORK_PLAN_INTRO: Readonly<Record<ReportAudience, string>> = Object.freeze({
  ELEVE: 'Ton plan de travail, dans l’ordre où on le traitera :',
  PARENTS: 'Le plan de travail, dans l’ordre où il sera traité :',
  NEXUS: 'Plan de travail, ordre de sévérité :',
});

/* -------------------------------------------------------------------------- */
/* §5 — Métacognition                                                          */
/* -------------------------------------------------------------------------- */

export function buildCalibrationSentence(
  calibrationIndex: number | null,
  audience: ReportAudience,
): string {
  if (calibrationIndex === null) {
    return audience === 'ELEVE'
      ? 'Trop de questions sans réponse cette fois pour évaluer ton auto-perception — on le regardera en séance.'
      : audience === 'PARENTS'
        ? 'Trop de questions sont restées sans réponse pour évaluer l’auto-perception ; ce point sera regardé en séance.'
        : 'calibrationIndex null — aucun item traité, auto-évaluation non mesurable.';
  }
  if (calibrationIndex < CALIBRATION_THRESHOLD) {
    return audience === 'ELEVE'
      ? 'Un levier en plus des notions : ton ressenti et tes résultats ne coïncident pas toujours. Apprendre à repérer quand tu es sûr à raison — et quand tu ne l’es pas — vaut autant que le contenu lui-même.'
      : audience === 'PARENTS'
        ? 'Un levier en plus des notions : le ressenti et les résultats ne coïncident pas toujours. Apprendre à repérer quand la confiance est justifiée vaut autant que le contenu lui-même.'
        : `calibrationIndex ${calibrationIndex} < ${CALIBRATION_THRESHOLD} — travail métacognitif à programmer.`;
  }
  return audience === 'ELEVE'
    ? 'Point fort : ton auto-évaluation est fiable — tu sais globalement ce que tu sais. C’est un vrai atout pour réviser juste, sans perdre de temps.'
    : audience === 'PARENTS'
      ? 'Point fort : l’auto-évaluation est fiable — un atout pour des révisions efficaces.'
      : `calibrationIndex ${calibrationIndex} ≥ ${CALIBRATION_THRESHOLD} — auto-évaluation fiable.`;
}

/* -------------------------------------------------------------------------- */
/* §6 — Clôture                                                                */
/* -------------------------------------------------------------------------- */

/** Exposé pour le test d'intégrité du catalogue (nombre de variantes). */
export const CAUTIOUS_VARIANTS = CAUTIOUS;

export const CLOSING: Readonly<Record<ReportAudience, string>> = Object.freeze({
  ELEVE: 'Ce bilan n’est pas une note : c’est une carte. Elle dit où appuyer l’effort pour que l’année à venir démarre du bon pied.',
  PARENTS: 'Aucune note, aucun classement : ce compte rendu sert uniquement à cibler l’accompagnement.',
  NEXUS: 'Document interne : faits de mesure et priorisation, sans interprétation ajoutée.',
});
