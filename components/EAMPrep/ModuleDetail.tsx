"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, BookOpen, CheckSquare, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EAMModule } from "./types";
import { Checklist } from "./Checklist";
import { MathFormula } from "./MathFormula";
import { Quiz } from "./Quiz";

interface ModuleDetailProps {
  module: EAMModule;
  checks: Record<string, boolean>;
  quiz?: { score: number; total: number; done: boolean };
  onBack: () => void;
  onToggleCheck: (key: string) => void;
  onSaveQuiz: (score: number, total: number) => void;
}

type DetailTab = "formules" | "methodes" | "quiz" | "checklist";

export function ModuleDetail({ module, checks, quiz, onBack, onToggleCheck, onSaveQuiz }: ModuleDetailProps) {
  const [tab, setTab] = useState<DetailTab>("formules");
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "formules", label: "Formules" },
    { id: "methodes", label: "Méthodes" },
    { id: "quiz", label: "Quiz" },
    { id: "checklist", label: "Checklist" },
  ];

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="text-neutral-300 hover:text-white" onClick={onBack} aria-label="Retour aux modules">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-9 w-1 rounded-full" style={{ backgroundColor: module.color }} />
          <div className="min-w-0">
            <h3 className="break-words text-xl font-black text-white">{module.title}</h3>
            <p className="break-words text-sm text-neutral-400">{module.subtitle}</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: module.color }}>
          {module.tag}
        </span>
      </div>

      <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-w-24 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === item.id ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "formules" && (
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {module.formules.map((formula) => (
            <div key={formula.title} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4" style={{ borderLeftColor: module.color, borderLeftWidth: 3 }}>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: module.color }}>
                <BookOpen className="h-3.5 w-3.5" />
                {formula.title}
              </p>
              <div className="mt-3 max-w-full overflow-x-auto rounded-lg bg-surface-darker/80 px-2 py-4 text-neutral-100">
                <MathFormula value={formula.content} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "methodes" && (
        <div className="space-y-3">
          {module.methodes.map((method, index) => (
            <div key={method} className="flex min-w-0 gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-surface-darker" style={{ backgroundColor: module.color }}>{index + 1}</span>
              <p className="min-w-0 break-words text-sm leading-relaxed text-neutral-100">{method}</p>
            </div>
          ))}
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-rose-200"><AlertTriangle className="h-4 w-4" /> Radar à pièges</p>
            <ul className="mt-3 space-y-2">
              {module.errors.map((error) => <li key={error} className="border-l-2 border-rose-300/30 pl-3 text-sm text-rose-100">{error}</li>)}
            </ul>
          </div>
        </div>
      )}

      {tab === "quiz" && <Quiz module={module} saved={quiz} onSave={onSaveQuiz} />}

      {tab === "checklist" && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm text-neutral-400">
            <CheckSquare className="h-4 w-4" />
            Coche uniquement les points que tu sais refaire sans calculatrice.
          </p>
          <Checklist module={module} checks={checks} onToggle={onToggleCheck} />
        </div>
      )}

      {tab !== "checklist" && (
        <Button variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={() => setTab("checklist")}>
          <ListChecks className="mr-2 h-4 w-4" />
          Valider ma checklist
        </Button>
      )}
    </div>
  );
}
