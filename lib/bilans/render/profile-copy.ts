import { SEVERITY_RANK } from '../facts/constants';
import type { FactSheet } from '../facts/fact-sheet';
import type { NodeProfile } from '../facts/types';
import type { BilanPackSubject } from '../catalog/subjects';
import { domainLabel, sentenceStart, type DomainLabelForms } from './domain-labels';
import type { RenderIdentity } from './render-identity';

export const PROFILE_COPY_VERSION = 'profile-copy.v2' as const;

export type ReportAudience = 'ELEVE' | 'PARENTS' | 'NEXUS';

export const PROFILE_FAMILY_LABELS: Readonly<Record<NodeProfile, string>> = Object.freeze({
  MAITRISE: 'solide',
  MAITRISE_FRAGILE: 'fragile / à consolider',
  LACUNE_CONSCIENTE: 'à combler (déjà repéré)',
  ERREUR_CONFIANTE: 'sûr mais à revoir',
  NON_TRAITE: 'non évalué',
});

/** Geste pédagogique associé à chaque profil — vocabulaire des tableaux. */
export const PROFILE_GESTURES: Readonly<Record<NodeProfile, string>> = Object.freeze({
  MAITRISE: 'Entretenir et prolonger',
  MAITRISE_FRAGILE: 'Consolider par entraînement espacé',
  LACUNE_CONSCIENTE: 'Installer les repères, puis entraîner',
  ERREUR_CONFIANTE: 'Confronter, puis reconstruire',
  NON_TRAITE: 'Diagnostiquer au démarrage',
});

// Doublon d'ordre supprimé (13/08/2026) : ce fichier portait sa propre
// échelle qui plaçait NON_TRAITE sous MAITRISE_FRAGILE — l'inverse de
// l'échelle canonique du moteur. L'ordre d'affichage des priorités dérive
// désormais de l'UNIQUE source `SEVERITY_RANK` (constants.ts).
const displayPriority = (profile: NodeProfile): number => -SEVERITY_RANK[profile];

type DomainFact = FactSheet['domains'][number];

type PublicNarrativeEntry = Readonly<{
  domainId: string;
  domainTitle: string;
  profileLabel: string;
  text: string;
}>;

type NexusNarrativeEntry = PublicNarrativeEntry & Readonly<{
  profile: NodeProfile;
  score: number;
}>;

export type ProfileNarrativeEntry = PublicNarrativeEntry | NexusNarrativeEntry;

export type ProfiledNarrative = Readonly<{
  version: typeof PROFILE_COPY_VERSION;
  forces: readonly ProfileNarrativeEntry[];
  priorities: readonly ProfileNarrativeEntry[];
}>;

type CopyVariant = (t: DomainLabelForms) => string;

/**
 * Catalogue de prose, trois variantes par profil et par audience.
 *
 * Les corps de phrase ne conjuguent jamais le libellé du domaine (pas
 * d'accord en genre ou en nombre à gérer) : le libellé est posé en tête,
 * ou introduit par une forme prépositionnelle fournie par `domain-labels`.
 * Les formulations élève sont épicènes — aucun accord au masculin supposé.
 *
 * La rotation des variantes est déterministe : l'index vient du rang du
 * domaine parmi ceux qui partagent son profil, donc deux domaines de même
 * profil qui se suivent ne reçoivent jamais la même phrase — et le même
 * bilan re-rendu produit toujours le même texte.
 */
