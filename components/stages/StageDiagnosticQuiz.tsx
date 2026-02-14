'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Brain,
  Code2,
  ChevronRight,
  CheckCircle,
  Loader2,
  BookOpen,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Calculator,
  Monitor,
  Trophy,
  Clock,
  BarChart3,
} from 'lucide-react';
import {
  MATHS_QUESTIONS,
  NSI_QUESTIONS,
  ALL_STAGE_QUESTIONS,
} from '@/lib/data/stage-qcm-structure';
import type { StageQuestion } from '@/lib/data/stage-qcm-structure';

// ─── Types ───────────────────────────────────────────────────────────────────

type QuizPhase = 'intro' | 'quiz' | 'transition' | 'submitting' | 'success' | 'error';
type AnswerMap = Record<string, string>; // questionId → optionId | 'NSP'

interface SubmitResult {
  success: boolean;
  redirectUrl?: string;
  error?: string;
  globalScore?: number;
  confidenceIndex?: number;
}

interface StageDiagnosticQuizProps {
  /** Email of the registered student (from reservation) */
  email: string;
  /** Optional reservation ID for direct lookup */
  reservationId?: string;
  /** Callback when quiz is completed */
  onComplete?: (result: SubmitResult) => void;
}

// ─── LaTeX Renderer ──────────────────────────────────────────────────────────

/**
 * Renders text containing LaTeX ($...$) and code blocks (```...```).
 * Uses KaTeX for math rendering, <pre><code> for code blocks.
 */
