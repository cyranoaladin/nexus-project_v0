"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Loader2,
  Search,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

interface DiagnosticSummary {
  id: string;
  type: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  status: string;
  mathAverage: string | null;
  establishment?: string;
  createdAt: string;
  data?: {
    scoring?: {
      readinessScore: number;
      riskIndex: number;
      recommendation: string;
      recommendationMessage: string;
    };
  };
}

const STATUS_CFG: Record<string, { label: string; text: string; bg: string; border: string; icon: React.ReactNode }> = {
  ANALYZED: { label: "Analysé", text: "text-semantic-success", bg: "bg-semantic-success/15", border: "border-semantic-success/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  SCORED:   { label: "Scoré",   text: "text-semantic-warning", bg: "bg-semantic-warning/15", border: "border-semantic-warning/30", icon: <Clock className="w-3.5 h-3.5" /> },
  PENDING:  { label: "En attente", text: "text-neutral-300", bg: "bg-neutral-500/15", border: "border-neutral-500/30", icon: <Clock className="w-3.5 h-3.5" /> },
};

const RECO_CFG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  Pallier2_confirmed:   { label: "P2 Confirmé",     text: "text-semantic-success", bg: "bg-semantic-success/12", border: "border-semantic-success/25" },
  Pallier2_conditional: { label: "P2 Conditionnel", text: "text-semantic-warning", bg: "bg-semantic-warning/12", border: "border-semantic-warning/25" },
  Pallier1_recommended: { label: "P1 Recommandé",   text: "text-semantic-error",   bg: "bg-semantic-error/12",   border: "border-semantic-error/25" },
};

function sColor(score: number, invert = false): string {
  if (invert) return score <= 40 ? "text-semantic-success" : score <= 60 ? "text-semantic-warning" : "text-semantic-error";
  return score >= 70 ? "text-semantic-success" : score >= 50 ? "text-semantic-warning" : "text-semantic-error";
}

/**
 * Dashboard Gestionnaire Nexus — Liste de tous les diagnostics avec scoring.
 */
