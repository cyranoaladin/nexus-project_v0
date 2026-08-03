import type { BilanPackSubject } from '../catalog/subjects';

export const SUBJECT_DISPLAY_POLICY_VERSION = 'subject-display.v1' as const;

type DisplayGroup = Readonly<{
  label: string;
  terms: readonly string[];
}>;

type SubjectDisplayPolicy = Readonly<{
  tableNoun: 'domaines' | 'aptitudes';
  groups: readonly DisplayGroup[];
  fallbackLabel: string;
}>;

const POLICY: Readonly<Record<BilanPackSubject, SubjectDisplayPolicy>> = Object.freeze({
  MATHS: {
    tableNoun: 'domaines',
    groups: [
      { label: 'Nombres et calcul', terms: ['nombre', 'relatif', 'fraction', 'puissance', 'calcul-numerique', 'arithmetique'] },
      { label: 'Algèbre et fonctions', terms: ['calcul-litteral', 'equation', 'inequation', 'fonction', 'second-degre', 'derivation', 'exponentielle', 'suite'] },
      { label: 'Géométrie, données et probabilités', terms: ['geometrie', 'trigonometrie', 'vecteur', 'droite', 'scalaire', 'statistique', 'probabilite', 'pourcentage', 'grandeur'] },
    ],
    fallbackLabel: 'Autres repères mathématiques',
  },
  MATHS_EXPERTES: {
    tableNoun: 'domaines',
    groups: [
      { label: 'Raisonnement et calcul', terms: ['arithmetique', 'calcul', 'logique', 'systeme'] },
      { label: 'Suites et combinatoire', terms: ['suite', 'denombrement'] },
    ],
    fallbackLabel: 'Autres repères de mathématiques expertes',
  },
  FRANCAIS: {
    tableNoun: 'domaines',
    groups: [
      { label: 'Maîtrise de la langue', terms: ['grammaire', 'conjugaison', 'orthographe', 'lexique'] },
      { label: 'Lecture et analyse', terms: ['lecture', 'poesie', 'theatre', 'recit'] },
      { label: 'Expression et argumentation', terms: ['ecriture', 'argumentation', 'methode'] },
    ],
    fallbackLabel: 'Autres repères de français',
  },
  NSI: {
    tableNoun: 'domaines',
    groups: [
      { label: 'Représentation et données', terms: ['representation', 'type', 'donnee', 'booleen'] },
      { label: 'Algorithmique et programmation', terms: ['algorith', 'programmation'] },
      { label: 'Architectures, réseaux et Web', terms: ['architecture', 'reseau', 'web'] },
    ],
    fallbackLabel: 'Autres repères de NSI',
  },
  PHYSIQUE_CHIMIE: {
    tableNoun: 'domaines',
    groups: [
      { label: 'Matière et transformations', terms: ['matiere', 'transformation', 'chimie'] },
      { label: 'Mouvement et énergie', terms: ['mecanique', 'energie'] },
      { label: 'Ondes, optique et électricité', terms: ['onde', 'optique', 'electricite', 'mesure'] },
    ],
    fallbackLabel: 'Autres repères de physique-chimie',
  },
  SVT: {
    tableNoun: 'domaines',
    groups: [
      { label: 'Vivant, génétique et évolution', terms: ['vivant', 'genetique', 'evolution', 'metabolisme'] },
      { label: 'Corps humain et santé', terms: ['corps', 'sante', 'immunite', 'nerveux'] },
      { label: 'Planète, écosystèmes et démarche', terms: ['geologie', 'ecosysteme', 'demarche'] },
    ],
    fallbackLabel: 'Autres repères de SVT',
  },
  PHILOSOPHIE: {
    tableNoun: 'aptitudes',
    groups: [
      { label: 'Comprendre et définir', terms: ['lexique', 'lecture', 'analyse'] },
      { label: 'Argumenter et rédiger', terms: ['argumentation', 'ecriture', 'methode'] },
    ],
    fallbackLabel: 'Autres aptitudes',
  },
  SES: { tableNoun: 'domaines', groups: [], fallbackLabel: 'Repères de sciences économiques et sociales' },
  HISTOIRE_GEOGRAPHIE: { tableNoun: 'domaines', groups: [], fallbackLabel: 'Repères d’histoire-géographie' },
  GRAND_ORAL: { tableNoun: 'aptitudes', groups: [], fallbackLabel: 'Aptitudes du Grand oral' },
});

export interface DisplayDomain {
  id: string;
}

export interface DisplayDomainGroup<T extends DisplayDomain> {
  label: string;
  domains: T[];
}

export function subjectDisplayPolicy(subject: BilanPackSubject): SubjectDisplayPolicy {
  return POLICY[subject];
}

export function groupDomainsForDisplay<T extends DisplayDomain>(
  subject: BilanPackSubject,
  domains: readonly T[],
): DisplayDomainGroup<T>[] {
  const policy = POLICY[subject];
  const grouped = new Map(policy.groups.map((group) => [group.label, [] as T[]]));
  const fallback: T[] = [];

  for (const domain of domains) {
    const normalized = domain.id.toLocaleLowerCase('fr-FR');
    const group = policy.groups.find(({ terms }) => terms.some((term) => normalized.includes(term)));
    if (group === undefined) fallback.push(domain);
    else grouped.get(group.label)!.push(domain);
  }

  const result = policy.groups
    .map(({ label }) => ({ label, domains: grouped.get(label)! }))
    .filter(({ domains: members }) => members.length > 0);
  if (fallback.length > 0) result.push({ label: policy.fallbackLabel, domains: fallback });
  return result;
}
