'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, CheckCircle, AlertCircle, RefreshCw, Pencil, ExternalLink } from 'lucide-react';
import { WeeklyCalendar, type CalendarSession } from '@/components/stages/WeeklyCalendar';
import { StageBilanCard, type StageBilanData } from '@/components/stages/StageBilanCard';

interface Reservation {
  id: string;
  studentName: string | null;
  email: string;
  studentId: string | null;
}

interface StageSessionItem {
  id: string;
  title: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string | null;
}

interface StageBilanSummary {
  studentId: string;
  isPublished: boolean;
  updatedAt: string;
}

interface StageAssignment {
  stage: {
    id: string;
    slug: string;
    title: string;
    startDate: string;
    endDate: string;
    sessions: StageSessionItem[];
    reservations: Reservation[];
    bilans: StageBilanSummary[];
  };
  role: string | null;
}

interface BilanForm {
  studentId: string;
  stageSlug: string;
  studentName: string;
  contentEleve: string;
  contentParent: string;
  scoreGlobal: string;
  strengths: string;
  areasForGrowth: string;
  nextSteps: string;
  isPublished: boolean;
}

const EMPTY_FORM: Omit<BilanForm, 'studentId' | 'stageSlug' | 'studentName'> = {
  contentEleve: '',
  contentParent: '',
  scoreGlobal: '',
  strengths: '',
  areasForGrowth: '',
  nextSteps: '',
  isPublished: false,
};

