"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EAMModule } from "./types";

interface ModuleGridProps {
  modules: EAMModule[];
  getModuleProgress: (modId: string) => { checked: number; total: number; pct: number };
  quiz: Record<string, { score: number; total: number; done: boolean }>;
  onOpen: (moduleId: string) => void;
  onReset: (moduleId: string) => void;
}

export function ModuleGrid({ modules, getModuleProgress, quiz, onOpen, onReset }: ModuleGridProps) {
  return (
    <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => {
        const progress = getModuleProgress(module.id);
        const quizResult = quiz[module.id];
        return (
          <Card key={module.id} className="min-w-0 overflow-hidden border-white/10 bg-surface-card">
            <CardContent className="min-w-0 p-5">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <button type="button" onClick={() => onOpen(module.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-xl" style={{ color: module.color }}>
                      {module.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: module.color }}>
                        {module.tag}
                      </p>
                      <h3 className="break-words text-base font-bold text-white">{module.title}</h3>
                      <p className="break-words text-xs text-neutral-400">{module.subtitle}</p>
                    </div>
                  </div>
                </button>
                <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white" onClick={() => onReset(module.id)} aria-label={`Réinitialiser ${module.title}`}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{progress.checked}/{progress.total} objectifs</span>
                  <span>{progress.pct}%</span>
                </div>
                <Progress value={progress.pct} />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                <span className="text-neutral-300">Quiz module</span>
                {quizResult?.done ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {quizResult.score}/{quizResult.total}
                  </span>
                ) : (
                  <span className="text-neutral-500">À faire</span>
                )}
              </div>
              <Button
                type="button"
                className="mt-4 w-full bg-brand-accent text-surface-darker hover:bg-brand-accent/90"
                onClick={() => onOpen(module.id)}
                data-testid={`eam-open-module-${module.id}`}
              >
                {quizResult?.done ? "Reprendre" : progress.checked > 0 ? "Réviser" : "Faire le quiz"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
