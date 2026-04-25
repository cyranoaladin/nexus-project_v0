"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AutomatismesList } from "@/components/automatismes/AutomatismesList";
import { AutomatismesPlayer } from "@/components/automatismes/AutomatismesPlayer";
import { AutomatismesResults } from "@/components/automatismes/AutomatismesResults";
import { AutomatismeAttemptResult, AutomatismeSeries } from "@/types/automatismes";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap, Sparkles } from "lucide-react";

type View = "list" | "playing" | "result";

export default function AutomatismesPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AutomatismeAttemptResult | null>(null);
  const [lastSeries, setLastSeries] = useState<AutomatismeSeries | null>(null);

  const handleSelectSeries = (id: string) => {
    setSelectedSeriesId(id);
    setView("playing");
  };

  const handleComplete = (result: AutomatismeAttemptResult, series: AutomatismeSeries) => {
    setLastResult(result);
    setLastSeries(series);
    setView("result");
  };

  const handleCancel = () => {
    setSelectedSeriesId(null);
    setView("list");
  };

  const handleRestart = () => {
    setLastResult(null);
    setView("list");
  };

  const handleGoHome = () => {
    router.push("/dashboard/eleve");
  };

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation / Breadcrumb */}
        {view === "list" && (
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleGoHome}
                className="rounded-full hover:bg-white/5"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-400" />
              </Button>
              <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                  <Zap className="w-8 h-8 text-brand-accent fill-brand-accent" />
                  Automatismes
                </h1>
                <p className="text-neutral-400 text-sm">
                  Préparez l&apos;épreuve anticipée de mathématiques
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-brand-accent/10 px-4 py-2 rounded-full border border-brand-accent/20">
              <Sparkles className="w-4 h-4 text-brand-accent" />
              <span className="text-xs font-bold text-brand-accent uppercase tracking-widest">
                Objectif Bac 2026
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Views */}
        {view === "list" && (
          <AutomatismesList onSelectSeries={handleSelectSeries} />
        )}

        {view === "playing" && selectedSeriesId && (
          <div className="pt-4">
             <AutomatismesPlayer 
              seriesId={selectedSeriesId} 
              onComplete={handleComplete} 
              onCancel={handleCancel} 
            />
          </div>
        )}

        {view === "result" && lastResult && lastSeries && (
          <AutomatismesResults 
            result={lastResult} 
            series={lastSeries}
            onRestart={handleRestart} 
            onGoHome={handleGoHome} 
          />
        )}
      </div>
    </div>
  );
}
