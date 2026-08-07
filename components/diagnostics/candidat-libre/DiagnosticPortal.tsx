'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, BookOpenCheck, CheckCircle2, ClipboardList, Clock3, FileLock2, FileText, GraduationCap, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, UploadCloud, Users } from 'lucide-react';
import { CANDIDATE_DIAGNOSTIC_MODULES } from '@/lib/diagnostics/candidat-libre/definition.public';
import type { DiagnosticCampaignView, DiagnosticModuleView } from '@/lib/diagnostics/candidat-libre/types';
import { ModuleRunner } from './ModuleRunner';

function cx(...items: Array<string | false | null | undefined>) { return items.filter(Boolean).join(' '); }

const phaseLabels: Record<string, string> = {
  questionnaire: 'Profil et méthodes',
  academic: 'Évaluations académiques',
  oral: 'Expression orale',
  'learning-potential': 'Potentiel d’apprentissage',
  documents: 'Pièces justificatives',
  review: 'Validation',
};

const statusMeta: Record<string, { label: string; className: string }> = {
  LOCKED: { label: 'Verrouillé', className: 'border-slate-700 bg-slate-800/60 text-slate-400' },
  AVAILABLE: { label: 'À faire', className: 'border-cyan-300/40 bg-cyan-400/10 text-cyan-200' },
  IN_PROGRESS: { label: 'En cours', className: 'border-amber-300/40 bg-amber-400/10 text-amber-200' },
  SUBMITTED: { label: 'Soumis', className: 'border-violet-300/40 bg-violet-400/10 text-violet-200' },
  AUTO_SCORED: { label: 'Terminé', className: 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200' },
  NEEDS_REVIEW: { label: 'À corriger', className: 'border-violet-300/40 bg-violet-400/10 text-violet-200' },
  REVIEWED: { label: 'Validé', className: 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200' },
};

export function DiagnosticPortal() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticCampaignView | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/diagnostics/candidat-libre?targetSession=2027', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(data.message ?? data.error ?? 'Impossible de charger le diagnostic.'); return; }
    setDiagnostic(data.diagnostic ?? null);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function createDiagnostic() {
    setCreating(true); setError(null);
    const response = await fetch('/api/diagnostics/candidat-libre', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetSession: 2027, source: 'STUDENT_DASHBOARD' }) });
    const data = await response.json().catch(() => ({}));
    setCreating(false);
    if (!response.ok) { setError(data.message ?? data.error ?? 'Création impossible.'); return; }
    setDiagnostic(data.diagnostic);
  }

  async function finalSubmit() {
    if (!diagnostic || !window.confirm('Confirmer la transmission définitive du dossier à l’équipe pédagogique ? Les modules ne seront plus modifiables.')) return;
    setSubmitting(true); setError(null);
    const response = await fetch(`/api/diagnostics/candidat-libre/${diagnostic.id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    const data = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) { setError(data.error ?? 'Soumission impossible.'); return; }
    await refresh();
  }

  const studentDefinitions = useMemo(() => CANDIDATE_DIAGNOSTIC_MODULES.filter((module) => module.audience === 'ELEVE'), []);
  const moduleByKey = useMemo(() => new Map((diagnostic?.modules ?? []).map((module) => [module.key, module])), [diagnostic]);
  const parentModule = diagnostic?.modules.find((module) => module.key === 'questionnaire-parent');
  const totalMinutes = studentDefinitions.reduce((sum, module) => sum + module.estimatedMinutes, 0);
  const finalReady = diagnostic?.completionPercentage === 100 && Boolean(diagnostic.studentConsentAt) && Boolean(diagnostic.parentConsentAt) && !diagnostic.submittedAt;

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050816] text-white"><div className="text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-300" /><p className="mt-4 text-sm text-slate-400">Chargement du parcours diagnostic…</p></div></main>;

  if (!diagnostic) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-10 text-white md:px-8">
        <section className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-900 via-[#09152b] to-slate-950 shadow-2xl">
          <div className="grid gap-8 p-6 md:grid-cols-[1.15fr_.85fr] md:p-10">
            <div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100"><Sparkles className="h-4 w-4" /> Dossier candidat individuel 2027</div><h1 className="mt-6 text-3xl font-bold leading-tight md:text-5xl">Votre parcours complet de diagnostic Nexus</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">Ce parcours évalue votre niveau réel, vos méthodes, votre autonomie, votre capacité de progression et votre situation administrative. Il ne s’agit pas d’un concours, mais d’une aide à la décision entre une préparation accélérée en un an et une reprise scolaire sur deux ans.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">{[[ClipboardList,'266 items structurés'],[Clock3,`Environ ${Math.floor(totalMinutes/60)} h ${totalMinutes%60} de passation`],[UploadCloud,'Documents et copies à déposer'],[Users,'Volet confidentiel du parent']].map(([Icon,label]) => { const C=Icon as typeof ClipboardList; return <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-200"><C className="h-5 w-5 text-cyan-300" />{String(label)}</div>; })}</div>
              {error && <p className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
              <button type="button" disabled={creating} onClick={() => void createDiagnostic()} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950 disabled:opacity-50">{creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />} Commencer mon diagnostic</button>
            </div>
            <aside className="rounded-3xl border border-violet-300/20 bg-violet-400/5 p-6"><ShieldCheck className="h-9 w-9 text-violet-300" /><h2 className="mt-5 text-xl font-bold">Conditions essentielles</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300"><li>Travail personnel, sans aide extérieure pendant les tests.</li><li>Possibilité d’indiquer honnêtement « notion non étudiée ».</li><li>Sauvegarde automatique et reprise ultérieure.</li><li>Réponses académiques non visibles par le parent.</li><li>Aucune promesse automatique de réussite : l’avis final est validé par l’équipe pédagogique.</li></ul></aside>
          </div>
        </section>
      </main>
    );
  }

  const studentName = [diagnostic.student.firstName, diagnostic.student.lastName].filter(Boolean).join(' ') || 'Élève';
  return (
    <main className="min-h-screen bg-[#050816] px-4 py-6 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-[#09152b] to-slate-950 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Espace élève · session 2027</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">Diagnostic de {studentName}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Progressez module par module. Les productions longues seront corrigées par un enseignant. Les scores automatiques ne constituent jamais, seuls, la décision finale.</p></div><button type="button" onClick={() => void refresh()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"><RefreshCw className="h-4 w-4" /> Actualiser</button></div>
          <div className="mt-7 grid gap-4 md:grid-cols-4"><Metric label="Avancement global" value={`${diagnostic.completionPercentage} %`} icon={BookOpenCheck} /><Metric label="Statut" value={diagnostic.status.replaceAll('_',' ')} icon={GraduationCap} /><Metric label="Parent" value={parentModule && ['AUTO_SCORED','NEEDS_REVIEW','REVIEWED'].includes(parentModule.status) ? 'Questionnaire reçu' : 'En attente'} icon={Users} /><Metric label="Documents" value={`${diagnostic.documents.length} déposé(s)`} icon={FileText} /></div>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-400 to-emerald-300 transition-all duration-700" style={{ width: `${diagnostic.completionPercentage}%` }} /></div>
        </header>

        {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}
        {diagnostic.retentionDueAt && new Date(diagnostic.retentionDueAt) > new Date() && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" /><span>Le test de rétention s’ouvrira le {new Date(diagnostic.retentionDueAt).toLocaleString('fr-FR')}. Ne relisez pas la micro-leçon avant cette échéance.</span></div>}

        <section className="mt-8 space-y-8">
          {Object.entries(phaseLabels).map(([kind, label]) => {
            const definitions = studentDefinitions.filter((module) => module.kind === kind);
            if (!definitions.length) return null;
            return <div key={kind}><div className="mb-4 flex items-center gap-3"><div className="h-px flex-1 bg-slate-800" /><h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{label}</h2><div className="h-px flex-1 bg-slate-800" /></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{definitions.map((definition) => <ModuleCard key={definition.key} definition={definition} view={moduleByKey.get(definition.key)} onOpen={() => setActiveModule(definition.key)} />)}</div></div>;
          })}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">Transmission finale</p><h2 className="mt-2 text-2xl font-bold">Envoyer le dossier à l’équipe pédagogique</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">La transmission devient possible lorsque tous les modules élève et parent sont terminés. Elle verrouille les réponses. Les documents restent soumis à un contrôle d’authenticité et de lisibilité.</p></div><button type="button" disabled={!finalReady || submitting} onClick={() => void finalSubmit()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-6 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-35">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileLock2 className="h-5 w-5" />} Transmettre définitivement</button></div></section>
      </div>
      {activeModule && <ModuleRunner diagnosticId={diagnostic.id} moduleKey={activeModule} onClose={() => setActiveModule(null)} onUpdated={() => void refresh()} />}
    </main>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof GraduationCap }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Icon className="h-4 w-4 text-cyan-300" />{label}</div><p className="mt-2 text-lg font-bold text-white">{value}</p></div>;
}

function ModuleCard({ definition, view, onOpen }: { definition: (typeof CANDIDATE_DIAGNOSTIC_MODULES)[number]; view?: DiagnosticModuleView; onOpen: () => void }) {
  const status = view?.status ?? 'LOCKED';
  const meta = statusMeta[status] ?? statusMeta.LOCKED;
  const locked = status === 'LOCKED';
  const completed = ['SUBMITTED','AUTO_SCORED','NEEDS_REVIEW','REVIEWED'].includes(status);
  const availableAt = view?.availableAt ? new Date(view.availableAt) : null;
  return <motion.article whileHover={!locked ? { y: -3 } : undefined} className={cx('group rounded-3xl border p-5 transition', locked ? 'border-slate-800 bg-slate-950/40' : 'border-slate-700 bg-slate-900/70 hover:border-cyan-300/40')}><div className="flex items-start justify-between gap-3"><div className={cx('flex h-11 w-11 items-center justify-center rounded-2xl border', completed ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-300' : locked ? 'border-slate-700 bg-slate-800 text-slate-500' : 'border-cyan-300/30 bg-cyan-400/10 text-cyan-300')}>{completed ? <CheckCircle2 className="h-5 w-5" /> : locked ? <LockKeyhole className="h-5 w-5" /> : definition.kind === 'documents' ? <UploadCloud className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}</div><span className={cx('rounded-full border px-2.5 py-1 text-[11px] font-semibold', meta.className)}>{meta.label}</span></div><h3 className="mt-5 text-lg font-bold leading-6 text-white">{definition.shortTitle}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{definition.description}</p><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{definition.questions.length} items</span><span>≈ {definition.estimatedMinutes} min</span></div>{availableAt && availableAt > new Date() && <p className="mt-3 text-xs text-amber-300">Ouverture : {availableAt.toLocaleString('fr-FR')}</p>}<button type="button" disabled={locked || completed} onClick={onOpen} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35">{status === 'IN_PROGRESS' ? 'Reprendre' : completed ? 'Terminé' : 'Ouvrir le module'} {!locked && !completed && <ArrowRight className="h-4 w-4" />}</button></motion.article>;
}
