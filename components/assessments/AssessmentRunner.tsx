/**
 * AssessmentRunner Component
 * 
 * Main orchestrator for running assessments.
 * Handles state machine, question loading, and answer submission.
 * 
 * State flow: INTRO → LOADING → QUESTION → TRANSITION → SUBMITTING → COMPLETED
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Subject, Grade } from '@/lib/assessments/core/types';
import type { StudentAnswer } from '@/lib/assessments/core/types';
import type { Question } from '@/lib/assessments/questions/types';
import { QuestionCard } from './QuestionCard';
import { ValidationBar } from './ValidationBar';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Assessment state machine
type AssessmentState = 
  | 'INTRO'
  | 'LOADING'
  | 'QUESTION'
  | 'TRANSITION'
  | 'SUBMITTING'
  | 'COMPLETED'
  | 'ERROR';

interface AssessmentRunnerProps {
  subject: Subject;
  grade: Grade;
  studentId?: string;
  onComplete?: (answers: StudentAnswer[]) => void;
  apiEndpoint?: string;
}

export function AssessmentRunner({
  subject,
  grade,
  studentId,
  onComplete,
  apiEndpoint,
}: AssessmentRunnerProps) {
  const router = useRouter();

  // State
  const [state, setState] = useState<AssessmentState>('INTRO');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isNSP, setIsNSP] = useState(false);
  const [startTime] = useState(Date.now());

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  // Load questions
  const loadQuestions = useCallback(async () => {
    setState('LOADING');
    try {
      // Dynamic import to use code splitting
      const { QuestionBank } = await import('@/lib/assessments/questions');
      const loadedQuestions = await QuestionBank.loadAll(subject, grade);

      if (loadedQuestions.length === 0) {
        throw new Error('Aucune question disponible pour cette combinaison');
      }

      setQuestions(loadedQuestions);
      setState('QUESTION');
    } catch (error) {
      console.error('Failed to load questions:', error);
      setState('ERROR');
      toast.error('Erreur lors du chargement des questions');
    }
  }, [subject, grade]);

  // Start assessment
  const handleStart = () => {
    loadQuestions();
  };

  // Select option
  const handleSelectOption = (optionId: string) => {
    setSelectedOption(optionId);
    setIsNSP(false);
  };

  // Select NSP
  const handleSelectNSP = () => {
    setIsNSP(true);
    setSelectedOption(null);
  };

  // Submit assessment
  const submitAssessment = useCallback(async (finalAnswers: Map<string, StudentAnswer>) => {
    setState('SUBMITTING');

    try {
      const answersArray = Array.from(finalAnswers.values());

      if (onComplete) {
        onComplete(answersArray);
      }

      if (apiEndpoint) {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject,
            grade,
            studentId,
            answers: answersArray,
            duration: Date.now() - startTime,
          }),
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la soumission');
        }

        const result = await response.json();
        setState('COMPLETED');
        
        // Redirect to results page if provided
        if (result.redirectUrl) {
          router.push(result.redirectUrl);
        }
      } else {
        setState('COMPLETED');
      }
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      setState('ERROR');
      toast.error('Erreur lors de la soumission');
    }
  }, [apiEndpoint, grade, onComplete, router, startTime, studentId, subject]);

  // Validate answer
  const handleValidate = useCallback(() => {
    if (!currentQuestion) return;

    // Determine answer status
    // Note: We don't know if it's correct/incorrect yet (that's determined server-side)
    // For now, we just mark as 'nsp' if NSP, otherwise we'll need to check correctness
    const answer: StudentAnswer = {
      questionId: currentQuestion.id,
      status: isNSP ? 'nsp' : 'incorrect', // Will be corrected server-side
    };

    // Store answer
    const newAnswers = new Map(answers);
    newAnswers.set(currentQuestion.id, answer);
    setAnswers(newAnswers);

    // Move to next question or complete
    if (currentIndex < totalQuestions - 1) {
      // Check if transitioning between categories
      const nextQuestion = questions[currentIndex + 1];
      const isTransition = currentQuestion.category !== nextQuestion.category;

      if (isTransition) {
        setState('TRANSITION');
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
          setSelectedOption(null);
          setIsNSP(false);
          setState('QUESTION');
        }, 2000);
      } else {
        setCurrentIndex(currentIndex + 1);
        setSelectedOption(null);
        setIsNSP(false);
      }
    } else {
      // All questions answered
      submitAssessment(newAnswers);
    }
  }, [answers, currentIndex, currentQuestion, isNSP, questions, submitAssessment, totalQuestions]);

  // Keyboard shortcuts
  useEffect(() => {
    if (state !== 'QUESTION' || !currentQuestion) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Option selection (A-D)
      if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
        const option = currentQuestion.options.find(
          (opt) => opt.id.toLowerCase() === e.key.toLowerCase()
        );
        if (option) {
          handleSelectOption(option.id);
        }
      }

      // NSP (N)
      if (e.key.toLowerCase() === 'n') {
        handleSelectNSP();
      }

      // Validate (Enter)
      if (e.key === 'Enter' && (selectedOption || isNSP)) {
        handleValidate();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [state, currentQuestion, selectedOption, isNSP, handleValidate]);

  // Calculate progress by category
  const calculateProgress = () => {
    const categories = new Map<string, { completed: number; total: number }>();

    questions.forEach((q, index) => {
      if (!categories.has(q.category)) {
        categories.set(q.category, { completed: 0, total: 0 });
      }
      const cat = categories.get(q.category)!;
      cat.total++;
      if (index < currentIndex || answers.has(q.id)) {
        cat.completed++;
      }
    });

    return Array.from(categories.entries()).map(([category, stats]) => ({
      category,
      ...stats,
    }));
  };

  // Render states
  if (state === 'INTRO') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">
              Évaluation {subject === Subject.MATHS ? 'Mathématiques' : 'NSI'}
            </h1>
            <p className="text-xl text-slate-400">
              {grade === 'PREMIERE' ? 'Première' : 'Terminale'}
            </p>
          </div>

          <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-left space-y-4">
            <h2 className="text-lg font-semibold">Instructions</h2>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Répondez à toutes les questions au mieux de vos connaissances</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Utilisez "Je ne sais pas" si vous n'avez pas encore vu la notion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Vous pouvez utiliser les raccourcis clavier (A-D, N, Entrée)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Prenez votre temps, il n'y a pas de limite de temps stricte</span>
              </li>
            </ul>
          </div>

          <Button size="lg" onClick={handleStart} className="w-full max-w-md">
            Commencer l'évaluation
          </Button>
        </div>
      </div>
    );
  }

  if (state === 'LOADING') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-slate-400">Chargement des questions...</p>
        </div>
      </div>
    );
  }

  if (state === 'TRANSITION') {
    const nextQuestion = questions[currentIndex + 1];
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">
              Bravo ! Partie {currentQuestion.category} terminée
            </h2>
            <p className="text-lg text-slate-400">
              Place à : {nextQuestion.category}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'SUBMITTING') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-slate-400">Envoi de vos réponses...</p>
        </div>
      </div>
    );
  }

  if (state === 'COMPLETED') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Évaluation terminée !</h1>
            <p className="text-lg text-slate-400">
              Vos réponses ont été enregistrées avec succès
            </p>
          </div>
          <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-slate-300">
              Vous allez recevoir votre bilan personnalisé par email dans quelques instants.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'ERROR') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Une erreur est survenue</h1>
            <p className="text-lg text-slate-400">
              Impossible de charger l'évaluation
            </p>
          </div>
          <Button onClick={() => setState('INTRO')} variant="outline">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  // Main question view
  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            selectedOption={selectedOption}
            onSelectOption={handleSelectOption}
            onSelectNSP={handleSelectNSP}
            isNSP={isNSP}
            questionNumber={currentIndex + 1}
            totalQuestions={totalQuestions}
            showHint={true}
          />
        )}
      </div>

      <ValidationBar
        onValidate={handleValidate}
        onNSP={handleSelectNSP}
        onNext={handleValidate}
        canValidate={selectedOption !== null || isNSP}
        isNSP={isNSP}
        currentQuestion={currentIndex + 1}
        totalQuestions={totalQuestions}
        progress={calculateProgress()}
      />
    </div>
  );
}
