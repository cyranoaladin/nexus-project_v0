"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, Timer, Brain } from "lucide-react";
import Link from "next/link";

interface AutomatismesDashboardCardProps {
  grade: string;
}

export function AutomatismesDashboardCard({ grade }: AutomatismesDashboardCardProps) {
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
            <p className="text-sm text-neutral-400 mb-6 line-clamp-2">
              Préparez-vous à la première partie de l&apos;épreuve de spécialité. Séries de 12 questions mélangeant tous les thèmes officiels.
            </p>
            <Link href="/dashboard/eleve/automatismes" className="w-full sm:w-fit">
              <Button className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 text-white font-bold px-8 shadow-lg shadow-rose-600/20">
                Lancer une série
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
