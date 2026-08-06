import type { FactSheet } from '../facts/fact-sheet';
import type { NodeProfile } from '../facts/types';
import type { RenderIdentity } from './render-identity';

export const PROFILE_COPY_VERSION = 'profile-copy.v1' as const;

export type ReportAudience = 'ELEVE' | 'PARENTS' | 'NEXUS';

export const PROFILE_FAMILY_LABELS: Readonly<Record<NodeProfile, string>> = Object.freeze({
  MAITRISE: 'solide',
  MAITRISE_FRAGILE: 'fragile / à consolider',
  LACUNE_CONSCIENTE: 'à combler (déjà repéré)',
  ERREUR_CONFIANTE: 'sûr mais à revoir',
  NON_TRAITE: 'non évalué',
});

const PROFILE_PRIORITY: Readonly<Record<NodeProfile, number>> = Object.freeze({
  ERREUR_CONFIANTE: 0,
  LACUNE_CONSCIENTE: 1,
  MAITRISE_FRAGILE: 2,
  NON_TRAITE: 3,
  MAITRISE: 4,
});

type DomainFact = FactSheet['domains'][number];

type PublicNarrativeEntry = Readonly<{
  domainId: string;
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

const COPY: Readonly<Record<ReportAudience, Readonly<Record<NodeProfile, (domainId: string) => string>>>> = Object.freeze({
  ELEVE: Object.freeze({
    MAITRISE: (domain: string) => `${domain} est un point solide sur lequel tu peux t'appuyer.`,
    MAITRISE_FRAGILE: (domain: string) => `${domain} est compris, mais tu dois encore le consolider pour le mobiliser sans hésiter.`,
    LACUNE_CONSCIENTE: (domain: string) => `Tu as déjà repéré ce qui manque en ${domain} : nous allons installer les repères essentiels.`,
    ERREUR_CONFIANTE: (domain: string) => `En ${domain}, une idée qui te paraît sûre doit être revue avant de poursuivre.`,
    NON_TRAITE: (domain: string) => `${domain} n'a pas encore été évalué : un diagnostic ciblé ouvrira le travail.`,
  }),
  PARENTS: Object.freeze({
    MAITRISE: (domain: string) => `${domain} constitue un acquis solide sur lequel le parcours peut prendre appui.`,
    MAITRISE_FRAGILE: (domain: string) => `${domain} est fragile et demande une consolidation régulière, sans reprise intégrale du cours.`,
    LACUNE_CONSCIENTE: (domain: string) => `La difficulté en ${domain} est déjà repérée ; le parcours installera les notions puis un entraînement court.`,
    ERREUR_CONFIANTE: (domain: string) => `En ${domain}, un raisonnement tenu pour juste doit d'abord être confronté puis reconstruit.`,
    NON_TRAITE: (domain: string) => `${domain} reste non évalué ; une vérification ciblée précédera toute décision pédagogique.`,
  }),
  NEXUS: Object.freeze({
    MAITRISE: (domain: string) => `${domain} : maintien actif du profil MAITRISE.`,
    MAITRISE_FRAGILE: (domain: string) => `${domain} : consolidation espacée du profil MAITRISE_FRAGILE.`,
    LACUNE_CONSCIENTE: (domain: string) => `${domain} : installation structurée du profil LACUNE_CONSCIENTE.`,
    ERREUR_CONFIANTE: (domain: string) => `${domain} : conflit cognitif prioritaire pour le profil ERREUR_CONFIANTE.`,
    NON_TRAITE: (domain: string) => `${domain} : diagnostic préalable du profil NON_TRAITE.`,
  }),
});

export function orderPriorityDomains(domains: FactSheet['domains']): readonly DomainFact[] {
  const canonicalOrder = new Map(domains.map(({ id }, index) => [id, index]));
  return Object.freeze(domains
    .filter(({ profile }) => profile !== 'MAITRISE')
    .slice()
    .sort((left, right) => (
      PROFILE_PRIORITY[left.profile] - PROFILE_PRIORITY[right.profile]
      || left.score - right.score
      || (canonicalOrder.get(left.id) ?? 0) - (canonicalOrder.get(right.id) ?? 0)
    )));
}

export function renderProfileNarrativeEntry(
  domain: DomainFact,
  audience: ReportAudience,
): ProfileNarrativeEntry {
  const base = Object.freeze({
    domainId: domain.id,
    profileLabel: PROFILE_FAMILY_LABELS[domain.profile],
    text: COPY[audience][domain.profile](domain.id),
  });
  if (audience !== 'NEXUS') return base;
  return Object.freeze({ ...base, profile: domain.profile, score: domain.score });
}

export function buildProfiledNarrative(
  factSheet: FactSheet,
  _identity: RenderIdentity,
  audience: ReportAudience,
): ProfiledNarrative {
  return Object.freeze({
    version: PROFILE_COPY_VERSION,
    forces: Object.freeze(factSheet.domains
      .filter(({ profile }) => profile === 'MAITRISE')
      .map((domain) => renderProfileNarrativeEntry(domain, audience))),
    priorities: Object.freeze(orderPriorityDomains(factSheet.domains)
      .map((domain) => renderProfileNarrativeEntry(domain, audience))),
  });
}
