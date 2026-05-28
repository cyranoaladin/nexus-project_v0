"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EAMModule } from "./types";

interface QuizProps {
  module: EAMModule;
  saved?: { score: number; total: number; done: boolean };
  onSave: (score: number, total: number) => void;
}

export function Quiz({ module, saved, onSave }: QuizProps) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const question = module.questions[index];

  const choose = (answerIndex: number) => {
    if (selected !== null) return;
    setSelected(answerIndex);
    if (answerIndex === question.c) setScore((current) => current + 1);
  };

  const next = () => {
    if (index + 1 >= module.questions.length) {
      setDone(true);
      onSave(score, module.questions.length);
      return;
    }
    setIndex((current) => current + 1);
    setSelected(null);
  };

  const restart = () => {
    setStarted(true);
    setDone(false);
    setIndex(0);
    setScore(0);
    setSelected(null);
  };

  if (!started && !done) {
    return (
      <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-neutral-400">Quiz corrigé - {module.questions.length} questions</p>
        {saved?.done && <p className="mt-2 text-sm font-semibold text-emerald-200">Dernier score : {saved.score}/{saved.total}</p>}
        <Button className="mt-4 bg-brand-accent text-surface-darker hover:bg-brand-accent/90" onClick={() => setStarted(true)} data-testid="eam-start-quiz">
          Démarrer le quiz
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-w-0 overflow-hidden rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-6 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-200" />
        <p className="mt-3 text-2xl font-black text-white">{score}/{module.questions.length}</p>
        <p className="text-sm text-neutral-300">Résultat sauvegardé.</p>
        <Button variant="outline" className="mt-4 border-white/15 text-white hover:bg-white/10" onClick={restart}>
          Refaire le quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>Question {index + 1}/{module.questions.length}</span>
        <span>Score : {score}</span>
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4" style={{ borderLeftColor: module.color, borderLeftWidth: 3 }}>
        <p className="break-words font-semibold leading-relaxed text-white">{question.q}</p>
      </div>
      <div className="grid gap-2">
        {question.r.map((answer, answerIndex) => {
          const isCorrect = selected !== null && answerIndex === question.c;
          const isWrong = selected === answerIndex && answerIndex !== question.c;
          return (
            <button
              key={answer}
              type="button"
              disabled={selected !== null}
              onClick={() => choose(answerIndex)}
              data-testid={`eam-answer-${answerIndex}`}
              className={`flex min-w-0 items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition ${
                isCorrect
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                  : isWrong
                    ? "border-rose-400/60 bg-rose-500/10 text-rose-100"
                    : "border-white/10 bg-white/5 text-neutral-100 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <span className="min-w-0 break-words"><strong>{String.fromCharCode(65 + answerIndex)}.</strong> {answer}</span>
              {isCorrect && <CheckCircle2 className="h-4 w-4" />}
              {isWrong && <XCircle className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-surface-elevated p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-accent">Correction</p>
          <p className="mt-2 break-words text-sm leading-relaxed text-neutral-200">{question.ex}</p>
          <Button className="mt-4 bg-brand-accent text-surface-darker hover:bg-brand-accent/90" onClick={next} data-testid="eam-next-question">
            {index + 1 >= module.questions.length ? "Terminer" : "Question suivante"}
          </Button>
        </div>
      )}
    </div>
  );
}