const COPY: Readonly<Record<ReportAudience, Readonly<Record<NodeProfile, readonly CopyVariant[]>>>> = Object.freeze({
  ELEVE: Object.freeze({
    MAITRISE: [
      (t: DomainLabelForms) => `${t.title} — réponses justes, données avec assurance : c’est un vrai point d’appui pour la suite.`,
      (t: DomainLabelForms) => `Tu peux t’appuyer sur ${t.article} : les réponses sont justes et assumées, rien à reprendre pour l’instant.`,
      (t: DomainLabelForms) => `${t.title} — acquis et disponible. On s’en servira comme socle pour aller plus loin.`,
    ],
    MAITRISE_FRAGILE: [
      (t: DomainLabelForms) => `${t.title} — les réponses sont justes, mais l’hésitation se sent encore. On va transformer ce « je crois » en « je sais ».`,
      (t: DomainLabelForms) => `Tu réussis ${t.en}, mais sans certitude complète : une consolidation courte suffira à ancrer le geste.`,
      (t: DomainLabelForms) => `${t.title} — compris, pas encore automatique. Quelques entraînements espacés rendront ce point disponible sans effort.`,
    ],
    LACUNE_CONSCIENTE: [
      (t: DomainLabelForms) => `${t.title} — quelque chose manque, et tu le sais déjà : c’est une vraie lucidité. Il reste à installer les bons repères.`,
      (t: DomainLabelForms) => `Ce qui manque ${t.en} est identifié. Aucune fausse certitude à défaire : on installe, puis on entraîne.`,
      (t: DomainLabelForms) => `${t.title} — une notion à construire plutôt qu’à corriger. Exactement le type de lacune qu’un stage comble vite.`,
    ],
    ERREUR_CONFIANTE: [
      (t: DomainLabelForms) => `${t.title} — une réponse fausse a été donnée avec assurance. C’est la priorité : une conviction erronée ne se corrige qu’une fois qu’on l’a vue.`,
      (t: DomainLabelForms) => `${sentenceStart(t.en)}, tu as répondu avec certitude… et la réponse était fausse. Rien de grave : on te montrera précisément où le raisonnement bifurque.`,
      (t: DomainLabelForms) => `${t.title} — une certitude à revoir avant d’avancer. C’est le travail le plus rentable des premières séances.`,
    ],
    NON_TRAITE: [
      (t: DomainLabelForms) => `${t.title} — aucune réponse apportée ici. Une question laissée vide nous renseigne aussi : on fera le point ensemble au démarrage.`,
      (t: DomainLabelForms) => `Pas de réponse ${t.en} : on ne devine pas, on vérifiera dès le début du stage.`,
      (t: DomainLabelForms) => `${t.title} — non traité cette fois. Un diagnostic ciblé situera ton point de départ.`,
    ],
  }),
  PARENTS: Object.freeze({
    MAITRISE: [
      (t: DomainLabelForms) => `${t.title} — acquis : réponses justes, données avec assurance. Le stage s’appuiera sur ce socle.`,
      (t: DomainLabelForms) => `Votre enfant maîtrise ${t.article} : ce point servira d’appui pour progresser ailleurs.`,
      (t: DomainLabelForms) => `${t.title} — un point en place, sans reprise nécessaire : il sera entretenu et mobilisé pendant le stage.`,
    ],
    MAITRISE_FRAGILE: [
      (t: DomainLabelForms) => `${t.title} — réponses justes mais encore hésitantes : une consolidation courte suffit, pas un réapprentissage.`,
      (t: DomainLabelForms) => `Votre enfant réussit ${t.en}, sans assurance complète. Le stage ancrera ce presque-acquis.`,
      (t: DomainLabelForms) => `${t.title} — compris mais pas encore automatique ; un entraînement espacé stabilisera ce point.`,
    ],
    LACUNE_CONSCIENTE: [
      (t: DomainLabelForms) => `${t.title} — la difficulté est identifiée, et votre enfant en a conscience : la reprise est directe, sans obstacle de conviction.`,
      (t: DomainLabelForms) => `Ce qui manque ${t.en} est repéré. Le stage installera les repères, puis proposera un entraînement court.`,
      (t: DomainLabelForms) => `${t.title} — une notion à installer ; c’est la lacune la plus simple à combler.`,
    ],
    ERREUR_CONFIANTE: [
      (t: DomainLabelForms) => `${t.title} — une réponse erronée a été donnée avec certitude. Ce point est traité en priorité : il ne se corrige pas seul.`,
      (t: DomainLabelForms) => `${sentenceStart(t.en)}, un raisonnement tenu pour juste doit d’abord être confronté, puis reconstruit pas à pas.`,
      (t: DomainLabelForms) => `${t.title} — une conviction à rectifier ; le travail commencera par la faire apparaître, précisément.`,
    ],
    NON_TRAITE: [
      (t: DomainLabelForms) => `${t.title} — sans réponse lors du bilan ; ce point sera situé en début de stage.`,
      (t: DomainLabelForms) => `Aucune réponse ${t.en} : une vérification ciblée précédera toute décision pédagogique.`,
      (t: DomainLabelForms) => `${t.title} — non évalué à ce stade ; la première séance permettra de le situer.`,
    ],
  }),
  NEXUS: Object.freeze({
    MAITRISE: [
      (t: DomainLabelForms) => `${t.title} : profil MAITRISE — maintien actif, mobilisable comme appui de différenciation.`,
      (t: DomainLabelForms) => `${t.title} : profil MAITRISE — acquis stable, aucun module de reprise à programmer.`,
      (t: DomainLabelForms) => `${t.title} : profil MAITRISE — socle disponible pour l’extension.`,
    ],
    MAITRISE_FRAGILE: [
      (t: DomainLabelForms) => `${t.title} : profil MAITRISE_FRAGILE — consolidation espacée, réussite sans confiance.`,
      (t: DomainLabelForms) => `${t.title} : profil MAITRISE_FRAGILE — ancrage à programmer, fond acquis.`,
      (t: DomainLabelForms) => `${t.title} : profil MAITRISE_FRAGILE — automatisation incomplète, entraînement bref et répété.`,
    ],
    LACUNE_CONSCIENTE: [
      (t: DomainLabelForms) => `${t.title} : profil LACUNE_CONSCIENTE — installation structurée, pas d’obstacle de conviction.`,
      (t: DomainLabelForms) => `${t.title} : profil LACUNE_CONSCIENTE — notion absente, reprise directe.`,
      (t: DomainLabelForms) => `${t.title} : profil LACUNE_CONSCIENTE — comblement simple, lucidité de l’élève acquise.`,
    ],
    ERREUR_CONFIANTE: [
      (t: DomainLabelForms) => `${t.title} : profil ERREUR_CONFIANTE — conflit cognitif prioritaire, à traiter en premier.`,
      (t: DomainLabelForms) => `${t.title} : profil ERREUR_CONFIANTE — représentation erronée assumée, priorité de séance.`,
      (t: DomainLabelForms) => `${t.title} : profil ERREUR_CONFIANTE — rectification à provoquer explicitement avant tout entraînement.`,
    ],
    NON_TRAITE: [
      (t: DomainLabelForms) => `${t.title} : profil NON_TRAITE — diagnostic préalable requis.`,
      (t: DomainLabelForms) => `${t.title} : profil NON_TRAITE — aucune donnée exploitable, à situer dès la première séance.`,
      (t: DomainLabelForms) => `${t.title} : profil NON_TRAITE — évaluation à reprendre au démarrage.`,
    ],
  }),
});

