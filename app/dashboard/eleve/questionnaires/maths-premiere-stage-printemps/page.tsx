"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  "Profil",
  "Avant le stage",
  "Automatismes",
  "Analyse",
  "Suites numériques",
  "Produit scalaire",
  "Probabilités",
  "Épreuve finale",
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
    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/30 bg-indigo-400/10 px-4 py-2 text-sm font-medium text-indigo-100 shadow-sm">
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
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">{eyebrow}</p>
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
        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-indigo-300 focus:bg-slate-950 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
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
        className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-300 focus:bg-slate-950 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
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
        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-300 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
      >
        <option value="">Sélectionner une réponse</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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

export default function QuestionnaireMathsPremiereStagePrintempsPage() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
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

  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch('/api/eleve/questionnaire-maths-premiere-stage-printemps');
        if (!res.ok) { setIsLoading(false); return; }
        const data = (await res.json()) as {
          bilan?: {
            status?: string;
            updatedAt?: string;
            sourceData?: {
              rawAnswers?: Answers;
              answers?: Answers;
              step?: number;
            };
          };
        };
        if (data.bilan) {
          const src = data.bilan.sourceData;
          const savedAnswers = src?.rawAnswers || src?.answers;
          if (savedAnswers) setAnswers((prev) => ({ ...prev, ...savedAnswers }));
          if (typeof src?.step === 'number') setStep(src.step);
          if (data.bilan.status === 'COMPLETED') setSubmitted(true);
          if (data.bilan.updatedAt) setLastSaved(new Date(data.bilan.updatedAt));
        }
      } catch (_err) {
        // Ignored
      } finally {
        setIsLoading(false);
      }
    }
    void loadDraft();
  }, []);

  const saveDraft = useCallback(async (currentAnswers: Answers, currentStep: number) => {
    if (submitted) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/eleve/questionnaire-maths-premiere-stage-printemps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: currentAnswers, step: currentStep, action: 'draft' }),
      });
      if (res.ok) setLastSaved(new Date());
    } catch { /* Ignored */ }
    finally { setIsSaving(false); }
  }, [submitted]);

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

    try {
      const res = await fetch('/api/eleve/questionnaire-maths-premiere-stage-printemps', {
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
    } catch (_err) {
      // ignored
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#050816] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-indigo-300 border-t-transparent" />
          <p className="text-sm text-slate-400">Chargement du questionnaire…</p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-10 text-white md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card className="overflow-hidden rounded-[2rem] border border-indigo-300/20 bg-slate-950/80 shadow-2xl shadow-indigo-950/30">
            <CardContent className="space-y-8 p-8 md:p-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-300 text-slate-950">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300">Questionnaire envoyé</p>
                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Merci pour tes réponses.</h1>
                <p className="text-base leading-7 text-slate-300 md:text-lg">
                  Ton bilan aidera l’équipe Nexus Réussite à mieux suivre ta progression en mathématiques et à proposer des accompagnements encore plus ciblés pour tes futures évaluations.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setStep(0);
                }}
                className="rounded-2xl bg-indigo-300 px-6 py-6 text-slate-950 hover:bg-indigo-200"
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
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-indigo-400/20 blur-3xl" />
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
                  Questionnaire bilan · Mathématiques (Première)
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-xl">
                  Ce questionnaire permet de mesurer ta progression après le stage intensif de mathématiques : automatismes, analyse, suites, produit scalaire et méthodes de résolution.
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-300 text-slate-950">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Objectif pédagogique</p>
                      <p className="font-semibold text-white">Faire le point après le stage</p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {[
                      "Identifier les progrès réalisés en mathématiques",
                      "Repérer les fragilités restantes par chapitre",
                      "Préparer la suite du travail jusqu'aux examens",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                        <CheckCircle2 className="h-4 w-4 text-indigo-300" />
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
                    <span className="flex items-center gap-1.5 text-[10px] text-indigo-400">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                      Sauvegarde en cours...
                    </span>
                  ) : lastSaved ? (
                    <span className="text-[10px] text-slate-500">
                      Brouillon enregistré à {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="text-sm font-semibold text-indigo-300">{progress}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-indigo-300 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <Card className="rounded-[2rem] border border-slate-800 bg-slate-950/85 shadow-2xl shadow-slate-950/60">
            <CardContent className="space-y-8 p-5 md:p-8 lg:p-10">
              {step === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 1"
                    title="Informations générales"
                    description="Ces informations servent à rattacher le bilan au bon élève et à adapter la suite de l’accompagnement."
                  />
                  <div className="grid gap-5 md:grid-cols-2">
                    <TextInput label="Nom et prénom" name="fullName" value={getString("fullName")} onChange={setValue} placeholder="Ex. Lina Ben Salem" required />
                    <SelectField label="Classe" name="classLevel" value={getString("classLevel")} onChange={setValue} options={["Première générale EDS", "Autre"]} />
                    <TextInput label="Établissement" name="school" value={getString("school")} onChange={setValue} placeholder="Ex. Lycée ..." />
                    <SelectField label="Présence au stage" name="attendance" value={getString("attendance")} onChange={setValue} options={["J’ai suivi toutes les séances", "J’ai manqué une séance", "J’ai manqué plusieurs séances"]} />
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 2"
                    title="Avant le stage"
                    description="Comprendre ton point de départ : ton niveau de confiance et ton rapport aux chapitres de maths."
                  />
                  <Scale label="Avant le stage, ton niveau de confiance en mathématiques était de :" name="beforeConfidence" value={getString("beforeConfidence")} onChange={setValue} left="Très faible" right="Très élevé" />
                  <Scale label="Avant le stage, ton stress face aux devoirs de maths était de :" name="beforeStress" value={getString("beforeStress")} onChange={setValue} labels={stressLabels} left="Aucun stress" right="Stress maximal" />
                  <MultiChoice
                    label="Avant le stage, quelles étaient tes principales difficultés ?"
                    name="beforeDifficulties"
                    values={getArray("beforeDifficulties")}
                    onChange={setValue}
                    options={[
                      "Calcul algébrique / automatismes",
                      "Fonction dérivée et variations",
                      "Suites arithmétiques et géométriques",
                      "Fonction exponentielle",
                      "Produit scalaire",
                      "Probabilités conditionnelles",
                      "Gestion du temps en épreuve",
                      "Rédaction et rigueur mathématique",
                    ]}
                  />
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 3"
                    title="Automatismes et calculs"
                    description="Évaluation de ta maîtrise des calculs rapides et des automatismes essentiels."
                  />
                  <Scale label="Fluidité des calculs algébriques" name="calculationFluency" value={getString("calculationFluency")} onChange={setValue} />
                  <Scale label="Identités remarquables et factorisations" name="identities" value={getString("identities")} onChange={setValue} />
                  <Scale label="Résolution d'équations et inéquations du premier degré" name="linearEquation" value={getString("linearEquation")} onChange={setValue} />
                  <Scale label="Dérivation de fonctions usuelles" name="derivatives" value={getString("derivatives")} onChange={setValue} />
                  <TextInput label="Ton automatisme le plus solide :" name="strongestAutomation" value={getString("strongestAutomation")} onChange={setValue} placeholder="Ex: calcul des dérivées" />
                  <TextInput label="L'automatisme que tu dois encore travailler :" name="weakestAutomation" value={getString("weakestAutomation")} onChange={setValue} placeholder="Ex: factorisations délicates" />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 4"
                    title="Analyse (Dérivation et Variations)"
                    description="Maîtrise du calcul des dérivées de produits, quotients et étude des variations."
                  />
                  <Scale label="Dérivation d'un produit (u × v)" name="productDerivative" value={getString("productDerivative")} onChange={setValue} />
                  <Scale label="Dérivation d'un quotient (u / v)" name="quotientDerivative" value={getString("quotientDerivative")} onChange={setValue} />
                  <Scale label="Tableau de signes et de variations" name="variationTable" value={getString("variationTable")} onChange={setValue} />
                  <Scale label="Utilisation de la fonction exponentielle" name="exponentialPositivity" value={getString("exponentialPositivity")} onChange={setValue} />
                </motion.div>
              )}

              {step === 4 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 5"
                    title="Suites numériques"
                    description="Progression sur les suites arithmétiques, géométriques et auxiliaires."
                  />
                  <Scale label="Reconnaître et utiliser les formules explicites" name="explicitFormula" value={getString("explicitFormula")} onChange={setValue} />
                  <Scale label="Utilisation des suites auxiliaires géométriques" name="auxiliarySequence" value={getString("auxiliarySequence")} onChange={setValue} />
                  <Scale label="Calcul de sommes (termes d'une suite)" name="sums" value={getString("sums")} onChange={setValue} />
                  <TextArea label="Que dois-tu encore travailler ou réviser sur les suites ?" name="progressReflection" value={getString("progressReflection")} onChange={setValue} />
                </motion.div>
              )}

              {step === 5 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 6"
                    title="Produit scalaire et géométrie"
                    description="Maîtrise du produit scalaire dans différentes configurations."
                  />
                  <Scale label="Calcul par les coordonnées" name="coordinates" value={getString("coordinates")} onChange={setValue} />
                  <Scale label="Calcul par la norme et l'angle" name="normAngle" value={getString("normAngle")} onChange={setValue} />
                  <Scale label="Utilisation d'Al-Kashi" name="alKashi" value={getString("alKashi")} onChange={setValue} />
                </motion.div>
              )}

              {step === 6 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 7"
                    title="Probabilités conditionnelles"
                    description="Construction d'arbres pondérés et calculs de probabilités."
                  />
                  <Scale label="Construction de l'arbre pondéré" name="weightedTree" value={getString("weightedTree")} onChange={setValue} />
                  <Scale label="Formule des probabilités totales" name="totalProbability" value={getString("totalProbability")} onChange={setValue} />
                  <Scale label="Formule de Bayes" name="bayes" value={getString("bayes")} onChange={setValue} />
                </motion.div>
              )}

              {step === 7 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 8"
                    title="Épreuve finale et méthode"
                    description="Gestion du temps, rédaction et rigueur lors de l'épreuve finale du stage."
                  />
                  <Scale label="Gestion du temps en épreuve" name="timeManagement" value={getString("timeManagement")} onChange={setValue} />
                  <Scale label="Clarté de la rédaction et des justifications" name="writtenClarity" value={getString("writtenClarity")} onChange={setValue} />
                  <TextArea label="Quel conseil retiens-tu pour ta prochaine épreuve ?" name="adviceForNextAssessment" value={getString("adviceForNextAssessment")} onChange={setValue} />
                </motion.div>
              )}

              {step === 8 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <SectionTitle
                    eyebrow="Étape 9"
                    title="Bilan final"
                    description="Ton niveau de confiance global et tes impressions à la fin du stage de mathématiques."
                  />
                  <Scale label="Après le stage, ton niveau de confiance en maths est de :" name="afterConfidence" value={getString("afterConfidence")} onChange={setValue} left="Très faible" right="Très élevé" />
                  <Scale label="Après le stage, ton stress face aux devoirs de maths est de :" name="afterStress" value={getString("afterStress")} onChange={setValue} labels={stressLabels} left="Aucun stress" right="Stress maximal" />
                  <SelectField label="Le chapitre où tu as le plus progressé :" name="bestProgress" value={getString("bestProgress")} onChange={setValue} options={["Second degré", "Dérivation", "Suites numériques", "Fonction exponentielle", "Produit scalaire", "Probabilités conditionnelles"]} />
                  <TextArea label="Un message final sur le stage ou tes besoins futurs :" name="finalMessage" value={getString("finalMessage")} onChange={setValue} />
                </motion.div>
              )}

              <div className="flex flex-col gap-4 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  disabled={step === 0}
                  onClick={previousStep}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-6 text-slate-200 hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Précédent
                </Button>

                {step === steps.length - 1 ? (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-2xl bg-indigo-500 px-8 py-6 text-slate-950 font-bold hover:bg-indigo-400"
                  >
                    Envoyer le bilan final
                    <Sparkles className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="rounded-2xl bg-indigo-500 px-8 py-6 text-slate-950 font-bold hover:bg-indigo-400"
                  >
                    Suivant
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </main>
  );
}
