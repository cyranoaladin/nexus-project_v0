'use client';

/**
 * Preview of the FUTURE public candidat-individuel wizard (mission "vers
 * un produit complet" §6-§10), running the new carte-aware pipeline via
 * /api/assistante/candidat-individuel/simulate — never replacing the real
 * public wizard (components/quotes/DevisWizard.tsx, still live at
 * /devis-bac on the legacy engine). Reuses that wizard's exact visual
 * language (lux-* tokens, StepFieldset/RadioOption pattern, 44px targets,
 * price-before-PII ordering) rather than inventing a new style.
 *
 * Scope note, stated explicitly rather than silently: of the 20 steps the
 * mission listed, "format" (présentiel/distanciel/mixte) and
 * "disponibilité" are NOT implemented here — neither exists as a real,
 * selectable concept in the product today (confirmed during the mission
 * §10 synthetic-corpus work: every catalogue module declares its own
 * fixed format, the family never chooses one independently). Adding a
 * step for a concept that doesn't exist yet would be UI fiction. Several
 * other listed steps are deliberately staff-only per the mission's own
 * carve-out ("les mécanismes de notes et les dispenses confirmées restent
 * staff-only") — this wizard only ever collects DECLARATIVE facts
 * (never a confirmed mécanisme/justificatif), consistent with
 * PublicCandidateInputRaw's own shape (lib/exams/normalize.ts).
 *
 * Price-before-PII (mission §10): the carte + scenarios steps render
 * fully before the "coordonnées" step is ever reachable — enforced by
 * step order, not just convention (coordonnees is the LAST step and the
 * wizard never fetches or displays it earlier).
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Subject } from '@prisma/client';
import { ScenarioCard } from '@/components/quotes/ScenarioCard';
import type { QuoteScenario, BudgetStrategy } from '@/lib/quotes/schemas';
import { BUDGET_SLIDER_TND } from '@/lib/quotes/ui-config';
import { SUBJECT_LABELS } from '@/lib/quotes/subject-labels';
import { getSellableSessionClient, getAutoCheckableEligibilityConditionsClient } from '@/lib/exams/catalog-client';

// ── Local, structural types — mirror the API response shape without
// importing from the carte-aware stack (keeps this client file outside
// the architecture whitelist entirely; only page.tsx needs to be there). ──

interface EpreuveCarteView {
  code: string;
  libelle: string;
  matiere: string;
  nature: string;
  anneePassation: number | null;
  coefficientEffectif: number | 'À_VERIFIER';
  statut: 'A_PRESENTER' | 'CONSERVEE' | 'DISPENSEE' | 'RECONDUITE';
  sourceReglementaire: string;
  avertissements: string[];
  necessiteVerificationHumaine: boolean;
}

interface CarteView {
  epreuves: EpreuveCarteView[];
  totalCoefficientObligatoire: number | 'À_VERIFIER';
  totalCoefficientOptions: number | 'À_VERIFIER';
  necessiteVerificationHumaine: boolean;
  avertissementsGeneraux: string[];
  emissionAutomatiqueAutorisee: boolean;
}

interface PipelineResultView {
  status: 'INVALID' | 'NOT_ELIGIBLE' | 'HUMAN_REVIEW_REQUIRED' | 'DIRECTION_APPROVAL_REQUIRED' | 'UNPRICED' | 'READY';
  reasons?: string[];
  avertissements?: string[];
  reason?: string;
  carte?: CarteView;
  scenarios?: QuoteScenario[];
  diagnosticStatus?: string;
  budgetInsuffisantPourSocle?: boolean;
}

// This wizard's curated subject selection — a fixed subset of the
// canonical SUBJECT_LABELS (mission P0-A dedupe: only the LABEL TEXT used
// to be duplicated here, not this list of which subjects are offerable).
const EDS_OPTIONS: Subject[] = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'SVT', 'SES', 'NSI'];
const LANGUAGE_OPTIONS: Subject[] = ['ANGLAIS', 'ESPAGNOL'];
const SUPPORTED_SESSION = getSellableSessionClient();

const STATUT_STYLE: Record<string, { label: string; className: string }> = {
  A_PRESENTER: { label: 'À présenter', className: 'bg-lux-white text-lux-ink border-lux-line' },
  CONSERVEE: { label: 'Conservée', className: 'bg-lux-evergreen/10 text-lux-evergreen border-lux-evergreen/30' },
  DISPENSEE: { label: 'Dispensée', className: 'bg-lux-evergreen/10 text-lux-evergreen border-lux-evergreen/30' },
  RECONDUITE: { label: 'Reconduite — à vérifier', className: 'bg-amber-50 text-amber-800 border-amber-300' },
};

interface WizardState {
  level: 'PREMIERE' | 'TERMINALE' | null;
  estTitulaireBacDejaObtenu: boolean;
  estRedoublant: boolean;
  changementSpecialite: boolean;
  intentionAmelioration: boolean;
  wantsBacAccelere: boolean;
  eligibilityAnswers: Record<string, boolean>;
  intentionCycleComplet: boolean;
  modalite: 'A' | 'B' | null;
  modaliteUnknown: boolean;
  specialite1: string | null;
  specialite2: string | null;
  specialiteAbandonnee: string | null;
  optionsTerminale: string[];
  langueA: string | null;
  langueB: string | null;
  resultatsAnterieursNote: string;
  brancheBascule: string | null;
  etalementPlurisessionsDeclare: boolean;
  budget: number;
  strategy: BudgetStrategy;
}

const initialState: WizardState = {
  level: null,
  estTitulaireBacDejaObtenu: false,
  estRedoublant: false,
  changementSpecialite: false,
  intentionAmelioration: false,
  wantsBacAccelere: false,
  eligibilityAnswers: {},
  intentionCycleComplet: true,
  modalite: null,
  modaliteUnknown: false,
  specialite1: null,
  specialite2: null,
  specialiteAbandonnee: null,
  optionsTerminale: [],
  langueA: null,
  langueB: null,
  resultatsAnterieursNote: '',
  brancheBascule: null,
  etalementPlurisessionsDeclare: false,
  budget: 1000,
  strategy: 'BEST_BALANCE',
};

/**
 * First-person presentation copy for each canonical auto-checkable
 * eligibility condition — mirrors components/quotes/DevisWizard.tsx's own
 * ELIGIBILITY_QUESTION_LABELS exactly (both wizards offer the same
 * conditions with the same wording); a missing entry falls back to the
 * canonical (3rd-person) label rather than breaking the wizard.
 */
