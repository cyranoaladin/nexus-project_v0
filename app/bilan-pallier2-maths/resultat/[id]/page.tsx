"use client";

import { useEffect, useState } from "react";
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
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquareQuote,
  Shield,
  Target,
  TrendingUp,
  Users,
  Building2,
  Zap,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface DomainScore {
  domain: string;
  score: number;
  evaluatedCount: number;
  totalCount: number;
  gaps: string[];
  dominantErrors: string[];
  priority: string;
}

interface ScoringData {
  readinessScore: number;
  riskIndex: number;
  recommendation: string;
  recommendationMessage: string;
  domainScores: DomainScore[];
  alerts: Array<{ type: string; code: string; message: string }>;
  dataQuality: { activeDomains: number; evaluatedCompetencies: number; lowConfidence: boolean };
}

interface DiagnosticResult {
  id: string;
  type: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  studentPhone?: string;
  establishment?: string;
  mathAverage: string | null;
  classRanking?: string;
  status: string;
  data: {
    version: string;
    scoring?: ScoringData;
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
  actionPlan: string | null;
  createdAt: string;
}

interface ParsedBilans {
  eleve: string;
  parents: string;
  nexus: string;
  generatedAt?: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const DOMAIN_LABELS: Record<string, string> = {
  algebra: "Algèbre",
  analysis: "Analyse",
  geometry: "Géométrie",
  probabilities: "Probabilités",
  python: "Python / Algo",
};

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "Haute", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
  medium: { label: "Moyenne", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
  low: { label: "Basse", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
};

const RATING_LABELS: Record<string, string> = {
  speedNoCalc: "Rapidité",
  calcReliability: "Fiabilité calculs",
  redaction: "Rédaction",
  justifications: "Justifications",
  stress: "Stress",
};

const VERBATIM_LABELS: Record<string, string> = {
  algebraUnderstanding: "Compréhension algèbre",
  canDemonstrateProductRule: "Démo (u·v')",
  probabilityQuestion: "Probabilités",
  hardestAnalysisChapter: "Difficulté analyse",
  geometryMixedExercise: "Exercice mixte géo",
  mustImprove: "Doit améliorer",
  invisibleDifficulties: "Difficultés invisibles",
  message: "Message libre",
};

function sColor(score: number, invert = false): string {
  if (invert) return score <= 40 ? "text-green-400" : score <= 60 ? "text-yellow-400" : "text-red-400";
  return score >= 70 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
}

function barBg(score: number): string {
  return score >= 70 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */

export default function BilanResultatPage() {
  const params = useParams();
  const id = params.id as string;
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [bilans, setBilans] = useState<ParsedBilans | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bilan-pallier2-maths?id=${id}`);
        if (!res.ok) { setError(res.status === 404 ? "Diagnostic non trouvé." : "Erreur de chargement."); return; }
        const json = await res.json();
        setDiagnostic(json.diagnostic);
        if (json.diagnostic.analysisResult) {
          try { setBilans(JSON.parse(json.diagnostic.analysisResult)); } catch { /* ignore */ }
        }
      } catch { setError("Impossible de contacter le serveur."); }
      finally { setLoading(false); }
    }
    if (id) load();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-4" />
        <p className="text-slate-300 text-lg">Chargement du bilan…</p>
      </div>
    </div>
  );

  if (error || !diagnostic) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="bg-slate-800/60 border-red-500/40 max-w-md backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Erreur</h2>
          <p className="text-slate-200">{error || "Diagnostic introuvable."}</p>
          <Link href="/bilan-pallier2-maths" className="inline-flex items-center gap-2 mt-6 text-blue-400 hover:text-blue-300 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour au formulaire
          </Link>
        </CardContent>
      </Card>
    </div>
  );

  const scoring = diagnostic.data?.scoring;
  const isAnalyzed = diagnostic.status === "ANALYZED" && bilans;
  const isPending = diagnostic.status === "SCORED" || diagnostic.status === "PENDING";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">

        <Link href="/bilan-pallier2-maths" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour au formulaire
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 border-blue-400/40 bg-blue-500/10 text-blue-300 px-4 py-1 text-xs tracking-wider uppercase">
            Bilan Diagnostic Pré-Stage
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {diagnostic.studentFirstName} {diagnostic.studentLastName}
          </h1>
          <p className="text-slate-400 text-sm">
            {diagnostic.establishment && <span>{diagnostic.establishment} · </span>}
            Soumis le{" "}
            {new Date(diagnostic.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>

        {/* Scoring Cards */}
        {scoring && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <ScoreCard icon={<Target className="w-4 h-4" />} label="Préparation" value={scoring.readinessScore} max={100} />
            <ScoreCard icon={<Shield className="w-4 h-4" />} label="Risque" value={scoring.riskIndex} max={100} invert />
            <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
              <CardContent className="p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-slate-400" />
                  <p className="text-slate-400 text-xs uppercase tracking-wide">Décision</p>
                </div>
                <Badge variant="outline" className={`text-sm mt-1 ${
                  scoring.recommendation === "Pallier2_confirmed" ? "bg-green-500/20 text-green-300 border-green-500/40" :
                  scoring.recommendation === "Pallier2_conditional" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" :
                  "bg-red-500/20 text-red-300 border-red-500/40"
                }`}>
                  {scoring.recommendation === "Pallier2_confirmed" ? "Pallier 2 confirmé" :
                   scoring.recommendation === "Pallier2_conditional" ? "Pallier 2 conditionnel" : "Pallier 1 recommandé"}
                </Badge>
                <p className="text-slate-400 text-xs mt-2">{scoring.recommendationMessage}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts */}
        {scoring && scoring.alerts.length > 0 && (
          <div className="mb-8 space-y-2">
            {scoring.alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3.5 rounded-lg border ${
                a.type === "danger" ? "bg-red-500/10 border-red-500/30" :
                a.type === "warning" ? "bg-yellow-500/10 border-yellow-500/30" :
                "bg-blue-500/10 border-blue-500/30"
              }`}>
                {a.type === "danger" ? <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-400" /> :
                 a.type === "warning" ? <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-yellow-400" /> :
                 <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-blue-400" />}
                <p className="text-white text-sm">{a.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Domain Progress */}
        {scoring && scoring.domainScores.length > 0 && (
          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" /> Cartographie par domaine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {scoring.domainScores.map((d) => (
                  <div key={d.domain}>
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{DOMAIN_LABELS[d.domain] || d.domain}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_CFG[d.priority]?.bg || ""}`}>
                          <span className={PRIORITY_CFG[d.priority]?.color || "text-slate-400"}>{PRIORITY_CFG[d.priority]?.label || d.priority}</span>
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs">{d.evaluatedCount}/{d.totalCount}</span>
                        <span className={`text-sm font-bold ${sColor(d.score)}`}>{d.score}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700/60 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all duration-500 ${barBg(d.score)}`} style={{ width: `${Math.max(d.score, 3)}%` }} />
                    </div>
                    {(d.gaps.length > 0 || d.dominantErrors.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {d.gaps.map((g) => <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">lacune: {g}</span>)}
                        {d.dominantErrors.map((e) => <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/20">{e}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bilans Tabs */}
        {isAnalyzed && bilans ? (
          <Tabs defaultValue="eleve" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800/60 border border-slate-700/50 mb-6 p-1 h-auto">
              <TabsTrigger value="eleve" className="flex items-center gap-2 py-2.5 text-slate-400 data-[state=active]:bg-blue-600/20 data-[state=active]:text-white rounded-md transition-all">
                <GraduationCap className="w-4 h-4" /><span className="text-sm font-medium">Élève</span>
              </TabsTrigger>
              <TabsTrigger value="parents" className="flex items-center gap-2 py-2.5 text-slate-400 data-[state=active]:bg-blue-600/20 data-[state=active]:text-white rounded-md transition-all">
                <Users className="w-4 h-4" /><span className="text-sm font-medium">Parents</span>
              </TabsTrigger>
              <TabsTrigger value="nexus" className="flex items-center gap-2 py-2.5 text-slate-400 data-[state=active]:bg-blue-600/20 data-[state=active]:text-white rounded-md transition-all">
                <Building2 className="w-4 h-4" /><span className="text-sm font-medium">Nexus</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="eleve">
              <BilanCard icon={<GraduationCap className="w-5 h-5 text-blue-400" />} title="Mon Diagnostic Maths" html={markdownToHtml(bilans.eleve)} />
            </TabsContent>
            <TabsContent value="parents">
              <BilanCard icon={<Users className="w-5 h-5 text-blue-400" />} title="Rapport de Positionnement" html={markdownToHtml(bilans.parents)} />
            </TabsContent>
            <TabsContent value="nexus">
              <NexusTab diagnostic={diagnostic} scoring={scoring ?? null} />
            </TabsContent>
          </Tabs>
        ) : isPending ? (
          <Card className="bg-slate-800/60 border-yellow-500/30 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <Clock className="w-14 h-14 text-yellow-400 mx-auto mb-4 animate-pulse" />
              <h2 className="text-white text-xl font-bold mb-2">Bilan en cours de génération</h2>
              <p className="text-slate-300 mb-4">Le bilan détaillé est en cours de génération par notre IA.</p>
              <p className="text-slate-500 text-sm">Rafraîchissez cette page dans quelques instants.</p>
              {scoring && (
                <div className="mt-6 p-4 bg-slate-700/40 rounded-lg inline-block">
                  <p className="text-slate-200 text-sm">
                    <CheckCircle2 className="w-4 h-4 inline mr-1 text-green-400" />
                    Score : <strong className="text-white">{scoring.readinessScore}/100</strong> — {scoring.recommendationMessage}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-14 h-14 text-slate-500 mx-auto mb-4" />
              <h2 className="text-white text-xl font-bold mb-2">Bilan non disponible</h2>
              <p className="text-slate-300">Statut : <Badge variant="outline" className="ml-1 text-slate-300">{diagnostic.status}</Badge></p>
            </CardContent>
          </Card>
        )}

        {bilans?.generatedAt && (
          <p className="text-center text-slate-600 text-xs mt-8">
            Bilan généré le {new Date(bilans.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────────── */

function ScoreCard({ icon, label, value, max, invert }: { icon: React.ReactNode; label: string; value: number; max: number; invert?: boolean }) {
  return (
    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
      <CardContent className="p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-slate-400">{icon}</span>
          <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
        </div>
        <p className={`text-4xl font-bold ${sColor(value, invert)}`}>
          {value}<span className="text-lg text-slate-500">/{max}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function BilanCard({ icon, title, html }: { icon: React.ReactNode; title: string; html: string }) {
  return (
    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-700/50">
        <CardTitle className="text-white flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="bilan-content" dangerouslySetInnerHTML={{ __html: html }} />
      </CardContent>
    </Card>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-700/40 rounded-lg">
      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-white text-sm font-medium truncate">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  );
}

function VerbatimBlock({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${accent ? "bg-blue-500/5 border-blue-500/20" : "bg-slate-700/30 border-slate-700/40"}`}>
      <p className={`text-xs uppercase tracking-wider mb-2 font-medium ${accent ? "text-blue-400" : "text-slate-500"}`}>{label}</p>
      <p className="text-slate-200 text-sm italic leading-relaxed">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

/* ─── Nexus Tab — Rich structured fiche pédagogique ─────────────────────────── */

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
      <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
        <CardHeader className="border-b border-slate-700/50 pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Fiche Pédagogique — {diagnostic.studentFirstName} {diagnostic.studentLastName}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCell label="Établissement" value={diagnostic.establishment || "—"} />
            <InfoCell label="Moyenne Maths" value={diagnostic.mathAverage || "—"} />
            <InfoCell label="Classement" value={diagnostic.classRanking || performance?.classRanking || "—"} />
            <InfoCell label="Email" value={diagnostic.studentEmail} />
          </div>
        </CardContent>
      </Card>

      {/* Scores */}
      {scoring && (
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-700/50 pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <BarChart3 className="w-5 h-5 text-blue-400" /> Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-700/40 rounded-lg">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">ReadinessScore</p>
                <p className={`text-xl font-bold ${sColor(scoring.readinessScore)}`}>{scoring.readinessScore}/100</p>
              </div>
              <div className="p-3 bg-slate-700/40 rounded-lg">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">RiskIndex</p>
                <p className={`text-xl font-bold ${sColor(scoring.riskIndex, true)}`}>{scoring.riskIndex}/100</p>
              </div>
              <div className="p-3 bg-slate-700/40 rounded-lg">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Recommandation</p>
                <Badge variant="outline" className={`text-xs ${
                  scoring.recommendation === "Pallier2_confirmed" ? "text-green-300 border-green-500/40" :
                  scoring.recommendation === "Pallier2_conditional" ? "text-yellow-300 border-yellow-500/40" :
                  "text-red-300 border-red-500/40"
                }`}>{scoring.recommendation.replace(/_/g, " ")}</Badge>
              </div>
              <div className="p-3 bg-slate-700/40 rounded-lg">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Qualité données</p>
                <p className="text-white text-sm font-medium">{scoring.dataQuality.activeDomains}/5 domaines · {scoring.dataQuality.evaluatedCompetencies} comp.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain Table */}
      {scoring && scoring.domainScores.length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-slate-700/50 pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <TrendingUp className="w-5 h-5 text-blue-400" /> Cartographie par domaine
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/80">
                    <th className="text-left text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Domaine</th>
                    <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Score</th>
                    <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Évalués</th>
                    <th className="text-left text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Lacunes</th>
                    <th className="text-left text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Erreurs</th>
                    <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Priorité</th>
                  </tr>
                </thead>
                <tbody>
                  {scoring.domainScores.map((d) => (
                    <tr key={d.domain} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{DOMAIN_LABELS[d.domain] || d.domain}</td>
                      <td className="px-4 py-3 text-center"><span className={`font-bold ${sColor(d.score)}`}>{d.score}%</span></td>
                      <td className="px-4 py-3 text-center text-slate-300">{d.evaluatedCount}/{d.totalCount}</td>
                      <td className="px-4 py-3">
                        {d.gaps.length > 0 ? <div className="flex flex-wrap gap-1">{d.gaps.map((g) => <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">{g}</span>)}</div> : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {d.dominantErrors.length > 0 ? <div className="flex flex-wrap gap-1">{d.dominantErrors.map((e) => <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/20">{e}</span>)}</div> : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_CFG[d.priority]?.bg || ""}`}>
                          <span className={PRIORITY_CFG[d.priority]?.color || "text-slate-400"}>{PRIORITY_CFG[d.priority]?.label || d.priority}</span>
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Épreuve Anticipée */}
      {examPrep && (
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-700/50 pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <FileText className="w-5 h-5 text-blue-400" /> Épreuve Anticipée
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {examPrep.miniTest && (
                <div className="p-3 bg-slate-700/40 rounded-lg">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Mini-test</p>
                  <p className={`text-lg font-bold ${sColor((examPrep.miniTest.score / 6) * 100)}`}>{examPrep.miniTest.score}/6</p>
                  <p className="text-slate-500 text-[10px]">{examPrep.miniTest.timeUsedMinutes}min · {examPrep.miniTest.completedInTime ? "terminé" : "non terminé"}</p>
                </div>
              )}
              {examPrep.selfRatings && Object.entries(examPrep.selfRatings).map(([key, val]) => (
                <div key={key} className="p-3 bg-slate-700/40 rounded-lg">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">{RATING_LABELS[key] || key}</p>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className={`w-5 h-5 rounded-sm text-[10px] flex items-center justify-center font-bold ${
                        n <= val
                          ? key === "stress" ? "bg-red-500/30 text-red-300" : val >= 3 ? "bg-green-500/30 text-green-300" : "bg-yellow-500/30 text-yellow-300"
                          : "bg-slate-700 text-slate-600"
                      }`}>{n}</div>
                    ))}
                    <span className={`text-sm font-bold ml-1 ${key === "stress" ? sColor(100 - (val / 4) * 100) : sColor((val / 4) * 100)}`}>{val}/4</span>
                  </div>
                </div>
              ))}
              {examPrep.signals && (
                <>
                  <div className="p-3 bg-slate-700/40 rounded-lg">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Ressenti</p>
                    <p className="text-white text-sm font-medium capitalize">{String(examPrep.signals.feeling || "—")}</p>
                  </div>
                  <div className="p-3 bg-slate-700/40 rounded-lg">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Erreur dominante</p>
                    <p className="text-white text-sm font-medium capitalize">{String(examPrep.signals.dominantErrorType || "—")}</p>
                  </div>
                </>
              )}
            </div>
            {examPrep.mainRisk && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-300 text-sm"><AlertTriangle className="w-4 h-4 inline mr-1.5" /><strong>Risque principal :</strong> {examPrep.mainRisk}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Méthodologie + Ambition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {methodology && (
          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-700/50 pb-4">
              <CardTitle className="text-white flex items-center gap-2 text-base"><Brain className="w-5 h-5 text-blue-400" /> Profil Cognitif</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <InfoRow label="Style" value={methodology.learningStyle || "—"} />
              <InfoRow label="Réflexe blocage" value={methodology.problemReflex || "—"} />
              <InfoRow label="Travail hebdo" value={methodology.weeklyWork || "—"} />
              <InfoRow label="Concentration max" value={methodology.maxConcentration || "—"} />
              {methodology.errorTypes && (
                <div>
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5">Erreurs fréquentes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {String(methodology.errorTypes).split(",").map((e) => (
                      <span key={e.trim()} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20">{e.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {ambition && (
          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-700/50 pb-4">
              <CardTitle className="text-white flex items-center gap-2 text-base"><Target className="w-5 h-5 text-blue-400" /> Ambition</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <InfoRow label="Mention visée" value={ambition.targetMention || "—"} />
              <InfoRow label="Post-bac" value={ambition.postBac || "—"} />
              <InfoRow label="Rythme intensif" value={ambition.pallier2Pace || "—"} />
              {performance && <>
                <InfoRow label="Moyenne générale" value={performance.generalAverage || "—"} />
                <InfoRow label="Dernier DS" value={performance.lastTestScore || "—"} />
              </>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Verbatims */}
      {(openQuestions || freeText) && (
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-700/50 pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <MessageSquareQuote className="w-5 h-5 text-blue-400" /> Verbatims de l&apos;élève
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {openQuestions && Object.entries(openQuestions).filter(([, v]) => v).map(([k, v]) => (
              <VerbatimBlock key={k} label={VERBATIM_LABELS[k] || k} text={v} />
            ))}
            {freeText && Object.entries(freeText).filter(([, v]) => v).map(([k, v]) => (
              <VerbatimBlock key={k} label={VERBATIM_LABELS[k] || k} text={v} accent />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {scoring && scoring.alerts.length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-700/50 pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5 text-yellow-400" /> Alertes ({scoring.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-2">
            {scoring.alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                a.type === "danger" ? "bg-red-500/10 border-red-500/30" :
                a.type === "warning" ? "bg-yellow-500/10 border-yellow-500/30" :
                "bg-blue-500/10 border-blue-500/30"
              }`}>
                {a.type === "danger" ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" /> :
                 <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-400" />}
                <div>
                  <span className={`text-[10px] uppercase tracking-wider font-medium ${a.type === "danger" ? "text-red-400" : "text-yellow-400"}`}>{a.code}</span>
                  <p className="text-white text-sm">{a.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Markdown → HTML ───────────────────────────────────────────────────────── */

function markdownToHtml(md: string): string {
  if (!md) return '<p class="text-slate-300">Contenu non disponible.</p>';

  let html = md
    // Tables
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return "___TABLE_SEP___";
      return `<tr>${cells.map((c) => `<td class="px-3 py-2 border-b border-slate-700/40 text-slate-200 text-sm">${c}</td>`).join("")}</tr>`;
    })
    .replace(/((<tr>.*<\/tr>\n?)+)/g, (block) => {
      const rows = block.split("\n").filter((r) => r.startsWith("<tr>"));
      if (rows.length === 0) return block;
      const headerRow = rows[0].replace(/<td /g, '<th ').replace(/<\/td>/g, "</th>").replace(/text-slate-200/g, "text-slate-400 font-medium");
      const bodyRows = rows.slice(1).filter((r) => !r.includes("___TABLE_SEP___"));
      return `<div class="overflow-x-auto my-4 rounded-lg border border-slate-700/40"><table class="w-full text-sm"><thead class="bg-slate-800/80">${headerRow}</thead><tbody>${bodyRows.join("")}</tbody></table></div>`;
    })
    .replace(/___TABLE_SEP___/g, "");

  html = html
    .replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold text-white mt-5 mb-2">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-2 flex items-center gap-2"><span class="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3 pb-2 border-b border-slate-700/40">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="text-slate-200 ml-6 list-decimal leading-relaxed">$1</li>')
    .replace(/^\*\s+(.+)$/gm, '<li class="text-slate-200 ml-6 list-disc leading-relaxed">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="text-slate-200 ml-6 list-disc leading-relaxed">$1</li>')
    .replace(/((<li class="text-slate-200 ml-6 list-disc[^"]*">.*<\/li>\n?)+)/g, '<ul class="space-y-1.5 my-3">$1</ul>')
    .replace(/((<li class="text-slate-200 ml-6 list-decimal[^"]*">.*<\/li>\n?)+)/g, '<ol class="space-y-1.5 my-3">$1</ol>')
    .replace(/\n\n/g, '</p><p class="text-slate-200 leading-relaxed my-2">')
    .replace(/^(?!<[hultod])/gm, "")
    .replace(/<p class="text-slate-200 leading-relaxed my-2"><\/p>/g, "");

  return html;
}
