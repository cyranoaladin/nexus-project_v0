'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Save, Send, CheckCircle, AlertCircle,
  RefreshCw, Tag, X, Plus,
} from 'lucide-react';
import Link from 'next/link';

interface BilanData {
  id?: string;
  contentEleve: string;
  contentParent: string;
  contentInterne: string;
  scoreGlobal: string;
  domainScores: Record<string, string>;
  strengths: string[];
  areasForGrowth: string[];
  nextSteps: string;
  isPublished: boolean;
  publishedAt?: string | null;
}

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  stageName: string;
  stageSlug: string;
}

const EMPTY_BILAN: BilanData = {
  contentEleve: '',
  contentParent: '',
  contentInterne: '',
  scoreGlobal: '',
  domainScores: {},
  strengths: [],
  areasForGrowth: [],
  nextSteps: '',
  isPublished: false,
};

type Tab = 'eleve' | 'parent' | 'interne';

export default function CoachBilanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const stageSlug = params.stageSlug as string;
  const studentId = params.studentId as string;

  const [bilan, setBilan] = useState<BilanData>(EMPTY_BILAN);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('eleve');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [newTag, setNewTag] = useState<{ strengths: string; areasForGrowth: string }>({ strengths: '', areasForGrowth: '' });

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated' && session?.user?.role !== 'COACH') router.push('/dashboard');
  }, [status, session, router]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stagesRes, bilanRes] = await Promise.all([
        fetch('/api/coach/stages'),
        fetch(`/api/stages/${stageSlug}/bilans?studentId=${studentId}`),
      ]);

      if (stagesRes.ok) {
        const stagesData = await stagesRes.json() as {
          stageAssignments: Array<{
            stage: {
              slug: string;
              title: string;
              reservations: Array<{ id: string; studentName?: string | null; email: string; studentId?: string | null }>;
            };
          }>;
        };
        const assignment = stagesData.stageAssignments?.find(a => a.stage.slug === stageSlug);
        if (assignment) {
          const reservation = assignment.stage.reservations.find(
            r => r.studentId === studentId || r.id === studentId
          );
          setStudentInfo({
            id: studentId,
            firstName: reservation?.studentName?.split(' ')[0] ?? 'Élève',
            lastName: reservation?.studentName?.split(' ').slice(1).join(' ') ?? '',
            stageName: assignment.stage.title,
            stageSlug: assignment.stage.slug,
          });
        }
      }

      if (bilanRes.ok) {
        const bilanData = await bilanRes.json() as {
          bilans: Array<{
            id?: string;
            contentEleve?: string;
            contentParent?: string;
            contentInterne?: string;
            scoreGlobal?: number | null;
            domainScores?: Record<string, number> | null;
            strengths?: string[];
            areasForGrowth?: string[];
            nextSteps?: string | null;
            isPublished?: boolean;
            publishedAt?: string | null;
          }>;
        };
        const existing = bilanData.bilans?.find(b =>
          (b as { studentId?: string }).studentId === studentId
        ) ?? bilanData.bilans?.[0];
        if (existing) {
          setBilan({
            id: existing.id,
            contentEleve: existing.contentEleve ?? '',
            contentParent: existing.contentParent ?? '',
            contentInterne: existing.contentInterne ?? '',
            scoreGlobal: existing.scoreGlobal != null ? String(existing.scoreGlobal) : '',
            domainScores: existing.domainScores
              ? Object.fromEntries(Object.entries(existing.domainScores).map(([k, v]) => [k, String(v)]))
              : {},
            strengths: existing.strengths ?? [],
            areasForGrowth: existing.areasForGrowth ?? [],
            nextSteps: existing.nextSteps ?? '',
            isPublished: existing.isPublished ?? false,
            publishedAt: existing.publishedAt,
          });
        }
      }
    } catch {
      showToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [stageSlug, studentId]);

  useEffect(() => { load(); }, [load]);

  const save = async (publish: boolean) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/stages/${stageSlug}/bilans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          contentEleve: bilan.contentEleve,
          contentParent: bilan.contentParent,
          contentInterne: bilan.contentInterne || undefined,
          scoreGlobal: bilan.scoreGlobal ? parseFloat(bilan.scoreGlobal) : undefined,
          domainScores: Object.keys(bilan.domainScores).length > 0
            ? Object.fromEntries(Object.entries(bilan.domainScores).map(([k, v]) => [k, parseFloat(v) || 0]))
            : undefined,
          strengths: bilan.strengths,
          areasForGrowth: bilan.areasForGrowth,
          nextSteps: bilan.nextSteps || undefined,
          isPublished: publish,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: unknown };
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      setBilan(prev => ({ ...prev, isPublished: publish, publishedAt: publish ? new Date().toISOString() : prev.publishedAt }));
      showToast(publish ? 'Bilan publié et envoyé ✓' : 'Brouillon sauvegardé ✓');
      await load();
    } catch (e) {
      showToast((e as Error).message || 'Erreur', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const addTag = (field: 'strengths' | 'areasForGrowth') => {
    const val = newTag[field].trim();
    if (!val) return;
    setBilan(prev => ({ ...prev, [field]: [...prev[field], val] }));
    setNewTag(prev => ({ ...prev, [field]: '' }));
  };

  const removeTag = (field: 'strengths' | 'areasForGrowth', idx: number) => {
    setBilan(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) }));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-darker">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'eleve', label: 'Bilan Élève' },
    { key: 'parent', label: 'Bilan Parent' },
    { key: 'interne', label: 'Notes internes' },
  ];

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl
          ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/dashboard/coach/stages"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
        </div>

        <div className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Rédaction du bilan</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            {studentInfo ? `${studentInfo.firstName} ${studentInfo.lastName}` : 'Élève'}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Stage&nbsp;: {studentInfo?.stageName ?? stageSlug}
          </p>
          {bilan.isPublished && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" /> Bilan publié
              {bilan.publishedAt ? ` · ${new Date(bilan.publishedAt).toLocaleDateString('fr-FR')}` : ''}
            </span>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-6">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="flex gap-1 border-b border-white/10 pb-4">
                {tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition
                      ${activeTab === t.key ? 'bg-brand-accent/20 text-brand-accent' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {activeTab === 'eleve' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Contenu bilan élève (tutoiement)
                    </label>
                    <textarea
                      value={bilan.contentEleve}
                      onChange={e => setBilan(prev => ({ ...prev, contentEleve: e.target.value }))}
                      rows={10}
                      placeholder="Pendant ce stage, tu as travaillé sur…"
                      className="w-full resize-y rounded-2xl border border-white/10 bg-surface-darker/80 px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none"
                    />
                  </div>
                )}
                {activeTab === 'parent' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Contenu bilan parent (vouvoiement)
                    </label>
                    <textarea
                      value={bilan.contentParent}
                      onChange={e => setBilan(prev => ({ ...prev, contentParent: e.target.value }))}
                      rows={10}
                      placeholder="Durant ce stage, votre enfant a travaillé sur…"
                      className="w-full resize-y rounded-2xl border border-white/10 bg-surface-darker/80 px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none"
                    />
                  </div>
                )}
                {activeTab === 'interne' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Notes internes (réservées à l&apos;équipe Nexus)
                    </label>
                    <textarea
                      value={bilan.contentInterne}
                      onChange={e => setBilan(prev => ({ ...prev, contentInterne: e.target.value }))}
                      rows={6}
                      placeholder="Observations internes non visibles par l'élève ni le parent…"
                      className="w-full resize-y rounded-2xl border border-white/10 bg-surface-darker/80 px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {(['strengths', 'areasForGrowth'] as const).map(field => (
              <div key={field} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {field === 'strengths' ? 'Points forts' : 'Axes de progrès'}
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bilan[field].map((tag, idx) => (
                    <span key={idx} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200">
                      <Tag className="h-3 w-3 text-neutral-500" />
                      {tag}
                      <button onClick={() => removeTag(field, idx)} className="text-neutral-500 hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newTag[field]}
                    onChange={e => setNewTag(prev => ({ ...prev, [field]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(field))}
                    placeholder="Ajouter un tag…"
                    className="flex-1 rounded-xl border border-white/10 bg-surface-darker/80 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none"
                  />
                  <button
                    onClick={() => addTag(field)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Prochaines étapes recommandées
              </label>
              <textarea
                value={bilan.nextSteps}
                onChange={e => setBilan(prev => ({ ...prev, nextSteps: e.target.value }))}
                rows={4}
                placeholder="Pour consolider les acquis du stage, nous recommandons…"
                className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-surface-darker/80 px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none"
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Score global (sur 20)
              </label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={bilan.scoreGlobal}
                onChange={e => setBilan(prev => ({ ...prev, scoreGlobal: e.target.value }))}
                placeholder="Ex : 14.5"
                className="mt-3 w-full rounded-xl border border-white/10 bg-surface-darker/80 px-4 py-3 text-lg font-semibold text-white placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none"
              />
              {bilan.scoreGlobal && (
                <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-brand-accent transition-all"
                    style={{ width: `${Math.min((parseFloat(bilan.scoreGlobal) / 20) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Scores par domaine</p>
              {['Algèbre', 'Analyse', 'Géométrie', 'Probabilités', 'Algorithmique'].map(domain => (
                <div key={domain} className="mt-3">
                  <label className="text-xs text-neutral-400">{domain}</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={bilan.domainScores[domain] ?? ''}
                    onChange={e => setBilan(prev => ({
                      ...prev,
                      domainScores: { ...prev.domainScores, [domain]: e.target.value },
                    }))}
                    placeholder="—"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-surface-darker/80 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => save(false)}
                disabled={submitting || bilan.isPublished}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/10 disabled:opacity-40"
              >
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder brouillon
              </button>
              <button
                onClick={() => save(true)}
                disabled={submitting || bilan.isPublished || !bilan.contentEleve || !bilan.contentParent}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-accent/90 disabled:opacity-40"
              >
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publier &amp; envoyer
              </button>
              {(!bilan.contentEleve || !bilan.contentParent) && (
                <p className="text-center text-xs text-neutral-500">
                  Remplissez les onglets Élève et Parent pour publier
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