/** Nombre de variantes attendu partout — vérifié par test d'intégrité. */
export const PROFILE_COPY_VARIANTS = 3;

export function orderPriorityDomains(domains: FactSheet['domains']): readonly DomainFact[] {
  const canonicalOrder = new Map(domains.map(({ id }, index) => [id, index]));
  return Object.freeze(domains
    .filter(({ profile }) => profile !== 'MAITRISE')
    .slice()
    .sort((left, right) => (
      displayPriority(left.profile) - displayPriority(right.profile)
      || left.score - right.score
      || (canonicalOrder.get(left.id) ?? 0) - (canonicalOrder.get(right.id) ?? 0)
    )));
}

/**
 * Index de variante d'un domaine : son rang parmi les domaines de même profil,
 * dans l'ordre canonique du pack. Déterministe, et garantit que deux domaines
 * de même profil ne reçoivent jamais la même phrase tant qu'ils sont moins
 * nombreux que les variantes.
 */
export function domainVariantIndex(domains: FactSheet['domains'], domainId: string): number {
  const domain = domains.find(({ id }) => id === domainId);
  if (domain === undefined) return 0;
  let rank = 0;
  for (const candidate of domains) {
    if (candidate.id === domainId) break;
    if (candidate.profile === domain.profile) rank += 1;
  }
  return rank;
}

export function renderProfileNarrativeEntry(
  domain: DomainFact,
  audience: ReportAudience,
  variantIndex: number,
  subject?: BilanPackSubject,
): ProfileNarrativeEntry {
  const forms = domainLabel(domain.id, subject);
  const variants = COPY[audience][domain.profile];
  const safeIndex = ((variantIndex % variants.length) + variants.length) % variants.length;
  const base = Object.freeze({
    domainId: domain.id,
    domainTitle: forms.title,
    profileLabel: PROFILE_FAMILY_LABELS[domain.profile],
    text: variants[safeIndex](forms),
  });
  if (audience !== 'NEXUS') return base;
  return Object.freeze({ ...base, profile: domain.profile, score: domain.score });
}

export function buildProfiledNarrative(
  factSheet: FactSheet,
  identity: RenderIdentity,
  audience: ReportAudience,
): ProfiledNarrative {
  const entry = (domain: DomainFact): ProfileNarrativeEntry => renderProfileNarrativeEntry(
    domain,
    audience,
    domainVariantIndex(factSheet.domains, domain.id),
    identity.subject,
  );
  return Object.freeze({
    version: PROFILE_COPY_VERSION,
    forces: Object.freeze(factSheet.domains
      .filter(({ profile }) => profile === 'MAITRISE')
      .map(entry)),
    priorities: Object.freeze(orderPriorityDomains(factSheet.domains).map(entry)),
  });
}
