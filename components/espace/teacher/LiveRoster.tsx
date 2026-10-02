'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { StatusBadge } from '@/components/espace/shared/StatusBadge';
import { espaceApi } from '@/lib/espace/client/api';
import { formatRelative } from '@/lib/espace/format';
import type { TeacherOverview } from '@/lib/espace/overview';

import { RosterPoller } from './roster-poller';

export function LiveRoster({ initial }: { initial: TeacherOverview }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => new Date());
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollerRef = useRef<RosterPoller | null>(null);
  const slug = initial.activity.slug;

  const refresh = useCallback(async () => {
    try {
      setBusy(true);
      setData(await espaceApi.overview(slug));
      setFailed(false);
    } catch (e) {
      setFailed(true);
      throw e; // le contrôleur applique le recul
    } finally {
      setBusy(false);
    }
  }, [slug]);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  useEffect(() => {
    const poller = new RosterPoller({ refresh, isVisible: () => document.visibilityState === 'visible' });
    pollerRef.current = poller;
    poller.start();
    const onVisibility = () => poller.onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibility);
    // Seul l'affichage relatif se met à jour ici : aucune requête.
    const tick = setInterval(() => setNow(new Date()), 5000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(tick);
      poller.stop();
      pollerRef.current = null;
    };
  }, [refresh]);

  const { counts } = data;
  const isUpload = data.activity.stepsTotal === 0;
  const stat = (label: string, value: number) => (
    <div className="rounded-lg border border-white/10 bg-surface-card p-3">
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-neutral-50">{value}</dd>
    </div>
  );

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Synthèse">
        {stat('Élèves', counts.students)}
        {stat('Pas commencé', counts.notStarted)}
        {stat('En cours', counts.inProgress)}
        {stat('À corriger', counts.submitted)}
        {stat('À reprendre', counts.reopened)}
        {stat('Corrigés', counts.corrected)}
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm text-neutral-300" data-testid="roster-updated">
          Mis à jour {formatRelative(data.generatedAt, now)}
          {failed && <span className="ml-2 text-amber-300">· Actualisation impossible, nouvel essai automatique.</span>}
        </p>
        <button
          type="button"
          onClick={() => void pollerRef.current?.refreshNow()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm text-neutral-100 hover:bg-white/5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualiser
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Suivi des élèves — {data.activity.title}</caption>
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
            <tr>
              <th scope="col" className="px-3 py-2">Élève</th>
              <th scope="col" className="px-3 py-2">{isUpload ? 'Fichiers' : 'Progression'}</th>
              <th scope="col" className="px-3 py-2">Dernière activité</th>
              <th scope="col" className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-400">Aucun élève inscrit à cette matière dans vos groupes.</td>
              </tr>
            )}
            {data.rows.map((r) => (
              <tr key={r.studentId} data-testid="roster-row">
                <th scope="row" className="px-3 py-2 font-medium text-neutral-50">
                  {r.workId ? (
                    <Link href={`/espace/enseignant/corriger/${r.workId}`} className="underline decoration-white/30 underline-offset-2 hover:decoration-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                  <span className="block text-xs font-normal text-neutral-400">{r.groupName}</span>
                </th>
                <td className="px-3 py-2">
                  {isUpload ? (
                    <span className="text-neutral-400">—</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <progress className="h-2 w-24 accent-brand-accent" value={r.progressSteps} max={data.activity.stepsTotal} aria-label={`Progression de ${r.name}`} />
                      <span className="tabular-nums text-neutral-100">{r.progressSteps}/{data.activity.stepsTotal}</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-300">{formatRelative(r.lastSavedAt, now)}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} audience="teacher" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
