import type { BilanPackSubject } from '../catalog/subjects';

/**
 * Libellés humains des domaines de positionnement.
 *
 * Les identifiants techniques (`proportionnalite`, `calcul-litteral`…) ne
 * doivent JAMAIS apparaître dans un texte destiné à un humain — élève, parent
 * ou équipe Nexus. Cette table est la seule source des formes françaises,
 * accentuées et accordées, de chaque domaine des packs.
 *
 * Trois formes par domaine, parce que le français ne se décline pas
 * mécaniquement :
 *
 * - `title`   : forme d'intitulé, pour les tableaux et les cartes.
 *               « Calcul littéral », « Fonctions de référence »
 * - `article` : forme avec article défini, pour le milieu de phrase.
 *               « le calcul littéral », « l'argumentation », « les fractions »
 * - `en`      : complément de lieu notionnel, préposition incluse.
 *               « en proportionnalité », « sur les fonctions de référence »
 *
 * Un test de couverture garantit qu'aucun pack VALIDATED ne déclare un domaine
 * absent de cette table.
 */

export const DOMAIN_LABELS_VERSION = 'domain-labels.v1' as const;

export type DomainLabelForms = Readonly<{
  title: string;
  article: string;
  en: string;
}>;

const LABELS: Readonly<Record<string, DomainLabelForms>> = Object.freeze({
  /* ── Mathématiques ─────────────────────────────────────────────────── */
  'calcul-litteral': { title: 'Calcul littéral', article: 'le calcul littéral', en: 'en calcul littéral' },
  'calcul-numerique': { title: 'Calcul numérique', article: 'le calcul numérique', en: 'en calcul numérique' },
  equations: { title: 'Équations', article: 'les équations', en: 'sur les équations' },
  inequations: { title: 'Inéquations et signes', article: 'les inéquations', en: 'sur les inéquations' },
  fonctions: { title: 'Fonctions', article: 'les fonctions', en: 'sur les fonctions' },
  'fonctions-reference': { title: 'Fonctions de référence', article: 'les fonctions de référence', en: 'sur les fonctions de référence' },
  vecteurs: { title: 'Vecteurs', article: 'les vecteurs', en: 'sur les vecteurs' },
  droites: { title: 'Droites du plan', article: 'les droites du plan', en: 'sur les droites du plan' },
  pourcentages: { title: 'Pourcentages et évolutions', article: 'les pourcentages', en: 'sur les pourcentages' },
  probabilites: { title: 'Probabilités', article: 'les probabilités', en: 'en probabilités' },
  proportionnalite: { title: 'Proportionnalité', article: 'la proportionnalité', en: 'en proportionnalité' },
  fractions: { title: 'Fractions', article: 'les fractions', en: 'sur les fractions' },
  puissances: { title: 'Puissances', article: 'les puissances', en: 'sur les puissances' },
  geometrie: { title: 'Géométrie', article: 'la géométrie', en: 'en géométrie' },
  trigonometrie: { title: 'Trigonométrie', article: 'la trigonométrie', en: 'en trigonométrie' },
  statistiques: { title: 'Statistiques', article: 'les statistiques', en: 'en statistiques' },
  grandeurs: { title: 'Aires et périmètres', article: 'les aires et périmètres', en: 'sur les aires et périmètres' },
  relatifs: { title: 'Nombres relatifs', article: 'les nombres relatifs', en: 'sur les nombres relatifs' },
  'nombres-relatifs': { title: 'Nombres relatifs', article: 'les nombres relatifs', en: 'sur les nombres relatifs' },
  'second-degre': { title: 'Second degré', article: 'le second degré', en: 'sur le second degré' },
  derivation: { title: 'Dérivation', article: 'la dérivation', en: 'en dérivation' },
  exponentielle: { title: 'Fonction exponentielle', article: 'la fonction exponentielle', en: 'sur la fonction exponentielle' },
  suites: { title: 'Suites numériques', article: 'les suites numériques', en: 'sur les suites numériques' },
  'produit-scalaire': { title: 'Produit scalaire', article: 'le produit scalaire', en: 'sur le produit scalaire' },

  /* ── Mathématiques expertes ────────────────────────────────────────── */
  arithmetique: { title: 'Arithmétique', article: 'l’arithmétique', en: 'en arithmétique' },
  systemes: { title: 'Systèmes d’équations', article: 'les systèmes d’équations', en: 'sur les systèmes d’équations' },
  logique: { title: 'Logique', article: 'la logique', en: 'en logique' },
  denombrement: { title: 'Dénombrement', article: 'le dénombrement', en: 'en dénombrement' },

  /* ── Français ──────────────────────────────────────────────────────── */
  grammaire: { title: 'Grammaire', article: 'la grammaire', en: 'en grammaire' },
  conjugaison: { title: 'Conjugaison', article: 'la conjugaison', en: 'en conjugaison' },
  orthographe: { title: 'Orthographe', article: 'l’orthographe', en: 'en orthographe' },
  lexique: { title: 'Lexique et figures de style', article: 'le lexique', en: 'sur le lexique et les figures de style' },
  poesie: { title: 'Poésie et versification', article: 'la poésie', en: 'en poésie' },
  lecture: { title: 'Lecture littéraire', article: 'la lecture littéraire', en: 'en lecture littéraire' },
  argumentation: { title: 'Argumentation', article: 'l’argumentation', en: 'en argumentation' },
  theatre: { title: 'Texte théâtral', article: 'le texte théâtral', en: 'sur le texte théâtral' },
  recit: { title: 'Récit et point de vue', article: 'le récit', en: 'sur le récit' },
  methode: { title: 'Méthode du commentaire', article: 'la méthode du commentaire', en: 'sur la méthode du commentaire' },

  /* ── NSI ───────────────────────────────────────────────────────────── */
  representation: { title: 'Représentation binaire', article: 'la représentation binaire', en: 'en représentation binaire' },
  booleens: { title: 'Booléens et logique', article: 'les booléens', en: 'sur les booléens' },
  'types-construits': { title: 'Types construits', article: 'les types construits', en: 'sur les types construits' },
  programmation: { title: 'Programmation', article: 'la programmation', en: 'en programmation' },
  algorithmique: { title: 'Algorithmique', article: 'l’algorithmique', en: 'en algorithmique' },
  donnees: { title: 'Données en tables', article: 'les données en tables', en: 'sur les données en tables' },
  reseaux: { title: 'Réseaux et Internet', article: 'les réseaux', en: 'sur les réseaux' },
  web: { title: 'Web', article: 'le Web', en: 'sur le Web' },
  architecture: { title: 'Architecture et systèmes', article: 'l’architecture des ordinateurs', en: 'sur l’architecture et les systèmes' },

  /* ── Physique-chimie ───────────────────────────────────────────────── */
  matiere: { title: 'Constitution de la matière', article: 'la constitution de la matière', en: 'sur la constitution de la matière' },
  transformations: { title: 'Transformations chimiques', article: 'les transformations chimiques', en: 'sur les transformations chimiques' },
  'chimie-organique': { title: 'Chimie organique', article: 'la chimie organique', en: 'en chimie organique' },
  mecanique: { title: 'Mécanique', article: 'la mécanique', en: 'en mécanique' },
  energie: { title: 'Énergie', article: 'l’énergie', en: 'sur l’énergie' },
  ondes: { title: 'Ondes et signaux', article: 'les ondes', en: 'sur les ondes' },
  optique: { title: 'Optique', article: 'l’optique', en: 'en optique' },
  electricite: { title: 'Électricité', article: 'l’électricité', en: 'en électricité' },
  mesure: { title: 'Grandeurs et mesures', article: 'les grandeurs et les mesures', en: 'sur les grandeurs et les mesures' },

  /* ── SVT ───────────────────────────────────────────────────────────── */
  genetique: { title: 'Génétique', article: 'la génétique', en: 'en génétique' },
  'organisation-du-vivant': { title: 'Organisation du vivant', article: 'l’organisation du vivant', en: 'sur l’organisation du vivant' },
  metabolisme: { title: 'Métabolisme cellulaire', article: 'le métabolisme cellulaire', en: 'sur le métabolisme cellulaire' },
  evolution: { title: 'Biodiversité et évolution', article: 'la biodiversité et l’évolution', en: 'sur la biodiversité et l’évolution' },
  geologie: { title: 'Géologie', article: 'la géologie', en: 'en géologie' },
  ecosystemes: { title: 'Écosystèmes', article: 'les écosystèmes', en: 'sur les écosystèmes' },
  'corps-humain': { title: 'Corps humain et santé', article: 'le corps humain', en: 'sur le corps humain et la santé' },
  immunite: { title: 'Immunité', article: 'l’immunité', en: 'sur l’immunité' },
  'systeme-nerveux': { title: 'Système nerveux', article: 'le système nerveux', en: 'sur le système nerveux' },
  sante: { title: 'Variation génétique et santé', article: 'la variation génétique et la santé', en: 'sur la variation génétique et la santé' },
  demarche: { title: 'Démarche scientifique', article: 'la démarche scientifique', en: 'sur la démarche scientifique' },
});

