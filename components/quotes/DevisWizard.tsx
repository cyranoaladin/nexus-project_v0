'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Subject } from '@prisma/client';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { fmtTND } from '@/components/premium/format';
import { ScenarioCard } from './ScenarioCard';
import type { BudgetStrategy, RecommendationResult, ScenarioTier } from '@/lib/quotes/schemas';
import { BUDGET_SLIDER_TND } from '@/lib/quotes/ui-config';

// ── Subject labels (kept in sync with lib/quotes/exam-profile.ts's SUBJECT_LABELS) ──
const SUBJECT_LABELS: Partial<Record<Subject, string>> = {
  MATHEMATIQUES: 'Mathématiques',
  NSI: 'NSI',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'SVT',
  SES: 'SES',
};
const EDS_OPTIONS = Object.keys(SUBJECT_LABELS) as Subject[];
const LANGUAGE_LABELS: Partial<Record<Subject, string>> = { ANGLAIS: 'Anglais', ESPAGNOL: 'Espagnol' };
const LANGUAGE_OPTIONS = Object.keys(LANGUAGE_LABELS) as Subject[];

const SUPPORTED_SESSION = 2027;
const TIER_BY_STRATEGY: Record<BudgetStrategy, ScenarioTier> = {
  RESPECT_BUDGET: 'ESSENTIEL',
  BEST_BALANCE: 'RECOMMANDE',
  MOST_COMPLETE: 'COMPLET',
};

type Level = 'premiere' | 'terminale';
type Statut = 'candidat_individuel' | 'cned_libre' | 'autre';

interface WizardState {
  level: Level | null;
  statut: Statut | null;
  wantsBacAccelere: boolean;
  eligibilityAnswers: Record<string, boolean>;
  eds1: Subject | null;
  eds2: Subject | null;
  specialiteAbandonnee: Subject | null;
  langueA: Subject | null;
  langueB: Subject | null;
  budget: number;
  strategy: BudgetStrategy;
}

type RecommendationSnapshot = Readonly<Omit<WizardState, 'level' | 'eligibilityAnswers'>> & {
  readonly level: Level;
  readonly eligibilityAnswers: Readonly<Record<string, boolean>>;
};

function createRecommendationSnapshot(state: WizardState & { level: Level }): RecommendationSnapshot {
  return Object.freeze({
    ...state,
    eligibilityAnswers: Object.freeze({ ...state.eligibilityAnswers }),
  });
}

const initialState: WizardState = {
  level: null,
  statut: null,
  wantsBacAccelere: false,
  eligibilityAnswers: {},
  eds1: null,
  eds2: null,
  specialiteAbandonnee: null,
  langueA: null,
  langueB: null,
  budget: 1000,
  strategy: 'BEST_BALANCE',
};

const STEPS = ['situation', 'parcours', 'specialites', 'diagnostic', 'budget', 'resultat'] as const;
type StepId = (typeof STEPS)[number];

const STEP_TITLES: Record<StepId, string> = {
  situation: 'Votre situation',
  parcours: "Parcours d'examen",
  specialites: 'Spécialités',
  diagnostic: 'Diagnostic',
  budget: 'Budget',
  resultat: 'Votre estimation',
};

const ELIGIBILITY_QUESTIONS: { id: string; label: string }[] = [
  { id: 'age20', label: "J'aurai au moins 20 ans au 31 décembre de l'année de l'examen" },
  { id: 'enfant_charge', label: "J'ai un enfant à charge" },
  { id: 'echec_anterieur', label: "J'ai déjà échoué au baccalauréat et je me représente" },
  { id: 'deja_titulaire_bac', label: 'Je suis déjà titulaire d’un baccalauréat (général, techno, pro, BT/BTA)' },
  { id: 'diplome_etranger_comparable', label: "Je suis titulaire d'un diplôme étranger comparable au niveau secondaire français" },
];

function StepFieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="mb-8">
      <legend className="text-xl font-fraunces text-lux-ink md:text-2xl">{legend}</legend>
      {description && <p className="mt-2 text-sm text-lux-slate">{description}</p>}
      <div className="mt-5 space-y-3">{children}</div>
    </fieldset>
  );
}

