"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, Timer, Brain, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { EleveAutomatismesProgress } from "@/components/dashboard/eleve/types";

interface AutomatismesDashboardCardProps {
  grade: string;
  /** Progress from dashboard payload — null until first exercise session */
  automatismes?: EleveAutomatismesProgress | null;
}

export function AutomatismesDashboardCard({ grade, automatismes }: AutomatismesDashboardCardProps) {
  if (grade !== "PREMIERE") return null;

  return (
    <Card className="bg-gradient-to-br from-rose-500/10 via-brand-accent/5 to-surface-card border border-rose-500/20 shadow-lg overflow-hidden group mb-6">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row items-stretch">
          <div className="md:w-1/3 bg-rose-500/10 p-6 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-rose-500/20">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-8 h-8 text-rose-300" />
            </div>
            <h3 className="font-bold text-white tracking-tight">Automatismes</h3>
            <p className="text-[10px] uppercase tracking-widest text-rose-300/70 font-bold mt-1">Épreuve Anticipée</p>
          </div>
          <div className="flex-1 p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-rose-400 animate-pulse" />
              <span className="text-xs font-semibold text-rose-200">Simulation Réelle — 12 Questions</span>
            </div>
            <h4 className="text-lg font-bold text-white mb-2">
              Entraînement aux Automatismes
            </h4>

            {automatismes ? (
              /* Progress stats — shown after first session */
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="flex flex-col items-center gap-1 rounded-lg bg-white/5 py-2 px-1">
                  <Target className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                  <span className="text-lg font-semibold text-white">{automatismes.accuracy}%</span>
                  <span className="text-[10px] text-neutral-500">Réussite</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-white/5 py-2 px-1">
                  <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span className="text-lg font-semibold text-white">{automatismes.bestStreak}</span>
                  <span className="text-[10px] text-neutral-500">Meilleure série</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-white/5 py-2 px-1">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="text-lg font-semibold text-white">{automatismes.totalAttempted}</span>
                  <span className="text-[10px] text-neutral-500">Tentatives</span>
                </div>
              </div>
            ) : (
              /* First session CTA — shown before any activity */
              <div className="flex items-center gap-4 mb-4 text-neutral-400 text-sm">
                <div className="flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-rose-400/70" />
                  <span>8-12 min</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-rose-400/70" />
                  <span>Sans calculatrice</span>
                </div>
              </div>
            )}

            {!automatismes && (
              <p className="text-sm text-neutral-400 mb-6 line-clamp-2">
                Préparez-vous à la première partie de l&apos;épreuve de spécialité. Séries de 12 questions mélangeant tous les thèmes officiels.
              </p>
            )}

            <Link href="/dashboard/eleve/automatismes" className="w-full sm:w-fit">
              <Button className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 text-white font-bold px-8 shadow-lg shadow-rose-600/20">
                {automatismes ? 'Continuer l\'entraînement' : 'Lancer une série'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
