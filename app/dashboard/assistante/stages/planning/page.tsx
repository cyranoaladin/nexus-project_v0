'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Video,
  Users,
  Clock,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

type PlanningEventSource = 'SESSION_BOOKING' | 'STAGE_SESSION';

interface PlanningEvent {
  id: string;
  source: PlanningEventSource;
  title: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string | null;
  status?: string;
  stage?: { id: string; title: string; slug: string } | null;
  student?: { id: string; firstName: string | null; lastName: string | null } | null;
  coach?: { id: string; firstName: string | null; lastName: string | null; pseudonym: string | null } | null;
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

function toLocalDateParam(d: Date): string {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fullName(p?: { firstName: string | null; lastName: string | null } | null) {
  return `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();
}

type StudentOption = {
  studentEntityId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type CoachOption = {
  userId: string;
  pseudonym: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

function durationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const start = (Number.isNaN(sh) ? 0 : sh) * 60 + (Number.isNaN(sm) ? 0 : sm);
  const end = (Number.isNaN(eh) ? 0 : eh) * 60 + (Number.isNaN(em) ? 0 : em);
  return end - start;
}

export default function AssistantePlanningPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selected, setSelected] = useState<PlanningEvent | null>(null);
  const [showStages, setShowStages] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);

  const [coachSearch, setCoachSearch] = useState('');
  const [coachOptions, setCoachOptions] = useState<CoachOption[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<CoachOption | null>(null);

  const [formSubject, setFormSubject] = useState<keyof typeof SUBJECT_LABELS>('MATHEMATIQUES');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDate, setFormDate] = useState(() => toLocalDateParam(new Date()));
  const [formStartTime, setFormStartTime] = useState('17:00');
  const [formEndTime, setFormEndTime] = useState('18:00');
  const [formType, setFormType] = useState<'INDIVIDUAL' | 'GROUP' | 'MASTERCLASS'>('INDIVIDUAL');
  const [formModality, setFormModality] = useState<'ONLINE' | 'IN_PERSON' | 'HYBRID'>('ONLINE');
  const [formOverride, setFormOverride] = useState(false);
  const [formRecurEnabled, setFormRecurEnabled] = useState(false);
  const [formRecurCount, setFormRecurCount] = useState(8);
  const [formRecurInterval, setFormRecurInterval] = useState(1);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated' && session?.user?.role !== 'ASSISTANTE' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const weekDates = getWeekDates(currentWeek);
      const from = toLocalDateParam(weekDates[0]);
      const to = toLocalDateParam(weekDates[6]);

      const res = await fetch(
        `/api/assistante/planning?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&includeStages=${showStages ? 'true' : 'false'}&includeSessions=${showSessions ? 'true' : 'false'}`
      );
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json() as { events: PlanningEvent[] };
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [currentWeek, showStages, showSessions]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let ignore = false;
    const q = studentSearch.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        if (!ignore) setStudentOptions([]);
        return;
      }
      try {
        const res = await fetch(`/api/assistante/students?search=${encodeURIComponent(q)}&limit=10&page=1`);
        const data = await res.json() as { students?: any[] };
        if (!res.ok) throw new Error('fetch');
        const opts: StudentOption[] = (data.students ?? []).map((s) => ({
          studentEntityId: s.id,
          userId: s.user?.id,
          firstName: s.user?.firstName ?? null,
          lastName: s.user?.lastName ?? null,
          email: s.user?.email ?? null,
        })).filter((s) => Boolean(s.userId));
        if (!ignore) setStudentOptions(opts);
      } catch {
        if (!ignore) setStudentOptions([]);
      }
    }, 250);
    return () => { ignore = true; clearTimeout(t); };
  }, [studentSearch]);

  useEffect(() => {
    let ignore = false;
    const q = coachSearch.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        if (!ignore) setCoachOptions([]);
        return;
      }
      try {
        const res = await fetch(`/api/assistante/coaches?search=${encodeURIComponent(q)}&limit=10&page=1`);
        const data = await res.json() as { coaches?: any[] };
        if (!res.ok) throw new Error('fetch');
        const opts: CoachOption[] = (data.coaches ?? []).map((c) => ({
          userId: c.userId,
          pseudonym: c.pseudonym ?? null,
          firstName: c.firstName ?? null,
          lastName: c.lastName ?? null,
          email: c.email ?? null,
        })).filter((c) => Boolean(c.userId));
        if (!ignore) setCoachOptions(opts);
      } catch {
        if (!ignore) setCoachOptions([]);
      }
    }, 250);
    return () => { ignore = true; clearTimeout(t); };
  }, [coachSearch]);

  const openCreate = () => {
    setCreateError(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (createBusy) return;
    setCreateOpen(false);
    setCreateError(null);
  };

  const submitCreate = async () => {
    setCreateError(null);
    if (!selectedStudent) return setCreateError('Sélectionnez un élève.');
    if (!selectedCoach) return setCreateError('Sélectionnez un coach.');
    if (!formTitle.trim()) return setCreateError('Titre requis.');

    const dur = durationMinutes(formStartTime, formEndTime);
    if (dur <= 0) return setCreateError('Créneau invalide (fin avant début).');

    try {
      setCreateBusy(true);
      const payload: any = {
        studentId: selectedStudent.userId,
        coachId: selectedCoach.userId,
        subject: formSubject,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        location: formLocation.trim() || undefined,
        scheduledDate: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        duration: dur,
        type: formType,
        modality: formModality,
        override: formOverride,
      };

      if (formRecurEnabled) {
        payload.recurrence = {
          frequency: 'WEEKLY',
          intervalWeeks: Math.max(1, formRecurInterval || 1),
          count: Math.max(1, formRecurCount || 1),
        };
      }

      const res = await fetch('/api/assistante/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data?.message || 'Erreur création séance.');
        return;
      }

      await load();
      setCreateOpen(false);
      setFormTitle('');
      setFormDescription('');
      setFormLocation('');
      setFormOverride(false);
      setFormRecurEnabled(false);
      setSelectedStudent(null);
      setSelectedCoach(null);
      setStudentSearch('');
      setCoachSearch('');
      setStudentOptions([]);
      setCoachOptions([]);
    } catch {
      setCreateError('Erreur création séance.');
    } finally {
      setCreateBusy(false);
    }
  };

  const cancelSelectedSession = async () => {
    if (!selected || selected.source !== 'SESSION_BOOKING') return;
    const id = selected.id.startsWith('sessionBooking:') ? selected.id.replace('sessionBooking:', '') : selected.id;
    const ok = window.confirm('Annuler cette séance ?');
    if (!ok) return;
    try {
      const res = await fetch('/api/sessions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          reason: 'Annulé par assistante (planning)',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || 'Annulation impossible.');
        return;
      }
      setSelected(null);
      await load();
    } catch {
      alert('Annulation impossible.');
    }
  };

  const weekDates = getWeekDates(currentWeek);
  const prevWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); };
  const nextWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); };
  const goToday = () => setCurrentWeek(new Date());

  const visibleEvents = events.filter((e) => {
    if (e.source === 'STAGE_SESSION') return showStages;
    if (e.source === 'SESSION_BOOKING') return showSessions;
    return true;
  });

  const eventsByDay = weekDates.map(date =>
    visibleEvents.filter(e => isSameDay(new Date(e.startAt), date))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  );

  const weekLabel = `${weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const subjectCounts = visibleEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.subject] = (acc[e.subject] ?? 0) + 1;
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
              <h1 className="text-2xl font-semibold text-white">Planning global</h1>
              <p className="text-xs text-neutral-400 mt-1">Stages + séances régulières</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" /> Actualiser
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-sm font-medium text-brand-accent hover:bg-brand-accent/20"
            >
              <Plus className="h-4 w-4" /> Nouvelle séance
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/5 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSessions((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                showSessions ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              Séances
            </button>
            <button
              type="button"
              onClick={() => setShowStages((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                showStages ? 'border-violet-500/30 bg-violet-500/10 text-violet-200' : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              Stages
            </button>
          </div>
          <div className="text-xs text-neutral-400">
            {visibleEvents.length} événement{visibleEvents.length > 1 ? 's' : ''}
          </div>
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
            const dayEvents = eventsByDay[idx];
            return (
              <div key={idx} className={`rounded-[20px] border p-3 ${isToday ? 'border-brand-accent/40 bg-brand-accent/5' : 'border-white/10 bg-white/5'}`}>
                <div className="mb-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{DAYS[idx]}</p>
                  <p className={`mt-0.5 text-lg font-bold ${isToday ? 'text-brand-accent' : 'text-white'}`}>
                    {date.getDate()}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {dayEvents.length === 0 ? (
                    <p className="text-center text-[10px] text-neutral-700">—</p>
                  ) : dayEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className={`w-full rounded-xl border px-2 py-1.5 text-left text-[10px] leading-tight transition hover:brightness-125 ${SUBJECT_COLORS[e.subject] ?? SUBJECT_COLORS.DEFAULT}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate">{e.title}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          e.source === 'SESSION_BOOKING'
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-violet-500/15 text-violet-200'
                        }`}>
                          {e.source === 'SESSION_BOOKING' ? 'Séance' : 'Stage'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[9px] opacity-80 truncate">
                        {new Date(e.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {e.source === 'SESSION_BOOKING' && e.student ? ` • ${fullName(e.student)}` : ''}
                        {e.source === 'STAGE_SESSION' && e.stage ? ` • ${e.stage.title}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {visibleEvents.length === 0 && (
          <div className="mt-10 rounded-[24px] border border-white/10 bg-white/5 py-16 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-neutral-600" />
            <p className="mt-4 text-sm text-neutral-400">Aucun événement planifié</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md rounded-t-[32px] border border-white/10 bg-surface-dark p-6 sm:rounded-[32px]"
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
            {selected.source === 'STAGE_SESSION' && selected.stage && (
              <p className="mt-1 text-sm text-brand-accent">{selected.stage.title}</p>
            )}
            {selected.source === 'SESSION_BOOKING' && selected.student && (
              <p className="mt-1 text-sm text-brand-accent">{fullName(selected.student) || 'Élève'}</p>
            )}

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
              {selected.coach && (selected.coach.pseudonym || fullName(selected.coach)) && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-500" />
                  Coach&nbsp;: {selected.coach.pseudonym ?? fullName(selected.coach)}
                </div>
              )}
              {selected.source === 'SESSION_BOOKING' && selected.status && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-500" />
                  Statut&nbsp;: {selected.status}
                </div>
              )}
            </div>

            <div className="mt-6">
              {selected.source === 'STAGE_SESSION' ? (
                <Link
                  href={`/dashboard/assistante/stages`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-white/10"
                  onClick={() => setSelected(null)}
                >
                  Ouvrir l&apos;espace Stages
                </Link>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={cancelSelectedSession}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
                  >
                    Annuler la séance
                  </button>
                  <Link
                    href={`/dashboard/assistante/students`}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-white/10"
                    onClick={() => setSelected(null)}
                  >
                    Ouvrir l&apos;espace Élèves
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={closeCreate}>
          <div
            className="w-full max-w-lg rounded-t-[32px] border border-white/10 bg-surface-dark p-6 sm:rounded-[32px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Nouvelle séance</h2>
                <p className="mt-1 text-xs text-neutral-400">
                  Les conflits sont toujours bloqués. Le mode “forcer” ignore uniquement les validations non-conflit (disponibilité/matière/crédits).
                </p>
              </div>
              <button onClick={closeCreate} className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-neutral-400 hover:text-neutral-200">
                ✕
              </button>
            </div>

            {createError && (
              <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-neutral-400">Élève</label>
                  {selectedStudent ? (
                    <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{fullName(selectedStudent)}</p>
                        <p className="truncate text-xs text-neutral-500">{selectedStudent.email ?? ''}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-300 hover:bg-white/10"
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <input
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Rechercher… (nom/email)"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-brand-accent/40"
                      />
                      {studentOptions.length > 0 && (
                        <div className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-surface-darker p-1">
                          {studentOptions.map((s) => (
                            <button
                              key={s.userId}
                              type="button"
                              onClick={() => { setSelectedStudent(s); setStudentSearch(''); setStudentOptions([]); }}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-200 hover:bg-white/10"
                            >
                              <div className="truncate font-medium text-white">{fullName(s) || 'Élève'}</div>
                              <div className="truncate text-xs text-neutral-500">{s.email ?? ''}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-400">Coach</label>
                  {selectedCoach ? (
                    <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {selectedCoach.pseudonym ?? (fullName(selectedCoach) || 'Coach')}
                        </p>
                        <p className="truncate text-xs text-neutral-500">{selectedCoach.email ?? ''}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCoach(null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-300 hover:bg-white/10"
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <input
                        value={coachSearch}
                        onChange={(e) => setCoachSearch(e.target.value)}
                        placeholder="Rechercher… (pseudo/email)"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-brand-accent/40"
                      />
                      {coachOptions.length > 0 && (
                        <div className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-surface-darker p-1">
                          {coachOptions.map((c) => (
                            <button
                              key={c.userId}
                              type="button"
                              onClick={() => { setSelectedCoach(c); setCoachSearch(''); setCoachOptions([]); }}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-200 hover:bg-white/10"
                            >
                              <div className="truncate font-medium text-white">{c.pseudonym ?? (fullName(c) || 'Coach')}</div>
                              <div className="truncate text-xs text-neutral-500">{c.email ?? ''}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-neutral-400">Matière</label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value as any)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-accent/40"
                  >
                    {Object.keys(SUBJECT_LABELS).map((s) => (
                      <option key={s} value={s}>{SUBJECT_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400">Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-accent/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-neutral-400">Début</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-accent/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400">Fin</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-accent/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400">Durée</label>
                  <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200">
                    {Math.max(0, durationMinutes(formStartTime, formEndTime))} min
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-neutral-400">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-accent/40"
                  >
                    <option value="INDIVIDUAL">Individuel</option>
                    <option value="GROUP">Groupe</option>
                    <option value="MASTERCLASS">Masterclass</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400">Modalité</label>
                  <select
                    value={formModality}
                    onChange={(e) => setFormModality(e.target.value as any)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-accent/40"
                  >
                    <option value="ONLINE">En ligne</option>
                    <option value="IN_PERSON">Présentiel</option>
                    <option value="HYBRID">Hybride</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400">Titre</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Maths — dérivation"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-brand-accent/40"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-neutral-400">Lieu / lien</label>
                  <input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Zoom / Adresse"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-brand-accent/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400">Description (optionnel)</label>
                  <input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Notes"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-brand-accent/40"
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <label className="flex items-center justify-between gap-3 text-sm text-neutral-200">
                  <span>Récurrence hebdomadaire</span>
                  <input
                    type="checkbox"
                    checked={formRecurEnabled}
                    onChange={(e) => setFormRecurEnabled(e.target.checked)}
                    className="h-4 w-4 accent-brand-accent"
                  />
                </label>
                {formRecurEnabled && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-neutral-400">Nombre de semaines</label>
                      <input
                        type="number"
                        min={1}
                        max={104}
                        value={formRecurCount}
                        onChange={(e) => setFormRecurCount(parseInt(e.target.value || '1', 10))}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-accent/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-400">Intervalle (semaines)</label>
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={formRecurInterval}
                        onChange={(e) => setFormRecurInterval(parseInt(e.target.value || '1', 10))}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-accent/40"
                      />
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-neutral-200">
                <span>Mode “forcer”</span>
                <input
                  type="checkbox"
                  checked={formOverride}
                  onChange={(e) => setFormOverride(e.target.checked)}
                  className="h-4 w-4 accent-brand-accent"
                />
              </label>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreate}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-white/10"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={createBusy}
                  className="rounded-2xl border border-brand-accent/40 bg-brand-accent/10 px-4 py-3 text-sm font-medium text-brand-accent hover:bg-brand-accent/20 disabled:opacity-50"
                >
                  {createBusy ? 'Création…' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
