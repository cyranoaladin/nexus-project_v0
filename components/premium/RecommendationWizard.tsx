'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { ExamCard } from './ExamCard';
import { buildRecommendationOutcome, getRecommendationActions, type RecommendationAction, type RecommendationData } from './recommendation-engine';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

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
      { id: 'terminale', label: 'Terminale', description: 'Bac en fin d\'année' },
      { id: 'premiere', label: 'Première', description: 'EAF + spécialités' },
      { id: 'seconde', label: 'Seconde', description: 'Consolidation' },
      { id: 'troisieme', label: 'Troisième', description: 'Brevet' },
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

// ── Component ──

interface RecommendationWizardProps {
  data: RecommendationData;
}

export function RecommendationWizard({ data }: RecommendationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const step = steps[currentStep];
  const selectedValue = answers[step.id];

  const recommendationOutcome = useMemo(
    () => (showResults ? buildRecommendationOutcome(answers, data) : { cards: [] }),
    [showResults, answers, data],
  );
  const recommendations = recommendationOutcome.cards;
  const recommendationActions = getRecommendationActions(data.whatsappUrl);

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

  const renderAction = (action: RecommendationAction, className: string) => {
    if (action.external) {
      return (
        <a
          key={action.href}
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {action.label}
        </a>
      );
    }

    return (
      <Link key={action.href} href={action.href} className={className}>
        {action.label}
      </Link>
    );
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
        {recommendations.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((props, i) => (
              <div key={`${props.title}-${i}`} className="relative">
                {i === 0 && (
                  <span className="absolute -top-3 left-4 z-10 rounded-full bg-lux-gold px-3 py-0.5 text-[0.65rem] font-semibold text-lux-ink">
                    Recommandation #1
                  </span>
                )}
                <ExamCard {...props} featured={i === 0} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-lux-line bg-lux-white p-6">
            <h3 className="text-xl font-fraunces text-lux-ink">
              {recommendationOutcome.emptyState?.title ?? 'Aucune recommandation disponible'}
            </h3>
            <p className="mt-2 text-sm text-lux-slate">
              {recommendationOutcome.emptyState?.message ?? 'Revenez au début du quiz pour préciser votre besoin.'}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {(recommendationOutcome.emptyState?.actions ?? recommendationActions).map((action) => (
                renderAction(
                  action,
                  'inline-flex items-center justify-center rounded-lg border border-lux-line px-4 py-3 text-sm font-semibold text-lux-ink transition-all hover:border-lux-gold hover:text-lux-gold lux-focus min-h-[44px]',
                )
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-lux-line bg-lux-paper/60 p-6">
          <h3 className="text-lg font-fraunces text-lux-ink">Et maintenant ?</h3>
          <p className="mt-2 text-sm text-lux-slate">
            Si vous hésitez encore, choisissez l’action la plus simple pour avancer.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {recommendationActions.map((action) => (
              renderAction(
                action,
                'inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-all lux-focus min-h-[44px] bg-lux-ink text-lux-ivory hover:bg-lux-ink/90',
              )
            ))}
          </div>
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
            href={buildWhatsAppUrl()}
            className="lux-cta-primary rounded-lg px-6 py-3"
          >
            Nous contacter sur WhatsApp
          </a>
        </div>
      </noscript>
    </div>
  );
}
