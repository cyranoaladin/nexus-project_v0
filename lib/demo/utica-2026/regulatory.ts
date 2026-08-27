/**
 * Faits réglementaires réellement dérivés du référentiel canonique
 * `data/exams/bac-general-2027.json` (amendement A5 : tout élément présenté
 * comme réglementaire doit venir d'une source canonique, jamais inventé).
 *
 * server-only : lecture disque pure via `lib/exams/catalog.ts`, zéro réseau,
 * zéro DB (amendement A7). N'importer que depuis un Server Component.
 *
 * CANDIDATE_SPECIFIC_BAC_MAP_DEFERRED (release isolation, voir mission
 * "release isolation + go-live réel") : une version antérieure de ce module
 * appelait `genererCarteExamen()` (lib/exams/carte.ts) pour résoudre des
 * libellés candidate-spécifiques ("Mathématiques", "NSI", "SES"). Ce moteur
 * — et toute sa chaîne de dépendances (a-verifier.ts, options.ts,
 * parcours.ts) — n'existe que sur la branche pricing/devis en cours
 * (feat/candidat-individuel-pricing-devis-v2), jamais mergé sur main : le
 * transplanter dans cette release isolée réintroduirait exactement le
 * travail hors-périmètre que cette release doit exclure. La carte Bac
 * affiche donc à nouveau les épreuves génériques du référentiel telles
 * quelles (labels catalogue, jamais un mapping supposé vers les
 * spécialités de Lina) — même discipline que `getDemoRegulatoryHighlights`
 * ci-dessous. Le fait fictif à afficher étant volontairement générique,
 * aucun `AVerifiable` n'est nécessaire ici : chaque coefficient du
 * référentiel est un nombre concret.
 */
import 'server-only';
import { getEpreuve, requireExamPolicy } from '@/lib/exams/catalog';
import type { Provenanced } from './types';

const DEMO_EXAM_SESSION = 2027;

export interface RegulatoryHighlight {
  id: string;
  label: string;
  coefficient: number;
  timing: string;
}

// Épreuves choisies pour leur libellé auto-porteur (pas de mapping supposé
// vers les spécialités de Lina — on affiche le référentiel tel quel).
const HIGHLIGHT_IDS = ['eam', 'eds1', 'eds2', 'grand-oral', 'philosophie'] as const;

export function getDemoRegulatoryHighlights(): Provenanced<RegulatoryHighlight[]> {
  const policy = requireExamPolicy(DEMO_EXAM_SESSION);

  const highlights: RegulatoryHighlight[] = HIGHLIGHT_IDS.map((id) => {
    const epreuve = getEpreuve(policy, id);
    if (!epreuve) {
      throw new Error(
        `Épreuve "${id}" introuvable dans le référentiel session ${DEMO_EXAM_SESSION} — vérifier data/exams/bac-general-2027.json`,
      );
    }
    return { id: epreuve.id, label: epreuve.label, coefficient: epreuve.coefficient, timing: epreuve.timing };
  });

  const primarySource = policy.sources[0]?.label ?? 'sources versionnées';
  return {
    value: highlights,
    provenance: 'REGLEMENTAIRE_CANONIQUE',
    sourceLabel: `Référentiel officiel session ${policy.session} (${primarySource})`,
  };
}

export function getDemoTotalCoefficient(): number {
  return requireExamPolicy(DEMO_EXAM_SESSION).totalCoefficient;
}

/**
 * Jalons officiels du "Parcours vers le Bac" (§10). Dérivés du champ
 * `timing` réel de chaque épreuve ('fin_premiere' | 'fin_terminale') —
 * jamais une date : le référentiel session 2027 ne contient AUCUNE date
 * d'épreuve (vérifié : seules `fin_premiere`/`fin_terminale`/`selon_modalite`
 * existent). Les épreuves `selon_modalite` sont exclues : leur moment exact
 * dépend d'un choix de modalité non représentable comme un jalon unique.
 */
export type RegulatoryMilestoneTiming = 'fin_premiere' | 'fin_terminale';

export interface RegulatoryMilestone {
  timing: RegulatoryMilestoneTiming;
  label: string;
  epreuveIds: string[];
}

