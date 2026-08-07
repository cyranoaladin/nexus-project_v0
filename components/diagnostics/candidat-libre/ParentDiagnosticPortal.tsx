'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, EyeOff, FileText, Loader2, ShieldCheck, Users } from 'lucide-react';
import type { DiagnosticCampaignView } from '@/lib/diagnostics/candidat-libre/types';
import { ModuleRunner } from './ModuleRunner';

export function ParentDiagnosticPortal({ studentId }: { studentId: string }) {
  const [diagnostic, setDiagnostic] = useState<DiagnosticCampaignView | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/diagnostics/candidat-libre?studentId=${encodeURIComponent(studentId)}&targetSession=2027`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(data.message ?? data.error ?? 'Chargement impossible.'); return; }
    setDiagnostic(data.diagnostic ?? null);
  }, [studentId]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create() {
    setCreating(true);
    const response = await fetch('/api/diagnostics/candidat-libre', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetSession: 2027, source: 'PARENT_DASHBOARD', studentId }) });
    const data = await response.json().catch(() => ({}));
    setCreating(false);
    if (!response.ok) { setError(data.message ?? data.error ?? 'Création impossible.'); return; }
    setDiagnostic(data.diagnostic);
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050816] text-white"><Loader2 className="h-10 w-10 animate-spin text-cyan-300" /></main>;
  if (!diagnostic) return <main className="min-h-screen bg-[#050816] px-4 py-10 text-white"><div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8"><Users className="h-10 w-10 text-cyan-300" /><h1 className="mt-5 text-3xl font-bold">Ouvrir le dossier diagnostic</h1><p className="mt-4 leading-7 text-slate-300">Le dossier regroupe le parcours de l’élève et un questionnaire parent séparé. Vos réponses ne sont pas affichées à l’élève.</p>{error && <p className="mt-4 text-rose-300">{error}</p>}<button type="button" disabled={creating} onClick={() => void create()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950">{creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />} Créer le dossier</button></div></main>;

  const parentModule = diagnostic.modules.find((module) => module.key === 'questionnaire-parent');
  const parentDone = Boolean(parentModule && ['AUTO_SCORED','NEEDS_REVIEW','REVIEWED','SUBMITTED'].includes(parentModule.status));
  const studentName = [diagnostic.student.firstName, diagnostic.student.lastName].filter(Boolean).join(' ') || 'l’élève';
  return <main className="min-h-screen bg-[#050816] px-4 py-8 text-white md:px-8"><div className="mx-auto max-w-6xl"><header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-[#09152b] p-7"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Espace parent</p><h1 className="mt-2 text-3xl font-bold">Diagnostic de {studentName}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Vous suivez l’avancement général et complétez un volet confidentiel. Les réponses académiques détaillées de l’élève restent privées afin de préserver son autonomie et l’intégrité de l’évaluation.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><Card icon={ClipboardList} label="Avancement élève" value={`${diagnostic.completionPercentage} %`} /><Card icon={FileText} label="Documents déposés" value={String(diagnostic.documents.length)} /><Card icon={ShieldCheck} label="Votre questionnaire" value={parentDone ? 'Transmis' : 'À compléter'} /></div></header>
    <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_.85fr]"><div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6"><h2 className="text-xl font-bold">Progression par module</h2><div className="mt-5 space-y-3">{diagnostic.modules.filter((module) => module.key !== 'questionnaire-parent').map((module) => <div key={module.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3"><span className="text-sm text-slate-300">{module.key.replaceAll('-',' ')}</span><span className="text-xs font-semibold text-slate-500">{module.status.replaceAll('_',' ')}</span></div>)}</div></div>
    <aside className="space-y-5"><div className="rounded-3xl border border-violet-300/20 bg-violet-400/5 p-6"><EyeOff className="h-8 w-8 text-violet-300" /><h2 className="mt-4 text-xl font-bold">Questionnaire confidentiel</h2><p className="mt-3 text-sm leading-6 text-slate-300">Il porte sur l’autonomie observée, les antécédents, les contraintes familiales, le financement et votre arbitrage. Répondez séparément de l’élève.</p><button type="button" disabled={parentDone} onClick={() => setOpen(true)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-40">{parentDone ? <CheckCircle2 className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}{parentDone ? 'Questionnaire transmis' : 'Compléter le questionnaire'}</button></div><div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm leading-6 text-slate-400"><strong className="text-slate-200">Limite de l’outil.</strong> Le portail organise les preuves et facilite l’analyse. La recommandation finale demeure une décision pédagogique humaine, argumentée et traçable.</div></aside></section></div>{open && <ModuleRunner diagnosticId={diagnostic.id} moduleKey="questionnaire-parent" parentMode onClose={() => setOpen(false)} onUpdated={() => void refresh()} />}</main>;
}

function Card({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Icon className="h-4 w-4 text-cyan-300" />{label}</div><p className="mt-2 text-xl font-bold">{value}</p></div>; }
