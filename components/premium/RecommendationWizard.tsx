'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { ExamCard, type ExamCardProps } from './ExamCard';
import {
  getOffersByLevel,
  getOffersByTrack,
  getStageFormats,
  getPonctuelOffers,
  getPacks,
  getCarte,
  getRules,
  type AnnualOffer,
} from '@/lib/pricing';
import { fmtTND } from './format';

// ── Wizard steps ──

interface WizardStep {
  id: string;
  title: string;
  description: string;
  options: { id: string; label: string; description?: string }[];
}

const steps: WizardStep[] = [
  {
    id: 'level',
    title: 'Quel est le niveau de l\'élève ?',
    description: 'Cela nous permet de cibler les épreuves et le programme.',
    options: [
      { id: 'Terminale', label: 'Terminale', description: 'Bac en fin d\'année' },
      { id: 'Premiere', label: 'Première', description: 'EAF + spécialités' },
      { id: 'Seconde', label: 'Seconde', description: 'Consolidation' },
      { id: 'Troisieme', label: 'Troisième', description: 'Brevet' },
    ],
  },
  {
    id: 'track',
    title: 'Quel est le statut de l\'élève ?',
    description: 'Scolarisé dans un établissement ou candidat libre.',
    options: [
      { id: 'scolarise', label: 'Scolarisé', description: 'Inscrit dans un lycée français' },
      { id: 'libre', label: 'Candidat libre', description: 'Passe le bac en candidat libre' },
    ],
  },
  {
    id: 'need',
    title: 'Quel est le besoin principal ?',
    description: 'Cela oriente notre recommandation.',
    options: [
      { id: 'annual', label: 'Accompagnement annuel', description: 'Suivi régulier sur l\'année' },
      { id: 'stage', label: 'Stage intensif', description: 'Session courte et ciblée' },
      { id: 'ponctuel', label: 'Prépa épreuve spécifique', description: 'EAF, Grand Oral, épreuve blanche' },
      { id: 'platform', label: 'Plateforme en ligne', description: 'Ressources et suivi à distance' },
    ],
  },
];

// ── Recommendation engine ──

function getRecommendations(answers: Record<string, string>): ExamCardProps[] {
  const level = answers.level;
  const track = answers.track;
  const need = answers.need;
  const results: ExamCardProps[] = [];

  if (need === 'annual') {
    const offers = track === 'libre'
      ? getOffersByTrack('libre').filter(o => o.level === level)
      : getOffersByLevel(level);

    for (const o of offers.slice(0, 3)) {
      const price = o.price_annual_campaign ?? o.price_annual_public ?? 0;
      results.push({
        eyebrow: `${o.level} · ${o.track === 'libre' ? 'Candidat libre' : 'Parcours présentiel'}`,
        title: o.title,
        subtitle: o.subjects,
        price,
        originalPrice: o.price_annual_public !== price ? (o.price_annual_public ?? undefined) : undefined,
        monthlyDisplay: o.monthly_display ?? undefined,
        hoursPerWeek: o.hours_per_week ?? undefined,
        totalHours: o.hours_per_year ?? undefined,
        groupMax: o.group_max ?? 5,
        groupMinOpen: o.group_min_open ?? 3,
        payment: o.deposit != null ? {
          deposit: o.deposit,
          installments: o.installment_amount != null && o.n_installments != null
            ? Array(o.n_installments).fill(o.installment_amount)
            : undefined,
        } : undefined,
      });
    }
  } else if (need === 'stage') {
    const formats = getStageFormats().slice(0, 3);
    for (const f of formats) {
      results.push({
        eyebrow: `Les Intensifs · ${f.title}`,
        title: f.title,
        subtitle: `${f.hours}h de travail concentré`,
        price: f.price_per_student,
        groupMax: f.group_max,
        groupMinOpen: f.group_min_open,
        payment: { deposit: f.payment.deposit, solde: f.payment.solde },
      });
    }
  } else if (need === 'ponctuel') {
    const ponctuels = getPonctuelOffers().filter(p =>
      !level || p.public === 'Tous' || p.public === level
    ).slice(0, 3);
    for (const p of ponctuels) {
      results.push({
        eyebrow: `Prépa épreuves · ${p.public}`,
        title: p.title,
        subtitle: p.description,
        price: p.price_per_student,
        groupMax: p.group_max ?? 5,
        groupMinOpen: p.group_min_open ?? 3,
        payment: p.payment.full_at_booking
          ? undefined
          : { deposit: p.payment.deposit, solde: p.payment.solde },
      });
    }
  } else {
    // platform
    const carte = getCarte();
    results.push({
      eyebrow: 'Carte membre',
      title: carte.title,
      subtitle: 'Accès plateforme + remises + diagnostic',
      price: carte.price_annual,
      features: carte.includes,
    });
  }

  return results;
}

