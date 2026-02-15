"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, GraduationCap, Loader2, Calculator, Target, TrendingUp, ChevronDown, AlertTriangle, BarChart3, Code2, Lightbulb, Sigma, FileText, BrainCircuit, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { track } from "@/lib/analytics";

import {
  createCompetency,
  CompetencyItem,
  SKILLS_BY_TRACK,
  DOMAIN_LABELS,
  LEARNING_STYLES,
  PROBLEM_REFLUX,
  TARGET_MENTIONS,
  POSTBAC,
  FEELINGS,
  ERROR_LABELS,
  ERROR_ENUM
} from "@/lib/diagnostics/skills-data";

interface FormData {
  version: string;
  submittedAt: string;
  identity: {
    firstName: string;
    lastName: string;
    birthDate: string;
    email: string;
    phone: string;
    city: string;
  };
  schoolContext: {
    establishment: string;
    mathTrack: string;
    mathTeacher: string;
    classSize: string;
  };
  performance: {
    generalAverage: string;
    mathAverage: string;
    lastTestScore: string;
    classRanking: string;
  };
  chapters: {
    chaptersStudied: string;
    chaptersInProgress: string;
    chaptersNotYet: string;
  };
  competencies: {
    algebra: CompetencyItem[];
    analysis: CompetencyItem[];
    geometry: CompetencyItem[];
    probabilities: CompetencyItem[];
    python: CompetencyItem[];
    terminalAnticipation: CompetencyItem[];
  };
  openQuestions: {
    algebraUnderstanding: string;
    canDemonstrateProductRule: string;
    probabilityQuestion: string;
    hardestAnalysisChapter: string;
    geometryMixedExercise: string;
  };
  examPrep: {
    miniTest: {
      score: number;
      timeUsedMinutes: number;
      completedInTime: boolean | null;
    };
    selfRatings: {
      speedNoCalc: number;
      calcReliability: number;
      redaction: number;
      justifications: number;
      stress: number;
    };
    signals: {
      hardestItems: number[];
      dominantErrorType: string;
      verifiedAnswers: boolean | null;
      feeling: string;
    };
    zeroSubjects: string;
    mainRisk: string;
  };
  methodology: {
    learningStyle: string;
    problemReflex: string;
    weeklyWork: string;
    maxConcentration: string;
    errorTypes: string[];
  };
  ambition: {
    targetMention: string;
    postBac: string;
    pallier2Pace: string;
  };
  freeText: {
    mustImprove: string;
    invisibleDifficulties: string;
    message: string;
  };
}

// Re-export specific constants if used elsewhere or keep local aliases if needed
// For now, we use them directly from the import

function LevelSelector({ value, onChange, max = 4, disabled = false }: { value: number; onChange: (val: number) => void; max?: number; disabled?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max + 1 }, (_, i) => (
        <button key={i} type="button" onClick={() => !disabled && onChange(i)} disabled={disabled}
          className={`w-6 h-6 rounded text-xs font-medium ${value === i ? "bg-brand-accent text-white" : disabled ? "bg-white/5 text-slate-600" : "bg-white/10 text-slate-400 hover:bg-white/20"}`}>
          {i}
        </button>
      ))}
    </div>
  );
}

