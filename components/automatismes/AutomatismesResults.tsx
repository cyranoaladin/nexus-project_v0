"use client";

import { AutomatismeSeries, AutomatismeAttemptResult, AutomatismeDomain } from "@/types/automatismes";
import { DOMAIN_LABELS } from "@/lib/automatismes/scoring";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Target, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  Home,
  Star,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Zap,
  HelpCircle,
  MessageSquare
} from "lucide-react";
import { MathRichText } from "@/app/programme/maths-1ere/components/MathContent";
import { cn } from "@/lib/utils";

interface AutomatismesResultsProps {
  result: AutomatismeAttemptResult;
  series: AutomatismeSeries;
  onRestart: () => void;
  onGoHome: () => void;
}

export function AutomatismesResults({ result, series, onRestart, onGoHome }: AutomatismesResultsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 10) return "text-emerald-400";
    if (score >= 7) return "text-amber-400";
    return "text-rose-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 10) return "bg-emerald-400/10";
    if (score >= 7) return "bg-amber-400/10";
    return "bg-rose-400/10";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Hero Result Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-primary to-surface-card p-8 border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent/10 blur-[100px] -mr-32 -mt-32 rounded-full" />
        
        <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
          <div className="shrink-0">
            <div className={cn(
              "w-48 h-48 rounded-full border-8 flex flex-col items-center justify-center shadow-inner",
              result.score >= 10 ? "border-emerald-500/30" : result.score >= 7 ? "border-amber-500/30" : "border-rose-500/30"
            )}>
              <span className={cn("text-6xl font-black mb-1", getScoreColor(result.score))}>
                {result.score}
              </span>
              <span className="text-neutral-400 font-bold uppercase tracking-widest text-sm">/ 12</span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <Star className="w-5 h-5 text-brand-accent fill-brand-accent" />
              <span className="text-brand-accent font-bold uppercase tracking-wider text-sm">Simulation Terminée</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Score Final : <span className={getScoreColor(result.score)}>{result.scoreSur6}/6</span>
            </h2>
            <p className="text-neutral-300 text-lg max-w-xl leading-relaxed italic">
              &ldquo;{result.recommendation}&rdquo;
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4 justify-center md:justify-start">
              <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span className="text-white font-mono">{Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                <Target className="w-4 h-4 text-neutral-400" />
                <span className="text-white">{result.averageTimePerQuestion}s / question</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Domain Performance */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-accent" />
            Analyse par domaine
          </h3>
          
          <div className="grid gap-4">
            {Object.entries(result.domainPerformance).map(([domain, data]) => (
              <Card key={domain} className="bg-surface-card border-white/5 hover:border-white/10 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        data.percentage >= 80 ? "bg-emerald-400" : data.percentage >= 50 ? "bg-amber-400" : "bg-rose-400"
                      )} />
                      <span className="font-semibold text-neutral-200">
                        {DOMAIN_LABELS[domain as AutomatismeDomain]}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-white">
                      {data.correct} / {data.total}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Progress 
                      value={data.percentage} 
                      className={cn(
                        "h-1.5 bg-white/5",
                        data.percentage >= 80 ? "[&>div]:bg-emerald-400" : data.percentage >= 50 ? "[&>div]:bg-amber-400" : "[&>div]:bg-rose-400"
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Strengths and Weaknesses */}
        <div className="space-y-8">
          {/* Points Forts */}
          {result.strengths.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Points Forts
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.strengths.map((s) => (
                  <div key={s} className="bg-emerald-400/10 text-emerald-300 border border-emerald-400/20 px-3 py-1.5 rounded-lg text-sm font-medium">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Points à travailler */}
          {result.weaknesses.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                Points à travailler
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.weaknesses.map((w) => (
                  <div key={w} className="bg-rose-400/10 text-rose-300 border border-rose-400/20 px-3 py-1.5 rounded-lg text-sm font-medium">
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remediation Cards */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-accent" />
              Remédiation suggérée
            </h3>
            <Card className="bg-brand-accent/5 border-brand-accent/20">
              <CardContent className="p-4 space-y-4">
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Basé sur tes erreurs, nous te conseillons de revoir les fiches de cours suivantes :
                </p>
                <div className="space-y-2">
                  {result.sourceReferences.slice(0, 3).map((ref) => (
                    <div key={ref} className="flex items-center justify-between p-2 bg-white/5 rounded-lg group">
                      <span className="text-xs text-neutral-400 line-clamp-1">{ref}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Detailed Correction Section */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-brand-accent" />
          Correction détaillée
        </h3>
        
        <div className="grid gap-6">
          {series.questions.map((q, idx) => {
            const userAnswer = result.answers[q.id];
            const isCorrect = userAnswer === q.correctChoiceId;
            
            return (
              <Card key={q.id} className="bg-surface-card border-white/10 overflow-hidden">
                <CardHeader className="bg-white/[0.02] border-b border-white/5 flex flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-neutral-300">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-lg font-bold">
                        <MathRichText content={q.statement} />
                      </div>
                      <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1 font-bold">
                        {DOMAIN_LABELS[q.domain]} • {q.skillTag.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase",
                    isCorrect ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  )}>
                    {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {isCorrect ? "Correct" : "Erreur"}
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User Answer vs Correct Answer */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Tes réponses :</span>
                        <div className="grid grid-cols-1 gap-2">
                          {q.choices.map(choice => (
                            <div 
                              key={choice.id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border text-sm",
                                choice.id === q.correctChoiceId ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100" :
                                choice.id === userAnswer ? "border-rose-500/30 bg-rose-500/5 text-rose-100" :
                                "border-white/5 bg-white/[0.02] text-neutral-400 opacity-60"
                              )}
                            >
                              <span className={cn(
                                "w-6 h-6 rounded flex items-center justify-center font-bold text-xs",
                                choice.id === q.correctChoiceId ? "bg-emerald-500 text-white" :
                                choice.id === userAnswer ? "bg-rose-500 text-white" : "bg-white/10"
                              )}>
                                {choice.id}
                              </span>
                              <MathRichText content={choice.text} className="text-sm" />
                              {choice.id === q.correctChoiceId && <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />}
                              {choice.id === userAnswer && choice.id !== q.correctChoiceId && <XCircle className="w-4 h-4 text-rose-400 ml-auto" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Method and Feedback */}
                    <div className="space-y-4">
                      <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-2 text-indigo-300">
                          <Lightbulb className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Méthode</span>
                        </div>
                        <div className="text-sm text-neutral-300 leading-relaxed">
                          <MathRichText content={q.method} />
                        </div>
                      </div>
                      
                      {!isCorrect && (
                        <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                          <div className="flex items-center gap-2 mb-2 text-amber-300">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Pourquoi l&apos;erreur ?</span>
                          </div>
                          <div className="text-sm text-neutral-300 leading-relaxed">
                            <MathRichText content={q.trap} />
                          </div>
                        </div>
                      )}

                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl flex items-start gap-3">
                        <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-neutral-400">
                          <span className="text-emerald-300 font-medium">Conseil :</span> {q.remediation}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 border-t border-white/5">
        <Button 
          variant="outline" 
          onClick={onGoHome}
          className="w-full sm:w-auto border-white/10 hover:bg-white/5 text-white"
        >
          <Home className="w-4 h-4 mr-2" />
          Retour au dashboard
        </Button>
        <Button 
          onClick={onRestart}
          className="w-full sm:w-auto bg-brand-accent hover:bg-brand-accent/90 text-white font-bold"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Nouvelle simulation
        </Button>
      </div>
    </div>
  );
}