/**
 * Ajustements par matière, quand un même identifiant recouvre des réalités
 * différentes d'une discipline à l'autre.
 */
const SUBJECT_OVERRIDES: Readonly<Record<string, DomainLabelForms>> = Object.freeze({
  'PHILOSOPHIE:lexique': { title: 'Vocabulaire des notions', article: 'le vocabulaire des notions', en: 'sur le vocabulaire des notions' },
  'PHILOSOPHIE:ecriture': { title: 'Écriture argumentée', article: 'l’écriture argumentée', en: 'en écriture argumentée' },
  'PHILOSOPHIE:argumentation': { title: 'Analyse et argumentation', article: 'l’analyse et l’argumentation', en: 'en analyse et argumentation' },
});

/* `ecriture` n'existe qu'en philosophie, mais la table principale doit rester
 * complète : la forme générique sert de filet si un autre pack l'adopte. */
const GENERIC_ECRITURE: DomainLabelForms = Object.freeze({
  title: 'Écriture', article: 'l’écriture', en: 'en écriture',
});

function genericFallback(domainId: string): DomainLabelForms {
  const flat = domainId.replace(/-/g, ' ').trim();
  return Object.freeze({ title: flat.charAt(0).toUpperCase() + flat.slice(1), article: flat, en: `sur ${flat}` });
}