function CompetencyRow({ competency, onUpdate }: { competency: CompetencyItem; onUpdate: (field: keyof CompetencyItem, value: unknown) => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const isNotStudied = competency.status === "not_studied" || competency.status === "unknown";

  return (
    <div className={`border-b border-white/5 py-2 ${isNotStudied ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={competency.status} onValueChange={(val) => {
          onUpdate("status", val);
          if (val === "not_studied" || val === "unknown") {
            onUpdate("mastery", null); onUpdate("confidence", null); onUpdate("friction", null);
          } else if (competency.mastery === null) {
            onUpdate("mastery", 2); onUpdate("confidence", 2); onUpdate("friction", 1);
          }
        }}>
          <SelectTrigger className="w-[90px] bg-white/5 border-white/10 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="studied">Étudié</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="not_studied">Non</SelectItem>
            <SelectItem value="unknown">?</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1 min-w-[140px]"><Label className="text-xs text-slate-200">{competency.skillLabel}</Label></div>
        <div className="flex items-center gap-1"><span className="text-xs text-slate-500 w-4">M</span><LevelSelector value={competency.mastery ?? 0} onChange={v => onUpdate("mastery", v)} disabled={isNotStudied} /></div>
        <button onClick={() => setShowDetails(!showDetails)} className="text-slate-400 hover:text-brand-accent"><ChevronDown className={`w-4 h-4 ${showDetails ? "rotate-180" : ""}`} /></button>
      </div>
      <AnimatePresence>
        {showDetails && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="mt-2 pl-[100px] space-y-2">
            <div className="flex gap-3">
              <div className="flex items-center gap-1"><span className="text-xs text-slate-500 w-4">C</span><LevelSelector value={competency.confidence ?? 0} onChange={v => onUpdate("confidence", v)} max={3} disabled={isNotStudied} /></div>
              <div className="flex items-center gap-1"><span className="text-xs text-slate-500 w-4">F</span><LevelSelector value={competency.friction ?? 0} onChange={v => onUpdate("friction", v)} max={3} disabled={isNotStudied} /></div>
            </div>
            <div className="flex flex-wrap gap-1">{ERROR_ENUM.map(e => (
              <div key={e} className="flex items-center gap-0.5">
                <Checkbox checked={competency.errorTypes.includes(e)} onCheckedChange={c => onUpdate("errorTypes", c ? [...competency.errorTypes, e] : competency.errorTypes.filter(x => x !== e))} disabled={isNotStudied} id={`${competency.skillId}-${e}`} />
                <Label htmlFor={`${competency.skillId}-${e}`} className="text-xs">{ERROR_LABELS.find(el => el.value === e)?.label}</Label>
              </div>
            ))}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BilanPallier2MathsPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;

  const [formData, setFormData] = useState<FormData>({
    version: "v1.3",
    submittedAt: new Date().toISOString(),
    identity: { firstName: "", lastName: "", birthDate: "", email: "", phone: "", city: "" },
    schoolContext: { establishment: "", mathTrack: "", mathTeacher: "", classSize: "" },
    performance: { generalAverage: "", mathAverage: "", lastTestScore: "", classRanking: "" },
    chapters: { chaptersStudied: "", chaptersInProgress: "", chaptersNotYet: "" },
    competencies: {
      algebra: SKILLS_BY_TRACK['eds_maths_1ere'].algebra.map(s => createCompetency(s.id, s.label)),
      analysis: SKILLS_BY_TRACK['eds_maths_1ere'].analysis.map(s => createCompetency(s.id, s.label)),
      geometry: SKILLS_BY_TRACK['eds_maths_1ere'].geometry.map(s => createCompetency(s.id, s.label)),
      probabilities: SKILLS_BY_TRACK['eds_maths_1ere'].probabilities.map(s => createCompetency(s.id, s.label)),
      python: SKILLS_BY_TRACK['eds_maths_1ere'].python.map(s => createCompetency(s.id, s.label)),
      terminalAnticipation: SKILLS_BY_TRACK['eds_maths_1ere'].terminalAnticipation.map(s => createCompetency(s.id, s.label))
    },
    openQuestions: { algebraUnderstanding: "", canDemonstrateProductRule: "", probabilityQuestion: "", hardestAnalysisChapter: "", geometryMixedExercise: "" },
    examPrep: {
      miniTest: { score: 0, timeUsedMinutes: 0, completedInTime: null },
      selfRatings: { speedNoCalc: 2, calcReliability: 2, redaction: 2, justifications: 2, stress: 2 },
      signals: { hardestItems: [], dominantErrorType: "", verifiedAnswers: null, feeling: "" },
      zeroSubjects: "no",
      mainRisk: ""
    },
    methodology: { learningStyle: "", problemReflex: "", weeklyWork: "", maxConcentration: "1h", errorTypes: [] },
    ambition: { targetMention: "", postBac: "", pallier2Pace: "" },
    freeText: { mustImprove: "", invisibleDifficulties: "", message: "" }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Derived track info for dynamic UI
  const trackKey = formData.schoolContext.mathTrack || 'eds_maths_1ere';
  const isMaths = trackKey.includes('maths');
  const isTerminale = trackKey.includes('tle');
  const disciplineLabel = isMaths ? 'Mathématiques' : 'NSI';
  const levelLabel = isTerminale ? 'Terminale' : 'Première';
  const trackLabel = `${disciplineLabel} — ${levelLabel} Spécialité`;

  const updateIdentity = (f: keyof FormData["identity"], v: string) => setFormData(p => ({ ...p, identity: { ...p.identity, [f]: v } }));
  const updateSchool = (f: keyof FormData["schoolContext"], v: string) => {
    setFormData(p => {
      const newData = { ...p, schoolContext: { ...p.schoolContext, [f]: v } };

      // If updating mathTrack, reset competencies based on new track
      if (f === 'mathTrack' && SKILLS_BY_TRACK[v]) {
        const skills = SKILLS_BY_TRACK[v];
        newData.competencies = {
          algebra: skills.algebra.map(s => createCompetency(s.id, s.label)),
          analysis: skills.analysis.map(s => createCompetency(s.id, s.label)),
          geometry: skills.geometry.map(s => createCompetency(s.id, s.label)),
          probabilities: skills.probabilities.map(s => createCompetency(s.id, s.label)),
          python: skills.python.map(s => createCompetency(s.id, s.label)),
          terminalAnticipation: skills.terminalAnticipation.map(s => createCompetency(s.id, s.label))
        };
      }
      return newData;
    });
  };
  const updatePerf = (f: keyof FormData["performance"], v: string) => setFormData(p => ({ ...p, performance: { ...p.performance, [f]: v } }));
  const updateChapter = (f: keyof FormData["chapters"], v: string) => setFormData(p => ({ ...p, chapters: { ...p.chapters, [f]: v } }));
  const updateOpenQ = (f: keyof FormData["openQuestions"], v: string) => setFormData(p => ({ ...p, openQuestions: { ...p.openQuestions, [f]: v } }));
  const updateMethod = (f: keyof FormData["methodology"], v: unknown) => setFormData(p => ({ ...p, methodology: { ...p.methodology, [f]: v } }));
  const updateAmb = (f: keyof FormData["ambition"], v: string) => setFormData(p => ({ ...p, ambition: { ...p.ambition, [f]: v } }));
  const updateFree = (f: keyof FormData["freeText"], v: string) => setFormData(p => ({ ...p, freeText: { ...p.freeText, [f]: v } }));

  const updateCompetency = (domain: keyof FormData["competencies"], idx: number, field: keyof CompetencyItem, value: unknown) => {
    setFormData(p => ({
      ...p,
      competencies: {
        ...p.competencies,
        [domain]: p.competencies[domain].map((c, i) => i === idx ? { ...c, [field]: value } : c)
      }
    }));
  };

  const updateExamPrep = (cat: string, field: string, value: unknown) => {
    if (cat === "miniTest") setFormData(p => ({ ...p, examPrep: { ...p.examPrep, miniTest: { ...p.examPrep.miniTest, [field]: value } } }));
    else if (cat === "selfRatings") setFormData(p => ({ ...p, examPrep: { ...p.examPrep, selfRatings: { ...p.examPrep.selfRatings, [field]: value } } }));
    else if (cat === "signals") setFormData(p => ({ ...p, examPrep: { ...p.examPrep, signals: { ...p.examPrep.signals, [field]: value } } }));
    else setFormData(p => ({ ...p, examPrep: { ...p.examPrep, [field]: value } }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.identity.firstName) newErrors.firstName = "Prénom requis";
      if (!formData.identity.lastName) newErrors.lastName = "Nom requis";
      if (!formData.identity.email) newErrors.email = "Email requis";
      if (!formData.identity.phone) newErrors.phone = "Téléphone requis";
    }
    if (step === 2) {
      if (!formData.performance.mathAverage) newErrors.mathAverage = "Moyenne maths requise";
    }
    if (step === 5) {
      if (!formData.examPrep.signals.feeling) newErrors.feeling = "Ressenti requis";
    }
    if (step === 6) {
      if (!formData.methodology.learningStyle) newErrors.learningStyle = "Style d'apprentissage requis";
    }
    if (step === 7) {
      if (!formData.ambition.targetMention) newErrors.targetMention = "Objectif mention requis";
    }
    if (Object.keys(newErrors).length > 0) {
      toast.error(Object.values(newErrors)[0]);
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (currentStep < effectiveTotalSteps && validateStep(currentStep)) {
      let next = currentStep + 1;
      // Skip step 4 (Anticipation Tle) for Terminale tracks
      if (isTerminale && next === 4) next = 5;
      setCurrentStep(next);
    }
  };
  const prevStep = () => {
    if (currentStep > 1) {
      let prev = currentStep - 1;
      // Skip step 4 (Anticipation Tle) for Terminale tracks
      if (isTerminale && prev === 4) prev = 3;
      setCurrentStep(prev);
    }
  };

  const onSubmit = async () => {
    for (let s = 1; s <= effectiveTotalSteps; s++) {
      // Skip step 4 for Terminale tracks
      if (isTerminale && s === 4) continue;
      if (!validateStep(s)) { setCurrentStep(s); return; }
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/bilan-pallier2-maths", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      const result = await response.json();
      if (response.ok) { track.bilanPallier2Success(result.id); router.push(`/bilan-pallier2-maths/confirmation?id=${result.id}&share=${result.publicShareId || result.id}`); }
      else { track.bilanPallier2Error(result.error); toast.error(result.error); }
    } catch { toast.error("Erreur lors de la soumission"); }
    finally { setIsSubmitting(false); }
  };

  const stepTitles = isTerminale
    ? ["Identité", "Contexte", `Programme ${disciplineLabel}`, "Épreuve BAC", "Méthodo", "Objectifs"]
    : ["Identité", "Contexte", `Programme ${disciplineLabel}`, "Anticipation Tle", "Épreuve anticipée", "Méthodo", "Objectifs"];
  const effectiveTotalSteps = isTerminale ? 6 : 7;

  return (
    <div className="min-h-screen bg-surface-darker">
      <Toaster position="top-right" richColors theme="dark" />
      <CorporateNavbar />
      <main className="py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Bilan Diagnostic Pré-Stage" }]} className="mb-6 breadcrumb-on-dark" />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <Badge variant="outline" className="mb-4 border-brand-accent/40 bg-brand-accent/10 text-brand-accent"><Target className="w-4 h-4 mr-2" />BILAN DIAGNOSTIC PRÉ-STAGE</Badge>
            <h1 className="font-display text-2xl md:text-4xl font-bold text-white mb-3">Bilan Diagnostic Pré-Stage</h1>
            <p className="text-slate-300">Votre positionnement personnalisé en {trackLabel} — {isTerminale ? 'Préparation BAC 2026' : 'Préparation épreuve anticipée 2026'}</p>
          </motion.div>
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2"><span className="text-slate-200">Étape {currentStep}/{effectiveTotalSteps}</span><span className="text-slate-400">{Math.round((currentStep / effectiveTotalSteps) * 100)}%</span></div>
            <div className="w-full bg-white/10 rounded-full h-2"><div className="bg-brand-accent h-2 rounded-full" style={{ width: `${(currentStep / effectiveTotalSteps) * 100}%` }} /></div>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {Array.from({ length: effectiveTotalSteps }, (_, i) => i + 1).map(s => (
                <button key={s} onClick={() => setCurrentStep(s)} className={`w-8 h-8 rounded-full text-xs font-medium ${currentStep === s ? "bg-brand-accent text-white" : currentStep > s ? "bg-green-500/20 text-green-400" : "bg-white/10 text-slate-400"}`}>
                  {currentStep > s ? "✓" : s}
                </button>
              ))}
            </div>
            <h2 className="text-xl font-semibold text-white text-center mt-4">{stepTitles[currentStep - 1]}</h2>
          </div>
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-white/10 bg-white/5">
                  <CardHeader><CardTitle className="flex items-center text-white"><GraduationCap className="w-5 h-5 mr-2 text-brand-accent" />Identité</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-slate-200">Prénom *</Label><Input value={formData.identity.firstName} onChange={e => updateIdentity("firstName", e.target.value)} className={`bg-white/5 border-white/10 ${errors.firstName ? "border-error" : ""}`} /></div>
                      <div><Label className="text-slate-200">Nom *</Label><Input value={formData.identity.lastName} onChange={e => updateIdentity("lastName", e.target.value)} className={`bg-white/5 border-white/10 ${errors.lastName ? "border-error" : ""}`} /></div>
                      <div><Label className="text-slate-200">Date de naissance</Label><Input type="date" value={formData.identity.birthDate} onChange={e => updateIdentity("birthDate", e.target.value)} className="bg-white/5 border-white/10" /></div>
                      <div><Label className="text-slate-200">Ville</Label><Input value={formData.identity.city} onChange={e => updateIdentity("city", e.target.value)} className="bg-white/5 border-white/10" placeholder="Tunis" /></div>
                      <div><Label className="text-slate-200">Email *</Label><Input value={formData.identity.email} onChange={e => updateIdentity("email", e.target.value)} className={`bg-white/5 border-white/10 ${errors.email ? "border-error" : ""}`} /></div>
                      <div><Label className="text-slate-200">Téléphone *</Label><Input value={formData.identity.phone} onChange={e => updateIdentity("phone", e.target.value)} className={`bg-white/5 border-white/10 ${errors.phone ? "border-error" : ""}`} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-slate-200">Établissement</Label><Input value={formData.schoolContext.establishment} onChange={e => updateSchool("establishment", e.target.value)} className="bg-white/5 border-white/10" /></div>
                      <div><Label className="text-slate-200">EDS / Niveau</Label><Select value={formData.schoolContext.mathTrack} onValueChange={v => updateSchool("mathTrack", v)}><SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Sélectionnez..." /></SelectTrigger><SelectContent><SelectItem value="eds_maths_1ere">EDS Maths / Première</SelectItem><SelectItem value="eds_maths_tle">EDS Maths / Terminale</SelectItem><SelectItem value="eds_nsi_1ere">EDS NSI / Première</SelectItem><SelectItem value="eds_nsi_tle">EDS NSI / Terminale</SelectItem></SelectContent></Select></div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {currentStep === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-white/10 bg-white/5">
                  <CardHeader><CardTitle className="flex items-center text-white"><TrendingUp className="w-5 h-5 mr-2 text-brand-accent" />Performances</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><Label className="text-slate-200">Moyenne générale</Label><Input value={formData.performance.generalAverage} onChange={e => updatePerf("generalAverage", e.target.value)} className="bg-white/5 border-white/10" placeholder="15" /></div>
                      <div><Label className="text-slate-200">Moyenne maths</Label><Input value={formData.performance.mathAverage} onChange={e => updatePerf("mathAverage", e.target.value)} className="bg-white/5 border-white/10" placeholder="14" /></div>
                      <div><Label className="text-slate-200">Dernier DS</Label><Input value={formData.performance.lastTestScore} onChange={e => updatePerf("lastTestScore", e.target.value)} className="bg-white/5 border-white/10" placeholder="12/20" /></div>
                      <div><Label className="text-slate-200">Classement</Label><Input value={formData.performance.classRanking} onChange={e => updatePerf("classRanking", e.target.value)} className="bg-white/5 border-white/10" placeholder="5e/35" /></div>
                    </div>
                    <div><Label className="text-slate-200">Chapitres vus depuis septembre</Label><Textarea value={formData.chapters.chaptersStudied} onChange={e => updateChapter("chaptersStudied", e.target.value)} className="bg-white/5 border-white/10 min-h-[80px]" placeholder="Copiez les titres des chapitres terminés..." /></div>
                    <div><Label className="text-slate-200">Chapitres en cours</Label><Textarea value={formData.chapters.chaptersInProgress} onChange={e => updateChapter("chaptersInProgress", e.target.value)} className="bg-white/5 border-white/10 min-h-[60px]" placeholder="Chapitres actuellement étudiés..." /></div>
                    <div><Label className="text-slate-200">Chapitres non encore abordés</Label><Textarea value={formData.chapters.chaptersNotYet} onChange={e => updateChapter("chaptersNotYet", e.target.value)} className="bg-white/5 border-white/10 min-h-[60px]" placeholder="Chapitres restants à voir..." /></div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {currentStep === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {[
                  { key: "algebra", icon: Sigma },
                  { key: "analysis", icon: TrendingUp },
                  { key: "geometry", icon: Calculator },
                  { key: "probabilities", icon: BarChart3 },
                  { key: "python", icon: Code2 }
                ].map(domain => {
                  const trackKey = formData.schoolContext.mathTrack || 'eds_maths_1ere';
                  const labels = DOMAIN_LABELS[trackKey] || DOMAIN_LABELS['eds_maths_1ere'];
                  const title = labels[domain.key] || domain.key;
                  // Only render if there are skills in this domain
                  if (formData.competencies[domain.key as keyof FormData["competencies"]].length === 0) return null;

                  return (
                    <Card key={domain.key} className="border-white/10 bg-white/5">
                      <CardHeader className="py-3"><CardTitle className="flex items-center text-white text-sm"><domain.icon className="w-4 h-4 mr-2 text-brand-accent" />{title}</CardTitle></CardHeader>
                      <CardContent className="py-2">
                        <div className="text-xs text-slate-500 mb-2 flex gap-2"><span className="w-[90px]">Statut</span><span className="flex-1 min-w-[140px]">Compétence</span><span className="w-24">Maîtrise</span></div>
                        {formData.competencies[domain.key as keyof FormData["competencies"]].map((comp, idx) => (
                          <CompetencyRow key={comp.skillId} competency={comp} onUpdate={(f, v) => updateCompetency(domain.key as keyof FormData["competencies"], idx, f, v)} />
                        ))}
                      </CardContent>
                    </Card>
                  )
                })}
                <Card className="border-white/10 bg-white/5">
                  <CardHeader className="py-3"><CardTitle className="flex items-center text-white text-sm"><FileText className="w-4 h-4 mr-2 text-brand-accent" />Questions ouvertes</CardTitle></CardHeader>
                  <CardContent className="space-y-4 py-2">
                    <div><Label className="text-slate-200 block mb-2">2 chapitres compris + 2 chapitres mécaniques/flous</Label><Textarea value={formData.openQuestions.algebraUnderstanding} onChange={e => updateOpenQ("algebraUnderstanding", e.target.value)} className="bg-white/5 border-white/10" placeholder="Ex: Je comprends vraiment les suites arithmétiques et le second degré. Par contre, la trigonométrie et les dérivées composées restent mécaniques..." /></div>
                    <div><Label className="text-slate-200 block mb-2">Savez-vous démontrer (u·v)&apos; = u&apos;v + uv&apos; ?</Label><Select value={formData.openQuestions.canDemonstrateProductRule} onValueChange={v => updateOpenQ("canDemonstrateProductRule", v)}><SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="..." /></SelectTrigger><SelectContent><SelectItem value="yes">Oui</SelectItem><SelectItem value="partially">Partiellement</SelectItem><SelectItem value="no">Non</SelectItem><SelectItem value="not_seen">Non vu</SelectItem></SelectContent></Select></div>
                    <div><Label className="text-slate-200 block mb-2">Quel point est le plus difficile en analyse ?</Label><Textarea value={formData.openQuestions.hardestAnalysisChapter} onChange={e => updateOpenQ("hardestAnalysisChapter", e.target.value)} className="bg-white/5 border-white/10" placeholder="Ex: L'optimisation, je ne sais jamais quand utiliser la dérivée..." /></div>
                    <div><Label className="text-slate-200 block mb-2">Exercice mixte PS + analytique + optimisation déjà résolu ?</Label><Select value={formData.openQuestions.geometryMixedExercise} onValueChange={v => updateOpenQ("geometryMixedExercise", v)}><SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="..." /></SelectTrigger><SelectContent><SelectItem value="yes_alone">Oui seul</SelectItem><SelectItem value="yes_with_help">Avec aide</SelectItem><SelectItem value="no">Non</SelectItem><SelectItem value="not_seen">Non vu</SelectItem></SelectContent></Select></div>
                    <div><Label className="text-slate-200 block mb-2">Expliquez la différence entre P_A(B) et P_B(A) + exemple</Label><Textarea value={formData.openQuestions.probabilityQuestion} onChange={e => updateOpenQ("probabilityQuestion", e.target.value)} className="bg-white/5 border-white/10" placeholder="Ex: P_A(B) c'est la probabilité de B sachant que A est réalisé..." /></div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {currentStep === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-white/10 bg-white/5">
                  <CardHeader><CardTitle className="flex items-center text-white"><BookOpen className="w-5 h-5 mr-2 text-brand-accent" />Anticipation Terminale (Facultatif)</CardTitle></CardHeader>
                  <CardContent>
                    {formData.competencies.terminalAnticipation.map((comp, idx) => (
                      <CompetencyRow key={comp.skillId} competency={comp} onUpdate={(f, v) => updateCompetency("terminalAnticipation", idx, f, v)} />
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {currentStep === 5 && (
              <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-white/10 bg-white/5">
                  <CardHeader><CardTitle className="flex items-center text-white"><AlertTriangle className="w-5 h-5 mr-2 text-brand-accent" />Épreuve anticipée 2026</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-200"><strong>Rappel :</strong> {isMaths ? (isTerminale ? '4h avec calculatrice • 20 pts (5-7 exercices)' : '2h sans calculatrice • 6 pts automatismes + 14 pts exercices') : (isTerminale ? '3h30 écrit + épreuve pratique 1h' : 'Contrôle continu + épreuves communes')}</div>
                    <div className="grid grid-cols-3 gap-4">
                      <div><Label className="text-slate-300">Score /6</Label><Input type="number" min={0} max={6} value={formData.examPrep.miniTest.score} onChange={e => updateExamPrep("miniTest", "score", parseInt(e.target.value) || 0)} className="bg-white/5 border-white/10" /></div>
                      <div><Label className="text-slate-300">Temps (min)</Label><Input type="number" value={formData.examPrep.miniTest.timeUsedMinutes} onChange={e => updateExamPrep("miniTest", "timeUsedMinutes", parseInt(e.target.value) || 0)} className="bg-white/5 border-white/10" /></div>
                      <div className="flex items-center gap-2 pt-6"><Checkbox checked={formData.examPrep.miniTest.completedInTime === true} onCheckedChange={c => updateExamPrep("miniTest", "completedInTime", c)} /><Label className="text-slate-300">Terminé ?</Label></div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[{ k: "speedNoCalc", l: "Rapidité" }, { k: "calcReliability", l: "Fiabilité" }, { k: "redaction", l: "Rédaction" }, { k: "justifications", l: "Justifs" }, { k: "stress", l: "Stress" }].map(item => (
                        <div key={item.k}><Label className="text-slate-300 text-xs">{item.l}</Label><div className="mt-1"><LevelSelector value={formData.examPrep.selfRatings[item.k as keyof typeof formData.examPrep.selfRatings]} onChange={v => updateExamPrep("selfRatings", item.k, v)} /></div></div>
                      ))}
                    </div>
                    <div><Label className="text-slate-200">Items difficiles</Label><div className="flex gap-2 mt-1">{[1, 2, 3, 4, 5, 6].map(n => <div key={n} className="flex items-center gap-1"><Checkbox checked={formData.examPrep.signals.hardestItems.includes(n)} onCheckedChange={c => updateExamPrep("signals", "hardestItems", c ? [...formData.examPrep.signals.hardestItems, n] : formData.examPrep.signals.hardestItems.filter(x => x !== n))} /><Label>{n}</Label></div>)}</div></div>
                    <div><Label className="text-slate-200">Erreur dominante</Label><Select value={formData.examPrep.signals.dominantErrorType} onValueChange={v => updateExamPrep("signals", "dominantErrorType", v)}><SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{ERROR_LABELS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-slate-200">Ressenti</Label><Select value={formData.examPrep.signals.feeling} onValueChange={v => updateExamPrep("signals", "feeling", v)}><SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{FEELINGS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-slate-200">Avez-vous travaillé sur des sujets zéro ?</Label><Select value={formData.examPrep.zeroSubjects} onValueChange={v => updateExamPrep("root", "zeroSubjects", v)}><SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue placeholder="..." /></SelectTrigger><SelectContent><SelectItem value="yes_multiple">Oui, plusieurs</SelectItem><SelectItem value="yes_one">Oui, un</SelectItem><SelectItem value="no">Non</SelectItem><SelectItem value="dont_know">Je ne connais pas</SelectItem></SelectContent></Select></div>
                    <div><Label className="text-slate-200">Risque principal</Label><Textarea value={formData.examPrep.mainRisk} onChange={e => updateExamPrep("root", "mainRisk", e.target.value)} className="bg-white/5 border-white/10" placeholder="Votre risque principal pour l'épreuve..." /></div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {currentStep === 6 && (
              <motion.div key="s6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-white/10 bg-white/5">
                  <CardHeader><CardTitle className="flex items-center text-white"><BrainCircuit className="w-5 h-5 mr-2 text-brand-accent" />Méthodologie</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-slate-200">Compréhension</Label><Select value={formData.methodology.learningStyle} onValueChange={v => updateMethod("learningStyle", v)}><SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{LEARNING_STYLES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label className="text-slate-200">Blocage</Label><Select value={formData.methodology.problemReflex} onValueChange={v => updateMethod("problemReflex", v)}><SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{PROBLEM_REFLUX.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-slate-200">Travail hebdo</Label><Input value={formData.methodology.weeklyWork} onChange={e => updateMethod("weeklyWork", e.target.value)} className="bg-white/5 border-white/10 mt-1" placeholder="3h" /></div>
                      <div><Label className="text-slate-200">Concentration</Label><Select value={formData.methodology.maxConcentration} onValueChange={v => updateMethod("maxConcentration", v)}><SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30min">30 min</SelectItem><SelectItem value="1h">1h</SelectItem><SelectItem value="1h30">1h30</SelectItem><SelectItem value="2h">2h</SelectItem><SelectItem value="3h+">3h+</SelectItem></SelectContent></Select></div>
                    </div>
                    <div><Label className="text-slate-200">Erreurs fréquentes</Label><div className="flex flex-wrap gap-2 mt-1">{ERROR_LABELS.map(e => (<div key={e.value} className="flex items-center gap-1"><Checkbox checked={formData.methodology.errorTypes.includes(e.value)} onCheckedChange={c => updateMethod("errorTypes", c ? [...formData.methodology.errorTypes, e.value] : formData.methodology.errorTypes.filter(x => x !== e.value))} /><Label className="text-xs">{e.label}</Label></div>))}</div></div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {currentStep === 7 && (
              <motion.div key="s7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-white/10 bg-white/5">
                  <CardHeader><CardTitle className="flex items-center text-white"><Lightbulb className="w-5 h-5 mr-2 text-brand-accent" />Ambition</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-slate-200">Mention</Label><Select value={formData.ambition.targetMention} onValueChange={v => updateAmb("targetMention", v)}><SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{TARGET_MENTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label className="text-slate-200">Post-Bac</Label><Select value={formData.ambition.postBac} onValueChange={v => updateAmb("postBac", v)}><SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue placeholder="..." /></SelectTrigger><SelectContent>{POSTBAC.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div><Label className="text-slate-200">Rythme Pallier 2</Label><div className="flex gap-4 mt-1">{[{ v: "yes", l: "Oui" }, { v: "yes_but_irregular", l: "Oui mais" }, { v: "no", l: "Non" }, { v: "to_discuss", l: "À voir" }].map(o => (<div key={o.v} className="flex items-center gap-1"><Checkbox checked={formData.ambition.pallier2Pace === o.v} onCheckedChange={() => updateAmb("pallier2Pace", o.v)} /><Label>{o.l}</Label></div>))}</div></div>
                    <div><Label className="text-slate-200">À améliorer</Label><Textarea value={formData.freeText.mustImprove} onChange={e => updateFree("mustImprove", e.target.value)} className="bg-white/5 border-white/10 mt-1" /></div>
                    <div><Label className="text-slate-200">Difficultés invisibles</Label><Textarea value={formData.freeText.invisibleDifficulties} onChange={e => updateFree("invisibleDifficulties", e.target.value)} className="bg-white/5 border-white/10 mt-1" /></div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>Précédent</Button>
            {currentStep < effectiveTotalSteps ? <Button onClick={nextStep} className="bg-brand-accent">Suivant</Button> : <Button onClick={onSubmit} disabled={isSubmitting} className="bg-green-600">{isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi...</> : <><CheckCircle className="w-4 h-4 mr-2" />Soumettre</>}</Button>}
          </div>
        </div>
      </main>
      <CorporateFooter />
    </div>
  );
}
