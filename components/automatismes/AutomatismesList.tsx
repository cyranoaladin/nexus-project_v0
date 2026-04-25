"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Timer, Trophy, History, Play, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SeriesMetadata {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  recommendedDurationMinutes: number;
  questionCount: number;
}

interface Attempt {
  id: string;
  createdAt: string;
  globalScore: number;
  scoringResult: any;
}

interface AutomatismesListProps {
  onSelectSeries: (id: string) => void;
}

export function AutomatismesList({ onSelectSeries }: AutomatismesListProps) {
  const [series, setSeries] = useState<SeriesMetadata[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [seriesRes, attemptsRes] = await Promise.all([
          fetch("/api/student/automatismes/series"),
          fetch("/api/student/automatismes/attempts")
        ]);

        if (seriesRes.ok && attemptsRes.ok) {
          setSeries(await seriesRes.json());
          setAttempts(await attemptsRes.json());
        }
      } catch (error) {
        console.error("Error fetching automatismes list:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mb-4" />
        <p className="text-neutral-400">Chargement des séries...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Selection Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-brand-accent" />
              Séries Disponibles
            </h2>
            <Badge variant="outline" className="border-brand-accent/30 text-brand-accent">
              {series.length} Simulations
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {series.map((s) => {
              const lastAttempt = attempts.find(a => (a.scoringResult as any)?.seriesId === s.id);
              const bestScore = attempts
                .filter(a => (a.scoringResult as any)?.seriesId === s.id)
                .reduce((max, a) => Math.max(max, a.globalScore), 0);

              return (
                <Card key={s.id} className="bg-surface-card border-white/5 hover:border-brand-accent/30 transition-all group overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-lg bg-brand-accent/10 flex items-center justify-center text-brand-accent mb-2 group-hover:scale-110 transition-transform">
                        <Zap className="w-5 h-5" />
                      </div>
                      {bestScore > 0 && (
                        <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-full">
                          <Trophy className="w-3 h-3" />
                          {bestScore}%
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-lg text-white group-hover:text-brand-accent transition-colors">
                      {s.title}
                    </CardTitle>
                    <CardDescription className="text-neutral-400 text-xs line-clamp-1">
                      {s.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center gap-4 mt-2 mb-4 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {s.recommendedDurationMinutes} min
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {s.questionCount} Questions
                      </div>
                    </div>
                    <Button 
                      onClick={() => onSelectSeries(s.id)}
                      className="w-full bg-white/5 hover:bg-brand-accent text-white group-hover:shadow-lg transition-all"
                    >
                      Démarrer
                      <Play className="w-4 h-4 ml-2 fill-current" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Sidebar / History */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-brand-accent" />
            Historique
          </h2>

          <Card className="bg-surface-card border-white/5 h-[calc(100vh-20rem)] overflow-y-auto custom-scrollbar">
            <CardContent className="p-0">
              {attempts.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {attempts.map((attempt) => (
                    <div key={attempt.id} className="p-4 hover:bg-white/5 transition-colors group cursor-pointer">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-neutral-400 font-medium">
                          {new Date(attempt.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className={`text-xs font-bold ${
                          attempt.globalScore >= 80 ? 'text-emerald-400' :
                          attempt.globalScore >= 50 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {attempt.globalScore}%
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-brand-accent transition-colors">
                        {(attempt.scoringResult as any)?.seriesTitle || "Simulation"}
                      </h4>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 italic">
                          Score: {(attempt.scoringResult as any)?.scoreSur6}/6
                        </span>
                        <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-brand-accent transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-neutral-600">
                    <History className="w-6 h-6" />
                  </div>
                  <p className="text-neutral-500 text-sm">Aucune tentative encore effectuée.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
