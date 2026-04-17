'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

export interface CalendarSession {
  id: string;
  title: string;
  subject: string;
  startAt: Date | string;
  endAt: Date | string;
  location?: string | null;
  coach?: { pseudonym: string } | null;
}

interface WeeklyCalendarProps {
  sessions: CalendarSession[];
  startDate: Date;
  endDate: Date;
  onSessionClick?: (session: CalendarSession) => void;
  readonly?: boolean;
}

const SUBJECT_COLORS: Record<string, string> = {
  MATHEMATIQUES:  'bg-indigo-500/20 border-indigo-500/50 text-indigo-300',
  NSI:            'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
  FRANCAIS:       'bg-rose-500/20 border-rose-500/50 text-rose-300',
  PHILOSOPHIE:    'bg-violet-500/20 border-violet-500/50 text-violet-300',
  PHYSIQUE_CHIMIE:'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
  SES:            'bg-orange-500/20 border-orange-500/50 text-orange-300',
  DEFAULT:        'bg-slate-500/20 border-slate-500/50 text-slate-300',
};

const HOUR_START = 8;
const HOUR_END = 18;
const SLOT_HEIGHT = 48; // px per hour

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function getDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const DAY_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

export function WeeklyCalendar({ sessions, startDate, endDate, onSessionClick }: WeeklyCalendarProps) {
  const [drawer, setDrawer] = useState<CalendarSession | null>(null);
  const days = useMemo(() => getDays(startDate, endDate), [startDate, endDate]);
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = hours.length * SLOT_HEIGHT;

  function topOffset(session: CalendarSession): number {
    const start = toDate(session.startAt);
    const mins = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
    return (mins / 60) * SLOT_HEIGHT;
  }

  function blockHeight(session: CalendarSession): number {
    const start = toDate(session.startAt);
    const end = toDate(session.endAt);
    const durationMins = (end.getTime() - start.getTime()) / 60000;
    return Math.max((durationMins / 60) * SLOT_HEIGHT, 24);
  }

  const now = new Date();
  const isActive = (s: CalendarSession) =>
    now >= toDate(s.startAt) && now <= toDate(s.endAt);

  function handleClick(s: CalendarSession) {
    setDrawer(s);
    onSessionClick?.(s);
  }

  return (
    <div className="relative">
      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60">
        <div className="min-w-[640px]">
          {/* Header row */}
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            <div className="h-10" />
            {days.map((d) => (
              <div key={d.toISOString()} className="h-10 flex items-center justify-center text-xs font-medium text-slate-400 border-l border-white/5">
                <span className="mr-1">{DAY_FR[d.getDay()]}</span>
                <span className="text-white/70">{d.getDate()} {MONTH_FR[d.getMonth()]}</span>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: totalHeight }}>
            {/* Hour labels */}
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 text-right pr-2 text-[10px] text-slate-500"
                  style={{ top: (h - HOUR_START) * SLOT_HEIGHT - 6 }}
                >
                  {h}h
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const daySessions = sessions.filter((s) => isSameDay(toDate(s.startAt), day));
              return (
                <div key={day.toISOString()} className="relative border-l border-white/5">
                  {/* Hour lines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{ top: (h - HOUR_START) * SLOT_HEIGHT }}
                    />
                  ))}
                  {/* Sessions */}
                  {daySessions.map((s) => {
                    const color = SUBJECT_COLORS[s.subject] ?? SUBJECT_COLORS.DEFAULT;
                    const active = isActive(s);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleClick(s)}
                        className={`absolute left-1 right-1 rounded border text-left px-1.5 py-1 text-[11px] font-medium leading-tight transition-all hover:brightness-125 ${color} ${active ? 'ring-1 ring-white/40' : ''}`}
                        style={{ top: topOffset(s), height: blockHeight(s) }}
                      >
                        <div className="truncate font-semibold">{s.title}</div>
                        {s.coach && <div className="truncate opacity-70">{s.coach.pseudonym}</div>}
                        {active && <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-90">En cours</div>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end pointer-events-none">
          <div className="pointer-events-auto w-full sm:w-80 bg-slate-800 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:mr-4 sm:mb-4">
            <div className="flex items-start justify-between mb-3">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SUBJECT_COLORS[drawer.subject] ?? SUBJECT_COLORS.DEFAULT}`}>
                {drawer.subject.replace('_', ' ')}
              </span>
              <button onClick={() => setDrawer(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-white font-semibold text-sm mb-3">{drawer.title}</h3>
            <dl className="space-y-1.5 text-xs text-slate-400">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-medium text-slate-500">Début</dt>
                <dd>{toDate(drawer.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-medium text-slate-500">Fin</dt>
                <dd>{toDate(drawer.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</dd>
              </div>
              {drawer.coach && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-medium text-slate-500">Coach</dt>
                  <dd>{drawer.coach.pseudonym}</dd>
                </div>
              )}
              {drawer.location && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-medium text-slate-500">Salle</dt>
                  <dd>{drawer.location}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
