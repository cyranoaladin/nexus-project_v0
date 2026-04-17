'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, CheckCircle, Clock, AlertCircle, TrendingUp, Calendar,
  RefreshCw, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import { WeeklyCalendar, type CalendarSession } from '@/components/stages/WeeklyCalendar';
import { StageReservationStatus } from '@/components/stages/StageReservationStatus';

interface Reservation {
  id: string;
  parentName: string;
  studentName: string | null;
  email: string;
  phone: string;
  classe: string;
  richStatus: string | null;
  paymentStatus: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

interface StageSession {
  id: string;
  title: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string | null;
}

interface StageData {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  type: string;
  startDate: string;
  endDate: string;
  capacity: number;
  priceAmount: string;
  isOpen: boolean;
  sessions: StageSession[];
  coaches: { coach: { pseudonym: string } }[];
  _count: { reservations: number };
}

interface Kpis {
  totalStages: number;
  totalInscrits: number;
  totalConfirmes: number;
  totalAttente: number;
  caEstime: number;
}

export default function AssistanteStagesPage() {
  const [stages, setStages] = useState<StageData[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [reservationsByStage, setReservationsByStage] = useState<Record<string, Reservation[]>>({});
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [loadingStages, setLoadingStages] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStages = useCallback(async () => {
    setLoadingStages(true);
    try {
      const res = await fetch('/api/assistant/stages');
      const data = await res.json() as { stages: StageData[]; kpis: Kpis };
      setStages(data.stages ?? []);
      setKpis(data.kpis ?? null);
    } catch {
      showToast('Erreur de chargement des stages', 'error');
    } finally {
      setLoadingStages(false);
    }
  }, []);

  const loadReservations = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/stages/${slug}/reservations`);
      const data = await res.json() as { reservations: Reservation[] };
      setReservationsByStage((prev) => ({ ...prev, [slug]: data.reservations ?? [] }));
    } catch {
      showToast('Erreur chargement réservations', 'error');
    }
  }, []);

  const handleToggleStage = (slug: string) => {
    if (expandedStage === slug) {
      setExpandedStage(null);
    } else {
      setExpandedStage(slug);
      if (!reservationsByStage[slug]) loadReservations(slug);
    }
  };

  const handleConfirm = async (slug: string, reservationId: string) => {
    setConfirming(reservationId);
    try {
      const res = await fetch(`/api/stages/${slug}/reservations/${reservationId}/confirm`, {
        method: 'POST',
      });
      const data = await res.json() as { success: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      showToast(data.message ?? 'Confirmation envoyée');
      await loadReservations(slug);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setConfirming(null);
    }
  };

  useEffect(() => { loadStages(); }, [loadStages]);

  const kpiCards = kpis ? [
    { label: 'Stages actifs', value: kpis.totalStages, icon: Calendar, color: 'text-indigo-400' },
    { label: 'Total inscrits', value: kpis.totalInscrits, icon: Users, color: 'text-blue-400' },
    { label: 'Confirmés', value: kpis.totalConfirmes, icon: CheckCircle, color: 'text-emerald-400' },
    { label: "En attente", value: kpis.totalAttente, icon: Clock, color: 'text-amber-400' },
    { label: 'CA estimé', value: `${kpis.caEstime.toLocaleString('fr-FR')} TND`, icon: TrendingUp, color: 'text-purple-400' },
  ] : [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl border ${toast.type === 'success' ? 'bg-emerald-900/90 text-emerald-300 border-emerald-700' : 'bg-red-900/90 text-red-300 border-red-700'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Gestion des Stages</h1>
          <p className="text-sm text-slate-400 mt-0.5">Réservations, confirmations et planning</p>
        </div>
        <button
          onClick={loadStages}
          disabled={loadingStages}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loadingStages ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <div className={`${color} mb-2`}><Icon className="h-5 w-5" /></div>
              <p className="text-white font-bold text-lg leading-none">{value}</p>
              <p className="text-slate-400 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stage list */}
      {loadingStages ? (
        <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement…
        </div>
      ) : stages.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-8 text-center text-slate-400">
          Aucun stage disponible.
        </div>
      ) : (
        <div className="space-y-4">
          {stages.map((stage) => {
            const isOpen = expandedStage === stage.slug;
            const reservations = reservationsByStage[stage.slug] ?? [];
            const sessions: CalendarSession[] = stage.sessions.map((s) => ({
              ...s,
              startAt: new Date(s.startAt),
              endAt: new Date(s.endAt),
              coach: null,
            }));

            return (
              <div key={stage.id} className="rounded-xl border border-white/10 bg-slate-800/50 overflow-hidden">
                {/* Stage header */}
                <button
                  type="button"
                  onClick={() => handleToggleStage(stage.slug)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${stage.isOpen ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{stage.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {new Date(stage.startDate).toLocaleDateString('fr-FR')} →{' '}
                        {new Date(stage.endDate).toLocaleDateString('fr-FR')} · {stage.priceAmount} TND · {stage._count.reservations} inscrit(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <a
                      href={`/stages/${stage.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/8 space-y-4 p-4">
                    {/* Calendar */}
                    {sessions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Planning</p>
                        <WeeklyCalendar
                          sessions={sessions}
                          startDate={new Date(stage.startDate)}
                          endDate={new Date(stage.endDate)}
                        />
                      </div>
                    )}

                    {/* Reservations table */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Inscriptions ({reservations.length})
                      </p>
                      {reservations.length === 0 ? (
                        <p className="text-slate-500 text-sm">Aucune inscription enregistrée.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-white/8">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/8 text-slate-400">
                                <th className="text-left px-3 py-2 font-medium">Nom</th>
                                <th className="text-left px-3 py-2 font-medium">Email</th>
                                <th className="text-left px-3 py-2 font-medium">Classe</th>
                                <th className="text-left px-3 py-2 font-medium">Statut</th>
                                <th className="px-3 py-2 font-medium">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {reservations.map((r) => (
                                <tr key={r.id} className="hover:bg-white/3 transition-colors">
                                  <td className="px-3 py-2 text-white font-medium">
                                    {r.studentName ?? r.parentName}
                                  </td>
                                  <td className="px-3 py-2 text-slate-400">{r.email}</td>
                                  <td className="px-3 py-2 text-slate-400">{r.classe || '—'}</td>
                                  <td className="px-3 py-2">
                                    <StageReservationStatus status={r.richStatus} />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {r.richStatus === 'PENDING' && (
                                      <button
                                        onClick={() => handleConfirm(stage.slug, r.id)}
                                        disabled={confirming === r.id}
                                        className="inline-flex items-center gap-1 text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-md px-2 py-1 transition-colors disabled:opacity-50"
                                      >
                                        {confirming === r.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                        Confirmer
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
