"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquareQuote,
  Shield,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  Users,
  Building2,
  Zap,
  Flame,
  Lightbulb,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface DomainScore {
  domain: string;
  score: number;
  evaluatedCount: number;
  totalCount: number;
  notStudiedCount?: number;
  unknownCount?: number;
  gaps: string[];
  dominantErrors: string[];
  priority: string;
}

interface PriorityItem {
  skillLabel: string;
  domain: string;
  reason: string;
  impact: string;
  exerciseType?: string;
}

interface ScoringData {
  readinessScore: number;
  riskIndex: number;
  masteryIndex?: number;
  coverageIndex?: number;
  examReadinessIndex?: number;
  recommendation: string;
  recommendationMessage: string;
  justification?: string;
  upgradeConditions?: string[];
  domainScores: DomainScore[];
  alerts: Array<{ type: string; code: string; message: string; impact?: string }>;
  dataQuality: { activeDomains: number; evaluatedCompetencies: number; lowConfidence: boolean; quality?: string };
  trustScore?: number;
  trustLevel?: 'green' | 'orange' | 'red';
  topPriorities?: PriorityItem[];
  quickWins?: PriorityItem[];
  highRisk?: PriorityItem[];
  inconsistencies?: Array<{ code: string; message: string; fields: string[]; severity: string }>;
  coverageProgramme?: { seenChapterRatio: number; evaluatedSkillRatio: number; totalChapters: number; seenChapters: number; inProgressChapters: number };
}

interface DiagnosticResult {
  id: string;
  publicShareId?: string;
  type: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail?: string;
  studentPhone?: string;
  establishment?: string;
  mathAverage: string | null;
  classRanking?: string;
  status: string;
  data: {
    version: string;
    scoring?: ScoringData;
    scoringV2?: ScoringData;
    examPrep?: {
      miniTest?: { score: number; timeUsedMinutes: number; completedInTime: boolean };
      selfRatings?: Record<string, number>;
      signals?: Record<string, unknown>;
      mainRisk?: string;
    };
    methodology?: Record<string, string>;
    ambition?: Record<string, string>;
    performance?: Record<string, string>;
    openQuestions?: Record<string, string>;
    freeText?: Record<string, string>;
  };
  analysisResult: string | null;
  studentMarkdown?: string | null;
  parentsMarkdown?: string | null;
  nexusMarkdown?: string | null;
  actionPlan: string | null;
  createdAt: string;
}

interface ParsedBilans {
  eleve: string;
  parents: string;
  nexus: string;
  generatedAt?: string;
}

/* ─── Design tokens ─────────────────────────────────────────────────────────── */

const DOMAIN_LABELS: Record<string, string> = {
  algebra: "Algèbre",
  analysis: "Analyse",
  geometry: "Géométrie",
  probabilities: "Probabilités",
  python: "Python / Algo",
};

const DOMAIN_ICONS: Record<string, string> = {
  algebra: "x²",
  analysis: "∫",
  geometry: "△",
  probabilities: "P",
  python: "</>",
};

const PRIORITY_CFG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  critical: { label: "Critique", text: "text-semantic-error",   bg: "bg-semantic-error/20", border: "border-semantic-error/40" },
  high:     { label: "Haute",    text: "text-semantic-error",   bg: "bg-semantic-error/15", border: "border-semantic-error/30" },
  medium:   { label: "Moyenne",  text: "text-semantic-warning", bg: "bg-semantic-warning/15", border: "border-semantic-warning/30" },
  low:      { label: "Basse",    text: "text-semantic-success", bg: "bg-semantic-success/15", border: "border-semantic-success/30" },
};

const RATING_LABELS: Record<string, string> = {
  speedNoCalc: "Rapidité sans calculatrice",
  calcReliability: "Fiabilité des calculs",
  redaction: "Qualité de rédaction",
  justifications: "Justifications",
  stress: "Niveau de stress",
};

const VERBATIM_LABELS: Record<string, string> = {
  algebraUnderstanding: "Compréhension algèbre",
  canDemonstrateProductRule: "Démonstration (u·v')",
  probabilityQuestion: "Probabilités",
  hardestAnalysisChapter: "Difficulté en analyse",
  geometryMixedExercise: "Exercice mixte géométrie",
  mustImprove: "Ce que je dois améliorer",
  invisibleDifficulties: "Difficultés invisibles",
  message: "Message libre",
};

/**
 * Returns a Tailwind text color class based on score thresholds.
 */
function scoreTextColor(score: number, invert = false): string {
  if (invert) return score <= 40 ? "text-semantic-success" : score <= 60 ? "text-semantic-warning" : "text-semantic-error";
  return score >= 70 ? "text-semantic-success" : score >= 50 ? "text-semantic-warning" : "text-semantic-error";
}

/**
 * Returns a Tailwind bg color class for progress bars.
 */