function RadioOption({
  name,
  checked,
  label,
  description,
  disabled = false,
  onSelect,
}: {
  name: string;
  checked: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex min-h-[44px] w-full items-start gap-3 rounded-xl border-2 p-4 transition-all focus-within:ring-2 focus-within:ring-lux-gold focus-within:ring-offset-2 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${
        checked ? 'border-lux-gold bg-lux-gold/5' : 'border-lux-line bg-lux-white hover:border-lux-gold/40'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 h-4 w-4 flex-shrink-0 accent-lux-gold"
      />
      <span>
        <span className={`block font-semibold ${checked ? 'text-lux-gold' : 'text-lux-ink'}`}>{label}</span>
        {description && <span className="mt-0.5 block text-sm text-lux-slate">{description}</span>}
      </span>
    </label>
  );
}

export function DevisWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [recommendationSnapshot, setRecommendationSnapshot] = useState<RecommendationSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPiiForm, setShowPiiForm] = useState(false);
  const [piiSubmitting, setPiiSubmitting] = useState(false);
  const [piiError, setPiiError] = useState<string | null>(null);
  const recommendationInFlightRef = useRef(false);
  const recommendationRequestIdRef = useRef(0);

  const step = STEPS[stepIndex];
  const selectedTier: ScenarioTier = recommendationSnapshot
    ? TIER_BY_STRATEGY[recommendationSnapshot.strategy]
    : 'RECOMMANDE';
  const selectedScenario = useMemo(
    () => result?.scenarios.find((scenario) => scenario.tier === selectedTier),
    [result, selectedTier],
  );
  const pilotageMonthly = useMemo(
    () =>
      result?.scenarios
        .flatMap((scenario) => scenario.lines)
        .find((line) => line.modality === 'PILOTAGE')?.unitPriceMonthly,
    [result],
  );

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canGoNext = useMemo(() => {
    switch (step) {
      case 'situation':
        return state.level != null && state.statut != null;
      case 'parcours':
        return true;
      case 'specialites':
        if (state.level === 'premiere') return true;
        return state.eds1 != null && state.eds2 != null && state.eds1 !== state.eds2;
      case 'diagnostic':
        return true;
      case 'budget':
        return state.budget > 0;
      default:
        return true;
    }
  }, [step, state]);

  const fetchRecommendation = useCallback(async (): Promise<boolean> => {
    if (!state.level || recommendationInFlightRef.current) return false;
    const snapshot = createRecommendationSnapshot({ ...state, level: state.level });
    const requestId = recommendationRequestIdRef.current + 1;
    recommendationRequestIdRef.current = requestId;
    recommendationInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/quotes/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situation: {
            level: snapshot.level,
            examSession: SUPPORTED_SESSION,
            specialites:
              snapshot.level === 'terminale' ? [snapshot.eds1, snapshot.eds2] : ['MATHEMATIQUES', 'FRANCAIS'],
            specialiteAbandonnee: snapshot.specialiteAbandonnee ?? undefined,
            langueA: snapshot.langueA ?? undefined,
            langueB: snapshot.langueB ?? undefined,
          },
          budget: { monthlyBudgetTnd: snapshot.budget, strategy: snapshot.strategy },
          bacAccelereEligibilityAnswers: snapshot.wantsBacAccelere ? snapshot.eligibilityAnswers : undefined,
        }),
      });
      if (!res.ok) throw new Error('recommendation_failed');
      const json = await res.json();
      if (requestId !== recommendationRequestIdRef.current) return false;
      setResult(json.result as RecommendationResult);
      setRecommendationSnapshot(snapshot);
      return true;
    } catch {
      if (requestId === recommendationRequestIdRef.current) {
        setError("Une erreur est survenue lors du calcul de l'estimation. Réessayez.");
        return true;
      }
      return false;
    } finally {
      if (requestId === recommendationRequestIdRef.current) {
        recommendationInFlightRef.current = false;
        setLoading(false);
      }
    }
  }, [state]);

  const goNext = useCallback(async () => {
    if (step === 'budget') {
      const requestCompleted = await fetchRecommendation();
      if (!requestCompleted) return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [step, fetchRecommendation]);

  const goBack = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);

  const [piiForm, setPiiForm] = useState({ parentName: '', studentFirstName: '', whatsapp: '', email: '', consent: false });
  const idempotencyKeyRef = useMemo(() => `devis-${Date.now()}-${Math.random().toString(36).slice(2)}`, []);

  const submitPiiForm = useCallback(async () => {
    if (!recommendationSnapshot) {
      setPiiError('Cette estimation doit être recalculée avant de créer le devis.');
      return;
    }
    setPiiSubmitting(true);
    setPiiError(null);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef,
          situation: {
            level: recommendationSnapshot.level,
            examSession: SUPPORTED_SESSION,
            specialites:
              recommendationSnapshot.level === 'terminale'
                ? [recommendationSnapshot.eds1, recommendationSnapshot.eds2]
                : ['MATHEMATIQUES', 'FRANCAIS'],
            specialiteAbandonnee: recommendationSnapshot.specialiteAbandonnee ?? undefined,
            langueA: recommendationSnapshot.langueA ?? undefined,
            langueB: recommendationSnapshot.langueB ?? undefined,
          },
          budget: {
            monthlyBudgetTnd: recommendationSnapshot.budget,
            strategy: recommendationSnapshot.strategy,
          },
          scenarioTier: selectedTier,
          contact: piiForm,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.token) throw new Error(json.error ?? 'quote_creation_failed');
      router.push(`/devis/${json.token}`);
    } catch {
      setPiiError('Impossible de créer votre devis pour le moment. Réessayez ou contactez-nous sur WhatsApp.');
    } finally {
      setPiiSubmitting(false);
    }
  }, [recommendationSnapshot, selectedTier, piiForm, idempotencyKeyRef, router]);

  const progressPct = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const progressText = `Étape ${stepIndex + 1} sur ${STEPS.length} — ${STEP_TITLES[step]}`;

  return (
    <div>
      <div
        className="mb-8"
        role="progressbar"
        aria-labelledby="devis-progress-label"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={progressText}
      >
        <div className="mb-3 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < stepIndex ? 'bg-lux-evergreen' : i === stepIndex ? 'bg-lux-gold' : 'bg-lux-line'
              }`}
            />
          ))}
        </div>
        <p id="devis-progress-label" className="text-sm text-lux-slate">
          {progressText}
        </p>
      </div>

      {step === 'situation' && (
        <>
          <StepFieldset legend="Quel est le niveau actuel de l'élève ?">
            <RadioOption name="level" checked={state.level === 'premiere'} label="Première" description="EAF + mathématiques anticipées" onSelect={() => update('level', 'premiere')} />
            <RadioOption name="level" checked={state.level === 'terminale'} label="Terminale" description="Spécialités, philosophie, Grand Oral" onSelect={() => update('level', 'terminale')} />
          </StepFieldset>
          <StepFieldset
            legend="Quel est le statut de l'élève ?"
            description="« Candidat individuel », couramment appelé « candidat libre »."
          >
            <RadioOption name="statut" checked={state.statut === 'candidat_individuel'} label="Candidat individuel" description="Non scolarisé, non inscrit au CNED réglementé" onSelect={() => update('statut', 'candidat_individuel')} />
            <RadioOption name="statut" checked={state.statut === 'cned_libre'} label="CNED libre" description="Scolarité libre au CNED" onSelect={() => update('statut', 'cned_libre')} />
            <RadioOption name="statut" checked={state.statut === 'autre'} label="Autre situation" onSelect={() => update('statut', 'autre')} />
          </StepFieldset>
          {state.statut === 'autre' && (
            <p className="rounded-xl border border-lux-line bg-lux-paper/60 p-4 text-sm text-lux-slate">
              Ce simulateur est conçu pour les candidats individuels et CNED libre au Bac général. Pour toute autre
              situation, faites votre{' '}
              <a href="/bilan-gratuit" className="font-semibold text-lux-gold hover:underline">
                bilan gratuit
              </a>{' '}
              — nous vous orienterons directement.
            </p>
          )}
        </>
      )}

      {step === 'parcours' && (
        <StepFieldset
          legend="Parcours sur une seule session (Bac accéléré) ?"
          description="Un dispositif exceptionnel, encadré par des conditions précises — pas une conséquence automatique du statut de candidat individuel."
        >
          <RadioOption name="bacAccelere" checked={!state.wantsBacAccelere} label="Non, je prépare sur le calendrier habituel" onSelect={() => update('wantsBacAccelere', false)} />
          <RadioOption name="bacAccelere" checked={state.wantsBacAccelere} label="Je souhaite savoir si je suis éligible" onSelect={() => update('wantsBacAccelere', true)} />
          {state.wantsBacAccelere && (
            <div className="mt-4 space-y-2 rounded-xl border border-lux-line bg-lux-paper/60 p-4">
              <p className="mb-2 text-sm font-semibold text-lux-ink">Cochez ce qui s'applique à votre situation :</p>
              {ELIGIBILITY_QUESTIONS.map((q) => (
                <label key={q.id} className="flex min-h-[44px] items-center gap-3 text-sm text-lux-slate">
                  <input
                    type="checkbox"
                    className="h-4 w-4 flex-shrink-0 accent-lux-gold"
                    checked={state.eligibilityAnswers[q.id] === true}
                    onChange={(e) =>
                      update('eligibilityAnswers', { ...state.eligibilityAnswers, [q.id]: e.target.checked })
                    }
                  />
                  {q.label}
                </label>
              ))}
            </div>
          )}
        </StepFieldset>
      )}

      {step === 'specialites' && (
        <>
          {state.level === 'terminale' ? (
            <>
              <StepFieldset legend="Vos deux enseignements de spécialité conservés en Terminale">
                <div className="grid gap-4 sm:grid-cols-2">
                  <select
                    aria-label="Première spécialité"
                    className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                    value={state.eds1 ?? ''}
                    onChange={(e) => update('eds1', (e.target.value || null) as Subject | null)}
                  >
                    <option value="">Spécialité 1</option>
                    {EDS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {SUBJECT_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Deuxième spécialité"
                    className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                    value={state.eds2 ?? ''}
                    onChange={(e) => update('eds2', (e.target.value || null) as Subject | null)}
                  >
                    <option value="">Spécialité 2</option>
                    {EDS_OPTIONS.filter((s) => s !== state.eds1).map((s) => (
                      <option key={s} value={s}>
                        {SUBJECT_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </StepFieldset>
              <StepFieldset legend="Spécialité abandonnée après la Première (optionnel)">
                <select
                  aria-label="Spécialité abandonnée"
                  className="min-h-[44px] w-full rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm sm:w-1/2"
                  value={state.specialiteAbandonnee ?? ''}
                  onChange={(e) => update('specialiteAbandonnee', (e.target.value || null) as Subject | null)}
                >
                  <option value="">Aucune / non applicable</option>
                  {EDS_OPTIONS.filter((s) => s !== state.eds1 && s !== state.eds2).map((s) => (
                    <option key={s} value={s}>
                      {SUBJECT_LABELS[s]}
                    </option>
                  ))}
                </select>
              </StepFieldset>
              <StepFieldset legend="Langues vivantes (optionnel)">
                <div className="grid gap-4 sm:grid-cols-2">
                  <select
                    aria-label="Langue vivante A"
                    className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                    value={state.langueA ?? ''}
                    onChange={(e) => update('langueA', (e.target.value || null) as Subject | null)}
                  >
                    <option value="">LVA</option>
                    {LANGUAGE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {LANGUAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Langue vivante B"
                    className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                    value={state.langueB ?? ''}
                    onChange={(e) => update('langueB', (e.target.value || null) as Subject | null)}
                  >
                    <option value="">LVB</option>
                    {LANGUAGE_OPTIONS.filter((s) => s !== state.langueA).map((s) => (
                      <option key={s} value={s}>
                        {LANGUAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </StepFieldset>
            </>
          ) : (
            <p className="rounded-xl border border-lux-line bg-lux-paper/60 p-4 text-sm text-lux-slate">
              En Première, l'accompagnement candidat individuel porte sur le Français / EAF et les mathématiques
              anticipées — aucune spécialité à préciser à ce stade.
            </p>
          )}
        </>
      )}

      {step === 'diagnostic' && (
        <StepFieldset
          legend="Avez-vous déjà fait le bilan Nexus ?"
          description="Le bilan ne sert pas à cacher le prix. Il sert à déterminer ce qu'il est réellement utile de préparer."
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="/bilan-gratuit"
              target="_blank"
              rel="noopener noreferrer"
              className="lux-cta-secondary flex min-h-[44px] flex-1 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold"
            >
              Faire mon bilan gratuit
            </a>
          </div>
          <p className="mt-4 text-sm text-lux-slate">
            Vous pouvez aussi continuer avec une estimation provisoire dès maintenant, puis affiner après votre
            bilan.
          </p>
        </StepFieldset>
      )}

      {step === 'budget' && (
        <>
          <StepFieldset legend="Quel budget mensuel envisagez-vous ?">
            <div className="px-1">
              <input
                type="range"
                min={BUDGET_SLIDER_TND.sliderMinTnd}
                max={BUDGET_SLIDER_TND.sliderMaxTnd}
                step={BUDGET_SLIDER_TND.sliderStepTnd}
                value={state.budget}
                disabled={loading}
                onChange={(e) => update('budget', Number(e.target.value))}
                aria-label="Budget mensuel en TND"
                className="w-full accent-lux-gold"
              />
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="number"
                  min={BUDGET_SLIDER_TND.inputMinTnd}
                  max={BUDGET_SLIDER_TND.inputMaxTnd}
                  value={state.budget}
                  disabled={loading}
                  onChange={(e) => update('budget', Math.max(0, Number(e.target.value)))}
                  className="min-h-[44px] w-32 rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                  aria-label="Budget mensuel, saisie libre"
                />
                <span className="text-sm text-lux-slate">TND / mois</span>
              </div>
            </div>
          </StepFieldset>
          <StepFieldset legend="Comment souhaitez-vous que nous équilibrions la recommandation ?">
            <RadioOption name="strategy" checked={state.strategy === 'RESPECT_BUDGET'} disabled={loading} label="Respecter strictement mon budget" onSelect={() => update('strategy', 'RESPECT_BUDGET')} />
            <RadioOption name="strategy" checked={state.strategy === 'BEST_BALANCE'} disabled={loading} label="Me proposer le meilleur équilibre" onSelect={() => update('strategy', 'BEST_BALANCE')} />
            <RadioOption name="strategy" checked={state.strategy === 'MOST_COMPLETE'} disabled={loading} label="Préparation la plus complète utile" onSelect={() => update('strategy', 'MOST_COMPLETE')} />
          </StepFieldset>
        </>
      )}

      {step === 'resultat' && (
        <div>
          {loading && (
            <div className="flex items-center gap-3 rounded-xl border border-lux-line bg-lux-paper/60 p-6 text-sm text-lux-slate">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Calcul de votre estimation en cours…
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}
          {result && !loading && (
            <>
              {result.bacAccelereEligibility && (
                <div className="mb-6 rounded-xl border border-lux-line bg-lux-paper/60 p-4 text-sm text-lux-ink">
                  {result.bacAccelereEligibility === 'ELIGIBLE' && (
                    <p>
                      D'après vos réponses, vous pourriez être <strong>éligible</strong> à une préparation sur une
                      seule session. Cette éligibilité doit être confirmée par l'académie lors de l'inscription.
                    </p>
                  )}
                  {result.bacAccelereEligibility === 'NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH' && (
                    <p>
                      D'après vos réponses, le parcours standard sur deux sessions (anticipées puis terminales)
                      s'applique à votre situation.
                    </p>
                  )}
                  {result.bacAccelereEligibility === 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW' && (
                    <p>
                      Votre éligibilité à une préparation sur une seule session nécessite une vérification humaine —
                      contactez-nous pour l'examiner avec vous.
                    </p>
                  )}
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-2xl font-fraunces text-lux-ink md:text-3xl">Estimation provisoire</h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-lux-slate md:text-base">
                  Cette estimation est établie à partir de votre situation scolaire, des épreuves à préparer et du
                  budget indiqué. Le bilan Nexus permettra ensuite d’affiner les matières, les volumes et le parcours
                  recommandé.
                </p>
              </div>

              {pilotageMonthly != null &&
                recommendationSnapshot != null &&
                recommendationSnapshot.budget < pilotageMonthly && (
                <p
                  role="alert"
                  className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950"
                >
                  Aucun accompagnement complet ne peut respecter ce budget. Le coût incompressible du Pilotage Nexus
                  est de {fmtTND(pilotageMonthly)} par mois.
                </p>
              )}
              {selectedScenario && (
                <div className="mx-auto max-w-xl">
                  <ScenarioCard scenario={selectedScenario} featured={selectedScenario.tier === 'RECOMMANDE'} />
                </div>
              )}

              {!showPiiForm ? (
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => setShowPiiForm(true)}
                    className="lux-cta-reserve min-h-[44px] rounded-lg px-8 py-3 text-sm font-semibold"
                  >
                    Recevoir mon devis détaillé
                  </button>
                  <a
                    href={buildWhatsAppUrl('Bonjour, je souhaite un devis Bac candidat individuel.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lux-cta-secondary flex min-h-[44px] items-center justify-center rounded-lg px-8 py-3 text-sm font-semibold"
                  >
                    Nous contacter sur WhatsApp
                  </a>
                </div>
              ) : (
                <div className="mt-8 rounded-xl border border-lux-line bg-lux-paper/60 p-6">
                  <h3 className="mb-4 text-lg font-fraunces text-lux-ink">Recevoir mon devis détaillé</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      placeholder="Votre nom"
                      value={piiForm.parentName}
                      onChange={(e) => setPiiForm((p) => ({ ...p, parentName: e.target.value }))}
                      className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                      aria-label="Votre nom"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Prénom du candidat"
                      value={piiForm.studentFirstName}
                      onChange={(e) => setPiiForm((p) => ({ ...p, studentFirstName: e.target.value }))}
                      className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                      aria-label="Prénom du candidat"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="WhatsApp"
                      value={piiForm.whatsapp}
                      onChange={(e) => setPiiForm((p) => ({ ...p, whatsapp: e.target.value }))}
                      className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                      aria-label="Numéro WhatsApp"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      value={piiForm.email}
                      onChange={(e) => setPiiForm((p) => ({ ...p, email: e.target.value }))}
                      className="min-h-[44px] rounded-lg border-2 border-lux-line bg-lux-white px-3 text-sm"
                      aria-label="Email"
                    />
                  </div>
                  <label className="mt-4 flex items-start gap-3 text-sm text-lux-slate">
                    <input
                      type="checkbox"
                      required
                      checked={piiForm.consent}
                      onChange={(e) => setPiiForm((p) => ({ ...p, consent: e.target.checked }))}
                      className="mt-1 h-4 w-4 flex-shrink-0 accent-lux-gold"
                    />
                    J'accepte d'être recontacté(e) par Nexus Réussite au sujet de ce devis.
                  </label>
                  {piiError && (
                    <p role="alert" className="mt-3 text-sm text-red-800">
                      {piiError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={piiSubmitting || !piiForm.parentName || !piiForm.studentFirstName || !piiForm.whatsapp || !piiForm.email || !piiForm.consent}
                    onClick={submitPiiForm}
                    className="lux-cta-reserve mt-5 min-h-[44px] w-full rounded-lg px-6 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                  >
                    {piiSubmitting ? 'Envoi…' : 'Recevoir mon devis'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step !== 'resultat' && (
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || loading}
            className={`min-h-[44px] rounded-lg px-6 py-3 text-sm font-semibold transition-all lux-focus ${
              stepIndex === 0 || loading ? 'cursor-not-allowed bg-lux-ivory text-lux-slate/50' : 'lux-cta-secondary'
            }`}
          >
            Retour
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext || loading || (state.statut === 'autre' && step === 'situation')}
            className="lux-cta-reserve min-h-[44px] rounded-lg px-6 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {step === 'budget' ? (loading ? 'Calcul en cours…' : 'Voir mon estimation') : 'Continuer'}
          </button>
        </div>
      )}
    </div>
  );
}
