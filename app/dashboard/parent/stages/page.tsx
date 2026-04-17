'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, CalendarDays, BookOpen, Users } from 'lucide-react';
import { WeeklyCalendar, type CalendarSession } from '@/components/stages/WeeklyCalendar';
import { StageBilanCard, type StageBilanData } from '@/components/stages/StageBilanCard';
import { StageReservationStatus } from '@/components/stages/StageReservationStatus';

interface StageSessionItem {
  id: string; title: string; subject: string;
  startAt: string; endAt: string; location: string | null;
  coach: { pseudonym: string } | null;
}
interface StageDoc { id: string; title: string; fileUrl: string; }
interface StageItem {
  id: string; slug: string; title: string; subtitle: string | null;
  startDate: string; endDate: string; location: string | null;
  sessions: StageSessionItem[];
  documents: StageDoc[];
}
interface Reservation {
  id: string; email: string; richStatus: string | null;
  stage: StageItem | null;
}
interface BilanWithChild extends StageBilanData {
  student?: { user: { firstName: string; lastName: string } } | null;
}

export default function ParentStagesPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [bilans, setBilans] = useState<BilanWithChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'planning' | 'bilans'>('planning');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/parent/stages');
      const data = await res.json() as { reservations: Reservation[]; bilans: BilanWithChild[] };
      setReservations(data.reservations ?? []);
      setBilans(data.bilans ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmedReservations = reservations.filter((r) => r.stage);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Stages de mes enfants</h1>
          <p className="text-sm text-slate-400 mt-0.5">Planning et bilans de fin de stage</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />Chargement…
        </div>
      ) : confirmedReservations.length === 0 && bilans.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-8 text-center">
          <Users className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Aucun stage confirmé</p>
          <p className="text-slate-500 text-sm mt-1">
            Inscrivez votre enfant depuis le{' '}
            <a href="/stages" className="text-indigo-400 hover:underline">catalogue de stages</a>.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 bg-slate-800/50 border border-white/10 rounded-xl p-1 w-fit">
            {(['planning', 'bilans'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {tab === 'planning' ? <CalendarDays className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                {tab === 'planning' ? 'Planning' : `Bilans${bilans.length > 0 ? ` (${bilans.length})` : ''}`}
              </button>
            ))}
          </div>

          {activeTab === 'planning' && (
            <div className="space-y-5">
              {confirmedReservations.map(({ id, email, richStatus, stage }) => {
                if (!stage) return null;
                const sessions: CalendarSession[] = stage.sessions.map((s) => ({
                  ...s,
                  startAt: new Date(s.startAt),
                  endAt: new Date(s.endAt),
                }));

                return (
                  <div key={id} className="rounded-xl border border-white/10 bg-slate-800/50 overflow-hidden">
                    <div className="p-4 flex items-start justify-between border-b border-white/8">
                      <div>
                        <h2 className="text-white font-semibold">{stage.title}</h2>
                        <p className="text-slate-400 text-xs mt-0.5">{email}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>{new Date(stage.startDate).toLocaleDateString('fr-FR')} → {new Date(stage.endDate).toLocaleDateString('fr-FR')}</span>
                          {stage.location && <span>📍 {stage.location}</span>}
                        </div>
                      </div>
                      <StageReservationStatus status={richStatus} />
                    </div>

                    {sessions.length > 0 && (
                      <div className="p-4">
                        <WeeklyCalendar sessions={sessions} startDate={new Date(stage.startDate)} endDate={new Date(stage.endDate)} />
                      </div>
                    )}

                    {stage.documents.length > 0 && (
                      <div className="p-4 border-t border-white/8">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Ressources</p>
                        <div className="flex flex-wrap gap-2">
                          {stage.documents.map((doc) => (
                            <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs bg-slate-700/50 hover:bg-slate-700 border border-white/10 text-slate-300 rounded-lg px-3 py-1.5 transition-colors">
                              📄 {doc.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'bilans' && (
            <div className="space-y-4">
              {bilans.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-800/50 p-8 text-center text-slate-400 text-sm">
                  Les bilans seront disponibles à la fin du stage.
                </div>
              ) : (
                bilans.map((b) => {
                  const childName = b.student
                    ? `${b.student.user.firstName} ${b.student.user.lastName}`
                    : undefined;
                  return (
                    <StageBilanCard
                      key={b.id}
                      bilan={{ ...b, studentName: childName }}
                      view="parent"
                    />
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