function barBgColor(score: number): string {
  return score >= 70 ? "bg-semantic-success" : score >= 50 ? "bg-semantic-warning" : "bg-semantic-error";
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */

export default function BilanResultatPage() {
  const params = useParams();
  const id = params.id as string;
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [bilans, setBilans] = useState<ParsedBilans | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDiagnostic = useCallback(async () => {
    try {
      let res = await fetch(`/api/bilan-pallier2-maths?share=${id}`);
      if (!res.ok) {
        res = await fetch(`/api/bilan-pallier2-maths?id=${id}`);
      }
      if (!res.ok) { setError(res.status === 404 ? "Diagnostic non trouvé." : res.status === 401 ? "Accès non autorisé." : "Erreur de chargement."); return; }
      const json = await res.json();
      const diag = json.diagnostic;
      setDiagnostic(diag);

      if (diag.studentMarkdown || diag.parentsMarkdown || diag.nexusMarkdown) {
        setBilans({
          eleve: diag.studentMarkdown || '',
          parents: diag.parentsMarkdown || '',
          nexus: diag.nexusMarkdown || '',
        });
      } else if (diag.analysisResult) {
        try { setBilans(JSON.parse(diag.analysisResult)); } catch { /* ignore */ }
      }

      // Stop polling if terminal status
      if (['ANALYZED', 'FAILED', 'SCORE_ONLY'].includes(diag.status) && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch { setError("Impossible de contacter le serveur."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    if (id) fetchDiagnostic();
  }, [id, fetchDiagnostic]);

  // Auto-poll every 10s for pending statuses
  useEffect(() => {
    if (!diagnostic) return;
    const isPendingStatus = ['RECEIVED', 'VALIDATED', 'SCORED', 'GENERATING', 'PENDING'].includes(diagnostic.status);
    if (isPendingStatus && !pollingRef.current) {
      pollingRef.current = setInterval(() => { fetchDiagnostic(); }, 10000);
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [diagnostic?.status, fetchDiagnostic]);

  /* Loading */
  if (loading) return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mx-auto mb-4" />
        <p className="text-neutral-200 text-lg">Chargement du bilan…</p>
      </div>
    </div>
  );

  /* Error */
  if (error || !diagnostic) return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center p-4">
      <div className="bg-surface-card border border-white/10 rounded-[18px] max-w-md p-8 text-center">
        <AlertCircle className="w-14 h-14 text-semantic-error mx-auto mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Erreur</h2>
        <p className="text-neutral-200">{error || "Diagnostic introuvable."}</p>
        <Link href="/bilan-pallier2-maths" className="inline-flex items-center gap-2 mt-6 text-brand-accent hover:text-brand-accent-dark text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour au formulaire
        </Link>
      </div>
    </div>
  );

  const scoring = diagnostic.data?.scoringV2 || diagnostic.data?.scoring;
  const isAnalyzed = diagnostic.status === "ANALYZED" && bilans;
  const isPending = ["RECEIVED", "VALIDATED", "SCORED", "GENERATING", "PENDING"].includes(diagnostic.status);
  const isFailed = diagnostic.status === "FAILED" || diagnostic.status === "SCORE_ONLY";

  return (
    <div className="min-h-screen bg-surface-darker">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">

        {/* Back */}
        <Link href="/bilan-pallier2-maths" className="inline-flex items-center gap-2 text-neutral-400 hover:text-brand-accent text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour au formulaire
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] border border-brand-accent/30 bg-brand-accent/10 text-brand-accent mb-4">
            <BookOpen className="w-3.5 h-3.5" /> Bilan Diagnostic Pré-Stage
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 font-display">
            {diagnostic.studentFirstName} {diagnostic.studentLastName}
          </h1>
          <p className="text-neutral-300 text-sm">
            {diagnostic.establishment && <span className="text-neutral-200">{diagnostic.establishment}</span>}
            {diagnostic.establishment && " · "}
            Soumis le{" "}
            {new Date(diagnostic.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>

        {/* ── Scoring Cards ── */}
        {scoring && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface-card border border-white/[0.08] rounded-[18px] p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Target className="w-4 h-4 text-brand-accent" />
                <p className="text-neutral-400 text-xs uppercase tracking-wider font-mono">Préparation</p>
              </div>
              <p className={`text-4xl font-bold font-display ${scoreTextColor(scoring.readinessScore)}`}>
                {scoring.readinessScore}<span className="text-lg text-neutral-500">/100</span>
              </p>
            </div>
            <div className="bg-surface-card border border-white/[0.08] rounded-[18px] p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-brand-accent" />
                <p className="text-neutral-400 text-xs uppercase tracking-wider font-mono">Risque</p>
              </div>
              <p className={`text-4xl font-bold font-display ${scoreTextColor(scoring.riskIndex, true)}`}>
                {scoring.riskIndex}<span className="text-lg text-neutral-500">/100</span>
              </p>
            </div>
            <div className="bg-surface-card border border-white/[0.08] rounded-[18px] p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-brand-accent" />
                <p className="text-neutral-400 text-xs uppercase tracking-wider font-mono">Décision</p>
              </div>
              <Badge
                variant="outline"
                className={`text-sm mt-1 ${
                  scoring.recommendation === "Pallier2_confirmed"
                    ? "bg-semantic-success/15 text-semantic-success border-semantic-success/30"
                    : scoring.recommendation === "Pallier2_conditional"
                      ? "bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30"
                      : "bg-semantic-error/15 text-semantic-error border-semantic-error/30"
                }`}
              >
                {scoring.recommendation === "Pallier2_confirmed" ? "Pallier 2 confirmé" :
                 scoring.recommendation === "Pallier2_conditional" ? "Pallier 2 conditionnel" : "Pallier 1 recommandé"}
              </Badge>
              <p className="text-neutral-300 text-xs mt-2">{scoring.recommendationMessage}</p>
            </div>
          </div>
        )}

        {/* ── TrustScore Badge ── */}
        {scoring && scoring.trustScore !== undefined && (
          <div className="mb-8">
            <div className={`flex items-center gap-4 p-4 rounded-[14px] border ${
              scoring.trustLevel === 'green' ? 'bg-semantic-success/10 border-semantic-success/25' :
              scoring.trustLevel === 'orange' ? 'bg-semantic-warning/10 border-semantic-warning/25' :
              'bg-semantic-error/10 border-semantic-error/25'
            }`}>
              <ShieldCheck className={`w-6 h-6 shrink-0 ${
                scoring.trustLevel === 'green' ? 'text-semantic-success' :
                scoring.trustLevel === 'orange' ? 'text-semantic-warning' :
                'text-semantic-error'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-semibold">Fiabilité du bilan</p>
                  <span className={`text-xs font-bold font-mono ${
                    scoring.trustLevel === 'green' ? 'text-semantic-success' :
                    scoring.trustLevel === 'orange' ? 'text-semantic-warning' :
                    'text-semantic-error'
                  }`}>{scoring.trustScore}/100</span>
                </div>
                <p className="text-neutral-300 text-xs mt-0.5">
                  {scoring.trustLevel === 'green' ? 'Conclusions solides — données complètes et cohérentes' :
                   scoring.trustLevel === 'orange' ? 'Conclusions probables — certaines données manquantes ou incohérentes' :
                   'Données insuffisantes — bilan partiel, à confirmer en séance'}
                </p>
              </div>
              <div className="w-16 h-2 bg-surface-elevated rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  scoring.trustLevel === 'green' ? 'bg-semantic-success' :
                  scoring.trustLevel === 'orange' ? 'bg-semantic-warning' :
                  'bg-semantic-error'
                }`} style={{ width: `${scoring.trustScore}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Coverage Programme ── */}
        {scoring && scoring.coverageProgramme && (
          <div className="mb-8">
            <div className="flex items-center gap-4 p-4 rounded-[14px] border bg-surface-card border-white/[0.08]">
              <BookOpen className="w-6 h-6 shrink-0 text-brand-accent" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-semibold">Couverture du programme</p>
                  <span className={`text-xs font-bold font-mono ${
                    scoring.coverageProgramme.seenChapterRatio >= 0.7 ? 'text-semantic-success' :
                    scoring.coverageProgramme.seenChapterRatio >= 0.4 ? 'text-semantic-warning' :
                    'text-semantic-error'
                  }`}>{Math.round(scoring.coverageProgramme.seenChapterRatio * 100)}%</span>
                </div>
                <p className="text-neutral-300 text-xs mt-0.5">
                  {scoring.coverageProgramme.seenChapters} chapitres vus + {scoring.coverageProgramme.inProgressChapters} en cours sur {scoring.coverageProgramme.totalChapters} au programme
                </p>
              </div>
              <div className="w-24 h-2 bg-surface-elevated rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  scoring.coverageProgramme.seenChapterRatio >= 0.7 ? 'bg-semantic-success' :
                  scoring.coverageProgramme.seenChapterRatio >= 0.4 ? 'bg-semantic-warning' :
                  'bg-semantic-error'
                }`} style={{ width: `${Math.round(scoring.coverageProgramme.seenChapterRatio * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── V2 Scoring Indices (if available) ── */}
        {scoring && scoring.masteryIndex !== undefined && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <div className="bg-surface-card border border-white/[0.08] rounded-[14px] p-4">
              <p className="text-neutral-400 text-[10px] uppercase tracking-wider font-mono mb-1">Maîtrise</p>
              <p className={`text-2xl font-bold font-display ${scoreTextColor(scoring.masteryIndex)}`}>
                {scoring.masteryIndex}<span className="text-sm text-neutral-500">/100</span>
              </p>
            </div>
            <div className="bg-surface-card border border-white/[0.08] rounded-[14px] p-4">
              <p className="text-neutral-400 text-[10px] uppercase tracking-wider font-mono mb-1">Couverture programme</p>
              <p className={`text-2xl font-bold font-display ${scoreTextColor(scoring.coverageIndex ?? 0)}`}>
                {scoring.coverageIndex}<span className="text-sm text-neutral-500">/100</span>
              </p>
            </div>
            <div className="bg-surface-card border border-white/[0.08] rounded-[14px] p-4">
              <p className="text-neutral-400 text-[10px] uppercase tracking-wider font-mono mb-1">Préparation épreuve</p>
              <p className={`text-2xl font-bold font-display ${scoreTextColor(scoring.examReadinessIndex ?? 0)}`}>
                {scoring.examReadinessIndex}<span className="text-sm text-neutral-500">/100</span>
              </p>
            </div>
          </div>
        )}

        {/* ── Computed Priorities ── */}
        {scoring && ((scoring.topPriorities && scoring.topPriorities.length > 0) || (scoring.quickWins && scoring.quickWins.length > 0) || (scoring.highRisk && scoring.highRisk.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* High Risk */}
            {scoring.highRisk && scoring.highRisk.length > 0 && (
              <div className="bg-surface-card border border-semantic-error/20 rounded-[18px] overflow-hidden">
                <div className="px-5 py-3 border-b border-semantic-error/15 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-semantic-error" />
                  <h4 className="text-semantic-error text-sm font-bold">Points bloquants</h4>
                </div>
                <div className="p-4 space-y-3">
                  {scoring.highRisk.map((p, i) => (
                    <div key={i} className="p-3 bg-semantic-error/5 rounded-[10px] border border-semantic-error/10">
                      <p className="text-white text-sm font-semibold">{p.skillLabel}</p>
                      <p className="text-neutral-300 text-xs mt-1">{p.reason}</p>
                      {p.exerciseType && <p className="text-semantic-error text-[10px] mt-1 font-mono">→ {p.exerciseType}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Top Priorities */}
            {scoring.topPriorities && scoring.topPriorities.length > 0 && (
              <div className="bg-surface-card border border-semantic-warning/20 rounded-[18px] overflow-hidden">
                <div className="px-5 py-3 border-b border-semantic-warning/15 flex items-center gap-2">
                  <Target className="w-4 h-4 text-semantic-warning" />
                  <h4 className="text-semantic-warning text-sm font-bold">Priorités</h4>
                </div>
                <div className="p-4 space-y-3">
                  {scoring.topPriorities.map((p, i) => (
                    <div key={i} className="p-3 bg-semantic-warning/5 rounded-[10px] border border-semantic-warning/10">
                      <p className="text-white text-sm font-semibold">{p.skillLabel}</p>
                      <p className="text-neutral-300 text-xs mt-1">{p.reason}</p>
                      {p.exerciseType && <p className="text-semantic-warning text-[10px] mt-1 font-mono">→ {p.exerciseType}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Quick Wins */}
            {scoring.quickWins && scoring.quickWins.length > 0 && (
              <div className="bg-surface-card border border-semantic-success/20 rounded-[18px] overflow-hidden">
                <div className="px-5 py-3 border-b border-semantic-success/15 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-semantic-success" />
                  <h4 className="text-semantic-success text-sm font-bold">Gains rapides</h4>
                </div>
                <div className="p-4 space-y-3">
                  {scoring.quickWins.map((p, i) => (
                    <div key={i} className="p-3 bg-semantic-success/5 rounded-[10px] border border-semantic-success/10">
                      <p className="text-white text-sm font-semibold">{p.skillLabel}</p>
                      <p className="text-neutral-300 text-xs mt-1">{p.reason}</p>
                      {p.exerciseType && <p className="text-semantic-success text-[10px] mt-1 font-mono">→ {p.exerciseType}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Alerts ── */}
        {scoring && scoring.alerts.length > 0 && (
          <div className="mb-8 space-y-2">
            {scoring.alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-[14px] border ${
                a.type === "danger"  ? "bg-semantic-error/10 border-semantic-error/25" :
                a.type === "warning" ? "bg-semantic-warning/10 border-semantic-warning/25" :
                "bg-semantic-info/10 border-semantic-info/25"
              }`}>
                {a.type === "danger"  ? <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-semantic-error" /> :
                 a.type === "warning" ? <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-semantic-warning" /> :
                 <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-semantic-info" />}
                <p className="text-neutral-100 text-sm">{a.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Domain Progress ── */}
        {scoring && scoring.domainScores.length > 0 && (
          <div className="bg-surface-card border border-white/[0.08] rounded-[18px] mb-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-accent" />
              <h3 className="text-white text-lg font-bold">Cartographie par domaine</h3>
            </div>
            <div className="p-6 space-y-6">
              {scoring.domainScores.map((d) => {
                const pCfg = PRIORITY_CFG[d.priority] || PRIORITY_CFG.medium;
                return (
                  <div key={d.domain}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-[10px] bg-surface-elevated border border-white/[0.08] flex items-center justify-center text-brand-accent text-xs font-mono font-bold">
                          {DOMAIN_ICONS[d.domain] || "?"}
                        </span>
                        <span className="text-white text-sm font-semibold">{DOMAIN_LABELS[d.domain] || d.domain}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${pCfg.bg} ${pCfg.border} ${pCfg.text} font-medium uppercase tracking-wider`}>
                          {pCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-400 text-xs font-mono">{d.evaluatedCount}/{d.totalCount}</span>
                        <span className={`text-sm font-bold font-mono ${scoreTextColor(d.score)}`}>{d.score}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-surface-elevated rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all duration-700 ${barBgColor(d.score)}`} style={{ width: `${Math.max(d.score, 3)}%` }} />
                    </div>
                    {(d.gaps.length > 0 || d.dominantErrors.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {d.gaps.map((g) => (
                          <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-semantic-error/10 text-semantic-error border border-semantic-error/20 font-medium">
                            lacune : {g}
                          </span>
                        ))}
                        {d.dominantErrors.map((e) => (
                          <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20 font-medium">
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Bilans Tabs ── */}
        {isAnalyzed && bilans ? (
          <Tabs defaultValue="eleve" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-surface-card border border-white/[0.08] rounded-[14px] mb-6 p-1.5 h-auto">
              <TabsTrigger value="eleve" className="flex items-center gap-2 py-3 rounded-[10px] text-neutral-400 data-[state=active]:bg-brand-accent/15 data-[state=active]:text-brand-accent transition-all">
                <GraduationCap className="w-4 h-4" /><span className="text-sm font-semibold">Élève</span>
              </TabsTrigger>
              <TabsTrigger value="parents" className="flex items-center gap-2 py-3 rounded-[10px] text-neutral-400 data-[state=active]:bg-brand-accent/15 data-[state=active]:text-brand-accent transition-all">
                <Users className="w-4 h-4" /><span className="text-sm font-semibold">Parents</span>
              </TabsTrigger>
              <TabsTrigger value="nexus" className="flex items-center gap-2 py-3 rounded-[10px] text-neutral-400 data-[state=active]:bg-brand-accent/15 data-[state=active]:text-brand-accent transition-all">
                <Building2 className="w-4 h-4" /><span className="text-sm font-semibold">Nexus</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="eleve">
              <BilanCard icon={<GraduationCap className="w-5 h-5 text-brand-accent" />} title="Mon Diagnostic Maths" html={markdownToHtml(bilans.eleve)} />
            </TabsContent>
            <TabsContent value="parents">
              <BilanCard icon={<Users className="w-5 h-5 text-brand-accent" />} title="Rapport de Positionnement" html={markdownToHtml(bilans.parents)} />
            </TabsContent>
            <TabsContent value="nexus">
              <NexusTab diagnostic={diagnostic} scoring={scoring ?? null} />
            </TabsContent>
          </Tabs>
        ) : isPending ? (
          <div className="bg-surface-card border border-semantic-warning/25 rounded-[18px] p-8 text-center">
            <Clock className="w-14 h-14 text-semantic-warning mx-auto mb-4 animate-pulse" />
            <h2 className="text-white text-xl font-bold mb-2">Bilan en cours de génération</h2>
            <p className="text-neutral-200 mb-4">Le bilan détaillé est en cours de génération par notre IA.</p>
            <p className="text-neutral-400 text-sm">Cette page se met à jour automatiquement toutes les 10 secondes.</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-semantic-warning" />
              <span className="text-semantic-warning text-xs font-mono uppercase tracking-wider">{diagnostic.status}</span>
            </div>
            {scoring && (
              <div className="mt-6 p-4 bg-surface-elevated rounded-[14px] inline-block border border-white/[0.08]">
                <p className="text-neutral-100 text-sm">
                  <CheckCircle2 className="w-4 h-4 inline mr-1.5 text-semantic-success" />
                  Score : <strong className="text-white">{scoring.readinessScore}/100</strong> — {scoring.recommendationMessage}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-surface-card border border-white/[0.08] rounded-[18px] p-8 text-center">
            <AlertCircle className="w-14 h-14 text-neutral-500 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2">Bilan non disponible</h2>
            <p className="text-neutral-200">Statut : <Badge variant="outline" className="ml-1 text-neutral-200">{diagnostic.status}</Badge></p>
          </div>
        )}

        {/* Footer */}
        {bilans?.generatedAt && (
          <p className="text-center text-neutral-500 text-xs mt-8 font-mono">
            Généré le {new Date(bilans.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────────── */

function BilanCard({ icon, title, html }: { icon: React.ReactNode; title: string; html: string }) {
  return (
    <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
      <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
        {icon}
        <h3 className="text-white text-lg font-bold">{title}</h3>
      </div>
      <div className="p-6">
        <div className="bilan-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

function InfoCell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon && <span className="text-brand-accent">{icon}</span>}
        <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono">{label}</p>
      </div>
      <p className="text-white text-sm font-medium truncate">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-neutral-300 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right font-medium">{value}</span>
    </div>
  );
}

function VerbatimBlock({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-[14px] border ${accent ? "bg-brand-accent/5 border-brand-accent/15" : "bg-surface-elevated border-white/[0.06]"}`}>
      <p className={`text-[10px] uppercase tracking-[0.14em] mb-2 font-mono font-semibold ${accent ? "text-brand-accent" : "text-neutral-400"}`}>{label}</p>
      <p className="text-neutral-100 text-sm italic leading-relaxed">&laquo; {text} &raquo;</p>
    </div>
  );
}

/* ─── Nexus Tab ─────────────────────────────────────────────────────────────── */

function NexusTab({ diagnostic, scoring }: { diagnostic: DiagnosticResult; scoring: ScoringData | null }) {
  const examPrep = diagnostic.data?.examPrep;
  const methodology = diagnostic.data?.methodology;
  const ambition = diagnostic.data?.ambition;
  const performance = diagnostic.data?.performance;
  const openQuestions = diagnostic.data?.openQuestions;
  const freeText = diagnostic.data?.freeText;

  return (
    <div className="space-y-6">

      {/* Identity */}
      <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-brand-accent" />
          <h3 className="text-white text-lg font-bold">Fiche Pédagogique — {diagnostic.studentFirstName} {diagnostic.studentLastName}</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCell icon={<Building2 className="w-3 h-3" />} label="Établissement" value={diagnostic.establishment || "—"} />
            <InfoCell icon={<BarChart3 className="w-3 h-3" />} label="Moyenne Maths" value={diagnostic.mathAverage || "—"} />
            <InfoCell icon={<TrendingUp className="w-3 h-3" />} label="Classement" value={diagnostic.classRanking || performance?.classRanking || "—"} />
            <InfoCell icon={<Users className="w-3 h-3" />} label="Email" value={diagnostic.studentEmail || "—"} />
          </div>
        </div>
      </div>

      {/* Scores */}
      {scoring && (
        <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-accent" />
            <h3 className="text-white text-base font-bold">Scores</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
                <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-1">ReadinessScore</p>
                <p className={`text-xl font-bold font-display ${scoreTextColor(scoring.readinessScore)}`}>{scoring.readinessScore}/100</p>
              </div>
              <div className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
                <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-1">RiskIndex</p>
                <p className={`text-xl font-bold font-display ${scoreTextColor(scoring.riskIndex, true)}`}>{scoring.riskIndex}/100</p>
              </div>
              <div className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
                <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-1">Recommandation</p>
                <Badge variant="outline" className={`text-xs mt-1 ${
                  scoring.recommendation === "Pallier2_confirmed" ? "text-semantic-success border-semantic-success/30" :
                  scoring.recommendation === "Pallier2_conditional" ? "text-semantic-warning border-semantic-warning/30" :
                  "text-semantic-error border-semantic-error/30"
                }`}>{scoring.recommendation.replace(/_/g, " ")}</Badge>
              </div>
              <div className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
                <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-1">Qualité données</p>
                <p className="text-white text-sm font-medium">{scoring.dataQuality.activeDomains}/5 domaines · {scoring.dataQuality.evaluatedCompetencies} comp.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Domain Table */}
      {scoring && scoring.domainScores.length > 0 && (
        <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-accent" />
            <h3 className="text-white text-base font-bold">Cartographie par domaine</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-surface-elevated">
                  <th className="text-left text-neutral-400 font-medium px-5 py-3 text-[10px] uppercase tracking-[0.14em] font-mono">Domaine</th>
                  <th className="text-center text-neutral-400 font-medium px-4 py-3 text-[10px] uppercase tracking-[0.14em] font-mono">Score</th>
                  <th className="text-center text-neutral-400 font-medium px-4 py-3 text-[10px] uppercase tracking-[0.14em] font-mono">Évalués</th>
                  <th className="text-left text-neutral-400 font-medium px-4 py-3 text-[10px] uppercase tracking-[0.14em] font-mono">Lacunes</th>
                  <th className="text-left text-neutral-400 font-medium px-4 py-3 text-[10px] uppercase tracking-[0.14em] font-mono">Erreurs</th>
                  <th className="text-center text-neutral-400 font-medium px-4 py-3 text-[10px] uppercase tracking-[0.14em] font-mono">Priorité</th>
                </tr>
              </thead>
              <tbody>
                {scoring.domainScores.map((d) => {
                  const pCfg = PRIORITY_CFG[d.priority] || PRIORITY_CFG.medium;
                  return (
                    <tr key={d.domain} className="border-b border-white/[0.04] hover:bg-surface-hover transition-colors">
                      <td className="px-5 py-3.5 text-white font-semibold">{DOMAIN_LABELS[d.domain] || d.domain}</td>
                      <td className="px-4 py-3.5 text-center"><span className={`font-bold font-mono ${scoreTextColor(d.score)}`}>{d.score}%</span></td>
                      <td className="px-4 py-3.5 text-center text-neutral-200 font-mono">{d.evaluatedCount}/{d.totalCount}</td>
                      <td className="px-4 py-3.5">
                        {d.gaps.length > 0 ? <div className="flex flex-wrap gap-1">{d.gaps.map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-semantic-error/10 text-semantic-error border border-semantic-error/20">{g}</span>)}</div> : <span className="text-neutral-500 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {d.dominantErrors.length > 0 ? <div className="flex flex-wrap gap-1">{d.dominantErrors.map((e) => <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20">{e}</span>)}</div> : <span className="text-neutral-500 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${pCfg.bg} ${pCfg.border} ${pCfg.text}`}>{pCfg.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Épreuve Anticipée */}
      {examPrep && (
        <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-accent" />
            <h3 className="text-white text-base font-bold">Épreuve Anticipée</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {examPrep.miniTest && (
                <div className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
                  <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-1">Mini-test</p>
                  <p className={`text-lg font-bold font-display ${scoreTextColor((examPrep.miniTest.score / 6) * 100)}`}>{examPrep.miniTest.score}/6</p>
                  <p className="text-neutral-400 text-[10px] font-mono">{examPrep.miniTest.timeUsedMinutes}min · {examPrep.miniTest.completedInTime ? "✓ terminé" : "✗ non terminé"}</p>
                </div>
              )}
              {examPrep.selfRatings && Object.entries(examPrep.selfRatings).map(([key, val]) => (
                <div key={key} className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
                  <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-2">{RATING_LABELS[key] || key}</p>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className={`w-6 h-6 rounded-[6px] text-[10px] flex items-center justify-center font-bold transition-colors ${
                        n <= val
                          ? key === "stress"
                            ? "bg-semantic-error/25 text-semantic-error border border-semantic-error/30"
                            : val >= 3
                              ? "bg-semantic-success/25 text-semantic-success border border-semantic-success/30"
                              : "bg-semantic-warning/25 text-semantic-warning border border-semantic-warning/30"
                          : "bg-surface-dark text-neutral-600 border border-white/[0.06]"
                      }`}>{n}</div>
                    ))}
                    <span className={`text-sm font-bold font-mono ml-1 ${key === "stress" ? scoreTextColor(100 - (val / 4) * 100) : scoreTextColor((val / 4) * 100)}`}>{val}/4</span>
                  </div>
                </div>
              ))}
              {examPrep.signals && (
                <>
                  <div className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
                    <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-1">Ressenti</p>
                    <p className="text-white text-sm font-medium capitalize">{String(examPrep.signals.feeling || "—")}</p>
                  </div>
                  <div className="p-4 bg-surface-elevated rounded-[14px] border border-white/[0.06]">
                    <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-1">Erreur dominante</p>
                    <p className="text-white text-sm font-medium capitalize">{String(examPrep.signals.dominantErrorType || "—")}</p>
                  </div>
                </>
              )}
            </div>
            {examPrep.mainRisk && (
              <div className="mt-4 p-4 bg-semantic-error/8 border border-semantic-error/20 rounded-[14px]">
                <p className="text-semantic-error text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  <strong>Risque principal :</strong> <span className="text-neutral-100 font-normal">{examPrep.mainRisk}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Méthodologie + Ambition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {methodology && (
          <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-accent" />
              <h3 className="text-white text-base font-bold">Profil Cognitif</h3>
            </div>
            <div className="p-6 space-y-1">
              <InfoRow label="Style d'apprentissage" value={methodology.learningStyle || "—"} />
              <InfoRow label="Réflexe blocage" value={methodology.problemReflex || "—"} />
              <InfoRow label="Travail hebdomadaire" value={methodology.weeklyWork || "—"} />
              <InfoRow label="Concentration max" value={methodology.maxConcentration || "—"} />
              {methodology.errorTypes && (
                <div className="pt-3">
                  <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono mb-2">Erreurs fréquentes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {String(methodology.errorTypes).split(",").map((e) => (
                      <span key={e.trim()} className="text-[10px] px-2.5 py-1 rounded-full bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20 font-medium">
                        {e.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {ambition && (
          <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-accent" />
              <h3 className="text-white text-base font-bold">Ambition</h3>
            </div>
            <div className="p-6 space-y-1">
              <InfoRow label="Mention visée" value={ambition.targetMention || "—"} />
              <InfoRow label="Post-bac" value={ambition.postBac || "—"} />
              <InfoRow label="Rythme intensif" value={ambition.pallier2Pace || "—"} />
              {performance && <>
                <InfoRow label="Moyenne générale" value={performance.generalAverage || "—"} />
                <InfoRow label="Dernier DS" value={performance.lastTestScore || "—"} />
              </>}
            </div>
          </div>
        )}
      </div>

      {/* Verbatims */}
      {(openQuestions || freeText) && (
        <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
            <MessageSquareQuote className="w-5 h-5 text-brand-accent" />
            <h3 className="text-white text-base font-bold">Verbatims de l&apos;élève</h3>
          </div>
          <div className="p-6 space-y-4">
            {openQuestions && Object.entries(openQuestions).filter(([, v]) => v).map(([k, v]) => (
              <VerbatimBlock key={k} label={VERBATIM_LABELS[k] || k} text={v} />
            ))}
            {freeText && Object.entries(freeText).filter(([, v]) => v).map(([k, v]) => (
              <VerbatimBlock key={k} label={VERBATIM_LABELS[k] || k} text={v} accent />
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {scoring && scoring.alerts.length > 0 && (
        <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-semantic-warning" />
            <h3 className="text-white text-base font-bold">Alertes ({scoring.alerts.length})</h3>
          </div>
          <div className="p-6 space-y-2">
            {scoring.alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-[14px] border ${
                a.type === "danger"  ? "bg-semantic-error/8 border-semantic-error/20" :
                a.type === "warning" ? "bg-semantic-warning/8 border-semantic-warning/20" :
                "bg-semantic-info/8 border-semantic-info/20"
              }`}>
                {a.type === "danger" ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-semantic-error" /> :
                 <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-semantic-warning" />}
                <div>
                  <span className={`text-[10px] uppercase tracking-[0.14em] font-mono font-semibold ${a.type === "danger" ? "text-semantic-error" : "text-semantic-warning"}`}>{a.code}</span>
                  <p className="text-neutral-100 text-sm mt-0.5">{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Markdown → HTML ───────────────────────────────────────────────────────── */

function markdownToHtml(md: string): string {
  if (!md) return '<p class="text-neutral-200">Contenu non disponible.</p>';

  let html = md
    // Tables
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return "___TABLE_SEP___";
      return `<tr>${cells.map((c) => `<td class="px-4 py-2.5 border-b border-white/[0.06] text-neutral-100 text-sm">${c}</td>`).join("")}</tr>`;
    })
    .replace(/((<tr>.*<\/tr>\n?)+)/g, (block) => {
      const rows = block.split("\n").filter((r) => r.startsWith("<tr>"));
      if (rows.length === 0) return block;
      const headerRow = rows[0]
        .replace(/<td /g, '<th ')
        .replace(/<\/td>/g, "</th>")
        .replace(/text-neutral-100/g, "text-neutral-300 font-semibold");
      const bodyRows = rows.slice(1).filter((r) => !r.includes("___TABLE_SEP___"));
      return `<div class="overflow-x-auto my-5 rounded-[14px] border border-white/[0.08]"><table class="w-full text-sm"><thead class="bg-surface-elevated">${headerRow}</thead><tbody>${bodyRows.join("")}</tbody></table></div>`;
    })
    .replace(/___TABLE_SEP___/g, "");

  html = html
    .replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold text-white mt-5 mb-2">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-2 flex items-center gap-2"><span class="w-1 h-5 bg-brand-accent rounded-full inline-block"></span>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3 pb-2 border-b border-white/[0.08]">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-neutral-200">$1</em>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="text-neutral-100 ml-6 list-decimal leading-relaxed">$1</li>')
    .replace(/^\*\s+(.+)$/gm, '<li class="text-neutral-100 ml-6 list-disc leading-relaxed">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="text-neutral-100 ml-6 list-disc leading-relaxed">$1</li>')
    .replace(/((<li class="text-neutral-100 ml-6 list-disc[^"]*">.*<\/li>\n?)+)/g, '<ul class="space-y-1.5 my-3">$1</ul>')
    .replace(/((<li class="text-neutral-100 ml-6 list-decimal[^"]*">.*<\/li>\n?)+)/g, '<ol class="space-y-1.5 my-3">$1</ol>')
    .replace(/\n\n/g, '</p><p class="text-neutral-200 leading-relaxed my-2">')
    .replace(/^(?!<[hultod])/gm, "")
    .replace(/<p class="text-neutral-200 leading-relaxed my-2"><\/p>/g, "");

  return html;
}