export function domainLabel(domainId: string, subject?: BilanPackSubject): DomainLabelForms {
  if (subject !== undefined) {
    const override = SUBJECT_OVERRIDES[`${subject}:${domainId}`];
    if (override !== undefined) return override;
  }
  if (domainId === 'ecriture') return GENERIC_ECRITURE;
  return LABELS[domainId] ?? genericFallback(domainId);
}

/** Forme d'intitulé : « Calcul littéral ». */
export function domainTitle(domainId: string, subject?: BilanPackSubject): string {
  return domainLabel(domainId, subject).title;
}

/** Forme avec article, milieu de phrase : « le calcul littéral ». */
export function domainWithArticle(domainId: string, subject?: BilanPackSubject): string {
  return domainLabel(domainId, subject).article;
}

/** Complément notionnel, préposition incluse : « en calcul littéral ». */
export function domainIn(domainId: string, subject?: BilanPackSubject): string {
  return domainLabel(domainId, subject).en;
}

/** Majuscule initiale d'une forme fléchie : « la géométrie » → « La géométrie »,
 * « l’argumentation » → « L’argumentation » (seule la première lettre change). */
export function sentenceStart(fragment: string): string {
  return fragment.charAt(0).toUpperCase() + fragment.slice(1);
}

/** Vrai si l'identifiant possède une forme humaine dédiée (test de couverture). */
export function hasDomainLabel(domainId: string, subject?: BilanPackSubject): boolean {
  if (domainId === 'ecriture') return true;
  if (subject !== undefined && SUBJECT_OVERRIDES[`${subject}:${domainId}`] !== undefined) return true;
  return LABELS[domainId] !== undefined;
}

/** Énumération française : « la géométrie, les fractions et l’argumentation ». */
export function enumerateFr(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}
