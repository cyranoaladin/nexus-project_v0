"use client";

import { useState, useEffect, useCallback } from "react";
import { AutomatismeSeries, SafeAutomatismeSeries, AutomatismeAttemptResult } from "@/types/automatismes";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MathRichText } from "@/app/programme/maths-1ere/components/MathContent";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Timer,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  Zap,
  HelpCircle,
  Loader2,
  BookOpen,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckAnswerResponse {
  isCorrect: boolean;
  correctChoiceId: string;
  feedback: string;
  method: string;
  trap: string;
  remediation: string;
  sourceReference: string;
  sourceComment: string;
}

interface AutomatismesPlayerProps {
  seriesId: string;
  onComplete: (result: AutomatismeAttemptResult, series: AutomatismeSeries) => void;
  onCancel: () => void;
}

export function AutomatismesPlayer({ seriesId, onComplete, onCancel }: AutomatismesPlayerProps) {
  const [series, setSeries] = useState<SafeAutomatismeSeries | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [validated, setValidated] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CheckAnswerResponse | null>(null);
  const [startTime] = useState(Date.now());
  const [currentTime, setCurrentTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Fetch series detail (safe — no answers exposed)
  useEffect(() => {
    async function fetchSeries() {
      try {
        const res = await fetch(`/api/student/automatismes/series/${seriesId}`);
        if (res.ok) {
          setSeries(await res.json());
        }
      } catch (err) {
        console.error("Error fetching series details:", err);
      }
    }
    fetchSeries();
  }, [seriesId]);

  // Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleChoiceSelect = (choiceId: string) => {
    if (validated) return;
    setSelectedChoiceId(choiceId);
  };

  const handleValidate = useCallback(async () => {
    if (!series || !selectedChoiceId) return;
    const q = series.questions[currentQuestionIndex];
    if (!q) return;

    setIsChecking(true);
    try {
      const res = await fetch("/api/student/automatismes/check-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          questionId: q.id,
          selectedChoiceId,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as CheckAnswerResponse;
        setFeedback(data);
        setValidated(true);
        setAnswers((prev) => ({ ...prev, [q.id]: selectedChoiceId }));
      }
    } catch (err) {
      console.error("Error checking answer:", err);
    } finally {
      setIsChecking(false);
    }
  }, [series, selectedChoiceId, currentQuestionIndex, seriesId]);

  const handleNext = useCallback(async () => {
    if (!series) return;

    if (currentQuestionIndex < series.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setValidated(false);
      setSelectedChoiceId(null);
      setFeedback(null);
    } else {
      // Finish — submit full attempt
      setIsSubmitting(true);
      try {
        const res = await fetch("/api/student/automatismes/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesId,
            answers,
            durationSeconds: currentTime,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          onComplete(data.result, data.series);
        }
      } catch (err) {
        console.error("Error submitting attempt:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [currentQuestionIndex, series, answers, currentTime, seriesId, onComplete]);

  if (!series) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mb-4" />
        <p className="text-neutral-400">Préparation de la simulation...</p>
      </div>
    );
  }

  const currentQuestion = series.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / series.questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === series.questions.length - 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{series.title}</h2>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-brand-accent/5 border-brand-accent/20 text-brand-accent px-2 py-0">
              Question {currentQuestionIndex + 1} / {series.questions.length}
            </Badge>
            <div className="flex items-center gap-1.5 text-neutral-400 text-sm">
              <Timer className="w-4 h-4" />
              <span className="font-mono">{formatTime(currentTime)}</span>
            </div>
          </div>
        </div>
        <div className="w-full md:w-48 space-y-1.5">
          <div className="flex justify-between text-[10px] text-neutral-500 font-bold uppercase">
            <span>Progression</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/5" />
        </div>
      </div>

      {/* Question Card */}
      <Card className="bg-surface-card border-white/10 shadow-2xl overflow-hidden">
        <CardHeader className="bg-white/[0.02] border-b border-white/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
              {currentQuestion.domain.replace(/_/g, " ")}
            </span>
            {currentQuestion.difficulty === 3 && (
              <Badge variant="outline" className="text-amber-400 border-amber-400/30 text-[10px]">
                Difficile
              </Badge>
            )}
          </div>
          <div className="text-xl md:text-2xl text-white font-bold leading-relaxed">
            <MathRichText content={currentQuestion.statement} />
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentQuestion.choices.map((choice) => {
              let stateClass =
                "border-white/5 bg-white/5 hover:border-brand-accent/50 hover:bg-white/[0.08]";

              if (!validated && choice.id === selectedChoiceId) {
                stateClass =
                  "border-brand-accent bg-brand-accent/10 text-brand-accent shadow-[0_0_15px_rgba(245,158,11,0.2)]";
              }

              if (validated && feedback) {
                if (choice.id === feedback.correctChoiceId) {
                  stateClass =
                    "border-emerald-500/50 bg-emerald-500/10 text-emerald-100";
                } else if (choice.id === selectedChoiceId && !feedback.isCorrect) {
                  stateClass = "border-rose-500/50 bg-rose-500/10 text-rose-100";
                } else {
                  stateClass =
                    "border-white/5 bg-white/[0.02] text-neutral-500 opacity-60";
                }
              }

              return (
                <button
                  key={choice.id}
                  disabled={validated}
                  onClick={() => handleChoiceSelect(choice.id)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border transition-all text-left group relative overflow-hidden",
                    stateClass
                  )}
                >
                  <span
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
                      validated && feedback && choice.id === feedback.correctChoiceId
                        ? "bg-emerald-500 text-white"
                        : validated && choice.id === selectedChoiceId && !feedback?.isCorrect
                        ? "bg-rose-500 text-white"
                        : "bg-white/10 text-neutral-300 group-hover:bg-brand-accent group-hover:text-white transition-colors"
                    )}
                  >
                    {choice.id}
                  </span>
                  <MathRichText content={choice.text} className="text-lg font-medium" />

                  {validated && feedback && choice.id === feedback.correctChoiceId && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto shrink-0" />
                  )}
                  {validated &&
                    feedback &&
                    choice.id === selectedChoiceId &&
                    !feedback.isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-400 ml-auto shrink-0" />
                    )}
                </button>
              );
            })}
          </div>

          {/* Per-question feedback */}
          {validated && feedback && (
            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border",
                  feedback.isCorrect
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-rose-500/5 border-rose-500/20"
                )}
              >
                {feedback.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <p
                    className={cn(
                      "text-sm font-bold",
                      feedback.isCorrect ? "text-emerald-300" : "text-rose-300"
                    )}
                  >
                    {feedback.isCorrect ? "Bonne réponse !" : "Réponse incorrecte"}
                  </p>
                  <p className="text-sm text-neutral-300 mt-1">{feedback.feedback}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300">
                    <Lightbulb className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Méthode</span>
                  </div>
                  <p className="text-sm text-neutral-300 leading-relaxed">{feedback.method}</p>
                </div>

                {!feedback.isCorrect && (
                  <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 text-amber-300">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Piège classique
                      </span>
                    </div>
                    <p className="text-sm text-neutral-300 leading-relaxed">{feedback.trap}</p>
                  </div>
                )}

                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl flex items-start gap-3">
                  <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-neutral-400">
                    <span className="text-emerald-300 font-medium">Remédiation :</span>{" "}
                    {feedback.remediation}
                  </p>
                </div>

                <div className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-start gap-3">
                  <Target className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-neutral-400">
                    <span className="text-neutral-300 font-medium">Source :</span>{" "}
                    {feedback.sourceReference}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-white/[0.02] border-t border-white/5 p-4 flex justify-between">
          <Button variant="ghost" onClick={onCancel} className="text-neutral-500 hover:text-white">
            Abandonner
          </Button>

          {!validated ? (
            <Button
              onClick={handleValidate}
              disabled={isChecking || !selectedChoiceId}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white font-bold px-8"
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Valider
              {!isChecking && <CheckCircle2 className="w-4 h-4 ml-2" />}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={isSubmitting}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white font-bold px-8"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {isLastQuestion ? "Terminer la simulation" : "Question suivante"}
              {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