export const ELIGIBILITY_QUESTION_LABELS: Record<string, string> = {
  age20: "J'aurai au moins 20 ans au 31 décembre de l'année de l'examen",
  enfant_charge: "J'ai un enfant à charge",
  echec_anterieur: "J'ai déjà échoué au baccalauréat et je me représente",
  deja_titulaire_bac: 'Je suis déjà titulaire d’un baccalauréat (général, techno, pro, BT/BTA)',
  diplome_etranger_comparable: "Je suis titulaire d'un diplôme étranger comparable au niveau secondaire français",
};
const ELIGIBILITY_QUESTIONS: { id: string; label: string }[] = getAutoCheckableEligibilityConditionsClient(
  SUPPORTED_SESSION,
).map((condition) => ({ id: condition.id, label: ELIGIBILITY_QUESTION_LABELS[condition.id] ?? condition.label }));

const STEPS = [
  'statut',
  'anterieur',
  'p3',
  'etalement',
  'cycle',
  'modalite',
  'specialites',
  'specialite_abandonnee',
  'options',
  'langues',
  'resultats_anterieurs',
  'bascule',
  'diagnostic',
  'budget',
  'carte',
  'scenarios',
  'coordonnees',
] as const;
type StepId = (typeof STEPS)[number];

const STEP_TITLES: Record<StepId, string> = {
  statut: 'Votre situation',
  anterieur: 'Situation antérieure',
  p3: 'Une seule session ?',
  etalement: 'Étalement sur plusieurs sessions ?',
  cycle: 'Cycle complet',
  modalite: 'Modalité de passation',
  specialites: 'Spécialités',
  specialite_abandonnee: 'Spécialité non poursuivie',
  options: 'Options',
  langues: 'Langues',
  resultats_anterieurs: 'Résultats antérieurs',
  bascule: 'Bascule scolaire',
  diagnostic: 'Diagnostic',
  budget: 'Budget',
  carte: "Votre carte d'examen",
  scenarios: 'Vos scénarios',
  coordonnees: 'Coordonnées',
};

function StepFieldset({ legend, description, children }: { legend: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-8">
      <legend className="text-xl font-fraunces text-lux-ink md:text-2xl">{legend}</legend>
      {description && <p className="mt-2 text-sm text-lux-slate">{description}</p>}
      <div className="mt-5 space-y-3">{children}</div>
    </fieldset>
  );
}

