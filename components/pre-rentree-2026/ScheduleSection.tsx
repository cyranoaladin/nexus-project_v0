'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { track } from '@/lib/analytics';
import type {
  LandingLevel,
  LandingScheduleSlot,
  LandingSubject,
} from '@/lib/campaigns/pre-rentree-2026/configurator';

interface Block {
  id: string;
  startTime: string;
  endTime: string;
}

type ScheduleView = 'by_level' | 'by_week';

function subjectLabel(subjects: LandingSubject[], id: string, level: string): string {
  const subject = subjects.find((candidate) => candidate.id === id);
  return subject?.labelByLevel?.[level] ?? subject?.label ?? id;
}

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('fr-TN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Tunis',
  }).format(new Date(`${date}T12:00:00+01:00`));
}

function durationHours(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  return (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
}

function uniqueModules(slots: LandingScheduleSlot[]): LandingScheduleSlot[] {
  return slots.filter(
    (slot, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.level === slot.level && candidate.subject === slot.subject,
      ) === index,
  );
}

export function ScheduleSection({
  schedule,
  levels,
  subjects,
  blocks,
}: {
  schedule: LandingScheduleSlot[];
  levels: LandingLevel[];
  subjects: LandingSubject[];
  blocks: Block[];
}) {
  const [view, setView] = useState<ScheduleView>('by_level');
  const [level, setLevel] = useState(levels[0]?.id ?? 'SECONDE');
  const viewTabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  function selectView(next: ScheduleView) {
    setView(next);
    track.preRentreeScheduleViewed(next);
  }

  function handleViewKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' || event.key === 'ArrowLeft' ? 0 : 1;
    const nextView: ScheduleView = nextIndex === 0 ? 'by_level' : 'by_week';
    selectView(nextView);
    viewTabsRef.current[nextIndex]?.focus();
  }

  const levelSlots = schedule.filter((slot) => slot.level === level);
  const subjectsForLevel = [...new Set(levelSlots.map((slot) => slot.subject))];
  const weeks = [...new Set(schedule.map((slot) => slot.week))].sort();

  return (
    <section className="bg-white px-4 py-14 md:py-20" aria-labelledby="schedule-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="schedule-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">
          Planning
        </h2>
        <p className="mt-3 max-w-3xl text-lux-slate">
          Deux lectures du même planning : par classe de rentrée pour choisir les matières,
          ou par semaine pour visualiser les blocs quotidiens.
        </p>

        <div className="mt-6 inline-flex rounded-xl border border-lux-line bg-lux-paper p-1" role="tablist" aria-label="Vue du planning">
          {([['by_level', 'Par classe de rentrée'], ['by_week', 'Par semaine']] as const).map(
            ([id, label], index) => (
              <button
                key={id}
                ref={(element) => { viewTabsRef.current[index] = element; }}
                id={`schedule-view-${id}`}
                role="tab"
                aria-selected={view === id}
                aria-controls={`schedule-${id}`}
                tabIndex={view === id ? 0 : -1}
                onKeyDown={handleViewKeys}
                onClick={() => selectView(id)}
                className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ${view === id ? 'bg-lux-ink text-lux-ivory' : 'text-lux-ink'}`}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {view === 'by_level' && (
          <div id="schedule-by_level" role="tabpanel" aria-labelledby="schedule-view-by_level" className="mt-8">
            <div className="flex flex-wrap gap-2" aria-label="Choisir une classe de rentrée">
              {levels.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={level === option.id}
                  onClick={() => setLevel(option.id)}
                  className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold ${level === option.id ? 'border-lux-gold bg-lux-gold/10 text-lux-ink' : 'border-lux-line text-lux-slate'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {subjectsForLevel.map((subjectId) => {
                const slots = levelSlots.filter((slot) => slot.subject === subjectId);
                const first = slots[0];
                const hours = first
                  ? durationHours(first.startTime, first.endTime) * slots.length
                  : 0;
                return (
                  <article key={subjectId} className="rounded-2xl border border-lux-line bg-lux-paper p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-lux-gold-deep">
                      Semaine {first?.week}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-lux-ink">
                      {subjectLabel(subjects, subjectId, level)}
                    </h3>
                    <p className="mt-2 text-sm text-lux-slate">
                      {slots.map((slot) => dateLabel(slot.date)).join(', ')}
                    </p>
                    <p className="mt-1 text-sm text-lux-slate">{first?.startTime}–{first?.endTime}</p>
                    <p className="mt-1 text-sm font-medium text-lux-ink">
                      {slots.length} séances · {hours} heures
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {view === 'by_week' && (
          <div id="schedule-by_week" role="tabpanel" aria-labelledby="schedule-view-by_week" className="mt-8 grid gap-6 lg:grid-cols-2">
            {weeks.map((week) => {
              const weekSlots = schedule.filter((slot) => slot.week === week);
              const dates = [...new Set(weekSlots.map((slot) => slot.date))];
              return (
                <section key={week} className="rounded-2xl border border-lux-line bg-lux-paper p-5">
                  <h3 className="font-fraunces text-2xl text-lux-ink">Semaine {week}</h3>
                  <p className="mt-2 text-sm text-lux-slate">{dates.map(dateLabel).join(' · ')}</p>
                  <div className="mt-5 space-y-3">
                    {blocks.map((block) => {
                      const moduleSlots = uniqueModules(
                        weekSlots.filter((slot) => slot.block === block.id),
                      );
                      return (
                        <div key={block.id} className="rounded-xl bg-white p-4">
                          <p className="text-sm font-semibold text-lux-ink">
                            Bloc {block.id} · {block.startTime}–{block.endTime}
                          </p>
                          {moduleSlots.length === 0 ? (
                            <p className="mt-1 text-sm text-lux-slate">Aucun module</p>
                          ) : (
                            <ul className="mt-2 space-y-1 text-sm text-lux-slate">
                              {moduleSlots.map((slot) => (
                                <li key={`${slot.level}-${slot.subject}`}>
                                  {levels.find((candidate) => candidate.id === slot.level)?.label}
                                  {' · '}
                                  {subjectLabel(subjects, slot.subject, slot.level)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