export function getDemoRegulatoryMilestones(): Provenanced<RegulatoryMilestone[]> {
  const policy = requireExamPolicy(DEMO_EXAM_SESSION);

  const byTiming = new Map<RegulatoryMilestoneTiming, typeof policy.epreuves>([
    ['fin_premiere', []],
    ['fin_terminale', []],
  ]);
  for (const epreuve of policy.epreuves) {
    if (epreuve.timing === 'fin_premiere' || epreuve.timing === 'fin_terminale') {
      byTiming.get(epreuve.timing)!.push(epreuve);
    }
  }

  const milestones: RegulatoryMilestone[] = [...byTiming.entries()]
    .filter(([, epreuves]) => epreuves.length > 0)
    .map(([timing, epreuves]) => ({
      timing,
      label: epreuves.map((e) => e.label).join(', '),
      epreuveIds: epreuves.map((e) => e.id),
    }));

  const primarySource = policy.sources[0]?.label ?? 'sources versionnées';
  return {
    value: milestones,
    provenance: 'REGLEMENTAIRE_CANONIQUE',
    sourceLabel: `Référentiel officiel session ${policy.session} (${primarySource})`,
  };
}

/**
 * Carte Bac 2027 — vue générique du référentiel (P1B §1). Note de
 * gouvernance ci-dessus (CANDIDATE_SPECIFIC_BAC_MAP_DEFERRED) : chaque
 * épreuve garde son libellé de catalogue tel quel (ex. "Enseignement de
 * spécialité 1 (conservé)"), jamais un nom de matière supposé — le
 * référentiel session 2027 ne porte lui-même aucune information de
 * spécialité par candidat (vérifié : `epreuveSchema` n'a pas de champ
 * matière/spécialité, seuls id/label/type/coefficient/timing existent).
 * Sectionnement dérivé du seul champ réglementaire disponible pour cela :
 * `epreuve.type` ('anticipe' | 'terminal' | 'ponctuel').
 */
const BAC_MAP_SESSION = 2027;

export interface BacMapItem {
  id: string;
  label: string;
  coefficient: number;
  /** Note réglementaire portée telle quelle par le référentiel, jamais reformulée. */
  notes: string[];
}

export type BacMapSectionId = 'PREMIERE' | 'TERMINALE' | 'PONCTUELLES_MODALITE_A';

export interface BacMapSection {
  id: BacMapSectionId;
  label: string;
  /** Texte réglementaire cité tel quel (ex. description de la modalité A), le cas échéant. */
  subtitle?: string;
  items: BacMapItem[];
}

const SECTION_FOR_TYPE: Record<'anticipe' | 'terminal' | 'ponctuel', BacMapSectionId> = {
  anticipe: 'PREMIERE',
  terminal: 'TERMINALE',
  ponctuel: 'PONCTUELLES_MODALITE_A',
};

export function getDemoBacMap(): Provenanced<BacMapSection[]> {
  const policy = requireExamPolicy(BAC_MAP_SESSION);
  const modaliteLabel = policy.candidatIndividuelRules.ponctuellesModality.options.find((o) => o.id === 'A')?.label;

  const itemsBySection: Record<BacMapSectionId, BacMapItem[]> = {
    PREMIERE: [],
    TERMINALE: [],
    PONCTUELLES_MODALITE_A: [],
  };
  for (const epreuve of policy.epreuves) {
    const sectionId = SECTION_FOR_TYPE[epreuve.type];
    itemsBySection[sectionId].push({
      id: epreuve.id,
      label: epreuve.label,
      coefficient: epreuve.coefficient,
      notes: epreuve.note ? [epreuve.note] : [],
    });
  }

  const rawSections: BacMapSection[] = [
    { id: 'PREMIERE', label: 'Première — épreuves anticipées', items: itemsBySection.PREMIERE },
    { id: 'TERMINALE', label: 'Terminale — épreuves terminales', items: itemsBySection.TERMINALE },
    {
      id: 'PONCTUELLES_MODALITE_A',
      label: 'Épreuves ponctuelles',
      subtitle: modaliteLabel,
      items: itemsBySection.PONCTUELLES_MODALITE_A,
    },
  ];
  const sections = rawSections.filter((section) => section.items.length > 0);

  const primarySource = policy.sources[0]?.label ?? 'sources versionnées';
  return {
    value: sections,
    provenance: 'REGLEMENTAIRE_CANONIQUE',
    sourceLabel: `Référentiel officiel session ${policy.session} (${primarySource}) — épreuves génériques du référentiel`,
  };
}
