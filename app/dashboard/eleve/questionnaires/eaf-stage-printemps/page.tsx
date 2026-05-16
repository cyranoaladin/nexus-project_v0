"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  PenLine,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  "Profil",
  "Avant le stage",
  "Méthode de l’épreuve",
  "Commentaire",
  "Dissertation",
  "Expression écrite",
  "Supports et accompagnement",
  "Bilan final",
];

const scaleLabels = ["1", "2", "3", "4", "5"];
const stressLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

type FieldValue = string | string[];
type Answers = Record<string, FieldValue>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function HeaderBadge({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 shadow-sm">
      <Icon className="h-4 w-4" />
      {children}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
      <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
      <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">{description}</p>
    </div>
  );
}

function TextInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-100">
        {label} {required && <span className="text-amber-300">*</span>}
      </span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300 focus:bg-slate-950 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-100">{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:bg-slate-950 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: string[];
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-100">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-neutral-800 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
      >
        <option value="" style={{ backgroundColor: '#1e1e2e', color: '#f5f5f5' }}>Sélectionner une réponse</option>
        {options.map((option) => (
          <option key={option} value={option} style={{ backgroundColor: '#1e1e2e', color: '#f5f5f5' }}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RadioCards({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-100">{label}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(name, option)}
              className={cx(
                "rounded-2xl border px-4 py-3 text-left text-sm transition",
                selected
                  ? "border-cyan-300 bg-cyan-400/15 text-cyan-50 shadow-[0_0_0_4px_rgba(34,211,238,0.10)]"
                  : "border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80",
              )}
            >
              <span className="flex items-start gap-3">
                <span
                  className={cx(
                    "mt-0.5 h-4 w-4 rounded-full border",
                    selected ? "border-cyan-200 bg-cyan-300" : "border-slate-500",
                  )}
                />
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiChoice({
  label,
  name,
  values,
  onChange,
  options,
}: {
  label: string;
  name: string;
  values: string[];
  onChange: (name: string, value: string[]) => void;
  options: string[];
}) {
  function toggle(option: string) {
    if (values.includes(option)) {
      onChange(
        name,
        values.filter((item) => item !== option),
      );
    } else {
      onChange(name, [...values, option]);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-100">{label}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={cx(
                "rounded-2xl border px-4 py-3 text-left text-sm transition",
                selected
                  ? "border-violet-300 bg-violet-400/15 text-violet-50 shadow-[0_0_0_4px_rgba(167,139,250,0.10)]"
                  : "border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80",
              )}
            >
              <span className="flex items-start gap-3">
                <span
                  className={cx(
                    "mt-0.5 flex h-4 w-4 items-center justify-center rounded border",
                    selected ? "border-violet-200 bg-violet-300" : "border-slate-500",
                  )}
                >
                  {selected && <CheckCircle2 className="h-3 w-3 text-slate-950" />}
                </span>
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Scale({
  label,
  name,
  value,
  onChange,
  labels = scaleLabels,
  left = "Pas du tout",
  right = "Tout à fait",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  labels?: string[];
  left?: string;
  right?: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-sm font-semibold leading-6 text-slate-100">{label}</p>
      <div className="flex flex-wrap gap-2">
        {labels.map((item) => {
          const selected = value === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(name, item)}
              className={cx(
                "h-10 min-w-10 rounded-xl border px-3 text-sm font-semibold transition",
                selected
                  ? "border-amber-300 bg-amber-300 text-slate-950"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

export default function QuestionnaireEAFStagePrintempsPage() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({
    fullName: "",
    classLevel: "",
    school: "",
    attendance: "",
    beforeConfidence: "",
    beforeStress: "",
    afterConfidence: "",
    afterStress: "",
  });

  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  // Load existing draft on mount
  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch('/api/eleve/questionnaire-eaf-stage-printemps');
        if (!res.ok) { setIsLoading(false); return; }
        const data = await res.json();
        if (data.bilan) {
          const src = data.bilan.sourceData as { rawAnswers?: Answers; answers?: Answers; step?: number };
          // Priorité aux rawAnswers pour l'UI plate, sinon fallback sur answers
          const savedAnswers = src?.rawAnswers || src?.answers;
          if (savedAnswers) setAnswers((prev) => ({ ...prev, ...savedAnswers }));
          if (typeof src?.step === 'number') setStep(src.step);
          if (data.bilan.status === 'COMPLETED') setSubmitted(true);
          setLastSaved(new Date(data.bilan.updatedAt));
        }
      } catch (err) {
        // Log removed to fix client build (logger is server-side only)
      }
      finally { setIsLoading(false); }
    }
    void loadDraft();
  }, []);

  // Save draft to API
  const saveDraft = useCallback(async (currentAnswers: Answers, currentStep: number) => {
    if (submitted) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/eleve/questionnaire-eaf-stage-printemps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: currentAnswers, step: currentStep, action: 'draft' }),
      });
      if (res.ok) setLastSaved(new Date());
    } catch { /* silent save failure */ }
    finally { setIsSaving(false); }
  }, [submitted]);

  // Autosave with debounce
  useEffect(() => {
    if (isLoading || submitted) return;
    const timer = setTimeout(() => {
      void saveDraft(answers, step);
    }, 1500);
    return () => clearTimeout(timer);
  }, [answers, step, saveDraft, isLoading, submitted]);

  function setValue(name: string, value: FieldValue) {
    setAnswers((current) => ({ ...current, [name]: value }));
  }

  function getString(name: string) {
    return typeof answers[name] === "string" ? answers[name] : "";
  }

  function getArray(name: string) {
    return Array.isArray(answers[name]) ? (answers[name] as string[]) : [];
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousStep() {
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/eleve/questionnaire-eaf-stage-printemps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, step, action: 'submit' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Une erreur est survenue lors de l\'envoi.');
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#050816] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
          <p className="text-sm text-slate-400">Chargement du questionnaire…</p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-10 text-white md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/80 shadow-2xl shadow-cyan-950/30">
            <CardContent className="space-y-8 p-8 md:p-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-300 text-slate-950">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Questionnaire envoyé</p>
                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Merci pour tes réponses.</h1>
                <p className="text-base leading-7 text-slate-300 md:text-lg">
                  Ton bilan aidera l’équipe Nexus Réussite à mieux suivre ta progression, à améliorer les prochains stages et à proposer des accompagnements encore plus ciblés pour l’épreuve anticipée de français.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setStep(0);
                }}
                className="rounded-2xl bg-cyan-300 px-6 py-6 text-slate-950 hover:bg-cyan-200"
              >
                Revenir au questionnaire
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="relative overflow-hidden px-4 py-12 md:px-8 md:py-16">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-0 top-32 h-[340px] w-[340px] rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[280px] w-[280px] rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-7"
            >
              <HeaderBadge icon={GraduationCap}>Nexus Réussite · Stage de printemps</HeaderBadge>
              <div className="space-y-5">
                <h1 className="max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                  Questionnaire bilan · Épreuve anticipée écrite de français
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-xl">
                  Ce questionnaire permet de mesurer ta progression après les 16 heures de préparation à l’écrit : compréhension des textes, méthode du commentaire, dissertation, expression écrite, gestion du temps et confiance avant l’épreuve.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <HeaderBadge icon={Clock}>Durée estimée : 8 à 12 minutes</HeaderBadge>
                <HeaderBadge icon={FileText}>Réponses sincères, non notées</HeaderBadge>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              <Card className="rounded-[2rem] border border-slate-700/70 bg-slate-950/70 shadow-2xl shadow-slate-950/70 backdrop-blur">
                <CardContent className="space-y-5 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Objectif pédagogique</p>
                      <p className="font-semibold text-white">Faire le point après le stage</p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {[
                      "Identifier les progrès réalisés",
                      "Repérer les fragilités restantes",
                      "Préparer la suite du travail jusqu’à l’EAF",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                        <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="px-4 pb-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 rounded-[1.75rem] border border-slate-800 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/40">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-slate-200">
                  Étape {step + 1} sur {steps.length} · {steps[step]}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {isSaving ? (
                    <span className="flex items-center gap-1.5 text-[10px] text-cyan-400">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                      Sauvegarde en cours...
                    </span>
                  ) : lastSaved ? (
                    <span className="text-[10px] text-slate-500">
                      Brouillon enregistré à {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="text-sm font-semibold text-cyan-300">{progress}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-4 hidden gap-2 md:grid md:grid-cols-8">
              {steps.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStep(index)}
                  className={cx(
                    "rounded-xl px-2 py-2 text-xs font-semibold transition",
                    index === step ? "bg-cyan-300 text-slate-950" : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <Card className="rounded-[2rem] border border-slate-800 bg-slate-950/85 shadow-2xl shadow-slate-950/60">
            <CardContent className="space-y-8 p-5 md:p-8 lg:p-10">
              {step === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 1"
                    title="Informations générales"
                    description="Ces informations servent uniquement à rattacher le bilan au bon élève et à adapter la suite de l’accompagnement."
                  />
                  <div className="grid gap-5 md:grid-cols-2">
                    <TextInput label="Nom et prénom" name="fullName" value={getString("fullName")} onChange={setValue} placeholder="Ex. Lina Ben Salem" required />
                    <SelectField label="Classe" name="classLevel" value={getString("classLevel")} onChange={setValue} options={["Première générale", "Première technologique", "Autre"]} />
                    <TextInput label="Établissement" name="school" value={getString("school")} onChange={setValue} placeholder="Ex. Lycée ..." />
                    <SelectField label="Présence au stage de 16h" name="attendance" value={getString("attendance")} onChange={setValue} options={["J’ai suivi toutes les séances", "J’ai manqué une séance", "J’ai manqué plusieurs séances"]} />
                  </div>
                  <TextArea label="Si tu as manqué une séance, indique laquelle." name="missedSessions" value={getString("missedSessions")} onChange={setValue} placeholder="Réponse facultative" />
                </motion.div>
              )}

              {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 2"
                    title="Avant le stage"
                    description="Cette partie permet de comprendre ton point de départ : tes difficultés, ton niveau de confiance et ton rapport à l’épreuve écrite."
                  />
                  <Scale label="Avant le stage, ton niveau de confiance face à l’épreuve écrite était de :" name="beforeConfidence" value={getString("beforeConfidence")} onChange={setValue} left="Très faible" right="Très élevé" />
                  <Scale label="Avant le stage, ton stress face à l’épreuve écrite était de :" name="beforeStress" value={getString("beforeStress")} onChange={setValue} labels={stressLabels} left="Aucun stress" right="Stress maximal" />
                  <MultiChoice
                    label="Avant le stage, quelles étaient tes principales difficultés ?"
                    name="beforeDifficulties"
                    values={getArray("beforeDifficulties")}
                    onChange={setValue}
                    options={[
                      "Comprendre les textes littéraires",
                      "Trouver des idées",
                      "Analyser les citations",
                      "Éviter la paraphrase",
                      "Construire un plan",
                      "Rédiger l’introduction",
                      "Rédiger la conclusion",
                      "Utiliser des références littéraires",
                      "Gérer le temps",
                      "Comprendre les attentes du correcteur",
                    ]}
                  />
                  <RadioCards
                    label="Avant le stage, avais-tu une méthode claire pour aborder un sujet d’écrit ?"
                    name="beforeMethod"
                    value={getString("beforeMethod")}
                    onChange={setValue}
                    options={["Oui, totalement", "Oui, mais elle était fragile", "Pas vraiment", "Non, je ne savais pas par où commencer"]}
                  />
                  <TextArea label="En une phrase, décris ton état d’esprit avant le stage." name="beforeSentence" value={getString("beforeSentence")} onChange={setValue} placeholder="Ex. Avant le stage, je savais que l’épreuve approchait, mais je ne savais pas comment m’y préparer efficacement." />
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 3"
                    title="Méthode et attentes de l’épreuve"
                    description="Ces questions portent sur la compréhension des critères essentiels : analyser, interpréter, organiser une réponse et répondre précisément au sujet."
                  />
                  <Scale label="Après le stage, comprends-tu mieux ce que l’on attend d’un élève à l’écrit de français ?" name="expectationsClear" value={getString("expectationsClear")} onChange={setValue} />
                  <Scale label="Sais-tu mieux faire la différence entre lire un texte et analyser un texte ?" name="readVsAnalyze" value={getString("readVsAnalyze")} onChange={setValue} />
                  <Scale label="Sais-tu mieux faire la différence entre citer un texte et interpréter une citation ?" name="quoteVsInterpret" value={getString("quoteVsInterpret")} onChange={setValue} />
                  <Scale label="Sais-tu mieux faire la différence entre réciter un cours et répondre précisément à un sujet ?" name="courseVsSubject" value={getString("courseVsSubject")} onChange={setValue} />
                  <Scale label="Le stage t’a-t-il aidé à mieux gérer le temps dans une épreuve écrite ?" name="timeManagement" value={getString("timeManagement")} onChange={setValue} />
                  <TextArea label="Quelle attente de l’épreuve as-tu le mieux comprise grâce au stage ?" name="bestUnderstoodExpectation" value={getString("bestUnderstoodExpectation")} onChange={setValue} />
                  <TextArea label="Quelle attente reste encore floue pour toi ?" name="unclearExpectation" value={getString("unclearExpectation")} onChange={setValue} />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 4"
                    title="Commentaire de texte"
                    description="Cette partie mesure ta progression sur la compréhension du texte, le projet de lecture, l’analyse des citations et l’organisation du commentaire."
                  />
                  <Scale label="Te sens-tu plus capable de comprendre globalement un texte littéraire ?" name="commentaryUnderstand" value={getString("commentaryUnderstand")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable de repérer les enjeux principaux d’un texte ?" name="commentaryIssues" value={getString("commentaryIssues")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable de formuler un projet de lecture ?" name="commentaryProject" value={getString("commentaryProject")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable d’éviter la paraphrase ?" name="commentaryNoParaphrase" value={getString("commentaryNoParaphrase")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable d’analyser une citation ?" name="commentaryQuote" value={getString("commentaryQuote")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable d’organiser ton commentaire en parties cohérentes ?" name="commentaryPlan" value={getString("commentaryPlan")} onChange={setValue} />
                  <MultiChoice
                    label="Quels éléments du commentaire te semblent maintenant plus clairs ?"
                    name="commentaryClearItems"
                    values={getArray("commentaryClearItems")}
                    onChange={setValue}
                    options={[
                      "Identifier le thème du texte",
                      "Repérer les mouvements du texte",
                      "Formuler un projet de lecture",
                      "Trouver des axes d’analyse",
                      "Choisir des citations pertinentes",
                      "Expliquer un procédé",
                      "Construire un paragraphe organisé",
                      "Rédiger une transition",
                      "Éviter le hors-sujet",
                      "Gérer le temps",
                    ]}
                  />
                  <TextArea label="Quelle méthode ou astuce sur le commentaire t’a le plus aidé ?" name="commentaryBestTip" value={getString("commentaryBestTip")} onChange={setValue} />
                  <TextArea label="Que dois-tu encore travailler pour réussir un commentaire ?" name="commentaryStillWork" value={getString("commentaryStillWork")} onChange={setValue} />
                </motion.div>
              )}

              {step === 4 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 5"
                    title="Dissertation"
                    description="Cette partie concerne la compréhension du sujet, la construction d’une problématique, l’organisation des arguments et l’utilisation pertinente des références."
                  />
                  <Scale label="La dissertation te paraît-elle plus accessible après le stage ?" name="dissertationAccessible" value={getString("dissertationAccessible")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable de comprendre précisément un sujet de dissertation ?" name="dissertationSubject" value={getString("dissertationSubject")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable d’éviter le hors-sujet ?" name="dissertationNoOffTopic" value={getString("dissertationNoOffTopic")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable de construire une problématique ?" name="dissertationProblem" value={getString("dissertationProblem")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable de construire un plan progressif ?" name="dissertationPlan" value={getString("dissertationPlan")} onChange={setValue} />
                  <Scale label="Te sens-tu plus capable d’utiliser des références tirées de l’œuvre étudiée ?" name="dissertationReferences" value={getString("dissertationReferences")} onChange={setValue} />
                  <MultiChoice
                    label="Quels éléments de la dissertation sont devenus plus clairs ?"
                    name="dissertationClearItems"
                    values={getArray("dissertationClearItems")}
                    onChange={setValue}
                    options={[
                      "Comprendre le sujet",
                      "Repérer les mots importants",
                      "Transformer le sujet en question",
                      "Formuler une problématique",
                      "Construire un plan",
                      "Formuler un argument",
                      "Utiliser un exemple précis",
                      "Exploiter une référence littéraire",
                      "Rédiger une introduction",
                      "Rédiger une conclusion",
                      "Gérer le temps",
                    ]}
                  />
                  <RadioCards
                    label="Quelle partie de la dissertation reste la plus difficile pour toi ?"
                    name="dissertationHardest"
                    value={getString("dissertationHardest")}
                    onChange={setValue}
                    options={["Comprendre le sujet", "Trouver des idées", "Trouver des exemples", "Construire le plan", "Rédiger l’introduction", "Rédiger les paragraphes", "Rédiger la conclusion", "Gérer le temps"]}
                  />
                </motion.div>
              )}

              {step === 5 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 6"
                    title="Expression écrite et qualité de rédaction"
                    description="La maîtrise de la langue, la précision du vocabulaire et la clarté du propos sont des critères déterminants dans une copie d’EAF."
                  />
                  <Scale label="Le stage t’a-t-il aidé à améliorer la clarté de tes phrases ?" name="writingClarity" value={getString("writingClarity")} onChange={setValue} />
                  <Scale label="Le stage t’a-t-il aidé à enrichir ton vocabulaire d’analyse ?" name="writingVocabulary" value={getString("writingVocabulary")} onChange={setValue} />
                  <Scale label="Le stage t’a-t-il aidé à mieux structurer tes paragraphes ?" name="writingParagraphs" value={getString("writingParagraphs")} onChange={setValue} />
                  <Scale label="Le stage t’a-t-il aidé à mieux formuler tes idées ?" name="writingIdeas" value={getString("writingIdeas")} onChange={setValue} />
                  <MultiChoice
                    label="Quelles difficultés d’expression écrite rencontres-tu encore ?"
                    name="writingStillHard"
                    values={getArray("writingStillHard")}
                    onChange={setValue}
                    options={[
                      "Phrases trop longues",
                      "Phrases trop simples",
                      "Vocabulaire imprécis",
                      "Répétitions",
                      "Orthographe",
                      "Grammaire",
                      "Ponctuation",
                      "Transitions",
                      "Difficulté à expliquer clairement une idée",
                      "Difficulté à rédiger vite",
                    ]}
                  />
                  <TextArea label="Donne un exemple de phrase, de formule ou de méthode de rédaction que tu as retenu." name="writingRemembered" value={getString("writingRemembered")} onChange={setValue} />
                </motion.div>
              )}

              {step === 6 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 7"
                    title="Supports, exercices et accompagnement"
                    description="Cette partie permet d’évaluer la qualité des supports, des corrections, des exercices et de l’accompagnement pédagogique."
                  />
                  <Scale label="Les supports distribués pendant le stage étaient-ils clairs ?" name="supportsClear" value={getString("supportsClear")} onChange={setValue} />
                  <Scale label="Les exercices proposés étaient-ils adaptés à ton niveau ?" name="exercisesLevel" value={getString("exercisesLevel")} onChange={setValue} />
                  <Scale label="Les corrections étaient-elles suffisamment détaillées ?" name="correctionsDetailed" value={getString("correctionsDetailed")} onChange={setValue} />
                  <Scale label="L’enseignante expliquait-elle clairement les méthodes ?" name="teacherClear" value={getString("teacherClear")} onChange={setValue} />
                  <Scale label="T’es-tu senti(e) à l’aise pour poser des questions ?" name="questionsComfort" value={getString("questionsComfort")} onChange={setValue} />
                  <RadioCards
                    label="Le livret ou les fiches de méthode vont-ils te servir après le stage ?"
                    name="futureUse"
                    value={getString("futureUse")}
                    onChange={setValue}
                    options={["Oui, régulièrement", "Oui, avant les devoirs ou le bac", "Peut-être", "Non, je ne pense pas"]}
                  />
                  <MultiChoice
                    label="Quels supports ou moments t’ont le plus aidé ?"
                    name="mostUsefulSupports"
                    values={getArray("mostUsefulSupports")}
                    onChange={setValue}
                    options={["Le livret de cours", "Les fiches méthode", "Les exercices guidés", "Les corrections détaillées", "Les exemples de paragraphes", "Les entraînements en temps limité", "Les explications orales", "Les échanges en petit groupe"]}
                  />
                  <TextArea label="Qu’as-tu particulièrement apprécié dans l’accompagnement ?" name="appreciatedSupport" value={getString("appreciatedSupport")} onChange={setValue} />
                  <TextArea label="Que pourrait-on améliorer pour les prochains stages ?" name="improveSupport" value={getString("improveSupport")} onChange={setValue} />
                </motion.div>
              )}

              {step === 7 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 8"
                    title="Bilan final et suite du travail"
                    description="Dernière étape : ton niveau après le stage, ton plan de travail et ton avis global sur l’accompagnement."
                  />
                  <Scale label="Après le stage, ton niveau de confiance face à l’épreuve écrite est de :" name="afterConfidence" value={getString("afterConfidence")} onChange={setValue} left="Très faible" right="Très élevé" />
                  <Scale label="Après le stage, ton stress face à l’épreuve écrite est de :" name="afterStress" value={getString("afterStress")} onChange={setValue} labels={stressLabels} left="Aucun stress" right="Stress maximal" />
                  <RadioCards
                    label="Par rapport au début du stage, tu te sens :"
                    name="progressFeeling"
                    value={getString("progressFeeling")}
                    onChange={setValue}
                    options={["Beaucoup plus confiant(e)", "Un peu plus confiant(e)", "À peu près pareil", "Encore inquiet/inquiète", "Je ne sais pas"]}
                  />
                  <SelectField
                    label="Quelle compétence as-tu le plus améliorée ?"
                    name="bestProgress"
                    value={getString("bestProgress")}
                    onChange={setValue}
                    options={["Comprendre un texte", "Analyser une citation", "Construire un plan", "Rédiger une introduction", "Développer un argument", "Utiliser des références", "Gérer le temps", "Améliorer l’expression écrite", "Comprendre les attentes du bac"]}
                  />
                  <SelectField
                    label="Quelle compétence dois-tu encore travailler en priorité ?"
                    name="priorityWork"
                    value={getString("priorityWork")}
                    onChange={setValue}
                    options={["Comprendre un texte", "Analyser une citation", "Construire un plan", "Rédiger une introduction", "Développer un argument", "Utiliser des références", "Gérer le temps", "Améliorer l’expression écrite", "Comprendre les attentes du bac"]}
                  />
                  <Scale label="Quelle note globale donnerais-tu au stage ?" name="globalRating" value={getString("globalRating")} onChange={setValue} labels={stressLabels} left="0" right="10" />
                  <Scale label="Recommanderais-tu ce stage à un autre élève de Première ?" name="recommendRating" value={getString("recommendRating")} onChange={setValue} labels={stressLabels} left="0" right="10" />
                  <TextArea label="En une phrase, qu’est-ce que le stage t’a apporté de plus important ?" name="mostImportantBenefit" value={getString("mostImportantBenefit")} onChange={setValue} />
                  <TextArea label="Que vas-tu faire concrètement dans les prochaines semaines pour continuer à progresser ?" name="nextActions" value={getString("nextActions")} onChange={setValue} />
                  <TextArea label="Un dernier message pour l’équipe Nexus Réussite ?" name="finalMessage" value={getString("finalMessage")} onChange={setValue} />
                </motion.div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  onClick={previousStep}
                  disabled={step === 0}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-6 text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>

                {step < steps.length - 1 ? (
                  <Button type="button" onClick={nextStep} className="rounded-2xl bg-cyan-300 px-6 py-6 font-bold text-slate-950 hover:bg-cyan-200">
                    Continuer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="rounded-2xl bg-amber-300 px-6 py-6 font-bold text-slate-950 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Envoi en cours…' : 'Envoyer mon bilan'}
                    {!isSubmitting && <Sparkles className="ml-2 h-4 w-4" />}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: BookOpen, title: "Méthode", text: "Comprendre les attentes précises de l’épreuve écrite." },
              { icon: PenLine, title: "Progression", text: "Identifier ce qui a changé depuis le début du stage." },
              { icon: Star, title: "Suite", text: "Construire un plan de travail clair jusqu’à l’EAF." },
            ].map((item) => (
              <Card key={item.title} className="rounded-3xl border border-slate-800 bg-slate-950/65">
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-cyan-300">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </form>
    </main>
  );
}
