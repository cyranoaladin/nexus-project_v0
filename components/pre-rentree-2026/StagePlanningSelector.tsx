'use client';

import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import {
  formatDetailedDates,
  formatWeekRange,
} from '@/lib/campaigns/pre-rentree-2026/presentation';
import { areSubjectsIncompatible, type SubjectIncompatibility } from '@/lib/campaigns/pre-rentree-2026/incompatibilities';
import { buildBilanUrl, selectPackBySubjectCount } from '@/lib/campaigns/pre-rentree-2026/configurator';
import type {
  LandingLevel,
  LandingPack,
  LandingScheduleSlot,
  LandingSubject,
} from '@/lib/campaigns/pre-rentree-2026/configurator';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';
import { SubjectBadge } from './SubjectBadge';

const LEVEL_RANGE: Record<EntryLevelCode, 'FONDATIONS' | 'PREMIUM'> = {
  TROISIEME: 'FONDATIONS',
  SECONDE: 'FONDATIONS',
  PREMIERE: 'PREMIUM',
  TERMINALE: 'PREMIUM',
};

function subjectLabelForLevel(subject: LandingSubject, level: EntryLevelCode): string {
  return subject.labelByLevel?.[level] ?? subject.label;
}

function roomLabel(room: string): string {
  const number = room.match(/(\d+)$/)?.[1];
  return number ? `Salle ${number}` : room;
}

interface DayGroup {
  date: string;
  entries: Array<{ subjectId: string; label: string; startTime: string; endTime: string; room: string }>;
}