// ── Component ──

export function RecommendationWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const step = steps[currentStep];
  const selectedValue = answers[step.id];

  const recommendations = useMemo(
    () => (showResults ? getRecommendations(answers) : []),
    [showResults, answers],
  );

  const handleSelect = (value: string) => {
    const newAnswers = { ...answers, [step.id]: value };
    setAnswers(newAnswers);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setAnswers({});
    setShowResults(false);
  };

  if (showResults) {
    return (
      <div className="space-y-10">
        {/* Results header */}
        <div className="rounded-xl border border-lux-evergreen/20 bg-lux-evergreen/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-lux-evergreen" />
            <span className="text-sm font-semibold text-lux-evergreen uppercase tracking-wider">
              Diagnostic complété
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl">Nos recommandations pour vous</h2>
          <p className="mt-2 text-sm text-lux-slate">
            Basées sur vos réponses, voici les formules les plus adaptées.
          </p>
          <button
            onClick={handleReset}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-lux-gold hover:underline"
          >
            <RotateCcw className="h-4 w-4" />
            Recommencer
          </button>
        </div>

        {/* Results grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((props, i) => (
            <div key={i} className="relative">
              {i === 0 && (
                <span className="absolute -top-3 left-4 z-10 rounded-full bg-lux-gold px-3 py-0.5 text-[0.65rem] font-semibold text-lux-ink">
                  Recommandation #1
                </span>
              )}
              <ExamCard {...props} featured={i === 0} ctaText="Réserver ma place" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-3 flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < currentStep
                  ? 'bg-lux-evergreen'
                  : i === currentStep
                    ? 'bg-lux-gold'
                    : 'bg-lux-line'
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-lux-slate">
          Étape {currentStep + 1} sur {steps.length}
        </p>
      </div>

      {/* Question */}
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl">{step.title}</h2>
        <p className="mt-2 text-base text-lux-slate">{step.description}</p>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-8">
        {step.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={`flex w-full items-center justify-between rounded-xl border-2 p-4 text-left transition-all lux-focus ${
              selectedValue === option.id
                ? 'border-lux-gold bg-lux-gold/5'
                : 'border-lux-line bg-lux-white hover:border-lux-gold/40'
            }`}
          >
            <div>
              <span className={`font-semibold ${
                selectedValue === option.id ? 'text-lux-gold' : 'text-lux-ink'
              }`}>
                {option.label}
              </span>
              {option.description && (
                <p className="mt-0.5 text-sm text-lux-slate">{option.description}</p>
              )}
            </div>
            {selectedValue === option.id && (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-lux-gold" />
            )}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`rounded-lg px-6 py-3 text-sm font-semibold transition-all lux-focus min-h-[44px] ${
            currentStep === 0
              ? 'bg-lux-ivory text-lux-slate/50 cursor-not-allowed'
              : 'lux-cta-secondary'
          }`}
        >
          Retour
        </button>
      </div>

      {/* Noscript fallback */}
      <noscript>
        <div className="mt-8 border-t border-lux-line pt-6">
          <p className="mb-4 text-sm text-lux-slate">
            JavaScript désactivé — veuillez nous contacter directement&nbsp;:
          </p>
          <a
            href="https://wa.me/21699192829"
            className="lux-cta-primary rounded-lg px-6 py-3"
          >
            Nous contacter sur WhatsApp
          </a>
        </div>
      </noscript>
    </div>
  );
}
