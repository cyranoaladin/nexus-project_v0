/**
 * Corpus shadow synthétique (recâblage mission §10) — pas d'environnement de
 * production accessible, donc corpus de profils-types synthétiques et
 * anonymisés (aucune donnée réelle, ProfilCandidatInput ne porte aucun champ
 * nominatif par construction). Ce fichier :
 *
 * 1. Exécute runShadowComparison (le vrai chemin de comparaison, tel que câblé
 *    dans app/api/quotes/route.ts) sur les profils que SituationInput (forme
 *    historique) peut représenter — "Section A, comparable".
 * 2. Exécute buildCandidateQuoteRecommendation directement (nouveau pipeline
 *    seul) sur les profils qu'AUCUNE forme SituationInput ne peut représenter
 *    (P3-P12 hors P1/P2/P10, conservation, dispense, options...) — "Section B,
 *    nouveau périmètre, non comparable par construction, pas par choix".
 * 3. Génère un rapport markdown (docs/candidat-individuel/
 *    shadow-corpus-synthetique-resultats.md) étiqueté SYNTHÉTIQUE — jamais
 *    présenté comme une observation de production (mission §10, explicite).
 *
 * Ce fichier n'est pas un test de régression au sens golden — c'est un
 * générateur de preuve, réexécutable, dont les assertions vérifient la
 * cohérence structurelle du corpus (taille, absence de PII, rapport écrit)
 * plutôt qu'un résultat figé ligne à ligne.
 */
import fs from 'fs';
import path from 'path';
import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineInput, type CandidateQuotePipelineResult } from '@/lib/quotes/pipeline';
import { runShadowComparison, buildAggregateDivergenceReport, type ShadowComparisonRecord } from '@/lib/quotes/shadow-comparison';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import type { BuildRecommendationInput } from '@/lib/quotes/recommendation';
import type { SituationInput, BudgetInput } from '@/lib/quotes/schemas';
import type { PublicCandidateInputRaw } from '@/lib/exams/normalize';

afterEach(() => resetCatalogueCacheForTests());

