"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Download, FileText, Gauge, Import, Play, Printer, RotateCcw, Timer } from "lucide-react";
import { BlockMath, InlineMath } from "react-katex";
import { AUTOMATISMS } from "@/content/stage-eam-stmg/automatismes";
import { computeDiagnosticProfile, labelOf } from "@/content/stage-eam-stmg/core";
import { DIAGNOSTIC_EXERCISES, DIAGNOSTIC_QCM } from "@/content/stage-eam-stmg/diagnostic";
import { COURSE_SHEETS, DOMAINS } from "@/content/stage-eam-stmg/domains";
import { TRAINING_EXERCISES } from "@/content/stage-eam-stmg/exercices";
import type { DiagnosticAnswers, DomainId, ExerciseEvaluation } from "@/content/stage-eam-stmg/types";
import { useStageProgress } from "@/hooks/stage-eam-stmg/useStageProgress";
import { MathToken } from "./MathToken";
import { ProfileRadar } from "./ProfileRadar";

const examDate = new Date("2026-06-08T08:00:00+01:00");
const evalLabels: Record<ExerciseEvaluation, string> = { acquired: "Acquis", partial: "Partiel", not_acquired: "Non acquis" };

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-card border border-neutral-700 bg-surface-card p-4 shadow-sm sm:p-5 ${className}`}>{children}</section>;
}

function TokenButton({ children, onClick, href }: { children: React.ReactNode; onClick?: () => void; href?: string }) {
  const className = "inline-flex items-center justify-center gap-2 rounded-card-sm border border-neutral-600 bg-surface-elevated px-3 py-2 text-sm font-semibold text-neutral-100 transition hover:border-brand-accent hover:text-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent";
  if (href) return <Link className={className} href={href}>{children}</Link>;
  return <button type="button" onClick={onClick} className={className}>{children}</button>;
}

function RichMath({ content, inline = false }: { content: string; inline?: boolean }) {
  const parts = content.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$|`[^`]+?`)/g).filter(Boolean);
  const rendered = parts.map((part, index) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      return <BlockMath key={index} math={part.slice(2, -2)} />;
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      return <InlineMath key={index} math={part.slice(1, -1)} />;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-surface-darker px-1.5 py-0.5 font-mono text-[0.9em] text-brand-accent">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
  return inline ? <span className="max-w-full overflow-x-auto">{rendered}</span> : <div className="max-w-full overflow-x-auto leading-relaxed">{rendered}</div>;
}

function Countdown({ enabled }: { enabled: boolean }) {
  const [now] = useState(() => new Date());
  if (!enabled) return <p className="text-sm text-neutral-400">Compte à rebours désactivé.</p>;
  const days = Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / 86_400_000));
  return <p className="text-3xl font-black text-brand-accent">{days} jours</p>;
}

function HydrationShell() {
  return <main className="min-h-screen bg-surface-darker text-neutral-100"><div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-400">Chargement du parcours EAM STMG…</div></main>;
}

