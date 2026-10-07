'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { espaceApi } from '@/lib/espace/client/api';

import { describeError } from './describe-error';

export interface SessionRowView {
  id: string;
  title: string | null;
  subjectLabel: string;
  groupName: string;
  activityTitle: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  scheduledAt: string | null;
  participants: number;
}

interface Option {
  groupId: string;
  groupName: string;
  subject: string;
  subjectLabel: string;
}

interface ActivityOption {
  slug: string;
  title: string;
  subject: string;
}

const STATUS_LABEL = { DRAFT: 'Brouillon', PUBLISHED: 'Publiée', CLOSED: 'Clôturée' } as const;
const STATUS_TONE = { DRAFT: 'border-white/15 text-neutral-300', PUBLISHED: 'border-emerald-400/40 text-emerald-200', CLOSED: 'border-white/15 text-neutral-400' } as const;

const field = 'mt-1 block h-10 w-full rounded-md border border-white/15 bg-white/5 px-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent';

export function SessionManager({ sessions, pairs, activities, timezone }: { sessions: SessionRowView[]; pairs: Option[]; activities: ActivityOption[]; timezone: string }) {
  const router = useRouter();
  const [pairKey, setPairKey] = useState(pairs[0] ? `${pairs[0].groupId}|${pairs[0].subject}` : '');
  const [activitySlug, setActivitySlug] = useState('');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [groupId, subject] = pairKey.split('|');
  const available = activities.filter((a) => a.subject === subject);
  const chosen = available.find((a) => a.slug === activitySlug) ?? available[0];

  async function act(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: 'ok', text: success });
      router.refresh();
    } catch (e) {
      setMessage({ kind: 'error', text: describeError(e) });
    } finally {
      setBusy(null);
    }
  }

  function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen) return;
    void act(
      'create',
      () =>
        espaceApi.createSession({
          groupId,
          subject,
          activitySlug: chosen.slug,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(when ? { scheduledAt: new Date(when).toISOString() } : {}),
        }),
      'Séance créée en brouillon. Publiez-la pour qu’elle apparaisse chez les élèves.',
    ).then(() => setTitle(''));
  }

  const dateFmt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(iso));

  return (
    <div className="space-y-8">
      {pairs.length === 0 ? (
        <p className="rounded-lg border border-white/10 p-4 text-neutral-300">Aucune affectation : vous n’enseignez aucun groupe pour le moment.</p>
      ) : (
        <form onSubmit={onCreate} className="grid gap-4 rounded-xl border border-white/10 bg-surface-card p-4 sm:grid-cols-2" aria-label="Nouvelle séance">
          <h2 className="sm:col-span-2 text-lg font-semibold text-neutral-50">Nouvelle séance</h2>
          <label className="text-sm text-neutral-200">
            Groupe et matière
            <select className={field} value={pairKey} onChange={(e) => { setPairKey(e.target.value); setActivitySlug(''); }}>
              {pairs.map((p) => (
                <option key={`${p.groupId}|${p.subject}`} value={`${p.groupId}|${p.subject}`}>{p.groupName} — {p.subjectLabel}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-200">
            Activité
            <select className={field} value={chosen?.slug ?? ''} onChange={(e) => setActivitySlug(e.target.value)} disabled={available.length === 0}>
              {available.length === 0 && <option value="">Aucune activité pour cette matière</option>}
              {available.map((a) => (
                <option key={a.slug} value={a.slug}>{a.title}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-200">
            Titre (facultatif)
            <input className={field} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-sm text-neutral-200">
            Date et heure (facultatif)
            <input className={field} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={!chosen || busy === 'create'} className="rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Créer la séance
            </button>
          </div>
        </form>
      )}

      <div aria-live="polite">
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-md border p-3 text-sm ${message.kind === 'error' ? 'border-amber-400/40 bg-amber-400/10 text-amber-100' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Vos séances</caption>
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
            <tr>
              <th scope="col" className="px-3 py-2">Séance</th>
              <th scope="col" className="px-3 py-2">Groupe</th>
              <th scope="col" className="px-3 py-2">Participants</th>
              <th scope="col" className="px-3 py-2">État</th>
              <th scope="col" className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sessions.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Aucune séance pour le moment.</td></tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id} data-testid="session-row">
                <th scope="row" className="px-3 py-2 font-medium text-neutral-50">
                  {s.title ?? s.activityTitle}
                  <span className="block text-xs font-normal text-neutral-400">{s.subjectLabel} · {s.activityTitle}{s.scheduledAt ? ` · ${dateFmt(s.scheduledAt)}` : ''}</span>
                </th>
                <td className="px-3 py-2 text-neutral-300">{s.groupName}</td>
                <td className="px-3 py-2 tabular-nums text-neutral-300">{s.status === 'DRAFT' ? '—' : s.participants}</td>
                <td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[s.status]}`}>{STATUS_LABEL[s.status]}</span></td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {s.status !== 'CLOSED' && (
                      <button type="button" disabled={busy === s.id} onClick={() => void act(s.id, () => espaceApi.publishSession(s.id), s.status === 'DRAFT' ? 'Séance publiée : les élèves inscrits la voient.' : 'Participants mis à jour.')} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-neutral-100 hover:bg-white/5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                        {s.status === 'DRAFT' ? 'Publier' : 'Réactualiser les participants'}
                      </button>
                    )}
                    {s.status === 'PUBLISHED' && (
                      <button type="button" disabled={busy === s.id} onClick={() => void act(s.id, () => espaceApi.closeSession(s.id), 'Séance clôturée.')} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-neutral-100 hover:bg-white/5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                        Clôturer
                      </button>
                    )}
                    <a href={`/api/espace/teacher/export?sessionId=${s.id}`} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                      Exporter (JSON)
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
