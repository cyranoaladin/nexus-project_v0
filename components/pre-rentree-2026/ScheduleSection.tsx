'use client';

import { useState } from 'react';

interface ScheduleSectionProps {
  schedule: Array<{
    date: string;
    level: string;
    subject: string;
    block: string;
    startTime: string;
    endTime: string;
    room: string;
    week: number;
    sessionNumber: number;
  }>;
  levels: Array<{ id: string; label: string }>;
  subjects: Array<{ id: string; label: string; labelByLevel?: Record<string, string> }>;
  campaign: { startDate: string; endDate: string; noClassDates: string[] };
}

export function ScheduleSection({ schedule, levels, subjects, campaign }: ScheduleSectionProps) {
  const [activeLevel, setActiveLevel] = useState(levels[0]?.id ?? 'SECONDE');

  const getSubjectLabel = (subjectId: string, levelId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return subjectId;
    return subject.labelByLevel?.[levelId] ?? subject.label;
  };

  const levelSchedule = schedule.filter(s => s.level === activeLevel);
  const bySubject = levelSchedule.reduce<Record<string, typeof levelSchedule>>((acc, s) => {
    if (!acc[s.subject]) acc[s.subject] = [];
    acc[s.subject].push(s);
    return acc;
  }, {});

  return (
    <div className="bg-white py-14 md:py-20 px-4" aria-labelledby="schedule-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="schedule-heading" className="font-fraunces text-2xl md:text-3xl text-lux-ink mb-6">
          Planning
        </h2>

        <div role="tablist" aria-label="Niveaux" className="flex gap-2 mb-8 flex-wrap">
          {levels.map(level => (
            <button
              key={level.id}
              role="tab"
              aria-selected={activeLevel === level.id}
              aria-controls={`schedule-panel-${level.id}`}
              onClick={() => setActiveLevel(level.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                activeLevel === level.id
                  ? 'bg-lux-ink text-lux-on-dark'
                  : 'bg-lux-paper text-lux-ink hover:bg-lux-ink/5'
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`schedule-panel-${activeLevel}`}
          aria-labelledby={`tab-${activeLevel}`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(bySubject).map(([subjectId, sessions]) => {
              const firstSession = sessions[0];
              const lastSession = sessions[sessions.length - 1];
              const weekLabel = firstSession.week === 1 ? '17–21 août' : '24–28 août';

              return (
                <div key={subjectId} className="rounded-xl border border-lux-line p-5">
                  <h3 className="font-semibold text-lux-ink mb-2">
                    {getSubjectLabel(subjectId, activeLevel)}
                  </h3>
                  <p className="text-sm text-lux-slate">Semaine {firstSession.week} — {weekLabel}</p>
                  <p className="text-sm text-lux-slate">{firstSession.startTime}–{firstSession.endTime}</p>
                  <p className="text-sm text-lux-slate">{sessions.length} séances · 10 heures</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