function RichText({ content, className = '' }: { content: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderKatex = async () => {
      try {
        const katex = (await import('katex')).default;

        if (!containerRef.current) return;

        // Process all .katex-placeholder spans
        const placeholders = containerRef.current.querySelectorAll('.katex-placeholder');
        placeholders.forEach((el) => {
          const latex = el.getAttribute('data-latex') || '';
          try {
            katex.render(latex, el as HTMLElement, {
              throwOnError: false,
              displayMode: false,
              trust: true,
            });
          } catch {
            (el as HTMLElement).textContent = latex;
          }
        });
      } catch {
        // KaTeX not available — leave placeholders as-is
      }
    };

    renderKatex();
  }, [content]);

  const html = useMemo(() => processContent(content), [content]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Parse content string into HTML with KaTeX placeholders and code blocks.
 */
function processContent(text: string): string {
  // Step 1: Handle code blocks (```...```)
  let result = text.replace(
    /```(\w+)?\n?([\s\S]*?)```/g,
    (_match, lang, code) => {
      const language = lang || 'python';
      const escapedCode = escapeHtml(code.trim());
      return `<pre class="code-block bg-slate-800 text-slate-100 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono leading-relaxed"><code class="language-${language}">${escapedCode}</code></pre>`;
    }
  );

  // Step 2: Handle inline code (`...`)
  result = result.replace(
    /`([^`]+)`/g,
    (_match, code) => {
      const escapedCode = escapeHtml(code);
      return `<code class="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">${escapedCode}</code>`;
    }
  );

  // Step 3: Handle LaTeX ($...$) — replace with placeholder spans
  result = result.replace(
    /\$([^$]+)\$/g,
    (_match, latex) => {
      const escapedLatex = escapeHtml(latex);
      return `<span class="katex-placeholder inline" data-latex="${escapedLatex}">${escapedLatex}</span>`;
    }
  );

  // Step 4: Handle newlines
  result = result.replace(/\n/g, '<br/>');

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({
  currentIndex,
  totalMaths,
  totalNSI,
}: {
  currentIndex: number;
  totalMaths: number;
  totalNSI: number;
}) {
  const total = totalMaths + totalNSI;
  const progressPercent = ((currentIndex + 1) / total) * 100;
  const mathsPercent = (totalMaths / total) * 100;
  const isInNSI = currentIndex >= totalMaths;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">
          Question {currentIndex + 1}/{total}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isInNSI
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {isInNSI ? 'NSI' : 'Mathématiques'}
        </span>
      </div>
      <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
        {/* Maths/NSI separator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-300 z-10"
          style={{ left: `${mathsPercent}%` }}
        />
        {/* Progress fill */}
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isInNSI
              ? 'bg-gradient-to-r from-blue-500 via-blue-500 to-emerald-500'
              : 'bg-gradient-to-r from-blue-400 to-blue-600'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">Maths ({totalMaths})</span>
        <span className="text-[10px] text-slate-400">NSI ({totalNSI})</span>
      </div>
    </div>
  );
}

// ─── Intro Screen ────────────────────────────────────────────────────────────

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-8">
      <div className="mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Brain className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-3">
          Diagnostic de Positionnement
        </h1>
        <p className="text-lg text-slate-600">
          Stage Février 2026 — Maths & NSI
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 text-left">
        <div className="flex items-start gap-3">
          <BookOpen className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-amber-900 mb-2">
              Ce n&apos;est pas une note, c&apos;est un outil.
            </h2>
            <p className="text-sm text-amber-800 leading-relaxed">
              Ce diagnostic nous permet d&apos;adapter ton groupe de travail à ton vrai niveau.
              Il n&apos;y a <strong>aucune pénalité</strong> pour les mauvaises réponses.
              L&apos;important est d&apos;être <strong>honnête</strong> : si tu ne connais pas une notion,
              dis-le. Ça nous aide à mieux t&apos;accompagner.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Calculator className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">30 questions Maths</p>
          <p className="text-xs text-slate-500">Analyse, Géométrie, Probas...</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Monitor className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">20 questions NSI</p>
          <p className="text-xs text-slate-500">POO, SQL, Algo, Réseaux...</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">~25 minutes</p>
          <p className="text-xs text-slate-500">Pas de chrono, prends ton temps</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
        <div className="flex items-center gap-2 justify-center">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          <p className="text-sm text-blue-800">
            Le bouton <strong>&quot;Je n&apos;ai pas encore vu cette notion&quot;</strong> est là pour toi.
            L&apos;utiliser est un signe de maturité, pas de faiblesse.
          </p>
        </div>
      </div>

      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
      >
        Commencer le diagnostic
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── Transition Screen (Maths → NSI) ────────────────────────────────────────

function TransitionScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-3">
        Partie Maths terminée !
      </h2>
      <p className="text-slate-600 mb-2">
        Bravo, tu as complété les 30 questions de Mathématiques.
      </p>
      <p className="text-slate-600 mb-8">
        Place maintenant à la partie <strong>Numérique et Sciences Informatiques</strong>.
      </p>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-8">
        <div className="flex items-center gap-2 justify-center">
          <Code2 className="w-5 h-5 text-emerald-600" />
          <p className="text-sm text-emerald-800">
            20 questions sur la POO, les bases de données, l&apos;algorithmique et les réseaux.
          </p>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
      >
        Continuer vers NSI
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── Success Screen ──────────────────────────────────────────────────────────

function SuccessScreen({ result }: { result: SubmitResult }) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
        <Trophy className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-3">
        Diagnostic terminé !
      </h2>
      <p className="text-slate-600 mb-6">
        Tes réponses ont été enregistrées et analysées par notre moteur pédagogique.
      </p>

      {result.globalScore !== undefined && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <BarChart3 className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-slate-900">{Math.round(result.globalScore)}%</p>
            <p className="text-xs text-slate-500">Score global</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <Brain className="w-6 h-6 text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-slate-900">{Math.round(result.confidenceIndex || 0)}%</p>
            <p className="text-xs text-slate-500">Indice de confiance</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 text-left">
        <h3 className="font-bold text-blue-900 mb-2">Prochaines étapes</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>Ton bilan personnalisé sera disponible sous 24h.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>Tu seras placé dans un groupe adapté à ton niveau.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>Un coach te contactera pour préparer le stage.</span>
          </li>
        </ul>
      </div>

      <a
        href="/stages/fevrier-2026"
        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
      >
        Retour à la page du stage
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

// ─── Question Card ───────────────────────────────────────────────────────────

function QuestionCard({
  question,
  selectedAnswer,
  onSelectOption,
  onSelectNSP,
  questionNumber,
}: {
  question: StageQuestion;
  selectedAnswer: string | undefined;
  onSelectOption: (optionId: string) => void;
  onSelectNSP: () => void;
  questionNumber: number;
}) {
  const isNSP = selectedAnswer === 'NSP';
  const isMaths = question.subject === 'MATHS';

  return (
    <div className="w-full">
      {/* Category & Competence badges */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          isMaths ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {question.category}
        </span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {question.competence}
        </span>
        <span className="text-xs text-slate-400 ml-auto">
          {'★'.repeat(question.weight)}{'☆'.repeat(3 - question.weight)}
        </span>
      </div>

      {/* Question text */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-400 mb-1">Question {questionNumber}</h3>
        <RichText
          content={question.questionText}
          className="text-lg font-semibold text-slate-900 leading-relaxed"
        />
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {question.options.map((option) => {
          const isSelected = selectedAnswer === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onSelectOption(option.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {option.id.toUpperCase()}
                </span>
                <RichText
                  content={option.text}
                  className={`text-sm leading-relaxed pt-0.5 ${
                    isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* NSP Button — separated visually */}
      <div className="border-t border-dashed border-slate-200 pt-4">
        <button
          onClick={onSelectNSP}
          className={`w-full text-center p-3 rounded-xl border-2 transition-all duration-200 ${
            isNSP
              ? 'border-slate-400 bg-slate-100 text-slate-700'
              : 'border-transparent bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-500'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <HelpCircle className={`w-4 h-4 ${isNSP ? 'text-slate-600' : 'text-slate-400'}`} />
            <span className="text-sm font-medium">
              Je n&apos;ai pas encore vu cette notion
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StageDiagnosticQuiz({
  email,
  reservationId,
  onComplete,
}: StageDiagnosticQuizProps) {
  const [phase, setPhase] = useState<QuizPhase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Ordered questions: Maths first, then NSI
  const allQuestions = useMemo<StageQuestion[]>(
    () => [...MATHS_QUESTIONS, ...NSI_QUESTIONS],
    []
  );

  const totalMaths = MATHS_QUESTIONS.length;
  const totalNSI = NSI_QUESTIONS.length;
  const currentQuestion = allQuestions[currentIndex];
  const isLastQuestion = currentIndex === allQuestions.length - 1;
  const isAtMathsEnd = currentIndex === totalMaths - 1;
  const hasAnswered = currentQuestion ? answers[currentQuestion.id] !== undefined : false;

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    setPhase('quiz');
    setCurrentIndex(0);
  }, []);

  const handleSelectOption = useCallback(
    (optionId: string) => {
      if (!currentQuestion) return;
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
    },
    [currentQuestion]
  );

  const handleSelectNSP = useCallback(() => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: 'NSP' }));
  }, [currentQuestion]);

  const handleNext = useCallback(() => {
    if (!hasAnswered) return;

    if (isLastQuestion) {
      // Submit
      handleSubmit();
      return;
    }

    if (isAtMathsEnd && phase === 'quiz') {
      // Show transition screen
      setPhase('transition');
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnswered, isLastQuestion, isAtMathsEnd, phase]);

  const handleContinueToNSI = useCallback(() => {
    setPhase('quiz');
    setCurrentIndex(totalMaths);
  }, [totalMaths]);

  const handleSubmit = useCallback(async () => {
    setPhase('submitting');
    setErrorMessage('');

    try {
      // Transform answers to the API format
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        selectedOptionId: answer === 'NSP' ? null : answer,
        isNSP: answer === 'NSP',
      }));

      const res = await fetch('/api/stages/submit-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          reservationId,
          answers: formattedAnswers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erreur serveur (${res.status})`);
      }

      setSubmitResult(data);
      setPhase('success');
      onComplete?.(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur inattendue');
      setPhase('error');
    }
  }, [answers, email, reservationId, onComplete]);

  // ─── Keyboard navigation ──────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'quiz') return;

      // Enter to go next
      if (e.key === 'Enter' && hasAnswered) {
        handleNext();
        return;
      }

      // a/b/c/d to select option
      if (currentQuestion && ['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
        const option = currentQuestion.options.find(
          (o) => o.id === e.key.toLowerCase()
        );
        if (option) handleSelectOption(option.id);
      }

      // n for NSP
      if (e.key.toLowerCase() === 'n') {
        handleSelectNSP();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, hasAnswered, handleNext, currentQuestion, handleSelectOption, handleSelectNSP]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* KaTeX CSS */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
        crossOrigin="anonymous"
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* ── Intro ──────────────────────────────────────────────────── */}
        {phase === 'intro' && <IntroScreen onStart={handleStart} />}

        {/* ── Transition Maths → NSI ─────────────────────────────────── */}
        {phase === 'transition' && (
          <TransitionScreen onContinue={handleContinueToNSI} />
        )}

        {/* ── Quiz ───────────────────────────────────────────────────── */}
        {phase === 'quiz' && currentQuestion && (
          <div>
            {/* Progress */}
            <div className="mb-8">
              <ProgressBar
                currentIndex={currentIndex}
                totalMaths={totalMaths}
                totalNSI={totalNSI}
              />
            </div>

            {/* Question Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-6">
              <QuestionCard
                question={currentQuestion}
                selectedAnswer={answers[currentQuestion.id]}
                onSelectOption={handleSelectOption}
                onSelectNSP={handleSelectNSP}
                questionNumber={currentIndex + 1}
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Raccourcis : <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">A</kbd>{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">B</kbd>{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">C</kbd>{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">D</kbd>{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">N</kbd>=NSP{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Entrée</kbd>=Suivant
              </p>

              <button
                onClick={handleNext}
                disabled={!hasAnswered}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  hasAnswered
                    ? isLastQuestion
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                      : 'bg-slate-900 text-white hover:bg-black'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLastQuestion ? (
                  <>
                    Terminer et voir mon bilan
                    <CheckCircle className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Suivant
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Submitting ─────────────────────────────────────────────── */}
        {phase === 'submitting' && (
          <div className="max-w-md mx-auto text-center py-16">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Analyse en cours...
            </h2>
            <p className="text-slate-600">
              Notre moteur pédagogique calcule ton profil de compétences.
            </p>
          </div>
        )}

        {/* ── Success ────────────────────────────────────────────────── */}
        {phase === 'success' && submitResult && (
          <SuccessScreen result={submitResult} />
        )}

        {/* ── Error ──────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Erreur lors de l&apos;envoi
            </h2>
            <p className="text-slate-600 mb-6">{errorMessage}</p>
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
            >
              <Loader2 className="w-4 h-4" />
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