export function StageEamStmgDashboard({ eleveId }: { eleveId: string }) {
  const progress = useStageProgress(eleveId);
  const [selectedDomain, setSelectedDomain] = useState<DomainId>("fonctions");
  const [simPart1, setSimPart1] = useState(4);
  const [simPart2, setSimPart2] = useState(9);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [runIndex, setRunIndex] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runAnswers, setRunAnswers] = useState<Array<{ correct: boolean; seconds: number }>>([]);
  const [runChoice, setRunChoice] = useState<number | null>(null);
  const [revealedCorrections, setRevealedCorrections] = useState<Record<string, boolean>>({});
  const [examSeconds, setExamSeconds] = useState(2 * 60 * 60);
  const [examTimerRunning, setExamTimerRunning] = useState(false);

  const scoreMap = Object.fromEntries(progress.state.profile.domainScores.map((entry) => [entry.domainId, entry.score])) as Record<DomainId, number>;
  const selectedItems = AUTOMATISMS.filter((item) => item.domainId === selectedDomain);
  const selectedDomainData = DOMAINS.find((domain) => domain.id === selectedDomain) ?? DOMAINS[0];
  const note = Math.min(20, Math.max(0, Number(simPart1) + Number(simPart2)));
  const currentRunItem = selectedItems[runIndex] ?? selectedItems[0];

  useEffect(() => {
    if (!examTimerRunning || examSeconds <= 0) return;
    const id = window.setInterval(() => setExamSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [examTimerRunning, examSeconds]);

  if (!progress.hydrated) return <HydrationShell />;

  const answerRunItem = (choiceIndex: number) => {
    if (!currentRunItem || runStartedAt === null) return;
    const seconds = Math.max(1, Math.round((Date.now() - runStartedAt) / 1000));
    const nextAnswers = [...runAnswers, { correct: choiceIndex === currentRunItem.answerIndex, seconds }];
    setRunAnswers(nextAnswers);
    setRunChoice(choiceIndex);
    if (runIndex + 1 >= selectedItems.length) {
      const score = nextAnswers.filter((answer) => answer.correct).length;
      const averageSeconds = Math.round(nextAnswers.reduce((sum, answer) => sum + answer.seconds, 0) / nextAnswers.length);
      progress.addAutomatismRun({ domainId: selectedDomain, score, total: selectedItems.length, averageSeconds });
    }
  };

  const nextRunItem = () => {
    setRunChoice(null);
    setRunStartedAt(Date.now());
    setRunIndex((index) => Math.min(index + 1, selectedItems.length - 1));
  };

  const startRun = () => {
    setRunIndex(0);
    setRunAnswers([]);
    setRunChoice(null);
    setRunStartedAt(Date.now());
  };

  return (
    <main className="min-h-screen bg-surface-darker text-neutral-100">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-card border border-brand-accent/40 bg-surface-card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Image src="/images/logo_slogan_nexus_x3.png" alt="Nexus Réussite" width={210} height={72} className="h-auto w-44" priority />
              <h1 className="mt-4 text-3xl font-black tracking-tight text-neutral-50">Stage Commando — Épreuve Anticipée de Mathématiques</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">Élève : Première STMG. Parcours individualisé du samedi 30/05 au lundi 08/06/2026, sans calculatrice.</p>
            </div>
            <div className="rounded-card-sm border border-neutral-700 bg-surface-elevated p-4 text-right">
              <p className="text-xs uppercase text-neutral-400">Épreuve AEFE Tunisie</p>
              <Countdown enabled={progress.state.settings.countdownEnabled} />
              <p className="mt-1 text-xs text-neutral-400">lundi 08/06/2026</p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-5" aria-label="Rappel d’épreuve">
          {["2 h", "coef 2", "note /20", "6 pts automatismes", "14 pts exercices"].map((item) => <div key={item} className="rounded-card-sm border border-neutral-700 bg-surface-card p-3 text-center text-sm font-bold">{item}</div>)}
          <div className="rounded-card-sm border border-brand-accent bg-brand-accent px-3 py-4 text-center text-sm font-black text-surface-darker md:col-span-5"><AlertTriangle className="mr-2 inline h-4 w-4" /> Sans calculatrice</div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Profil diagnostic</h2>
              <span className="text-xs text-neutral-400">{new Date(progress.state.profile.diagnosticDate).toLocaleDateString("fr-FR")}</span>
            </div>
            <ProfileRadar scores={progress.state.profile.domainScores} />
            <div className="space-y-2">
              {progress.state.profile.priorities.map((id, index) => (
                <div key={id} className="flex items-center justify-between rounded-card-sm bg-surface-elevated p-3">
                  <span className="text-sm"><strong>Priorité {index + 1}</strong> — {labelOf(id)}</span>
                  <span className="font-bold text-brand-accent">{scoreMap[id] ?? 0}/100</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-xl font-black">Progression par domaine</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {DOMAINS.map((domain) => {
                const checked = progress.state.validatedNotions[domain.id]?.length ?? 0;
                const pct = Math.round((checked / domain.notions.length) * 100);
                return (
                  <button key={domain.id} type="button" onClick={() => setSelectedDomain(domain.id)} className="rounded-card-sm border border-neutral-700 bg-surface-elevated p-3 text-left transition hover:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{domain.label}</span>
                      <span className="text-sm text-brand-accent">{pct}%</span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400">{checked}/{domain.notions.length} notions validées</p>
                    <div className="mt-3 h-2 rounded-full bg-surface-darker"><div className="h-2 rounded-full bg-brand-accent" style={{ width: `${pct}%` }} /></div>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <Panel>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><CalendarDays className="h-5 w-5 text-brand-accent" />Planning J0 {"->"} J8</h2>
          <div className="grid gap-3 lg:grid-cols-4">
            {progress.planning.map((day) => (
              <article key={day.id} className="rounded-card-sm border border-neutral-700 bg-surface-elevated p-3">
                <p className="text-xs font-bold uppercase text-brand-accent">{day.label} - {day.date}</p>
                <h3 className="mt-2 font-bold">{day.objective}</h3>
                <p className="mt-2 text-xs text-neutral-300">Domaines : {day.domainIds.length ? day.domainIds.map(labelOf).join(", ") : "transversal"}</p>
                <p className="mt-2 text-xs text-neutral-400">Automatismes : {day.automatismes}</p>
                <p className="mt-1 text-xs text-neutral-400">Inter-séance : {day.homework}</p>
              </article>
            ))}
          </div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><Timer className="h-5 w-5 text-brand-accent" />Entraîneur d’automatismes</h2>
            <select value={selectedDomain} onChange={(event) => setSelectedDomain(event.target.value as DomainId)} className="w-full rounded-card-sm border border-neutral-700 bg-surface-elevated p-2 text-neutral-100">
              {DOMAINS.map((domain) => <option key={domain.id} value={domain.id}>{domain.label}</option>)}
            </select>
            <div className="mt-3 rounded-card-sm border border-neutral-700 bg-surface-elevated p-4">
              {runStartedAt === null ? (
                <TokenButton onClick={startRun}><Play className="h-4 w-4" />Démarrer une série de {selectedItems.length} items</TokenButton>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase text-brand-accent">Item {runIndex + 1}/{selectedItems.length} · sans calculatrice</p>
                  <div className="text-sm font-semibold"><RichMath content={currentRunItem.question} /></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {currentRunItem.choices.map((choice, choiceIndex) => (
                      <button key={choice} type="button" disabled={runChoice !== null} onClick={() => answerRunItem(choiceIndex)} className="rounded-card-sm border border-neutral-700 bg-surface-darker p-3 text-left text-sm transition hover:border-brand-accent disabled:cursor-default">
                        <RichMath content={choice} inline />
                      </button>
                    ))}
                  </div>
                  {runChoice !== null && (
                    <div className="rounded-card-sm border border-neutral-700 bg-surface-darker p-3 text-sm">
                      <p className="font-bold text-brand-accent">{runChoice === currentRunItem.answerIndex ? "Correct." : "À reprendre."}</p>
                      <RichMath content={currentRunItem.correction} />
                      {runIndex + 1 < selectedItems.length ? <TokenButton onClick={nextRunItem}>Item suivant</TokenButton> : <p className="mt-2 text-neutral-300">Série enregistrée dans l’historique.</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3 space-y-1 text-xs text-neutral-400">
              {progress.state.automatismHistory.slice(0, 4).map((run) => <p key={run.id}>{new Date(run.date).toLocaleDateString("fr-FR")} · {labelOf(run.domainId)} · {run.score}/{run.total} · {run.averageSeconds}s/item</p>)}
              {progress.state.automatismHistory.length === 0 && <p>Aucune série enregistrée pour le moment.</p>}
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><Gauge className="h-5 w-5 text-brand-accent" />Simulateur de note</h2>
            <label className="block text-sm">Partie 1 /6<input type="number" min={0} max={6} value={simPart1} onChange={(e) => setSimPart1(Number(e.target.value))} className="mt-1 w-full rounded-card-sm border border-neutral-700 bg-surface-elevated p-2" /></label>
            <label className="mt-3 block text-sm">Partie 2 /14<input type="number" min={0} max={14} value={simPart2} onChange={(e) => setSimPart2(Number(e.target.value))} className="mt-1 w-full rounded-card-sm border border-neutral-700 bg-surface-elevated p-2" /></label>
            <p className="mt-4 text-3xl font-black text-brand-accent">{note}/20</p>
            <p className="text-sm text-neutral-400">Projection indicative, sans jugement. Elle sert à repérer où placer l’effort.</p>
          </Panel>
        </div>

        <Panel>
          <h2 className="mb-3 text-xl font-black">Ressources ciblées — {selectedDomainData.label}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="font-bold">Formules</h3>
              {selectedDomainData.formulas.map((formula) => <p key={formula.label} className="mt-2 text-sm">{formula.label} : <MathToken latex={formula.latex} /></p>)}
            </div>
            <div>
              <h3 className="font-bold">Notions</h3>
              {selectedDomainData.notions.map((notion) => (
                <label key={notion} className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={(progress.state.validatedNotions[selectedDomain] ?? []).includes(notion)} onChange={() => progress.toggleNotion(selectedDomain, notion)} />
                  {notion}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {TRAINING_EXERCISES.filter((exercise) => exercise.domainId === selectedDomain).map((exercise) => (
              <article key={exercise.id} className="rounded-card-sm border border-neutral-700 bg-surface-elevated p-4">
                <h3 className="font-bold">{exercise.title}</h3>
                {exercise.statement.map((line) => <RichMath key={line} content={line} />)}
                <ul className="mt-3 list-inside list-disc text-sm text-neutral-300">{exercise.questions.map((question) => <li key={question}><RichMath content={question} inline /></li>)}</ul>
                <TokenButton onClick={() => setRevealedCorrections((current) => ({ ...current, [exercise.id]: !current[exercise.id] }))}>
                  {revealedCorrections[exercise.id] ? "Masquer la correction" : "Afficher la correction"}
                </TokenButton>
                {revealedCorrections[exercise.id] && (
                  <div className="mt-3 space-y-3 rounded-card-sm bg-surface-darker p-3">
                    {exercise.correction.map((block) => <div key={block.title}><h4 className="font-bold text-brand-accent">{block.title}</h4>{block.details.map((detail) => <RichMath key={detail} content={detail} />)}</div>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-3 text-xl font-black">Sujet en conditions</h2>
          <p className="text-sm text-neutral-300">Minuteur 2 h, sans calculatrice. Utiliser cette section en J4/J5 pour simuler l’épreuve complète.</p>
          <div className="mt-3 rounded-card-sm border border-brand-accent/30 bg-surface-elevated p-4 text-center">
            <p className="text-3xl font-black text-brand-accent">{new Date(examSeconds * 1000).toISOString().slice(11, 19)}</p>
            <p className="text-xs text-neutral-400">Minuteur de référence à lancer au début du sujet.</p>
            <div className="mt-3 flex justify-center gap-2">
              <TokenButton onClick={() => setExamTimerRunning((value) => !value)}>{examTimerRunning ? "Mettre en pause" : "Lancer le minuteur"}</TokenButton>
              <TokenButton onClick={() => { setExamTimerRunning(false); setExamSeconds(2 * 60 * 60); }}>Réinitialiser</TokenButton>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {/* SOURCE: Drive EAM_entraienemnt + sujets zéro Éduscol voie technologique. */}
            <TokenButton href="https://drive.google.com/file/d/1lgWeP15vi4FSTW9HEBCpXT1F9pv6un4r/view">Sujet d’entraînement Nexus</TokenButton>
            <TokenButton href="https://drive.google.com/file/d/1aNFBm3Llhk79Y0ZZdWUBkO0nbSW7GNbD/view">Corrigé Nexus</TokenButton>
            <TokenButton href="https://eduscol.education.fr/4230/epreuve-anticipee-de-mathematiques-aux-baccalaureats-general-et-technologique">Sujets zéro Éduscol</TokenButton>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-3 text-xl font-black">Accès livret & contrôles</h2>
          <div className="flex flex-wrap gap-2">
            <TokenButton href="/dashboard/eleve/stage-eam-stmg/livret"><FileText className="h-4 w-4" />Livret imprimable</TokenButton>
            <TokenButton href="/dashboard/eleve/stage-eam-stmg/diagnostic"><CheckCircle2 className="h-4 w-4" />Diagnostic J0</TokenButton>
            <TokenButton onClick={() => {
              const data = progress.exportJson();
              if (navigator.clipboard) navigator.clipboard.writeText(data);
              else setImportText(data);
              setImportStatus("Export JSON prêt.");
            }}><Download className="h-4 w-4" />Exporter JSON</TokenButton>
            <TokenButton onClick={() => progress.reset()}><RotateCcw className="h-4 w-4" />Réinitialiser</TokenButton>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={progress.state.settings.countdownEnabled} onChange={(e) => progress.setSetting("countdownEnabled", e.target.checked)} />Compte à rebours activé</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={progress.state.settings.gamificationEnabled} onChange={(e) => progress.setSetting("gamificationEnabled", e.target.checked)} />Gamification activée</label>
          </div>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Coller un export JSON ici" className="mt-4 min-h-24 w-full rounded-card-sm border border-neutral-700 bg-surface-elevated p-3 text-sm" />
          <TokenButton onClick={() => {
            try {
              JSON.parse(importText);
              progress.importJson(importText);
              setImportStatus("Import effectué.");
            } catch {
              setImportStatus("Import impossible : JSON invalide.");
            }
          }}><Import className="h-4 w-4" />Importer</TokenButton>
          {importStatus && <p className="mt-2 text-sm text-neutral-300" role="status">{importStatus}</p>}
        </Panel>
      </div>
    </main>
  );
}

export function StageEamStmgDiagnostic({ eleveId }: { eleveId: string }) {
  const progress = useStageProgress(eleveId);
  const [answers, setAnswers] = useState<DiagnosticAnswers>(progress.state.diagnosticAnswers);
  const profile = useMemo(() => computeDiagnosticProfile(answers), [answers]);

  useEffect(() => {
    if (progress.hydrated) setAnswers(progress.state.diagnosticAnswers);
  }, [progress.hydrated, progress.state.diagnosticAnswers]);

  if (!progress.hydrated) return <HydrationShell />;

  return (
    <main className="min-h-screen bg-surface-darker text-neutral-100">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <header className="rounded-card border border-brand-accent/40 bg-surface-card p-5">
          <p className="text-sm font-bold uppercase text-brand-accent">Nexus Réussite — J0</p>
          <h1 className="mt-2 text-3xl font-black">Diagnostic et profilage EAM STMG</h1>
          <p className="mt-2 text-sm text-neutral-300">Environ 75 à 90 minutes, sans calculatrice. QCM corrigés automatiquement, exercices auto-évalués.</p>
        </header>
        <Panel>
          <h2 className="mb-3 text-xl font-black">Automatismes</h2>
          <div className="space-y-4">
            {DIAGNOSTIC_QCM.map((item, index) => (
              <fieldset key={item.id} className="rounded-card-sm border border-neutral-700 bg-surface-elevated p-3">
                <legend className="text-sm font-bold">{index + 1}. <RichMath content={item.question} inline /></legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {item.choices.map((choice, choiceIndex) => (
                    <label key={choice} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={item.id} checked={answers.qcm[item.id] === choiceIndex} onChange={() => setAnswers((current) => ({ ...current, qcm: { ...current.qcm, [item.id]: choiceIndex } }))} />
                      <RichMath content={choice} inline />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-xl font-black">Exercices courts</h2>
          {DIAGNOSTIC_EXERCISES.map((exercise) => (
            <fieldset key={exercise.id} className="mb-3 rounded-card-sm border border-neutral-700 bg-surface-elevated p-3">
              <legend className="font-bold">{exercise.title}</legend>
              <div className="mt-2 text-sm text-neutral-300">{exercise.statement.map((line) => <RichMath key={line} content={line} />)}</div>
              <div className="mt-3 flex flex-wrap gap-3">
                {(Object.keys(evalLabels) as ExerciseEvaluation[]).map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={exercise.id} checked={answers.exercises[exercise.id] === value} onChange={() => setAnswers((current) => ({ ...current, exercises: { ...current.exercises, [exercise.id]: value } }))} />
                    {evalLabels[value]}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <TokenButton onClick={() => progress.saveDiagnostic(answers, profile)}><CheckCircle2 className="h-4 w-4" />Enregistrer le profil</TokenButton>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-xl font-black">Sortie diagnostic</h2>
          <ProfileRadar scores={profile.domainScores} />
          <TokenButton href="/dashboard/eleve/stage-eam-stmg">Retour dashboard</TokenButton>
        </Panel>
      </div>
    </main>
  );
}

export function StageEamStmgLivret({ eleveId }: { eleveId: string }) {
  const progress = useStageProgress(eleveId);
  if (!progress.hydrated) return <main className="min-h-screen bg-neutral-50 p-8 text-neutral-700">Chargement du livret…</main>;
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 print:bg-neutral-50">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <header className="border-b border-neutral-300 pb-4">
          <Image src="/images/logo_slogan_nexus_x3.png" alt="Nexus Réussite" width={220} height={76} className="mb-4 h-auto w-44" />
          <h1 className="text-3xl font-black">Livret sur mesure — Stage Commando EAM STMG</h1>
          <p className="text-sm">Élève de Première STMG — Épreuve du lundi 08/06/2026 — sans calculatrice</p>
          <button type="button" onClick={() => window.print()} className="mt-4 inline-flex items-center gap-2 rounded-card-sm border border-neutral-600 px-3 py-2 text-sm print:hidden"><Printer className="h-4 w-4" />Imprimer / enregistrer en PDF</button>
        </header>
        <section className="break-inside-avoid">
          <h2 className="text-xl font-black">Profil et priorités</h2>
          <ul className="mt-2 list-inside list-disc text-sm">{progress.state.profile.priorities.map((id) => <li key={id}>{labelOf(id)}</li>)}</ul>
        </section>
        <section>
          <h2 className="text-xl font-black">Planning J0 {"->"} Jour J</h2>
          <div className="mt-3 space-y-3">{progress.planning.map((day) => <div key={day.id} className="break-inside-avoid border border-neutral-300 p-3"><strong>{day.label} - {day.date}</strong><p>{day.objective}</p><p className="text-sm">{day.homework}</p></div>)}</div>
        </section>
        <section>
          <h2 className="text-xl font-black">Fiches prioritaires</h2>
          {progress.state.profile.priorities.slice(0, 3).map((id) => {
            const sheet = COURSE_SHEETS.find((item) => item.domainId === id);
            return <article key={id} className="break-before-page"><h3 className="text-lg font-bold">{sheet?.title}</h3>{sheet?.blocks.map((block) => <div key={block.title}><h4 className="mt-3 font-bold">{block.title}</h4><ul className="list-inside list-disc text-sm">{block.lines.map((line) => <li key={line}>{line}</li>)}</ul></div>)}</article>;
          })}
        </section>
        <section className="break-before-page">
          <h2 className="text-xl font-black">Stratégie jour J</h2>
          <ul className="list-inside list-disc text-sm">
            <li>Lire tout le sujet puis traiter les automatismes en premier, sans calculatrice.</li>
            <li>Ne pas rester bloqué : marquer la question, passer, revenir en fin d’épreuve.</li>
            <li>Poser les calculs de pourcentages avec coefficients multiplicateurs.</li>
            <li>Garder 10 minutes de relecture : unités, signes, arrondis et phrases de conclusion.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
