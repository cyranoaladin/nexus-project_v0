"use client";

import { CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEAMProgress } from "@/hooks/useEAMProgress";
import { MathFormula } from "./MathFormula";
import { MOCK_EXAM, type MockExamBlock } from "./mockExamData";

const MOCK_EXAM_KEY = "mock_exam_1";

function ExamBlock({ block }: { block: MockExamBlock }) {
  if (block.type === "math") {
    return (
      <div className="max-w-full overflow-x-auto rounded-lg bg-surface-darker/70 px-2 py-3 text-neutral-100">
        <MathFormula value={block.content} />
      </div>
    );
  }

  if (block.type === "code") {
    return (
      <pre className="max-w-full overflow-x-auto rounded-lg border border-white/10 bg-surface-darker/80 p-4 text-xs leading-relaxed text-neutral-100">
        <code>{block.content}</code>
      </pre>
    );
  }

  return <p className="break-words text-sm leading-relaxed text-neutral-300">{block.content}</p>;
}

export function MockExam() {
  const progress = useEAMProgress();
  const mockExamResult = progress.state.quiz[MOCK_EXAM_KEY];
  const mockExamDone = Boolean(mockExamResult?.done);
  const handlePrint = () => window.print();
  const handleComplete = () => {
    progress.saveQuizResult(MOCK_EXAM_KEY, 1, 1);
  };

  return (
    <div className="eam-mock-exam w-full min-w-0 max-w-full space-y-5 overflow-hidden">
      <Card className="min-w-0 overflow-hidden border-brand-accent/20 bg-gradient-to-br from-brand-accent/10 via-surface-card to-surface-card">
        <CardContent className="p-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-accent">Sujet d'entraînement premium</p>
              <h3 className="mt-2 break-words text-2xl font-black tracking-tight text-white sm:text-3xl">{MOCK_EXAM.title}</h3>
              <p className="mt-2 break-words text-sm font-semibold text-neutral-200">{MOCK_EXAM.subtitle}</p>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-300">
                {MOCK_EXAM.instructions}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="eam-no-print w-full border-white/15 text-white hover:bg-white/10 sm:w-auto"
              onClick={handlePrint}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
          </div>
          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-3">
            {[`Durée : ${MOCK_EXAM.duration}`, MOCK_EXAM.calculator, `Total : ${MOCK_EXAM.total}`].map((item) => (
              <div key={item} className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-semibold text-neutral-100">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 grid min-w-0 gap-2 md:grid-cols-5">
            {MOCK_EXAM.timePlan.map((step) => (
              <div key={step.label} className="min-w-0 rounded-lg border border-white/10 bg-surface-darker/60 p-3">
                <p className="text-xs font-black text-brand-accent">{step.label}</p>
                <p className="mt-1 break-words text-xs leading-relaxed text-neutral-300">{step.task}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="qcm-section min-w-0 overflow-hidden rounded-xl border border-white/10 bg-surface-card">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h4 className="break-words text-lg font-black text-white">{MOCK_EXAM.qcm.title}</h4>
              <p className="mt-1 text-sm text-neutral-400">{MOCK_EXAM.qcm.instruction}</p>
            </div>
            <span className="w-fit rounded-full border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-xs font-bold text-brand-accent">
              {MOCK_EXAM.qcm.points}
            </span>
          </div>
        </div>
        <div className="grid min-w-0 gap-3 p-4 sm:p-5 lg:grid-cols-2">
          {MOCK_EXAM.qcm.questions.map((question, index) => (
            <article key={question.id} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent text-sm font-black text-surface-darker">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="break-words text-sm font-semibold leading-relaxed text-white">{question.statement}</p>
                  {question.math && (
                    <div className="max-w-full overflow-x-auto rounded-lg bg-surface-darker/70 px-2 py-3 text-neutral-100">
                      <MathFormula value={question.math} />
                    </div>
                  )}
                  {question.code && (
                    <pre className="max-w-full overflow-x-auto rounded-lg border border-white/10 bg-surface-darker/80 p-4 text-xs leading-relaxed text-neutral-100">
                      <code>{question.code}</code>
                    </pre>
                  )}
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {question.choices.map((choice) => (
                      <div key={choice.label} className="flex min-w-0 items-start gap-2 rounded-lg border border-white/10 bg-surface-darker/50 p-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-neutral-200">
                          {choice.label}
                        </span>
                        <div className="min-w-0 flex-1 break-words text-sm text-neutral-200">
                          {choice.math ? <MathFormula value={choice.content} displayMode={false} className="inline-block py-0" /> : choice.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h4 className="print-page-break text-lg font-black text-white">Partie 2 — Exercices rédigés indépendants</h4>
            <p className="text-sm text-neutral-400">Rédiger les raisonnements, justifier les calculs et conclure dans le contexte.</p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-neutral-200">14 points</span>
        </div>

        {MOCK_EXAM.exercises.map((exercise) => (
          <Card key={exercise.id} className="min-w-0 overflow-hidden border-white/10 bg-surface-card">
            <CardHeader className="border-b border-white/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="break-words text-white">{exercise.title}</CardTitle>
                <span className="w-fit rounded-full border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-xs font-bold text-brand-accent">
                  {exercise.points}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {exercise.intro && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  {exercise.intro.map((block, index) => (
                    <ExamBlock key={`${exercise.id}-intro-${index}`} block={block} />
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {exercise.questions.map((question) => (
                  <article key={question.id} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                      <div className="flex items-start justify-between gap-3 sm:block">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/10 px-2 text-sm font-black text-white">
                          {question.label}
                        </span>
                        {question.points && (
                          <span className="rounded-full border border-white/10 bg-surface-darker/60 px-2 py-1 text-[11px] font-semibold text-neutral-300 sm:mt-2 sm:block">
                            {question.points}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        {question.content.map((block, index) => (
                          <ExamBlock key={`${question.id}-${index}`} block={block} />
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="eam-no-print min-w-0 overflow-hidden border-emerald-400/20 bg-emerald-500/10">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-100">Suivi de progression</p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-50/80">
              Une fois le sujet blanc réalisé en conditions réelles, marquez-le comme fait pour l’afficher dans votre cockpit.
            </p>
          </div>
          {mockExamDone ? (
            <div className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 text-sm font-bold text-emerald-200">
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Sujet blanc complété
            </div>
          ) : (
            <Button
              type="button"
              className="min-h-11 shrink-0 bg-emerald-400 text-surface-darker hover:bg-emerald-300"
              onClick={handleComplete}
            >
              Marquer comme fait
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
