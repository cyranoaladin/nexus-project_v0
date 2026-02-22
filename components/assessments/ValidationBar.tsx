/**
 * ValidationBar Component
 * 
 * Bottom bar with validation buttons and progress indicator.
 * Shows segmented progress by module/category.
 */

'use client';

import { Button } from '@/components/ui/button';
import { ChevronRight, HelpCircle, Check } from 'lucide-react';

interface ValidationBarProps {
  onValidate: () => void;
  onNSP: () => void;
  onNext: () => void;
  canValidate: boolean;
  isNSP: boolean;
  currentQuestion: number;
  totalQuestions: number;
  progress: {
    category: string;
    completed: number;
    total: number;
  }[];
  className?: string;
}

export function ValidationBar({
  onValidate,
  onNSP,
  onNext,
  canValidate,
  isNSP,
  currentQuestion,
  totalQuestions,
  progress,
  className = '',
}: ValidationBarProps) {
  const overallProgress = (currentQuestion / totalQuestions) * 100;

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 ${className}`}>
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">
              Question {currentQuestion} sur {totalQuestions}
            </span>
            <span className="text-sm text-slate-300">
              {Math.round(overallProgress)}% complété
            </span>
          </div>

          {/* Segmented progress bar */}
          <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-800">
            {progress.map((segment, index) => {
              const segmentWidth = (segment.total / totalQuestions) * 100;
              const segmentProgress = (segment.completed / segment.total) * 100;

              return (
                <div
                  key={index}
                  className="relative"
                  style={{ width: `${segmentWidth}%` }}
                  title={`${segment.category}: ${segment.completed}/${segment.total}`}
                >
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${segmentProgress}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Category labels */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {progress.map((segment, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs text-slate-300">
                  {segment.category} ({segment.completed}/{segment.total})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {/* NSP button */}
          <Button
            variant="ghost"
            onClick={onNSP}
            disabled={isNSP}
            className={`
              flex-1 border-2 border-dashed
              ${isNSP ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-slate-600 text-slate-300'}
            `}
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Je ne sais pas
          </Button>

          {/* Validate button */}
          <Button
            onClick={onValidate}
            disabled={!canValidate && !isNSP}
            className="flex-1"
            size="lg"
          >
            <Check className="w-4 h-4 mr-2" />
            Valider
          </Button>

          {/* Next button (appears after validation) */}
          {canValidate && (
            <Button
              onClick={onNext}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-3 text-center">
          <p className="text-xs text-slate-500">
            Raccourcis : <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">A-D</kbd> pour répondre,{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">N</kbd> pour NSP,{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">Entrée</kbd> pour valider
          </p>
        </div>
      </div>
    </div>
  );
}