export function StagePlanningSelector({
  levels,
  subjects,
  schedule,
  offerOptions,
  incompatibilities,
  capacityByOffer,
  planningPdfHref,
}: {
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
  schedule: readonly LandingScheduleSlot[];
  offerOptions: readonly LandingPack[];
  incompatibilities: readonly SubjectIncompatibility[];
  capacityByOffer: Record<'FONDATIONS' | 'PREMIUM', { minPerCohort: number; maxPerCohort: number }>;
  planningPdfHref?: string;
}) {
  const [level, setLevel] = useState<EntryLevelCode | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const levelSelectId = useId();

  const availableSubjects = useMemo(
    () => (level ? subjects.filter((subject) => subject.levels.includes(level)) : []),
    [level, subjects],
  );

  function handleLevelChange(nextLevel: EntryLevelCode) {
    setLevel(nextLevel);
    setSelectedSubjects([]);
    track.preRentreeLevelSelected(nextLevel.toLowerCase() as never);
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjects((current) => {
      const next = current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId];
      if (level && !current.includes(subjectId)) {
        track.preRentreeSubjectSelected(level.toLowerCase() as never, subjectId, next.length);
      }
      return next;
    });
  }

  const selectedSlots = useMemo(() => {
    if (!level) return [];
    return schedule
      .filter((slot) => slot.level === level && selectedSubjects.includes(slot.subject))
      .slice()
      .sort((left, right) => (left.date === right.date ? left.startTime.localeCompare(right.startTime) : left.date.localeCompare(right.date)));
  }, [schedule, level, selectedSubjects]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const byDate = new Map<string, DayGroup['entries']>();
    for (const slot of selectedSlots) {
      const subject = subjects.find((candidate) => candidate.id === slot.subject);
      const label = subject && level ? subjectLabelForLevel(subject, level) : slot.subject;
      const entries = byDate.get(slot.date) ?? [];
      entries.push({ subjectId: slot.subject, label, startTime: slot.startTime, endTime: slot.endTime, room: slot.room });
      byDate.set(slot.date, entries);
    }
    return [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, entries]) => ({ date, entries }));
  }, [selectedSlots, subjects, level]);

  const conflicts = useMemo(() => {
    if (!level || selectedSubjects.length < 2) return [];
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < selectedSubjects.length; i += 1) {
      for (let j = i + 1; j < selectedSubjects.length; j += 1) {
        const subjectA = selectedSubjects[i]!;
        const subjectB = selectedSubjects[j]!;
        if (areSubjectsIncompatible(incompatibilities, level, subjectA, subjectB)) {
          pairs.push([subjectA, subjectB]);
        }
      }
    }
    return pairs;
  }, [level, selectedSubjects, incompatibilities]);

  const dates = useMemo(() => [...new Set(selectedSlots.map((slot) => slot.date))].sort(), [selectedSlots]);
  const range = level ? LEVEL_RANGE[level] : null;
  const capacity = range ? capacityByOffer[range] : null;

  const pack = level ? selectPackBySubjectCount(offerOptions, selectedSubjects.length, level) : null;
  const totalHours = pack?.totalHours ?? 0;
  const bilanHref = level && pack
    ? buildBilanUrl({ packCode: pack.code, level, subjectIds: selectedSubjects, profile: {} })
    : null;

  return (
    <section aria-labelledby="planning-selector-heading" className="mt-10 rounded-2xl border border-lux-line bg-lux-paper p-5 sm:p-7">
      <h3 id="planning-selector-heading" className="font-fraunces text-2xl text-lux-ink">Composez votre planning</h3>
      <p className="mt-2 max-w-2xl text-sm text-lux-slate">
        Choisissez une classe de rentrée, puis une ou plusieurs matières : le planning se compose en direct, avec les dates et horaires réels.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
        <div>
          <label htmlFor={levelSelectId} className="block text-sm font-semibold text-lux-ink">Classe de rentrée</label>
          <select
            id={levelSelectId}
            className="mt-2 min-h-11 w-full rounded-xl border border-lux-line bg-white px-3 py-2 text-sm font-medium text-lux-ink"
            value={level ?? ''}
            onChange={(event) => handleLevelChange(event.target.value as EntryLevelCode)}
          >
            <option value="" disabled>Sélectionnez un niveau</option>
            {levels.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>

          {level && (
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-lux-ink">Matières disponibles</legend>
              <div className="mt-3 grid gap-2">
                {availableSubjects.map((subject) => {
                  const checkboxId = `${levelSelectId}-${subject.id}`;
                  const label = subjectLabelForLevel(subject, level);
                  return (
                    <label
                      key={subject.id}
                      htmlFor={checkboxId}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-lux-line bg-white px-3 py-2 text-sm"
                    >
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={selectedSubjects.includes(subject.id)}
                        onChange={() => toggleSubject(subject.id)}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="font-medium text-lux-ink">{label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>

        <div>
          {!level && (
            <p role="status" className="rounded-xl border border-dashed border-lux-line bg-white p-6 text-sm text-lux-slate">
              Sélectionnez un niveau pour afficher le planning.
            </p>
          )}

          {level && selectedSubjects.length === 0 && (
            <p role="status" className="rounded-xl border border-dashed border-lux-line bg-white p-6 text-sm text-lux-slate">
              Cochez au moins une matière pour composer le planning de {levels.find((candidate) => candidate.id === level)?.label.toLowerCase()}.
            </p>
          )}

          {conflicts.length > 0 && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              {conflicts.map(([subjectA, subjectB]) => {
                const labelA = subjects.find((candidate) => candidate.id === subjectA);
                const labelB = subjects.find((candidate) => candidate.id === subjectB);
                const a = labelA && level ? subjectLabelForLevel(labelA, level) : subjectA;
                const b = labelB && level ? subjectLabelForLevel(labelB, level) : subjectB;
                return (
                  <p key={`${subjectA}-${subjectB}`}>
                    <strong>{a}</strong> et <strong>{b}</strong> ont lieu au même créneau — un élève ne peut pas suivre les deux. Choisissez l’une ou l’autre.
                  </p>
                );
              })}
            </div>
          )}

          {level && selectedSubjects.length > 0 && (
            <>
              <div className="grid gap-3">
                {dayGroups.map((group) => (
                  <article key={group.date} className="rounded-xl border border-lux-line bg-white p-4">
                    <h4 className="text-sm font-semibold text-lux-ink" title={formatDetailedDates([group.date])}>
                      {formatDetailedDates([group.date])}
                    </h4>
                    <ul className="mt-2 grid gap-2">
                      {group.entries.map((entry) => (
                        <li key={`${group.date}-${entry.subjectId}`} className="flex flex-wrap items-center gap-2">
                          <SubjectBadge subjectId={entry.subjectId} label={entry.label} />
                          <span className="text-sm text-lux-slate">{entry.startTime}–{entry.endTime} · {roomLabel(entry.room)}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-lux-line bg-white p-4 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-lux-slate">Matières</dt><dd className="font-semibold text-lux-ink">{selectedSubjects.length}</dd></div>
                <div><dt className="text-xs text-lux-slate">Volume</dt><dd className="font-semibold text-lux-ink">{totalHours} h</dd></div>
                <div className="col-span-2"><dt className="text-xs text-lux-slate">Dates concernées</dt><dd className="font-semibold text-lux-ink">{dates.length > 0 ? formatWeekRange(dates[0]!, dates.at(-1)!) : '—'}</dd></div>
                {capacity && (
                  <p className="col-span-2 text-xs text-lux-slate sm:col-span-4">
                    Groupe de {capacity.minPerCohort} à {capacity.maxPerCohort} élèves, ouverture à partir de {capacity.minPerCohort} inscrits.
                  </p>
                )}
              </dl>

              {bilanHref && (
                <a
                  href={bilanHref}
                  className={cn(
                    'mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white',
                    conflicts.length > 0 ? 'bg-lux-slate' : 'bg-lux-gold-deep',
                  )}
                  aria-disabled={conflicts.length > 0}
                  onClick={(event) => {
                    if (conflicts.length > 0) event.preventDefault();
                  }}
                >
                  Pré-inscrire sur ces créneaux
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {planningPdfHref && (
        <p className="mt-6 text-sm">
          <a href={planningPdfHref} download className="inline-flex min-h-11 items-center gap-2 font-semibold text-lux-gold-deep underline">
            Télécharger le planning complet (PDF)
          </a>
        </p>
      )}
    </section>
  );
}
