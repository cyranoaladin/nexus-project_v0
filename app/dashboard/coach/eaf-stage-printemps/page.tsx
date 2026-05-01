'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText, Search, Users, Clock, CheckCircle2, AlertCircle,
  ChevronRight, Loader2, BookOpen,
} from 'lucide-react';

type BilanStatus = 'NOT_STARTED' | 'DRAFT' | 'COMPLETED' | 'VALIDATED';

type StudentRow = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gradeLevel?: string;
  academicTrack?: string;
  school?: string;
  bilanStatus: BilanStatus;
  bilanId?: string;
  lastSavedAt?: string;
  completedAt?: string;
};

const STATUS_CONFIG: Record<BilanStatus, { label: string; color: string; icon: React.ReactNode }> = {
  NOT_STARTED: {
    label: 'À rédiger',
    color: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
    icon: <FileText className="h-3 w-3" />,
  },
  DRAFT: {
    label: 'Brouillon',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: <Clock className="h-3 w-3" />,
  },
  COMPLETED: {
    label: 'Complété',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  VALIDATED: {
    label: 'Validé',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

type FilterOption = 'ALL' | BilanStatus;

const FILTERS: { key: FilterOption; label: string }[] = [
  { key: 'ALL', label: 'Tous' },
  { key: 'NOT_STARTED', label: 'À rédiger' },
  { key: 'DRAFT', label: 'Brouillons' },
  { key: 'COMPLETED', label: 'Complétés' },
  { key: 'VALIDATED', label: 'Validés' },
];

function getActionButton(student: StudentRow) {
  const base = `/dashboard/coach/eaf-stage-printemps/${student.id}`;
  switch (student.bilanStatus) {
    case 'NOT_STARTED':
      return { href: base, label: 'Rédiger le bilan', primary: true };
    case 'DRAFT':
      return { href: base, label: 'Continuer le brouillon', primary: true };
    case 'COMPLETED':
      return { href: base, label: 'Modifier', primary: false };
    case 'VALIDATED':
      return { href: base, label: 'Voir le bilan', primary: false };
  }
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function CoachEafStageListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'COACH') {
      router.push('/auth/signin');
    }
  }, [session, status, router]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/coach/eaf-stage-printemps/students');
      if (!res.ok) throw new Error('Impossible de charger la liste des élèves.');
      const data = await res.json() as { students: StudentRow[]; count: number };
      setStudents(data.students ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchStudents();
  }, [status, fetchStudents]);

  const filtered = useMemo(() => {
    let list = students;
    if (filter !== 'ALL') list = list.filter(s => s.bilanStatus === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => {
        const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.toLowerCase();
        return name.includes(q) || (s.email ?? '').toLowerCase().includes(q);
      });
    }
    return list;
  }, [students, filter, search]);

  const counts = useMemo(() => {
    const c: Record<BilanStatus, number> = {
      NOT_STARTED: 0, DRAFT: 0, COMPLETED: 0, VALIDATED: 0,
    };
    for (const s of students) c[s.bilanStatus]++;
    return c;
  }, [students]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent/15">
            <BookOpen className="h-5 w-5 text-brand-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Bilan coach — Stage de printemps EAF</h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-neutral-400">
          Renseignez un bilan pédagogique pour chaque élève suivi afin de préparer un retour clair et exploitable pour les familles.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.entries(STATUS_CONFIG) as [BilanStatus, typeof STATUS_CONFIG[BilanStatus]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'ALL' : key)}
            className={`rounded-2xl border p-4 text-left transition hover:bg-white/5 ${
              filter === key ? 'border-brand-accent/40 bg-brand-accent/10' : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="text-2xl font-bold text-white">{counts[key]}</div>
            <div className="mt-1 text-xs text-neutral-400">{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                filter === f.key
                  ? 'bg-brand-accent/20 text-brand-accent'
                  : 'bg-white/5 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un élève…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-neutral-200 placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none sm:w-64"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && filtered.length === 0 && (
        <div className="rounded-[28px] border border-white/10 bg-white/5 py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-neutral-600" />
          <p className="mt-4 text-neutral-400">
            {students.length === 0
              ? "Aucun élève de Première n'est assigné à votre compte."
              : 'Aucun élève ne correspond à vos critères.'}
          </p>
        </div>
      )}

      {/* Student list */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(student => {
            const cfg = STATUS_CONFIG[student.bilanStatus];
            const action = getActionButton(student);
            const displayName = [student.firstName, student.lastName].filter(Boolean).join(' ') || student.email || 'Élève';

            return (
              <div
                key={student.id}
                className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/5 p-5 transition hover:border-white/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-sm font-semibold text-brand-accent">
                    {(student.firstName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{displayName}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-500">
                      {student.gradeLevel && <span>{student.gradeLevel}</span>}
                      {student.academicTrack && <span>{student.academicTrack}</span>}
                      {student.school && <span>{student.school}</span>}
                      {student.lastSavedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Sauvegardé le {formatDate(student.lastSavedAt)}
                        </span>
                      )}
                      {student.completedAt && student.bilanStatus !== 'DRAFT' && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Complété le {formatDate(student.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  href={action.href}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    action.primary
                      ? 'bg-brand-accent text-white hover:bg-brand-accent/90'
                      : 'border border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10'
                  }`}
                >
                  {action.label}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
