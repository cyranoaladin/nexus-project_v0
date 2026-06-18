'use client';

import { useState } from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';

interface WizardStep {
  id: number;
  title: string;
  description: string;
  options: Array<{
    id: string;
    label: string;
    value: string;
  }>;
}

interface WizardProps {
  onComplete: (answers: Record<string, string>) => void;
}

export function RecommendationWizard({ onComplete }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const steps: WizardStep[] = [
    {
      id: 1,
      title: 'Quel est ton statut?',
      description: 'Cela nous aide à personnaliser ta préparation.',
      options: [
        {
          id: 'student',
          label: 'Élève Scolarisé',
          value: 'student',
        },
        {
          id: 'free',
          label: 'Candidat Libre',
          value: 'free',
        },
        {
          id: 'repeat',
          label: 'Redoublant',
          value: 'repeat',
        },
      ],
    },
    {
      id: 2,
      title: 'Quelle est ta moyenne actuelle?',
      description: 'Cela nous permet d\'évaluer ton niveau.',
      options: [
        {
          id: 'under10',
          label: 'Moins de 10/20',
          value: 'under10',
        },
        {
          id: '10-12',
          label: '10 à 12/20',
          value: '10-12',
        },
        {
          id: '12-14',
          label: '12 à 14/20',
          value: '12-14',
        },
        {
          id: 'above14',
          label: '14/20 et plus',
          value: 'above14',
        },
      ],
    },
    {
      id: 3,
      title: 'Quelle est ta matière prioritaire?',
      description: 'Nous porterons une attention particulière à cette matière.',
      options: [
        {
          id: 'math',
          label: 'Mathématiques',
          value: 'math',
        },
        {
          id: 'french',
          label: 'Français',
          value: 'french',
        },
        {
          id: 'history',
          label: 'Histoire-Géographie',
          value: 'history',
        },
        {
          id: 'all',
          label: 'Toutes les matières',
          value: 'all',
        },
      ],
    },
  ];

  const handleSelectOption = (optionValue: string) => {
    const currentStepData = steps[currentStep];
    const newAnswers = {
      ...answers,
      [`step${currentStepData.id}`]: optionValue,
    };
    setAnswers(newAnswers);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(newAnswers);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];
  const selectedValue = answers[`step${currentStepData.id}`];

  return (
    <div className="w-full">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex gap-2 mb-4">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`flex-1 h-2 rounded-full transition-smooth ${
                idx < currentStep
                  ? 'bg-secondary'
                  : idx === currentStep
                    ? 'bg-accent'
                    : 'bg-border'
              }`}
            />
          ))}
        </div>
        <p className="text-body-sm text-muted-foreground">
          Étape {currentStep + 1} sur {steps.length}
        </p>
      </div>

      {/* Question */}
      <div className="mb-12">
        <h2 className="text-h2 mb-3">{currentStepData.title}</h2>
        <p className="text-body-lg text-muted-foreground">
          {currentStepData.description}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-8">
        {currentStepData.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelectOption(option.value)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-smooth focus-ring ${
              selectedValue === option.value
                ? 'border-accent bg-accent/5'
                : 'border-border bg-card hover:border-accent/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-bold ${
                  selectedValue === option.value
                    ? 'text-accent'
                    : 'text-primary'
                }`}
              >
                {option.label}
              </span>
              {selectedValue === option.value && (
                <CheckCircle2 className="w-5 h-5 text-accent" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-4">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`px-6 py-3 rounded-lg font-bold transition-smooth focus-ring ${
            currentStep === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-card hover:bg-primary/90'
          }`}
        >
          Retour
        </button>

        {selectedValue && (
          <button
            onClick={() => handleSelectOption(selectedValue)}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-accent text-primary font-bold rounded-lg hover:bg-accent/90 transition-smooth focus-ring"
          >
            {currentStep === steps.length - 1 ? 'Voir mes résultats' : 'Continuer'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Accessibility: Show all options text version */}
      <noscript>
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-body-sm text-muted-foreground mb-4">
            JavaScript désactivé: Veuillez sélectionner une option ci-dessous
          </p>
          {currentStepData.options.map((option) => (
            <div key={option.id} className="mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`step${currentStepData.id}`}
                  value={option.value}
                  onChange={(e) => handleSelectOption(e.target.value)}
                />
                <span>{option.label}</span>
              </label>
            </div>
          ))}
        </div>
      </noscript>
    </div>
  );
}
