/**
 * Dashboard Directeur — Vue Stratégique
 *
 * Protected: ADMIN role only.
 * Displays KPIs, SSN distribution, cohort progression, radar, and alerts.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, Users, BarChart3, TrendingUp, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MetricCard from '@/components/dashboard/MetricCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface KPIData {
  totalAssessments: number;
  completedAssessments: number;
  averageSSN: number | null;
  averageGlobalScore: number | null;
  activeStudents: number;
  stageConversionRate: number | null;
}

interface SSNDistribution {
  excellence: number;
  tres_solide: number;
  stable: number;
  fragile: number;
  prioritaire: number;
}

interface AlertEntry {
  studentName: string;
  studentEmail: string;
  ssn: number;
  subject: string;
  assessmentId: string;
}

interface DashboardData {
  success: boolean;
  kpis: KPIData;
  distribution: SSNDistribution;
  subjectAverages: { subject: string; avgSSN: number }[];
  alerts: AlertEntry[];
  monthlyProgression: { month: string; avgSSN: number; count: number }[];
}

// ─── Distribution chart data formatter ──────────────────────────────────────

function formatDistribution(dist: SSNDistribution) {
  return [
    { name: 'Prioritaire', value: dist.prioritaire, fill: '#ef4444' },
    { name: 'Fragile', value: dist.fragile, fill: '#f97316' },
    { name: 'Stable', value: dist.stable, fill: '#f59e0b' },
    { name: 'Très solide', value: dist.tres_solide, fill: '#3b82f6' },
    { name: 'Excellence', value: dist.excellence, fill: '#10b981' },
  ];
}

function formatSubjectLabel(subject: string): string {
  switch (subject) {
    case 'MATHS': return 'Maths';
    case 'NSI': return 'NSI';
    case 'GENERAL': return 'Général';
    default: return subject;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DirecteurDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/admin/directeur/stats');

        if (response.status === 403) {
          setError('Accès non autorisé. Rôle ADMIN requis.');
          return;
        }

        if (!response.ok) {
          throw new Error('Erreur lors du chargement des données');
        }

        const result: DashboardData = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-slate-400">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-bold">{error || 'Données indisponibles'}</h1>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Retour
          </Button>
        </div>
      </div>
    );
  }

  const { kpis, distribution, subjectAverages, alerts, monthlyProgression } = data;
  const isLowSample = kpis.completedAssessments < 30;
  const distData = formatDistribution(distribution);

  const radarData = subjectAverages.map((s) => ({
    subject: formatSubjectLabel(s.subject),
    score: s.avgSSN,
    fullMark: 100,
  }));

  return (
    <div className="min-h-screen py-8 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Tableau de Bord Directeur</h1>
          <p className="text-slate-400 mt-1">Vue stratégique — Pilotage Nexus 2.0</p>
        </div>

        {/* ─── Low Sample Warning ──────────────────────────────────────── */}
        {isLowSample && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-amber-300">Cohorte insuffisante</span>
              <span className="text-sm text-amber-400/80 ml-2">
                N={kpis.completedAssessments} (minimum recommandé : 30). Les métriques SSN, percentiles et distributions sont indicatives.
              </span>
            </div>
          </div>
        )}

        {/* ─── KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Bilans réalisés"
            value={kpis.completedAssessments}
            subtitle={`${kpis.totalAssessments} total`}
            icon={<BarChart3 className="w-5 h-5" />}
            variant="primary"
          />
          <MetricCard
            title="SSN Moyen"
            value={kpis.averageSSN !== null ? `${kpis.averageSSN}` : '—'}
            subtitle={isLowSample ? `⚠ Indicatif (N=${kpis.completedAssessments})` : 'Score Standardisé Nexus'}
            icon={<Target className="w-5 h-5" />}
            variant="success"
          />
          <MetricCard
            title="Élèves actifs"
            value={kpis.activeStudents}
            icon={<Users className="w-5 h-5" />}
            variant="default"
          />
          <MetricCard
            title="Conversion Stage"
            value={kpis.stageConversionRate !== null ? `${kpis.stageConversionRate}%` : '—'}
            subtitle="Réservations confirmées"
            icon={<TrendingUp className="w-5 h-5" />}
            variant="warning"
          />
        </div>

        {/* ─── Charts Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SSN Distribution Histogram */}
          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold mb-4">
              Distribution SSN
              {isLowSample && <span className="ml-2 text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">N&lt;30 — indicatif</span>}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {distData.map((entry, index) => (
                    <Bar key={index} dataKey="value" fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Progression */}
          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold mb-4">
              Progression Mensuelle SSN
              {isLowSample && <span className="ml-2 text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">N&lt;30 — indicatif</span>}
            </h3>
            {monthlyProgression.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyProgression}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgSSN"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    name="SSN Moyen"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-20">
                Données insuffisantes pour afficher la progression.
              </p>
            )}
          </div>
        </div>

        {/* ─── Radar + Alerts Row ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Global Cohorte */}
          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold mb-4">
              Radar Global Cohorte
              {isLowSample && <span className="ml-2 text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">N&lt;30 — indicatif</span>}
            </h3>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar
                    name="SSN Moyen"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-20">
                Aucune donnée SSN par discipline disponible.
              </p>
            )}
          </div>

          {/* Pedagogical Alerts */}
          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Alertes Pédagogiques
            </h3>
            {alerts.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.assessmentId}
                    className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20"
                  >
                    <div>
                      <div className="text-sm font-medium">{alert.studentName}</div>
                      <div className="text-xs text-slate-400">{alert.studentEmail} • {alert.subject}</div>
                    </div>
                    <div className="text-lg font-bold text-red-400">
                      {Math.round(alert.ssn)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-20">
                Aucune alerte — tous les élèves sont au-dessus du seuil prioritaire.
              </p>
            )}
          </div>
        </div>

        {/* ─── Actions ───────────────────────────────────────────────────── */}
        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              fetch('/api/admin/recompute-ssn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'MATHS' }),
              }).then(() => window.location.reload());
            }}
          >
            Recalculer SSN (Maths)
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Retour au Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