function RadioOption({ name, checked, label, description, onSelect }: { name: string; checked: boolean; label: string; description?: string; onSelect: () => void }) {
  return (
    <label
      className={`flex min-h-[44px] w-full items-start gap-3 rounded-xl border-2 p-4 transition-all focus-within:ring-2 focus-within:ring-lux-gold focus-within:ring-offset-2 cursor-pointer ${
        checked ? 'border-lux-gold bg-lux-gold/5' : 'border-lux-line bg-lux-white hover:border-lux-gold/40'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="mt-1 h-4 w-4 flex-shrink-0 accent-lux-gold" />
      <span>
        <span className={`block font-semibold ${checked ? 'text-lux-gold-deep' : 'text-lux-ink'}`}>{label}</span>
        {description && <span className="mt-0.5 block text-sm text-lux-slate">{description}</span>}
      </span>
    </label>
  );
}

export function PublicWizardPreview() {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [result, setResult] = useState<PipelineResultView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPiiForm, setShowPiiForm] = useState(false);
  const [piiForm, setPiiForm] = useState({ parentName: '', studentFirstName: '', whatsapp: '', email: '', consent: false });

  // Local-only draft persistence (mission §11) — non-sensitive wizard
  // answers only, never notes/justificatifs. Cleared on submit or explicit
  // reset. Best-effort: wrapped so a blocked/unavailable storage never
  // breaks the wizard.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('nexus-wizard-preview-draft');
      if (saved) setState({ ...initialState, ...JSON.parse(saved) });
    } catch {
      /* private mode / blocked storage — start fresh, never throw */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem('nexus-wizard-preview-draft', JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const step = STEPS[stepIndex];
  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => setState((prev) => ({ ...prev, [key]: value }));

  const canGoNext = (): boolean => {
    switch (step) {
      case 'statut':
        return state.level != null;
      case 'specialites':
        if (state.level === 'PREMIERE') return true;
        return state.specialite1 != null && state.specialite2 != null && state.specialite1 !== state.specialite2;
      case 'modalite':
        return state.modalite != null || state.modaliteUnknown;
      case 'budget':
        return state.budget > 0;
      default:
        return true;
    }
  };

  async function runSimulation(): Promise<boolean> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/assistante/candidat-individuel/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicInput: {
            level: state.level,
            examSession: SUPPORTED_SESSION,
            // "Je ne sais pas" is NEVER guessed into A or B (mission §7) —
            // the pipeline itself classifies this as INSUFFICIENT_INPUT-
            // adjacent (fail-closed), never silently defaulted.
            modalite: state.modaliteUnknown ? null : state.modalite,
            specialite1: state.level === 'TERMINALE' ? state.specialite1 : 'MATHEMATIQUES',
            specialite2: state.level === 'TERMINALE' ? state.specialite2 : 'FRANCAIS',
            specialiteAbandonnee: state.specialiteAbandonnee,
            optionsTerminale: state.optionsTerminale,
            langueA: state.langueA,
            langueB: state.langueB,
            estRedoublant: state.estRedoublant,
            estTitulaireBacDejaObtenu: state.estTitulaireBacDejaObtenu,
            changementSpecialite: state.changementSpecialite,
            intentionAmelioration: state.intentionAmelioration,
            intentionCycleComplet: state.intentionCycleComplet,
            brancheBascule: state.brancheBascule,
            etalementPlurisessionsDeclare: state.etalementPlurisessionsDeclare,
          },
          budget: { monthlyBudgetTnd: state.budget, strategy: state.strategy },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || json.error || "Échec du calcul de l'estimation.");
        return false;
      }
      setResult(json.result as PipelineResultView);
      return true;
    } catch {
      setError('Une erreur est survenue. Réessayez.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function goNext() {
    if (step === 'budget') {
      const ok = await runSimulation();
      if (!ok) return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  function resetDraft() {
    setState(initialState);
    setStepIndex(0);
    setResult(null);
    try {
      window.localStorage.removeItem('nexus-wizard-preview-draft');
    } catch {
      /* ignore */
    }
  }

  const progressPct = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const scenario = result?.scenarios?.find((s) => s.tier === 'RECOMMANDE') ?? result?.scenarios?.[0];

  return (
    <div>
      <div className="mb-8" role="progressbar" aria-label="Progression du parcours" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="mb-3 flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${i < stepIndex ? 'bg-lux-evergreen' : i === stepIndex ? 'bg-lux-gold' : 'bg-lux-line'}`} />
          ))}
        </div>
        <p className="text-sm text-lux-slate" aria-live="polite">
          Étape {stepIndex + 1} sur {STEPS.length} — {STEP_TITLES[step]}
        </p>
      </div>

      {step === 'statut' && (
        <>
          <p className="mb-4 text-xs uppercase tracking-wide text-lux-slate">Session d'examen : {SUPPORTED_SESSION}</p>
          <StepFieldset legend="Quel est le niveau actuel de l'élève ?">
            <RadioOption name="level" checked={state.level === 'PREMIERE'} label="Première" description="EAF + mathématiques anticipées" onSelect={() => update('level', 'PREMIERE')} />
            <RadioOption name="level" checked={state.level === 'TERMINALE'} label="Terminale" description="Spécialités, philosophie, Grand Oral" onSelect={() => update('level', 'TERMINALE')} />
          </StepFieldset>
          <StepFieldset legend="Êtes-vous déjà titulaire d'un baccalauréat ?" description="Répondez oui uniquement si vous avez déjà obtenu un bac (général, techno ou pro) et souhaitez en repasser un.">
            <RadioOption name="titulaire" checked={!state.estTitulaireBacDejaObtenu} label="Non" onSelect={() => update('estTitulaireBacDejaObtenu', false)} />
            <RadioOption name="titulaire" checked={state.estTitulaireBacDejaObtenu} label="Oui" onSelect={() => update('estTitulaireBacDejaObtenu', true)} />
          </StepFieldset>
        </>
      )}

      {step === 'anterieur' && (
        <>
          <StepFieldset legend="Redoublez-vous votre année ?">
            <RadioOption name="redoublant" checked={!state.estRedoublant} label="Non" onSelect={() => update('estRedoublant', false)} />
            <RadioOption name="redoublant" checked={state.estRedoublant} label="Oui" onSelect={() => update('estRedoublant', true)} />
          </StepFieldset>
          {state.estRedoublant && state.level === 'TERMINALE' && (
            <StepFieldset legend="Souhaitez-vous améliorer une note déjà obtenue ?">
              <RadioOption name="amelioration" checked={!state.intentionAmelioration} label="Non, je repars sur un nouveau parcours complet" onSelect={() => update('intentionAmelioration', false)} />
              <RadioOption name="amelioration" checked={state.intentionAmelioration} label="Oui, je veux améliorer certaines notes" onSelect={() => update('intentionAmelioration', true)} />
            </StepFieldset>
          )}
          <StepFieldset legend="Changez-vous de spécialité par rapport à votre première ?">
            <RadioOption name="changement" checked={!state.changementSpecialite} label="Non" onSelect={() => update('changementSpecialite', false)} />
            <RadioOption name="changement" checked={state.changementSpecialite} label="Oui" onSelect={() => update('changementSpecialite', true)} />
          </StepFieldset>
        </>
      )}

      {step === 'p3' && (
        <StepFieldset legend="Parcours sur une seule session (Bac accéléré) ?" description="Un dispositif exceptionnel, encadré par des conditions précises — pas une conséquence automatique du statut de candidat individuel.">
          <RadioOption name="bacAccelere" checked={!state.wantsBacAccelere} label="Non, je prépare sur le calendrier habituel" onSelect={() => update('wantsBacAccelere', false)} />
          <RadioOption name="bacAccelere" checked={state.wantsBacAccelere} label="Je souhaite savoir si je suis éligible" onSelect={() => update('wantsBacAccelere', true)} />
          {state.wantsBacAccelere && (
            <div className="mt-4 space-y-2 rounded-xl border border-lux-line bg-lux-paper/60 p-4">
              <p className="mb-2 text-sm font-semibold text-lux-ink">Cochez ce qui s'applique à votre situation :</p>
              {ELIGIBILITY_QUESTIONS.map((q) => (
                <label key={q.id} className="flex min-h-[44px] items-center gap-3 text-sm text-lux-slate">
                  <input type="checkbox" className="h-4 w-4 flex-shrink-0 accent-lux-gold" checked={state.eligibilityAnswers[q.id] === true} onChange={(e) => update('eligibilityAnswers', { ...state.eligibilityAnswers, [q.id]: e.target.checked })} />
                  {q.label}
                </label>
              ))}
              <p className="mt-2 text-xs text-lux-slate">
                Cette déclaration doit être confirmée par un membre de l'équipe Nexus avant toute émission — jamais automatique.
              </p>
            </div>
          )}
        </StepFieldset>
      )}

      {step === 'etalement' && (
        <StepFieldset legend="Envisagez-vous un étalement sur plusieurs sessions ?" description="À l'inverse d'une seule session : répartir votre préparation sur plus de deux années. Un cas manuel, jamais traité automatiquement.">
          <RadioOption name="etalement" checked={!state.etalementPlurisessionsDeclare} label="Non, cycle standard" onSelect={() => update('etalementPlurisessionsDeclare', false)} />
          <RadioOption name="etalement" checked={state.etalementPlurisessionsDeclare} label="Oui, je souhaite étaler ma préparation" onSelect={() => update('etalementPlurisessionsDeclare', true)} />
          {state.etalementPlurisessionsDeclare && (
            <p className="mt-2 text-xs text-lux-slate">
              Cette situation nécessite systématiquement une revue humaine avant toute estimation — aucun devis automatique n'est possible pour un étalement.
            </p>
          )}
        </StepFieldset>
      )}

      {step === 'cycle' && (
        state.level === 'PREMIERE' ? (
          <StepFieldset legend="Envisagez-vous le cycle complet (Première + Terminale) ?">
            <RadioOption name="cycle" checked={state.intentionCycleComplet} label="Oui, cycle complet sur 2 ans" onSelect={() => update('intentionCycleComplet', true)} />
            <RadioOption name="cycle" checked={!state.intentionCycleComplet} label="Non, épreuves anticipées seulement cette session" onSelect={() => update('intentionCycleComplet', false)} />
          </StepFieldset>
        ) : (
          <p className="rounded-xl border border-lux-line bg-lux-paper/60 p-4 text-sm text-lux-slate">Non applicable en Terminale.</p>
        )
      )}

      {step === 'modalite' && (
        <StepFieldset legend="Quelle modalité de passation des épreuves ponctuelles ?" description="Le choix ne change QUE le moment où les épreuves ponctuelles (hors EAF/EAM) sont passées — jamais le fait de préparer sur un ou deux ans.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`rounded-xl border-2 p-4 ${state.modalite === 'A' && !state.modaliteUnknown ? 'border-lux-gold bg-lux-gold/5' : 'border-lux-line bg-lux-white'}`}>
              <p className="font-semibold text-lux-ink">Modalité A</p>
              <p className="mt-1 text-sm text-lux-slate">Ponctuelles regroupées en fin de cycle terminal.</p>
              <ul className="mt-3 space-y-1 text-xs text-lux-slate">
                <li>• Année de passation : toutes en fin de Terminale (hors EAF/EAM, anticipées en fin de Première)</li>
                <li>• Coefficients : sourcés pour toutes les épreuves communes</li>
                <li>• Charge : concentrée sur la dernière année</li>
              </ul>
              <button type="button" onClick={() => { update('modalite', 'A'); update('modaliteUnknown', false); }} className="lux-cta-secondary mt-4 min-h-[44px] w-full rounded-lg px-4 py-2 text-sm font-semibold">
                Choisir A
              </button>
            </div>
            <div className={`rounded-xl border-2 p-4 ${state.modalite === 'B' && !state.modaliteUnknown ? 'border-lux-gold bg-lux-gold/5' : 'border-lux-line bg-lux-white'}`}>
              <p className="font-semibold text-lux-ink">Modalité B</p>
              <p className="mt-1 text-sm text-lux-slate">Ponctuelles réparties entre la fin de Première et la fin de Terminale.</p>
              <ul className="mt-3 space-y-1 text-xs text-lux-slate">
                <li>• Année de passation : réparties sur les deux années</li>
                <li>• Coefficients : <strong className="text-amber-700">plusieurs épreuves encore à vérifier</strong> auprès du Bureau des examens</li>
                <li>• Charge : répartie sur les deux années</li>
              </ul>
              <button type="button" onClick={() => { update('modalite', 'B'); update('modaliteUnknown', false); }} className="lux-cta-secondary mt-4 min-h-[44px] w-full rounded-lg px-4 py-2 text-sm font-semibold">
                Choisir B
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { update('modaliteUnknown', true); update('modalite', null); }}
            className={`min-h-[44px] w-full rounded-xl border-2 p-4 text-left text-sm font-semibold transition-all ${state.modaliteUnknown ? 'border-lux-gold bg-lux-gold/5 text-lux-gold-deep' : 'border-lux-line bg-lux-white text-lux-ink hover:border-lux-gold/40'}`}
          >
            Je ne sais pas
            <span className="mt-1 block text-xs font-normal text-lux-slate">
              Nous ne devinons jamais votre modalité — une revue avec l'équipe Nexus sera nécessaire avant tout devis définitif.
            </span>
          </button>
          <p className="mt-2 text-xs text-lux-slate">
            Aucune des deux modalités n'est structurellement meilleure — le choix dépend de votre rythme de préparation, pas d'un avantage caché.
          </p>
        </StepFieldset>
      )}

      {step === 'specialites' && (
        state.level === 'TERMINALE' ? (
          <StepFieldset legend="Vos deux enseignements de spécialité conservés en Terminale">
            <div className="grid gap-4 sm:grid-cols-2">
              <select aria-label="Première spécialité" className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" value={state.specialite1 ?? ''} onChange={(e) => update('specialite1', e.target.value || null)}>
                <option value="">Spécialité 1</option>
                {EDS_OPTIONS.map((s) => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
              </select>
              <select aria-label="Deuxième spécialité" className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" value={state.specialite2 ?? ''} onChange={(e) => update('specialite2', e.target.value || null)}>
                <option value="">Spécialité 2</option>
                {EDS_OPTIONS.filter((s) => s !== state.specialite1).map((s) => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
              </select>
            </div>
          </StepFieldset>
        ) : (
          <p className="rounded-xl border border-lux-line bg-lux-paper/60 p-4 text-sm text-lux-slate">En Première, aucune spécialité à préciser à ce stade.</p>
        )
      )}

      {step === 'specialite_abandonnee' && (
        <StepFieldset legend="Spécialité abandonnée après la Première (optionnel)">
          <select aria-label="Spécialité abandonnée" className="min-h-[44px] w-full rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink sm:w-1/2" value={state.specialiteAbandonnee ?? ''} onChange={(e) => update('specialiteAbandonnee', e.target.value || null)}>
            <option value="">Aucune / non applicable</option>
            {EDS_OPTIONS.filter((s) => s !== state.specialite1 && s !== state.specialite2).map((s) => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
          </select>
        </StepFieldset>
      )}

      {step === 'options' && (
        <StepFieldset legend="Options (optionnel)" description="Points bonus loi des points — coefficient de certaines options encore en cours de vérification réglementaire.">
          <div className="space-y-2">
            {['MATHS_EXPERTES', 'MATHS_COMPLEMENTAIRES', 'DGEMC'].map((opt) => (
              <label key={opt} className="flex min-h-[44px] items-center gap-3 text-sm text-lux-slate">
                <input
                  type="checkbox"
                  className="h-4 w-4 flex-shrink-0 accent-lux-gold"
                  checked={state.optionsTerminale.includes(opt)}
                  onChange={(e) => update('optionsTerminale', e.target.checked ? [...state.optionsTerminale, opt] : state.optionsTerminale.filter((o) => o !== opt))}
                />
                {opt.replaceAll('_', ' ')}
              </label>
            ))}
          </div>
        </StepFieldset>
      )}

      {step === 'langues' && (
        <StepFieldset legend="Langues vivantes (optionnel)">
          <div className="grid gap-4 sm:grid-cols-2">
            <select aria-label="Langue vivante A" className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" value={state.langueA ?? ''} onChange={(e) => update('langueA', e.target.value || null)}>
              <option value="">LVA</option>
              {LANGUAGE_OPTIONS.map((s) => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
            </select>
            <select aria-label="Langue vivante B" className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" value={state.langueB ?? ''} onChange={(e) => update('langueB', e.target.value || null)}>
              <option value="">LVB</option>
              {LANGUAGE_OPTIONS.filter((s) => s !== state.langueA).map((s) => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
            </select>
          </div>
        </StepFieldset>
      )}

      {step === 'resultats_anterieurs' && (
        <StepFieldset legend="Avez-vous des notes à faire valoir d'une session précédente ? (optionnel)" description="Une simple déclaration — jamais confirmée automatiquement. Un membre de l'équipe Nexus vérifiera avec vous les conditions exactes (conservation, reconduction).">
          <textarea
            aria-label="Notes antérieures à signaler"
            className="min-h-[100px] w-full rounded-lg border-2 border-lux-line bg-lux-white p-3 text-sm text-lux-ink"
            placeholder="Ex. : Philosophie 14/20 en 2026, souhaite la conserver."
            value={state.resultatsAnterieursNote}
            onChange={(e) => update('resultatsAnterieursNote', e.target.value)}
          />
        </StepFieldset>
      )}

      {step === 'bascule' && (
        <StepFieldset legend="Étiez-vous scolarisé avant de devenir candidat individuel ? (optionnel)">
          <RadioOption name="bascule" checked={state.brancheBascule === null} label="Non applicable" onSelect={() => update('brancheBascule', null)} />
          <RadioOption name="bascule" checked={state.brancheBascule === 'CONSERVATION_MOYENNES_PREMIERE'} label="Oui — je souhaite conserver mes moyennes de Première" onSelect={() => update('brancheBascule', 'CONSERVATION_MOYENNES_PREMIERE')} />
          <RadioOption name="bascule" checked={state.brancheBascule === 'RENONCIATION_MOYENNES_PREMIERE'} label="Oui — je ne souhaite pas conserver mes moyennes de Première" onSelect={() => update('brancheBascule', 'RENONCIATION_MOYENNES_PREMIERE')} />
        </StepFieldset>
      )}

      {step === 'diagnostic' && (
        <StepFieldset legend="Avez-vous déjà fait le bilan Nexus ?" description="Le bilan ne sert pas à cacher le prix. Il sert à déterminer ce qu'il est réellement utile de préparer.">
          <p className="text-sm text-lux-slate">Vous pouvez continuer avec une estimation provisoire dès maintenant, puis affiner après votre bilan.</p>
        </StepFieldset>
      )}

      {step === 'budget' && (
        <>
          <StepFieldset legend="Quel budget mensuel envisagez-vous ?">
            <div className="px-1">
              <input type="range" min={BUDGET_SLIDER_TND.sliderMinTnd} max={BUDGET_SLIDER_TND.sliderMaxTnd} step={BUDGET_SLIDER_TND.sliderStepTnd} value={state.budget} disabled={loading} onChange={(e) => update('budget', Number(e.target.value))} aria-label="Budget mensuel en TND" className="w-full accent-lux-gold" />
              <div className="mt-3 flex items-center gap-3">
                <input type="number" min={BUDGET_SLIDER_TND.inputMinTnd} max={BUDGET_SLIDER_TND.inputMaxTnd} value={state.budget} disabled={loading} onChange={(e) => update('budget', Math.max(0, Number(e.target.value)))} className="min-h-[44px] w-32 rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" aria-label="Budget mensuel, saisie libre" />
                <span className="text-sm text-lux-slate">TND / mois</span>
              </div>
            </div>
          </StepFieldset>
          <StepFieldset legend="Comment souhaitez-vous que nous équilibrions la recommandation ?">
            <RadioOption name="strategy" checked={state.strategy === 'RESPECT_BUDGET'} label="Respecter strictement mon budget" onSelect={() => update('strategy', 'RESPECT_BUDGET')} />
            <RadioOption name="strategy" checked={state.strategy === 'BEST_BALANCE'} label="Me proposer le meilleur équilibre" onSelect={() => update('strategy', 'BEST_BALANCE')} />
            <RadioOption name="strategy" checked={state.strategy === 'MOST_COMPLETE'} label="Préparation la plus complète utile" onSelect={() => update('strategy', 'MOST_COMPLETE')} />
          </StepFieldset>
        </>
      )}

      {step === 'carte' && (
        <div>
          {loading && (
            <div className="flex items-center gap-3 rounded-xl border border-lux-line bg-lux-paper/60 p-6 text-sm text-lux-slate">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Génération de votre carte d'examen…
            </div>
          )}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          {result && !loading && result.status !== 'READY' && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {result.status === 'HUMAN_REVIEW_REQUIRED' && 'Une revue réglementaire est nécessaire avant de poursuivre.'}
                {result.status === 'DIRECTION_APPROVAL_REQUIRED' && "Un ou plusieurs éléments nécessitent une décision de la direction avant chiffrage."}
                {(result.status === 'INVALID' || result.status === 'NOT_ELIGIBLE') && 'Votre situation nécessite un échange avec notre équipe.'}
                {result.status === 'UNPRICED' && 'Sélection non chiffrable en l’état.'}
              </p>
              {(result.reasons ?? result.avertissements ?? []).map((r, i) => <p key={i} className="mt-1">{r}</p>)}
            </div>
          )}
          {result?.status === 'READY' && result.carte && (
            <>
              <h2 className="mb-4 text-2xl font-fraunces text-lux-ink md:text-3xl">Votre carte d'examen</h2>
              {result.carte.avertissementsGeneraux.length > 0 && (
                <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {result.carte.avertissementsGeneraux.map((a, i) => <p key={i}>{a}</p>)}
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-lux-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-lux-paper/60 text-xs uppercase tracking-wide text-lux-slate">
                    <tr>
                      <th className="px-4 py-3">Épreuve</th>
                      <th className="px-4 py-3">Coefficient</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.carte.epreuves.map((ep) => {
                      const style = STATUT_STYLE[ep.statut] ?? STATUT_STYLE.A_PRESENTER;
                      return (
                        <tr key={ep.code} className="border-t border-lux-line/60">
                          <td className="px-4 py-3 font-medium text-lux-ink">{ep.libelle}</td>
                          <td className="px-4 py-3">{ep.coefficientEffectif === 'À_VERIFIER' ? <span className="text-amber-700">À vérifier</span> : ep.coefficientEffectif}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
                            {ep.necessiteVerificationHumaine && <span className="ml-1 text-xs text-amber-700">(revue requise)</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-lux-slate">{ep.sourceReglementaire}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-lux-slate">
                Total coefficient obligatoire : {result.carte.totalCoefficientObligatoire === 'À_VERIFIER' ? 'à vérifier' : result.carte.totalCoefficientObligatoire}
                {result.carte.totalCoefficientOptions !== 0 && (
                  <> · options (hors total obligatoire) : {result.carte.totalCoefficientOptions === 'À_VERIFIER' ? 'à vérifier' : result.carte.totalCoefficientOptions}</>
                )}
              </p>
            </>
          )}
        </div>
      )}

      {step === 'scenarios' && (
        <div>
          {result?.status === 'READY' && result.scenarios && (
            <>
              <h2 className="mb-2 text-2xl font-fraunces text-lux-ink md:text-3xl">Votre estimation</h2>
              <p className="mb-6 max-w-3xl text-sm leading-relaxed text-lux-slate md:text-base">
                Cette estimation est établie à partir de votre situation, de la carte ci-avant et du budget indiqué —
                non contractuelle tant qu'une revue n'a pas été faite avec l'équipe Nexus.
              </p>
              {result.budgetInsuffisantPourSocle && (
                <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                  Aucun scénario ne peut respecter ce budget pour le socle minimal — voir le scénario Essentiel ci-dessous pour l'écart réel.
                </p>
              )}
              {scenario && (
                <div className="mx-auto max-w-xl">
                  <ScenarioCard scenario={scenario} featured={scenario.tier === 'RECOMMANDE'} />
                </div>
              )}
              {!showPiiForm && (
                <div className="mt-8 flex justify-center">
                  <button type="button" onClick={() => setShowPiiForm(true)} className="lux-cta-reserve min-h-[44px] rounded-lg px-8 py-3 text-sm font-semibold">
                    Continuer vers mes coordonnées
                  </button>
                </div>
              )}
            </>
          )}
          {result?.status !== 'READY' && <p className="text-sm text-lux-slate">Aucun scénario disponible pour ce statut ({result?.status}).</p>}
        </div>
      )}

      {step === 'coordonnees' && (
        <div className="rounded-xl border border-lux-line bg-lux-paper/60 p-6">
          <h2 className="mb-2 text-lg font-fraunces text-lux-ink">Recevoir mon devis détaillé</h2>
          <p className="mb-4 text-xs text-lux-slate">
            Aperçu de l'écran final — la création réelle du devis (RGPD, capture du lead) reste le flux existant, non
            dupliquée dans cette prévisualisation.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <input type="text" placeholder="Votre nom" value={piiForm.parentName} onChange={(e) => setPiiForm((p) => ({ ...p, parentName: e.target.value }))} className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" aria-label="Votre nom" />
            <input type="text" placeholder="Prénom du candidat" value={piiForm.studentFirstName} onChange={(e) => setPiiForm((p) => ({ ...p, studentFirstName: e.target.value }))} className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" aria-label="Prénom du candidat" />
            <input type="tel" placeholder="WhatsApp" value={piiForm.whatsapp} onChange={(e) => setPiiForm((p) => ({ ...p, whatsapp: e.target.value }))} className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" aria-label="Numéro WhatsApp" />
            <input type="email" placeholder="Email" value={piiForm.email} onChange={(e) => setPiiForm((p) => ({ ...p, email: e.target.value }))} className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm text-lux-ink" aria-label="Email" />
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-lux-slate">
            <input type="checkbox" checked={piiForm.consent} onChange={(e) => setPiiForm((p) => ({ ...p, consent: e.target.checked }))} className="mt-1 h-4 w-4 flex-shrink-0 accent-lux-gold" />
            J'accepte d'être recontacté(e) par Nexus Réussite au sujet de ce devis.
          </label>
          <button type="button" onClick={resetDraft} className="lux-cta-secondary mt-5 min-h-[44px] rounded-lg px-6 py-3 text-sm font-semibold">
            Recommencer l'aperçu
          </button>
        </div>
      )}

      {step !== 'coordonnees' && (
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={goBack} disabled={stepIndex === 0 || loading} className={`min-h-[44px] rounded-lg px-6 py-3 text-sm font-semibold transition-all ${stepIndex === 0 || loading ? 'cursor-not-allowed bg-lux-ivory text-lux-slate/50' : 'lux-cta-secondary'}`}>
            Retour
          </button>
          <button type="button" onClick={goNext} disabled={!canGoNext() || loading} className="lux-cta-reserve min-h-[44px] rounded-lg px-6 py-3 text-sm font-semibold disabled:opacity-50">
            {step === 'budget' ? (loading ? 'Calcul en cours…' : 'Voir ma carte et mon estimation') : 'Continuer'}
          </button>
        </div>
      )}
    </div>
  );
}
