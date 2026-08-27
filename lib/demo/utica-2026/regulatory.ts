/**
 * Faits réglementaires réellement dérivés du référentiel canonique
 * `data/exams/bac-general-2027.json` (amendement A5 : tout élément présenté
 * comme réglementaire doit venir d'une source canonique, jamais inventé).
 *
 * server-only : lecture disque pure via `lib/exams/catalog.ts`, zéro réseau,
 * zéro DB (amendement A7). N'importer que depuis un Server Component.
 *
 * Volontairement minimal pour le P0 : on affiche quelques épreuves réelles
 * avec leur coefficient exact, on n'appelle pas le moteur complet
 * `genererCarteExamen()` (carte d'examen intégrale) — reporté à une itération
 * ultérieure si le besoin se confirme.
 */
import 'server-only';
import { getEpreuve, requireExamPolicy } from '@/lib/exams/catalog';
import { requireResolved, type AVerifiable } from '@/lib/exams/a-verifier';
import { genererCarteExamen, type EpreuveNature } from '@/lib/exams/carte';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import { demoScenario } from './scenario';
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
 * Carte Bac 2027 candidate-spécifique (P1C §0). Construite en appelant le
 * moteur canonique `genererCarteExamen()` (lib/exams/carte.ts) avec un
 * `ProfilCandidatInput` reflétant exactement `demoScenario.student` — c'est
 * ce même moteur qui sert la production (assistante, simulateur public),
 * jamais une logique de résolution dupliquée ici. Les libellés
 * spécialité-spécifiques ("NSI", "Mathématiques", "SES" pour la spécialité
 * abandonnée) viennent de `EpreuveCarte.matiere`, résolu par le moteur lui-
 * même depuis `profil.specialite1/2/specialiteAbandonnee` — jamais un
 * mapping manuel reconstruit dans ce module (préflight P1C : confirmé
 * possible sans modifier le moteur, voir lib/exams/carte.ts::buildAnticipeeLine
 * / resolveTerminaleLine / subjectLabel).
 *
 * Fail-closed : si le profil démo produisait un jour une carte nécessitant
 * une revue humaine (necessiteVerificationHumaine=true), cette fonction lève
 * une erreur plutôt que d'afficher une carte partiellement incertaine sans
 * le signaler — un scénario de démonstration doit toujours être entièrement
 * résolu.
 */
const BAC_MAP_SESSION = 2027;

function buildDemoProfilCandidatInput(): ProfilCandidatInput {
  const student = demoScenario.student;
  return {
    level: 'TERMINALE',
    examSession: student.examSession,
    modalite: student.modalite,
    specialite1: student.specialites[0],
    specialite2: student.specialites[1],
    specialiteAbandonnee: student.specialiteAbandonnee,
    langueA: student.langueA,
    langueB: student.langueB,
    estRedoublant: false,
    estTitulaireBacDejaObtenu: false,
    changementSpecialite: false,
    intentionAmelioration: false,
    intentionCycleComplet: true,
    brancheBascule: null,
    epreuvesDispenseesDeclarees: [],
    dispensesDeclarees: null,
    etalementPlurisessionsDeclare: false,
    moyenneRattrapage: null,
    optionsTerminale: [],
    notesConservees: null,
    p3EligibiliteAudit: null,
  };
}

export interface BacMapItem {
  id: string;
  label: string;
  coefficient: AVerifiable<number>;
  /** true uniquement si le scénario pédagogique de la démo suit réellement cette matière. */
  trackedByNexus: boolean;
  /** Avertissements réglementaires portés par le moteur (ex. dispense de partie pratique) — jamais reformulés. */
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

const SECTION_FOR_NATURE: Record<EpreuveNature, BacMapSectionId | null> = {
  ANTICIPEE: 'PREMIERE',
  TERMINALE: 'TERMINALE',
  PONCTUELLE: 'PONCTUELLES_MODALITE_A',
  OPTION: null, // le profil démo ne déclare aucune option
};

export function getDemoBacMap(): Provenanced<BacMapSection[]> {
  const policy = requireExamPolicy(BAC_MAP_SESSION);
  const rules = requireResolved(policy.candidatIndividuelRules, `session ${BAC_MAP_SESSION} candidatIndividuelRules`);
  const modaliteLabel = rules.ponctuellesModality.options.find((o) => o.id === 'A')?.label;

  const carte = genererCarteExamen({ profil: buildDemoProfilCandidatInput(), policy });
  if (carte.necessiteVerificationHumaine) {
    throw new Error(
      `Carte Bac démo non entièrement résolue (necessiteVerificationHumaine=true) — vérifier demoScenario.student : ${carte.avertissementsGeneraux.join(' | ') || '(aucun détail)'}`,
    );
  }

  // Matières réellement suivies par le scénario pédagogique de la démo
  // (lib/demo/utica-2026/scenario.ts::subjectTracks) — comparaison directe
  // aux libellés résolus par le moteur, aucun id d'épreuve codé en dur.
  const trackedMatieres = new Set(demoScenario.subjectTracks.map((t) => t.label));

  const itemsBySection: Record<BacMapSectionId, BacMapItem[]> = {
    PREMIERE: [],
    TERMINALE: [],
    PONCTUELLES_MODALITE_A: [],
  };
  for (const epreuve of carte.epreuves) {
    const sectionId = SECTION_FOR_NATURE[epreuve.nature];
    if (!sectionId) continue;
    itemsBySection[sectionId].push({
      id: epreuve.code,
      label: epreuve.matiere,
      coefficient: epreuve.coefficientEffectif,
      trackedByNexus: trackedMatieres.has(epreuve.matiere),
      notes: epreuve.avertissements,
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
    sourceLabel: `Référentiel officiel session ${policy.session} (${primarySource}) — carte résolue via genererCarteExamen()`,
  };
}
