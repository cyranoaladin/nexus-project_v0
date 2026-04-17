'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, CalendarDays,
  MapPin, Video, Users, Clock,
} from 'lucide-react';
import Link from 'next/link';

interface SessionItem {
  id: string;
  title: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string | null;
  stageTitle: string;
  stageSlug: string;
  coach: { pseudonym: string } | null;
}

interface StageData {
  id: string;
  slug: string;
  title: string;
  sessions: Array<{
    id: string;
    title: string;
    subject: string;
    startAt: string;
    endAt: string;
    location: string | null;
    coach: { pseudonym: string } | null;
  }>;
  reservations: Array<{ richStatus: string | null; status: string }>;
}

const SUBJECT_COLORS: Record<string, string> = {
  MATHEMATIQUES: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  NSI: 'bg-violet-500/20 border-violet-500/40 text-violet-300',
  FRANCAIS: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
  PHILOSOPHIE: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  PHYSIQUE_CHIMIE: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  ANGLAIS: 'bg-green-500/20 border-green-500/40 text-green-300',
  DEFAULT: 'bg-white/10 border-white/20 text-neutral-200',
};

const SUBJECT_LABELS: Record<string, string> = {
  MATHEMATIQUES: 'Maths', NSI: 'NSI', FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philo', HISTOIRE_GEO: 'H-G', ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol', PHYSIQUE_CHIMIE: 'PC', SVT: 'SVT', SES: 'SES',
};

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export default function AssistantePlanningPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [allSessions, setAllSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selected, setSelected] = useState<SessionItem | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated' && session?.user?.role !== 'ASSISTANTE' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stages');
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json() as { stages: StageData[] };
      const flat: SessionItem[] = (data.stages ?? []).flatMap(stage =>
        (stage.sessions ?? []).map(s => ({
          ...s,
          stageTitle: stage.title,
          stageSlug: stage.slug,
        }))
      );
      setAllSessions(flat);
    } catch {
      setAllSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const weekDates = getWeekDates(currentWeek);
  const prevWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); };
  const nextWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); };
  const goToday = () => setCurrentWeek(new Date());

  const sessionsByDay = weekDates.map(date =>
    allSessions.filter(s => isSameDay(new Date(s.startAt), date))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  );

  const weekLabel = `${weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const subjectCounts = allSessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.subject] = (acc[s.subject] ?? 0) + 1;
    return acc;
  }, {});

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-darker">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/assistante/stages"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Assistante</p>
              <h1 className="text-2xl font-semibold text-white">Planning global des stages</h1>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-52 text-center text-sm font-medium text-white">{weekLabel}</span>
            <button onClick={nextWeek} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button onClick={goToday} className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 px-4 py-2 text-sm font-medium text-brand-accent hover:bg-brand-accent/20">
            Aujourd&apos;hui
          </button>
        </div>

        {Object.keys(subjectCounts).length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {Object.entries(subjectCounts).map(([subject, count]) => (
              <span key={subject} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${SUBJECT_COLORS[subject] ?? SUBJECT_COLORS.DEFAULT}`}>
                {SUBJECT_LABELS[subject] ?? subject}
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{count}</span>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, idx) => {
            const isToday = isSameDay(date, new Date());
            const sessions = sessionsByDay[idx];
            return (
              <div key={idx} className={`rounded-[20px] border p-3 ${isToday ? 'border-brand-accent/40 bg-brand-accent/5' : 'border-white/10 bg-white/5'}`}>
                <div className="mb-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{DAYS[idx]}</p>
                  <p className={`mt-0.5 text-lg font-bold ${isToday ? 'text-brand-accent' : 'text-white'}`}>
                    {date.getDate()}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {sessions.length === 0 ? (
                    <p className="text-center text-[10px] text-neutral-700">—</p>
                  ) : sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className={`w-full rounded-xl border px-2 py-1.5 text-left text-[10px] leading-tight transition hover:brightness-125 ${SUBJECT_COLORS[s.subject] ?? SUBJECT_COLORS.DEFAULT}`}
                    >
                      <p className="font-semibold truncate">{s.title}</p>
                      <p className="mt-0.5 text-[9px] opacity-80">
                        {new Date(s.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {allSessions.length === 0 && (
          <div className="mt-10 rounded-[24px] border border-white/10 bg-white/5 py-16 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-neutral-600" />
            <p className="mt-4 text-sm text-neutral-400">Aucune séance planifiée</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md rounded-t-[32px] border border-white/10 bg-[#0d1117] p-6 sm:rounded-[32px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${SUBJECT_COLORS[selected.subject] ?? SUBJECT_COLORS.DEFAULT}`}>
                {SUBJECT_LABELS[selected.subject] ?? selected.subject}
              </span>
              <button onClick={() => setSelected(null)} className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-neutral-400 hover:text-neutral-200">
                ✕
              </button>
            </div>

            <h2 className="text-xl font-semibold text-white">{selected.title}</h2>
            <p className="mt-1 text-sm text-brand-accent">{selected.stageTitle}</p>

            <div className="mt-5 space-y-3 text-sm text-neutral-300">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-neutral-500" />
                {new Date(selected.startAt).toLocaleString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                  hour: '2-digit', minute: '2-digit',
                })}
                {' – '}
                {new Date(selected.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {selected.location && (
                <div className="flex items-center gap-2">
                  {/en ligne|online|zoom|meet/i.test(selected.location)
                    ? <Video className="h-4 w-4 text-neutral-500" />
                    : <MapPin className="h-4 w-4 text-neutral-500" />}
                  {selected.location}
                </div>
              )}
              {selected.coach && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-500" />
                  Coach&nbsp;: {selected.coach.pseudonym}
                </div>
              )}
            </div>

            <div className="mt-6">
              <Link
                href={`/dashboard/assistante/stages`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-white/10"
                onClick={() => setSelected(null)}
              >
                Voir les réservations de ce stage
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
