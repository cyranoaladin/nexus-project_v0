"use client";

import { useState, useEffect, useCallback } from "react";
import { AutomatismeSeries, AutomatismeQuestion } from "@/types/automatismes";
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
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AutomatismesPlayerProps {
  seriesId: string;
  onComplete: (result: any, series: AutomatismeSeries) => void;
  onCancel: () => void;
}

export function AutomatismesPlayer({ seriesId, onComplete, onCancel }: AutomatismesPlayerProps) {
  const [series, setSeries] = useState<AutomatismeSeries | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [currentTime, setCurrentTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch series detail
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
    setSelectedChoiceId(choiceId);
    setAnswers(prev => ({ ...prev, [series!.questions[currentQuestionIndex].id]: choiceId }));
  };

  const handleNext = useCallback(async () => {
    if (!series) return;
    
    if (currentQuestionIndex < series.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowFeedback(false);
      setSelectedChoiceId(null);
    } else {
      // Finish
      setIsSubmitting(true);
      try {
        const res = await fetch("/api/student/automatismes/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesId,
            answers,
            durationSeconds: currentTime
          })
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
  // isCorrect calculation moved to results

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
              {currentQuestion.domain.replace("_", " ")}
            </span>
          </div>
          <div className="text-xl md:text-2xl text-white font-bold leading-relaxed">
            <MathRichText content={currentQuestion.statement} />
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentQuestion.choices.map((choice) => {
              let stateClass = "border-white/5 bg-white/5 hover:border-brand-accent/50 hover:bg-white/[0.08]";
              
              if (choice.id === selectedChoiceId) {
                stateClass = "border-brand-accent bg-brand-accent/10 text-brand-accent shadow-[0_0_15px_rgba(245,158,11,0.2)]";
              }

              return (
                <button
                  key={choice.id}
                  disabled={showFeedback}
                  onClick={() => handleChoiceSelect(choice.id)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border transition-all text-left group relative overflow-hidden",
                    stateClass
                  )}
                >
                  <span className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
                    showFeedback && choice.id === currentQuestion.correctChoiceId ? "bg-emerald-500 text-white" :
                    showFeedback && choice.id === selectedChoiceId ? "bg-rose-500 text-white" :
                    "bg-white/10 text-neutral-300 group-hover:bg-brand-accent group-hover:text-white transition-colors"
                  )}>
                    {choice.id}
                  </span>
                  <MathRichText content={choice.text} className="text-lg font-medium" />
                  
                  {choice.id === selectedChoiceId && (
                    <div className="absolute right-4 w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback section removed from playing mode */}
        </CardContent>

        <CardFooter className="bg-white/[0.02] border-t border-white/5 p-4 flex justify-between">
          <Button 
            variant="ghost" 
            onClick={onCancel}
            className="text-neutral-500 hover:text-white"
          >
            Abandonner
          </Button>
          
          <Button 
            onClick={handleNext}
            disabled={isSubmitting || !selectedChoiceId}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white font-bold px-8"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {currentQuestionIndex < series.questions.length - 1 ? "Question Suivante" : "Terminer la simulation"}
            {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