const SESSION = 2027;
const BUDGET_STANDARD: BudgetInput = { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' };
const BUDGET_BAS: BudgetInput = { monthlyBudgetTnd: 150, strategy: 'RESPECT_BUDGET' };
const BUDGET_ELEVE: BudgetInput = { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' };

function basePublicInput(overrides: Partial<PublicCandidateInputRaw> = {}): PublicCandidateInputRaw {
  return {
    level: 'TERMINALE',
    examSession: SESSION,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
    ...overrides,
  };
}

// ── Section A — représentable par SituationInput (forme historique), donc
// comparable via le vrai chemin runShadowComparison. ──

interface SectionAProfile {
  label: string;
  dimension: string;
  situation: SituationInput;
  legacyInput: BuildRecommendationInput;
}

const DIAGNOSTIC_FAIBLE = {
  mathematiques: { points: 4, maxPoints: 20, percentage: 20 },
  anglais: { points: 5, maxPoints: 20, percentage: 25 },
};

const sectionA: SectionAProfile[] = [
  {
    label: 'A1 — Terminale, modalité implicite dans SituationInput',
    dimension: 'Terminale',
    situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'] },
    legacyInput: { situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'] }, diagnosticDomainScores: null, budget: BUDGET_STANDARD },
  },
  {
    label: 'A2 — Première',
    dimension: 'Première',
    situation: { level: 'premiere', examSession: SESSION, specialites: ['MATHEMATIQUES', 'SES'] },
    legacyInput: { situation: { level: 'premiere', examSession: SESSION, specialites: ['MATHEMATIQUES', 'SES'] }, diagnosticDomainScores: null, budget: BUDGET_STANDARD },
  },
  {
    label: 'A3 — diagnostic absent',
    dimension: 'diagnostic absent',
    situation: { level: 'terminale', examSession: SESSION, specialites: ['NSI', 'MATHEMATIQUES'] },
    legacyInput: { situation: { level: 'terminale', examSession: SESSION, specialites: ['NSI', 'MATHEMATIQUES'] }, diagnosticDomainScores: null, budget: BUDGET_STANDARD },
  },
  {
    label: 'A4 — diagnostic faible (20-25%, tier A_RECTIFIER attendu)',
    dimension: 'diagnostic faible',
    situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'SES'], langueA: 'ANGLAIS' },
    legacyInput: { situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'SES'], langueA: 'ANGLAIS' }, diagnosticDomainScores: DIAGNOSTIC_FAIBLE, budget: BUDGET_STANDARD },
  },
  {
    label: 'A5 — budget bas (150 TND/mois)',
    dimension: 'budget bas',
    situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'] },
    legacyInput: { situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'] }, diagnosticDomainScores: null, budget: BUDGET_BAS },
  },
  {
    label: 'A6 — budget élevé (5000 TND/mois)',
    dimension: 'budget élevé',
    situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'] },
    legacyInput: { situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'] }, diagnosticDomainScores: null, budget: BUDGET_ELEVE },
  },
  {
    label: 'A7 — spécialité abandonnée renseignée',
    dimension: 'options / spécialité abandonnée',
    situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'], specialiteAbandonnee: 'SES' },
    legacyInput: { situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'], specialiteAbandonnee: 'SES' }, diagnosticDomainScores: null, budget: BUDGET_STANDARD },
  },
  {
    label: 'A8 — langues A/B renseignées (LVA/LVB)',
    dimension: 'options',
    situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'], langueA: 'ANGLAIS', langueB: 'ESPAGNOL' },
    legacyInput: { situation: { level: 'terminale', examSession: SESSION, specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'], langueA: 'ANGLAIS', langueB: 'ESPAGNOL' }, diagnosticDomainScores: null, budget: BUDGET_STANDARD },
  },
];

// ── Section B — hors périmètre de SituationInput (P3-P12, conservation,
// dispense, options, élément non approuvé) : aucune comparaison legacy
// possible par construction (la forme historique n'a pas ces champs), donc
// classée directement, jamais forcée dans le comparateur shadow. ──

interface SectionBProfile {
  label: string;
  dimension: string;
  input: CandidateQuotePipelineInput;
}

const sectionB: SectionBProfile[] = [
  { label: 'B1 — P1 libre 2 ans modalité A', dimension: 'P1', input: { publicInput: basePublicInput({ modalite: 'A' }), budget: BUDGET_STANDARD } },
  { label: 'B2 — P2 libre 2 ans modalité B', dimension: 'P2', input: { publicInput: basePublicInput({ modalite: 'B' }), budget: BUDGET_STANDARD } },
  {
    label: 'B3 — P3 dérogation même session (motif confirmé)',
    dimension: 'P3',
    input: {
      publicInput: basePublicInput(),
      staffExtension: {
        p3EligibiliteAudit: [
          { motif: 'age20', faitsDeclares: true, justificatifRequis: false, justificatifValide: true, decision: 'CONFIRMEE', validateurUserId: 'staff-corpus', dateDecision: '2026-08-25', sourceReglementaire: 'Article 3, arrêté du 16 juillet 2018' },
        ],
      },
      budget: BUDGET_STANDARD,
    },
  },
  { label: 'B4 — P4 redoublement première', dimension: 'P4', input: { publicInput: basePublicInput({ level: 'PREMIERE' }), budget: BUDGET_STANDARD } },
  { label: 'B5 — P5 redoublement terminale', dimension: 'P5', input: { publicInput: basePublicInput({ estRedoublant: true }), budget: BUDGET_STANDARD } },
  { label: 'B6 — P6 amélioration + terminale', dimension: 'P6', input: { publicInput: basePublicInput({ estRedoublant: true, intentionAmelioration: true }), budget: BUDGET_STANDARD } },
  { label: 'B7 — P7 titulaire du bac', dimension: 'P7 / titulaire', input: { publicInput: basePublicInput({ estTitulaireBacDejaObtenu: true }), budget: BUDGET_STANDARD } },
  { label: 'B8 — P8 bascule scolaire vers individuel', dimension: 'P8 / bascule', input: { publicInput: basePublicInput({ brancheBascule: 'CONSERVATION_MOYENNES_PREMIERE' }), budget: BUDGET_STANDARD } },
  { label: 'B9 — P9 combiné (changement de spécialité sur P1)', dimension: 'P9 combiné', input: { publicInput: basePublicInput({ changementSpecialite: true, specialiteAbandonnee: 'SES' }), budget: BUDGET_STANDARD } },
  { label: 'B10 — P10 épreuves anticipées seules (première, hors cycle complet)', dimension: 'P10', input: { publicInput: basePublicInput({ level: 'PREMIERE', intentionCycleComplet: false }), budget: BUDGET_STANDARD } },
  { label: 'B11 — P11 second groupe (moyenne rattrapage 9/20)', dimension: 'P11', input: { publicInput: basePublicInput({ moyenneRattrapage: 9 }), budget: BUDGET_STANDARD } },
  { label: 'B12 — P12 étalement plurisessions déclaré', dimension: 'P12', input: { publicInput: basePublicInput({ etalementPlurisessionsDeclare: true }), budget: BUDGET_STANDARD } },
  {
    label: 'B13 — conservation (note conservée confirmée, D. 334-13)',
    dimension: 'conservation',
    input: {
      publicInput: basePublicInput(),
      staffExtension: { notesConservees: [{ epreuveId: 'eds1', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }] },
      budget: BUDGET_STANDARD,
    },
  },
  {
    label: 'B14 — reconduction automatique confirmée (audit vérifié, D. 334-7-1, redoublement terminale)',
    dimension: 'reconduction',
    input: {
      publicInput: basePublicInput({ estRedoublant: true }),
      staffExtension: {
        notesConservees: [
          {
            epreuveId: 'eds1',
            note: 16,
            sessionObtention: 2026,
            mecanisme: 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE',
            reconductionAudit: {
              mecanismeDeclare: 'RECONDUCTION_AUTOMATIQUE_DECLAREE',
              statutVerification: 'VERIFIEE',
              validateurUserId: 'staff-corpus',
              dateValidation: '2026-08-25',
              sourceReglementaire: 'Article D. 334-7-1',
              sessionOrigine: 2026,
              sessionCible: 2027,
            },
          },
        ],
      },
      budget: BUDGET_STANDARD,
    },
  },
  {
    label: 'B15 — dispense confirmée (arrêté du 14 mai 2020)',
    dimension: 'dispense',
    input: {
      publicInput: basePublicInput({ estTitulaireBacDejaObtenu: true }),
      staffExtension: { dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-CORPUS-1' }] },
      budget: BUDGET_STANDARD,
    },
  },
  {
    label: "B16 — option déclarée, élément non approuvé (Maths expertes, coefficient non sourcé)",
    dimension: 'options / élément non approuvé',
    input: { publicInput: basePublicInput({ optionsTerminale: ['MATHS_EXPERTES'] }), budget: BUDGET_STANDARD },
  },
  {
    label: 'B17 — profil READY (P7 intégralement dispensé — Pilotage seul)',
    dimension: 'READY / pack ou sur-mesure',
    input: {
      publicInput: basePublicInput({ estTitulaireBacDejaObtenu: true }),
      staffExtension: {
        dispensesDeclarees: [
          { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
          { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
          { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'REF-3' },
          { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'REF-4' },
          { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'REF-5' },
          { epreuveId: 'lva', statut: 'CONFIRMEE', justificatifRef: 'REF-6' },
          { epreuveId: 'lvb', statut: 'CONFIRMEE', justificatifRef: 'REF-7' },
          { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'REF-8' },
          { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'REF-9' },
        ],
      },
      budget: BUDGET_STANDARD,
    },
  },
  {
    label: 'B18 — budget insuffisant pour le socle (1 TND/mois, même profil READY)',
    dimension: 'budget bas (nouveau périmètre)',
    input: {
      publicInput: basePublicInput({ estTitulaireBacDejaObtenu: true }),
      staffExtension: {
        dispensesDeclarees: [
          { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
          { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
          { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'REF-3' },
          { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'REF-4' },
          { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'REF-5' },
          { epreuveId: 'lva', statut: 'CONFIRMEE', justificatifRef: 'REF-6' },
          { epreuveId: 'lvb', statut: 'CONFIRMEE', justificatifRef: 'REF-7' },
          { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'REF-8' },
          { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'REF-9' },
        ],
      },
      budget: { monthlyBudgetTnd: 1, strategy: 'RESPECT_BUDGET' },
    },
  },
  {
    label: 'B19 — dispense déclarée non confirmée (fail-closed attendu)',
    dimension: 'dispense (non confirmée)',
    input: {
      publicInput: basePublicInput({ estTitulaireBacDejaObtenu: true }),
      staffExtension: { dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'DECLAREE' }] },
      budget: BUDGET_STANDARD,
    },
  },
  {
    label: 'B20 — note conservée mécanisme INDETERMINE (fail-closed attendu)',
    dimension: 'conservation (indéterminée)',
    input: {
      publicInput: basePublicInput(),
      staffExtension: { notesConservees: [{ epreuveId: 'eaf-ecrit', note: 15, sessionObtention: 2026, mecanisme: 'INDETERMINE' }] },
      budget: BUDGET_STANDARD,
    },
  },
  {
    label: 'B21 — nominal terminale sans aucune donnée incertaine (référence)',
    dimension: 'élément non approuvé (HG/ES/EMC/LVA/LVB structurels)',
    input: { publicInput: basePublicInput(), budget: BUDGET_STANDARD },
  },
];

// ── Exécution + rapport ──

interface SectionBResult {
  profile: SectionBProfile;
  result: CandidateQuotePipelineResult;
}

function classifySectionB(result: CandidateQuotePipelineResult): { status: string; note: string; matchedOfferId?: string | null } {
  if (result.status === 'READY') {
    const recommande = result.scenarios.find((s) => s.tier === 'RECOMMANDE') ?? result.scenarios[0];
    return {
      status: `READY (diagnostic=${result.diagnosticStatus}, budgetInsuffisant=${result.budgetInsuffisantPourSocle})`,
      note: recommande.matchedOfferId ? `pack canonique apparié (${recommande.matchedOfferId})` : 'sur-mesure (aucun pack canonique apparié)',
      matchedOfferId: recommande.matchedOfferId,
    };
  }
  if (result.status === 'DIRECTION_APPROVAL_REQUIRED') return { status: result.status, note: `${result.pendingModuleIds.length} module(s) en attente d'arbitrage direction` };
  if (result.status === 'HUMAN_REVIEW_REQUIRED') return { status: result.status, note: `${result.avertissements.length} avertissement(s)` };
  if (result.status === 'INVALID') return { status: result.status, note: result.reasons.join(' ; ') };
  if (result.status === 'NOT_ELIGIBLE') return { status: result.status, note: result.reasons.join(' ; ') };
  if (result.status === 'UNPRICED') return { status: result.status, note: result.reason };
  // Exhaustive: READY/DIRECTION_APPROVAL_REQUIRED/HUMAN_REVIEW_REQUIRED/
  // INVALID/NOT_ELIGIBLE/UNPRICED cover every CandidateQuotePipelineResult
  // status (PROVISIONAL was deleted as a dead canonical state — mission
  // "fair go-live" Phase G) — result is `never` here.
  return result;
}

test('corpus shadow synthétique — comparaison réelle (Section A) + classification nouveau périmètre (Section B), rapport généré (mission recâblage §10)', () => {
  const sectionARecords: ShadowComparisonRecord[] = sectionA.map((p) => runShadowComparison(p.situation, p.legacyInput));
  const sectionBResults: SectionBResult[] = sectionB.map((p) => ({ profile: p, result: buildCandidateQuoteRecommendation(p.input) }));

  const totalCorpusSize = sectionA.length + sectionB.length;
  expect(totalCorpusSize).toBeGreaterThanOrEqual(22);

  // Aucune fuite de PII possible par construction — SituationInput/
  // PublicCandidateInputRaw n'ont aucun champ nominatif — vérifié quand même
  // explicitement, pas seulement supposé.
  const PII_PATTERN = /nom|email|telephone|phone|adresse/i;
  for (const r of sectionARecords) {
    expect(PII_PATTERN.test(JSON.stringify(r))).toBe(false);
  }

  const aggregate = buildAggregateDivergenceReport(sectionARecords);
  expect(aggregate.totalSimulations).toBe(sectionA.length);

  // Finding attendu (documenté dans shadow-comparison.ts avant ce corpus) :
  // SituationInput ne porte aucun concept de modalité -> chaque comparaison
  // Section A tombe sur INSUFFICIENT_INPUT. Vérifié ici systématiquement sur
  // 8 profils variés (diagnostic/budget/langues différents), pas supposé.
  const allInsufficientInput = sectionARecords.every((r) => r.divergenceCategory === 'INSUFFICIENT_INPUT');
  expect(allInsufficientInput).toBe(true);

  // ── Génération du rapport markdown ──
  const lines: string[] = [];
  lines.push('# Corpus shadow synthétique — résultats (mission recâblage §10)');
  lines.push('');
  lines.push('**STATUT : CORPUS SYNTHÉTIQUE, JAMAIS UNE OBSERVATION DE PRODUCTION.**');
  lines.push(
    'Aucun environnement réel n\'est accessible à ce stade — tous les profils ci-dessous sont fabriqués, ' +
      'anonymes par construction (aucun champ nominatif dans SituationInput/PublicCandidateInputRaw), et ' +
      `générés le ${new Date().toISOString().slice(0, 10)} par __tests__/lib/quotes/shadow-corpus.synthetic.test.ts. ` +
      'Ce document ne doit jamais être cité comme une mesure réelle de conversion, de marge ou de comportement client.',
  );
  lines.push('');
  lines.push(
    '## Section A — comparable via le vrai chemin `runShadowComparison` (8 profils)',
  );
  lines.push('');
  lines.push(
    'Exécuté avec exactement la fonction appelée par `app/api/quotes/route.ts` en mode SHADOW — pas une ' +
      'réimplémentation. **Constat systématique et non fabriqué : les 8 profils, malgré des variations de ' +
      'diagnostic/budget/langues/spécialité abandonnée, classent tous `INSUFFICIENT_INPUT`.** Cause racine ' +
      '(documentée dans le code avant ce corpus, confirmée ici empiriquement) : `SituationInput` — la forme ' +
      'du moteur historique — ne porte aucun concept de modalité (A/B), un champ que le nouveau pipeline ' +
      'exige. `situationToPublicInput` n\'infère jamais cette valeur (fail-closed, décision déjà prise) — donc ' +
      'aucune comparaison prix-à-prix legacy/nouveau n\'est possible aujourd\'hui via ce chemin réel, pour ' +
      'aucun profil, pas seulement les cas particuliers.',
  );
  lines.push('');
  lines.push('| Profil | Dimension | Catégorie | Détail |');
  lines.push('|---|---|---|---|');
  sectionA.forEach((p, i) => {
    const r = sectionARecords[i];
    lines.push(`| ${p.label} | ${p.dimension} | ${r.divergenceCategory} | ${r.detail} |`);
  });
  lines.push('');
  lines.push('**Rapport agrégé (`buildAggregateDivergenceReport`)** :');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(aggregate, null, 2));
  lines.push('```');
  lines.push('');
  lines.push(
    '**Conséquence pour la mission** : tant que le nouveau pipeline reste en mode SHADOW, aucune preuve ' +
      'chiffrée de convergence/divergence prix legacy vs nouveau ne peut être produite via ce chemin — pas ' +
      'un défaut de ce corpus, un fait structurel du format historique. Pour obtenir une vraie comparaison ' +
      'prix-à-prix, `situationToPublicInput` devrait recevoir une source de modalité (ex. un champ ajouté au ' +
      'formulaire familial existant), ce qui est un changement de périmètre commercial (nouveau champ visible ' +
      'famille), pas un simple correctif technique — à signaler à la direction, pas à corriger silencieusement.',
  );
  lines.push('');
  lines.push('## Section B — nouveau périmètre, non comparable par construction (21 profils)');
  lines.push('');
  lines.push(
    'Ces dimensions (P3-P12 hors P1/P2/P10, conservation, reconduction, dispense, options, éléments non ' +
      'approuvés) n\'ont aucune représentation dans `SituationInput` — les forcer dans `runShadowComparison` ' +
      'produirait un `INSUFFICIENT_INPUT` qui masquerait leur vrai comportement. Classées ici directement via ' +
      '`buildCandidateQuoteRecommendation` (nouveau pipeline seul), sans comparaison inventée.',
  );
  lines.push('');
  lines.push('| Profil | Dimension | Statut | Note |');
  lines.push('|---|---|---|---|');
  const statusCounts: Record<string, number> = {};
  sectionBResults.forEach(({ profile, result }) => {
    const c = classifySectionB(result);
    statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
    lines.push(`| ${profile.label} | ${profile.dimension} | ${c.status} | ${c.note} |`);
  });
  lines.push('');
  lines.push('**Répartition des statuts (Section B, 21 profils)** :');
  lines.push('');
  lines.push('| Statut | Nombre |');
  lines.push('|---|---:|');
  Object.entries(statusCounts).forEach(([status, n]) => lines.push(`| ${status} | ${n} |`));
  lines.push('');
  lines.push(
    '## Dimensions demandées par la mission §10 sans représentation dans le pipeline actuel',
  );
  lines.push('');
  lines.push(
    '- **Format présentiel / distanciel / mixte** : aucune de ces valeurs n\'existe comme champ candidat ' +
      'aujourd\'hui — chaque module du catalogue déclare son propre format fixe ' +
      '(`petit_groupe`, `individuel_presentiel`, `autonomie_guidee_aria`), la famille ne choisit jamais un ' +
      'format de livraison indépendamment du module. Non testable comme dimension d\'entrée séparée sans ' +
      'inventer un champ qui n\'existe pas dans le produit actuel.',
  );
  lines.push(
    '- **Pack / sur-mesure** : ce n\'est pas une dimension d\'entrée mais une observation de sortie ' +
      '(`matchedOfferId` sur chaque scénario). Reporté ci-dessus pour le seul profil B17 qui atteint READY ' +
      '(les autres profils Section B n\'atteignent pas un statut produisant des scénarios).',
  );
  lines.push('');

  const outPath = path.join(process.cwd(), 'docs', 'candidat-individuel', 'shadow-corpus-synthetique-resultats.md');
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
  expect(fs.existsSync(outPath)).toBe(true);

  // Sanity — Section B doit couvrir au moins un statut par grande famille
  // (pas seulement un seul statut répété partout, ce qui trahirait un corpus
  // dégénéré plutôt que représentatif).
  const distinctStatuses = new Set(sectionBResults.map((r) => r.result.status));
  expect(distinctStatuses.size).toBeGreaterThanOrEqual(3);
});