export default function CoachStagesPage() {
  const [assignments, setAssignments] = useState<StageAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [bilanForm, setBilanForm] = useState<BilanForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/coach/stages');
      const data = await res.json() as { stageAssignments: StageAssignment[] };
      setAssignments(data.stageAssignments ?? []);
    } catch {
      showToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openBilanForm = (stageSlug: string, r: Reservation) => {
    setBilanForm({
      studentId: r.studentId ?? r.id,
      stageSlug,
      studentName: r.studentName ?? r.email,
      ...EMPTY_FORM,
    });
  };

  const submitBilan = async () => {
    if (!bilanForm) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/stages/${bilanForm.stageSlug}/bilans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: bilanForm.studentId,
          contentEleve: bilanForm.contentEleve,
          contentParent: bilanForm.contentParent,
          scoreGlobal: bilanForm.scoreGlobal ? parseFloat(bilanForm.scoreGlobal) : undefined,
          strengths: bilanForm.strengths.split('\n').filter(Boolean),
          areasForGrowth: bilanForm.areasForGrowth.split('\n').filter(Boolean),
          nextSteps: bilanForm.nextSteps || undefined,
          isPublished: bilanForm.isPublished,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: unknown };
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      showToast(bilanForm.isPublished ? 'Bilan publié ✓' : 'Bilan sauvegardé ✓');
      setBilanForm(null);
      await load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl border ${toast.type === 'success' ? 'bg-emerald-900/90 text-emerald-300 border-emerald-700' : 'bg-red-900/90 text-red-300 border-red-700'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Mes Stages</h1>
          <p className="text-sm text-slate-400 mt-0.5">Planning et bilans élèves</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement…
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-8 text-center text-slate-400">
          Vous n&apos;êtes affecté à aucun stage pour le moment.
        </div>
      ) : (
        assignments.map(({ stage }) => {
          const sessions: CalendarSession[] = stage.sessions.map((s) => ({
            ...s,
            startAt: new Date(s.startAt),
            endAt: new Date(s.endAt),
            coach: null,
          }));

          const publishedCount = stage.bilans.filter((b) => b.isPublished).length;

          return (
            <div key={stage.id} className="space-y-4 rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-white font-semibold">{stage.title}</h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {new Date(stage.startDate).toLocaleDateString('fr-FR')} →{' '}
                    {new Date(stage.endDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{stage.reservations.length} élèves</span>
                  <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-emerald-400" />{publishedCount} bilans publiés</span>
                </div>
              </div>

              {sessions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Planning de mes séances</p>
                  <WeeklyCalendar sessions={sessions} startDate={new Date(stage.startDate)} endDate={new Date(stage.endDate)} />
                </div>
              )}

              {/* Élèves + bilans */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Élèves inscrits</p>
                <div className="space-y-2">
                  {stage.reservations.map((r) => {
                    const hasBilan = stage.bilans.some((b) => b.studentId === (r.studentId ?? ''));
                    return (
                      <div key={r.id} className="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-white text-sm font-medium">{r.studentName ?? r.email}</p>
                          <p className="text-slate-400 text-xs">{r.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openBilanForm(stage.slug, r)}
                            className={`inline-flex items-center gap-1 text-xs rounded-md px-2.5 py-1.5 transition-colors ${hasBilan ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30' : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30'}`}
                          >
                            <Pencil className="h-3 w-3" />
                            {hasBilan ? 'Modifier' : 'Rédiger'}
                          </button>
                          <Link
                            href={`/dashboard/coach/stages/${stage.slug}/bilan/${r.studentId ?? r.id}`}
                            className="inline-flex items-center gap-1 text-xs rounded-md px-2 py-1.5 border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-colors"
                            title="Ouvrir l'éditeur complet"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Bilan modal */}
      {bilanForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <h2 className="text-white font-semibold">Rédiger le bilan — {bilanForm.studentName}</h2>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Note globale (/20)</label>
                  <input type="number" min="0" max="20" step="0.5" value={bilanForm.scoreGlobal}
                    onChange={(e) => setBilanForm({ ...bilanForm, scoreGlobal: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="ex: 14.5"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={bilanForm.isPublished}
                      onChange={(e) => setBilanForm({ ...bilanForm, isPublished: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-slate-700 text-indigo-500"
                    />
                    <span className="text-sm text-slate-300">Publier maintenant</span>
                  </label>
                </div>
              </div>

              {[
                { label: 'Bilan élève', field: 'contentEleve' as const, placeholder: 'Message personnalisé pour l\'élève…' },
                { label: 'Bilan parent', field: 'contentParent' as const, placeholder: 'Message pour les parents…' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                  <textarea rows={4} value={bilanForm[field]}
                    onChange={(e) => setBilanForm({ ...bilanForm, [field]: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                    placeholder={placeholder}
                  />
                </div>
              ))}

              {[
                { label: 'Points forts (1 par ligne)', field: 'strengths' as const },
                { label: 'Axes de progrès (1 par ligne)', field: 'areasForGrowth' as const },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                  <textarea rows={3} value={bilanForm[field]}
                    onChange={(e) => setBilanForm({ ...bilanForm, [field]: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Prochaines étapes</label>
                <textarea rows={2} value={bilanForm.nextSteps}
                  onChange={(e) => setBilanForm({ ...bilanForm, nextSteps: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-5 border-t border-white/10 flex gap-3 justify-end">
              <button onClick={() => setBilanForm(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-white/10 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={submitBilan} disabled={submitting || !bilanForm.contentEleve || !bilanForm.contentParent}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50">
                {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {bilanForm.isPublished ? 'Publier le bilan' : 'Enregistrer le bilan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Published bilans preview */}
      {assignments.flatMap((a) => {
        const publishedBilans = a.stage.bilans.filter((b) => b.isPublished);
        if (publishedBilans.length === 0) return [] as StageBilanData[];
        return publishedBilans.map((b) => ({
          id: b.studentId,
          stageId: a.stage.id,
          stage: { title: a.stage.title, slug: a.stage.slug },
          scoreGlobal: null,
          publishedAt: b.updatedAt,
        } as StageBilanData));
      }).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Bilans publiés</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {assignments.flatMap((a) =>
              a.stage.bilans
                .filter((b) => b.isPublished)
                .map((b) => (
                  <StageBilanCard
                    key={`${a.stage.id}-${b.studentId}`}
                    bilan={{
                      id: b.studentId,
                      stage: { title: a.stage.title, slug: a.stage.slug },
                      publishedAt: b.updatedAt,
                    }}
                    view="eleve"
                  />
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
