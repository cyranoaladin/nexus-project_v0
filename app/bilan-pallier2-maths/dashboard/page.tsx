"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ANALYZED: { label: "Analysé", color: "bg-green-500/20 text-green-300 border-green-500/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  SCORED: { label: "Scoré", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: <Clock className="w-3.5 h-3.5" /> },
  PENDING: { label: "En attente", color: "bg-slate-500/20 text-slate-300 border-slate-500/30", icon: <Clock className="w-3.5 h-3.5" /> },
};

const RECO_CONFIG: Record<string, { label: string; color: string; short: string }> = {
  Pallier2_confirmed: { label: "P2 Confirmé", color: "text-green-300 bg-green-500/15 border-green-500/25", short: "P2" },
  Pallier2_conditional: { label: "P2 Conditionnel", color: "text-yellow-300 bg-yellow-500/15 border-yellow-500/25", short: "P2?" },
  Pallier1_recommended: { label: "P1 Recommandé", color: "text-red-300 bg-red-500/15 border-red-500/25", short: "P1" },
};

function sColor(score: number, invert = false): string {
  if (invert) return score <= 40 ? "text-green-400" : score <= 60 ? "text-yellow-400" : "text-red-400";
  return score >= 70 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
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
    const matchesSearch = !q || `${d.studentFirstName} ${d.studentLastName} ${d.studentEmail}`.toLowerCase().includes(q);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-4" />
        <p className="text-slate-300 text-lg">Chargement des diagnostics…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="bg-slate-800/60 border-red-500/40 max-w-md backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Erreur</h2>
          <p className="text-slate-200">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Tableau de Bord Diagnostics</h1>
                <p className="text-slate-400 text-sm">Gestion des bilans pré-stage — Nexus Réussite</p>
              </div>
            </div>
          </div>
          <Link href="/bilan-pallier2-maths" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition-colors text-sm">
            <GraduationCap className="w-4 h-4" /> Formulaire
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard icon={<Users className="w-4 h-4 text-blue-400" />} label="Total" value={stats.total} />
          <StatCard icon={<CheckCircle2 className="w-4 h-4 text-green-400" />} label="Analysés" value={stats.analyzed} />
          <StatCard icon={<TrendingUp className="w-4 h-4 text-green-400" />} label="P2 Confirmé" value={stats.p2Confirmed} color="text-green-400" />
          <StatCard icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />} label="P2 Conditionnel" value={stats.p2Conditional} color="text-yellow-400" />
          <StatCard icon={<AlertTriangle className="w-4 h-4 text-red-400" />} label="P1 Recommandé" value={stats.p1Recommended} color="text-red-400" />
          <StatCard icon={<BarChart3 className="w-4 h-4 text-blue-400" />} label="Moy. Readiness" value={stats.avgReadiness} suffix="/100" />
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher un élève…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: "all", label: "Tous" },
              { key: "Pallier2_confirmed", label: "P2 Confirmé" },
              { key: "Pallier2_conditional", label: "P2 Conditionnel" },
              { key: "Pallier1_recommended", label: "P1 Recommandé" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterReco(f.key)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  filterReco === f.key
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                    : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-slate-500 text-sm mb-4">{filtered.length} diagnostic{filtered.length !== 1 ? "s" : ""} trouvé{filtered.length !== 1 ? "s" : ""}</p>

        {/* Diagnostics Table */}
        {filtered.length === 0 ? (
          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Aucun diagnostic trouvé.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/80">
                      <th className="text-left text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Élève</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Statut</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Readiness</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Risque</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Recommandation</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Moy. Maths</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Date</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const sc = d.data?.scoring;
                      const statusCfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDING;
                      const recoCfg = sc ? RECO_CONFIG[sc.recommendation] : null;
                      return (
                        <tr key={d.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors group">
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="text-white font-medium text-sm">{d.studentFirstName} {d.studentLastName}</p>
                              <p className="text-slate-500 text-xs">{d.studentEmail}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge variant="outline" className={`text-[10px] gap-1 ${statusCfg.color}`}>
                              {statusCfg.icon}{statusCfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {sc ? <span className={`font-bold text-sm ${sColor(sc.readinessScore)}`}>{sc.readinessScore}</span> : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {sc ? <span className={`font-bold text-sm ${sColor(sc.riskIndex, true)}`}>{sc.riskIndex}</span> : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {recoCfg ? (
                              <Badge variant="outline" className={`text-[10px] ${recoCfg.color}`}>{recoCfg.label}</Badge>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-300 text-sm">{d.mathAverage || "—"}</td>
                          <td className="px-4 py-3.5 text-center text-slate-400 text-xs">
                            {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Link
                              href={`/bilan-pallier2-maths/resultat/${d.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600/15 border border-blue-500/25 text-blue-300 hover:bg-blue-600/25 text-xs font-medium transition-all opacity-70 group-hover:opacity-100"
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, suffix }: { icon: React.ReactNode; label: string; value: number; color?: string; suffix?: string }) {
  return (
    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
        </div>
        <p className={`text-2xl font-bold ${color || "text-white"}`}>
          {value}{suffix && <span className="text-sm text-slate-500">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}
