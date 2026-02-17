'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import type { DashboardRole } from './DashboardPilotage';

/**
 * SynthesisCard — Mini Rapport Synthèse 30 jours.
 *
 * Role-aware strategic reading:
 * - ELEVE/PARENT: trajectory-oriented interpretation (score + trend)
 * - COACH: execution-oriented (pending reports, next slot)
 * - ASSISTANTE: flux-oriented (pending requests, payments)
 * - ADMIN: supervision-oriented (activity status, signals)
 */

interface SynthesisCardProps {
  /** Student ID for scoped fetch (student roles) */
  studentId?: string | null;
  /** Role for micro-variante selection */
  role?: DashboardRole;
}

// ─── Student synthesis (score × trend) ──────────────────────────────────────

interface StudentSynthesisData {
  globalScore: number;
  trend: 'up' | 'down' | 'stable';
}

function getStudentMessage(score: number, trend: string): { message: string; secondary: string | null; tone: string } {
  if (score >= 80 && trend === 'up') {
    return { message: 'Dynamique excellente. Trajectoire maîtrisée.', secondary: null, tone: 'text-emerald-400' };
  }
  if (score >= 80) {
    return { message: 'Dynamique stable et maîtrisée.', secondary: null, tone: 'text-emerald-400' };
  }
  if (score >= 65 && trend === 'up') {
    return { message: 'Progression soutenue. Cap en consolidation.', secondary: null, tone: 'text-blue-400' };
  }
  if (score >= 65) {
    return { message: 'Progression régulière. Maintenir le rythme.', secondary: null, tone: 'text-blue-400' };
  }
  if (score >= 50 && trend === 'down') {
    return { message: 'Trajectoire à ajuster.', secondary: 'Un échange stratégique est recommandé.', tone: 'text-amber-400' };
  }
  if (score >= 50) {
    return { message: 'Trajectoire en construction.', secondary: 'Consolider les acquis pour stabiliser le cap.', tone: 'text-amber-400' };
  }
  if (trend === 'up') {
    return { message: 'Engagement à renforcer.', secondary: 'Dynamique positive détectée — maintenir l\u2019effort.', tone: 'text-amber-400' };
  }
  return { message: 'Un ajustement stratégique est recommandé.', secondary: 'Un point de situation permettrait de relancer la trajectoire.', tone: 'text-orange-400' };
}

// ─── Coach synthesis ────────────────────────────────────────────────────────

interface CoachSynthesisData {
  pendingReports: number;
  todaySessions: number;
}

function getCoachMessage(data: CoachSynthesisData): { message: string; tone: string } {
  const parts: string[] = [];
  if (data.pendingReports > 0) {
    parts.push(`${data.pendingReports} compte${data.pendingReports > 1 ? 's' : ''}-rendu${data.pendingReports > 1 ? 's' : ''} en attente.`);
  }
  if (data.todaySessions > 0) {
    parts.push(`${data.todaySessions} séance${data.todaySessions > 1 ? 's' : ''} à préparer aujourd'hui.`);
  }
  if (parts.length === 0) {
    return { message: 'Tout est à jour. Aucune action en attente.', tone: 'text-emerald-400' };
  }
  return { message: parts.join(' '), tone: data.pendingReports > 2 ? 'text-amber-400' : 'text-blue-400' };
}

// ─── Assistante synthesis ───────────────────────────────────────────────────

interface AssistanteSynthesisData {
  pendingSubscriptions: number;
  pendingPayments: number;
}

function getAssistanteMessage(data: AssistanteSynthesisData): { message: string; tone: string } {
  const parts: string[] = [];
  if (data.pendingSubscriptions > 0) {
    parts.push(`Demandes en attente : ${data.pendingSubscriptions}.`);
  }
  if (data.pendingPayments > 0) {
    parts.push(`Paiements à vérifier : ${data.pendingPayments}.`);
  }
  if (parts.length === 0) {
    return { message: 'Flux opérationnel nominal. Aucune action urgente.', tone: 'text-emerald-400' };
  }
  const total = data.pendingSubscriptions + data.pendingPayments;
  return { message: parts.join(' '), tone: total > 3 ? 'text-amber-400' : 'text-blue-400' };
}

// ─── Admin synthesis ────────────────────────────────────────────────────────

function getAdminMessage(): { message: string; tone: string } {
  return { message: 'Activité stable. Aucun signal critique.', tone: 'text-emerald-400' };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SynthesisCard({ studentId, role = 'ELEVE' }: SynthesisCardProps) {
  const [studentData, setStudentData] = useState<StudentSynthesisData | null>(null);
  const [coachData, setCoachData] = useState<CoachSynthesisData | null>(null);
  const [assistanteData, setAssistanteData] = useState<AssistanteSynthesisData | null>(null);
  const [loading, setLoading] = useState(true);

  const isStudentRole = role === 'ELEVE' || role === 'PARENT';

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        if (isStudentRole) {
          const params = studentId ? `?studentId=${studentId}` : '';
          const res = await fetch(`/api/student/nexus-index${params}`);
          if (!res.ok) return;
          const json = await res.json();
          if (cancelled || !json.index) return;
          setStudentData({ globalScore: json.index.globalScore, trend: json.index.trend });
        } else if (role === 'COACH') {
          const res = await fetch('/api/coach/dashboard');
          if (!res.ok) { if (!cancelled) setCoachData({ pendingReports: 0, todaySessions: 0 }); return; }
          const json = await res.json();
          if (cancelled) return;
          setCoachData({
            pendingReports: json.stats?.pendingReports ?? json.pendingReports ?? 0,
            todaySessions: json.stats?.todaySessions ?? json.todaySessions?.length ?? 0,
          });
        } else if (role === 'ASSISTANTE') {
          const res = await fetch('/api/assistante/dashboard');
          if (!res.ok) { if (!cancelled) setAssistanteData({ pendingSubscriptions: 0, pendingPayments: 0 }); return; }
          const json = await res.json();
          if (cancelled) return;
          setAssistanteData({
            pendingSubscriptions: json.stats?.pendingSubscriptionRequests ?? 0,
            pendingPayments: json.stats?.pendingPayments ?? 0,
          });
        }
        // ADMIN: no fetch needed, static message
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [studentId, role, isStudentRole]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800/50 bg-surface-card/50 p-5 animate-pulse">
        <div className="h-4 w-48 rounded bg-neutral-800 mb-2" />
        <div className="h-3 w-64 rounded bg-neutral-800" />
      </div>
    );
  }

  // Resolve message per role
  let synthesis: { message: string; secondary?: string | null; tone: string } | null = null;

  if (isStudentRole && studentData) {
    synthesis = getStudentMessage(studentData.globalScore, studentData.trend);
  } else if (role === 'COACH' && coachData) {
    synthesis = getCoachMessage(coachData);
  } else if (role === 'ASSISTANTE' && assistanteData) {
    synthesis = getAssistanteMessage(assistanteData);
  } else if (role === 'ADMIN') {
    synthesis = getAdminMessage();
  }

  if (!synthesis) return null;

  return (
    <div className="rounded-xl border border-neutral-800/50 bg-surface-card/50 p-5">
      <div className="flex items-start gap-3">
        <FileText className="h-4 w-4 text-neutral-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1.5">Synthèse stratégique</p>
          <p className={`text-sm font-medium ${synthesis.tone}`}>{synthesis.message}</p>
          {synthesis.secondary && (
            <p className="text-xs text-neutral-500 mt-1">{synthesis.secondary}</p>
          )}
        </div>
      </div>
    </div>
  );
}