export default function DiagnosticsDashboardPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterReco, setFilterReco] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/bilan-pallier2-maths");
        if (!res.ok) { setError("Erreur de chargement."); return; }
        const json = await res.json();
        setDiagnostics(json.diagnostics || []);
      } catch { setError("Impossible de contacter le serveur."); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = diagnostics.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || `${d.studentFirstName} ${d.studentLastName} ${d.studentEmail} ${d.establishment || ""}`.toLowerCase().includes(q);
    const matchesFilter = filterReco === "all" || d.data?.scoring?.recommendation === filterReco;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: diagnostics.length,
    analyzed: diagnostics.filter((d) => d.status === "ANALYZED").length,
    p2Confirmed: diagnostics.filter((d) => d.data?.scoring?.recommendation === "Pallier2_confirmed").length,
    p2Conditional: diagnostics.filter((d) => d.data?.scoring?.recommendation === "Pallier2_conditional").length,
    p1Recommended: diagnostics.filter((d) => d.data?.scoring?.recommendation === "Pallier1_recommended").length,
    avgReadiness: diagnostics.length > 0
      ? Math.round(diagnostics.reduce((sum, d) => sum + (d.data?.scoring?.readinessScore || 0), 0) / diagnostics.length)
      : 0,
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mx-auto mb-4" />
        <p className="text-neutral-200 text-lg">Chargement des diagnostics…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center p-4">
      <div className="bg-surface-card border border-white/10 rounded-[18px] max-w-md p-8 text-center">
        <AlertTriangle className="w-14 h-14 text-semantic-error mx-auto mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Erreur</h2>
        <p className="text-neutral-200">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-darker">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[14px] bg-brand-accent/15 border border-brand-accent/25 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-brand-accent" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white font-display">Tableau de Bord</h1>
              <p className="text-neutral-300 text-sm">Diagnostics pré-stage — Nexus Réussite</p>
            </div>
          </div>
          <Link href="/bilan-pallier2-maths" className="btn-outline-strong gap-2">
            <GraduationCap className="w-4 h-4" /> Formulaire
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard icon={<Users className="w-4 h-4 text-brand-accent" />} label="Total élèves" value={stats.total} />
          <StatCard icon={<CheckCircle2 className="w-4 h-4 text-semantic-success" />} label="Analysés" value={stats.analyzed} color="text-semantic-success" />
          <StatCard icon={<TrendingUp className="w-4 h-4 text-semantic-success" />} label="P2 Confirmé" value={stats.p2Confirmed} color="text-semantic-success" />
          <StatCard icon={<AlertTriangle className="w-4 h-4 text-semantic-warning" />} label="P2 Conditionnel" value={stats.p2Conditional} color="text-semantic-warning" />
          <StatCard icon={<Shield className="w-4 h-4 text-semantic-error" />} label="P1 Recommandé" value={stats.p1Recommended} color="text-semantic-error" />
          <StatCard icon={<BarChart3 className="w-4 h-4 text-brand-accent" />} label="Moy. Readiness" value={stats.avgReadiness} suffix="/100" />
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Rechercher un élève par nom ou email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-elevated border border-white/[0.1] rounded-[10px] text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: "Tous", icon: <Users className="w-3 h-3" /> },
              { key: "Pallier2_confirmed", label: "P2 Confirmé", icon: <CheckCircle2 className="w-3 h-3" /> },
              { key: "Pallier2_conditional", label: "P2 Conditionnel", icon: <AlertTriangle className="w-3 h-3" /> },
              { key: "Pallier1_recommended", label: "P1 Recommandé", icon: <Shield className="w-3 h-3" /> },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterReco(f.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-semibold border transition-all ${
                  filterReco === f.key
                    ? "bg-brand-accent/15 border-brand-accent/30 text-brand-accent"
                    : "bg-surface-card border-white/[0.08] text-neutral-400 hover:text-neutral-100 hover:border-white/[0.15]"
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-neutral-400 text-sm mb-4 font-mono">
          {filtered.length} diagnostic{filtered.length !== 1 ? "s" : ""} trouvé{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-surface-card border border-white/[0.08] rounded-[18px] p-12 text-center">
            <Search className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-300">Aucun diagnostic trouvé.</p>
          </div>
        ) : (
          <div className="bg-surface-card border border-white/[0.08] rounded-[18px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-surface-elevated">
                    <th className="text-left text-neutral-400 font-medium px-5 py-3.5 text-[10px] uppercase tracking-[0.14em] font-mono">Élève</th>
                    <th className="text-center text-neutral-400 font-medium px-4 py-3.5 text-[10px] uppercase tracking-[0.14em] font-mono">Statut</th>
                    <th className="text-center text-neutral-400 font-medium px-4 py-3.5 text-[10px] uppercase tracking-[0.14em] font-mono">Readiness</th>
                    <th className="text-center text-neutral-400 font-medium px-4 py-3.5 text-[10px] uppercase tracking-[0.14em] font-mono">Risque</th>
                    <th className="text-center text-neutral-400 font-medium px-4 py-3.5 text-[10px] uppercase tracking-[0.14em] font-mono">Recommandation</th>
                    <th className="text-center text-neutral-400 font-medium px-4 py-3.5 text-[10px] uppercase tracking-[0.14em] font-mono">Moy. Maths</th>
                    <th className="text-center text-neutral-400 font-medium px-4 py-3.5 text-[10px] uppercase tracking-[0.14em] font-mono">Date</th>
                    <th className="text-center text-neutral-400 font-medium px-4 py-3.5 text-[10px] uppercase tracking-[0.14em] font-mono">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const sc = d.data?.scoring;
                    const statusCfg = STATUS_CFG[d.status] || STATUS_CFG.PENDING;
                    const recoCfg = sc ? RECO_CFG[sc.recommendation] : null;
                    return (
                      <tr key={d.id} className="border-b border-white/[0.04] hover:bg-surface-hover transition-colors group">
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-white font-semibold text-sm">{d.studentFirstName} {d.studentLastName}</p>
                            <p className="text-neutral-400 text-xs font-mono">{d.studentEmail}</p>
                            {d.establishment && <p className="text-neutral-500 text-[10px] mt-0.5">{d.establishment}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
                            {statusCfg.icon}{statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {sc ? <span className={`font-bold text-sm font-mono ${sColor(sc.readinessScore)}`}>{sc.readinessScore}</span> : <span className="text-neutral-600">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {sc ? <span className={`font-bold text-sm font-mono ${sColor(sc.riskIndex, true)}`}>{sc.riskIndex}</span> : <span className="text-neutral-600">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {recoCfg ? (
                            <span className={`inline-flex text-[10px] px-2 py-1 rounded-full border font-semibold ${recoCfg.bg} ${recoCfg.border} ${recoCfg.text}`}>{recoCfg.label}</span>
                          ) : <span className="text-neutral-600">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center text-neutral-200 text-sm font-mono">{d.mathAverage || "—"}</td>
                        <td className="px-4 py-4 text-center text-neutral-300 text-xs font-mono">
                          {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Link
                            href={`/bilan-pallier2-maths/resultat/${d.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-brand-accent/10 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent/20 text-xs font-semibold transition-all opacity-70 group-hover:opacity-100"
                          >
                            Voir <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, suffix }: { icon: React.ReactNode; label: string; value: number; color?: string; suffix?: string }) {
  return (
    <div className="bg-surface-card border border-white/[0.08] rounded-[14px] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <p className="text-neutral-400 text-[10px] uppercase tracking-[0.14em] font-mono">{label}</p>
      </div>
      <p className={`text-2xl font-bold font-display ${color || "text-white"}`}>
        {value}{suffix && <span className="text-sm text-neutral-500 font-mono">{suffix}</span>}
      </p>
    </div>
  );
}
