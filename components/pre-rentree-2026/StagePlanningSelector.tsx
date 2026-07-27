'use client';

import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import {
  formatDetailedDates,
  formatWeekRange,
} from '@/lib/campaigns/pre-rentree-2026/presentation';
import {
  buildStageAvailabilityMessage,
} from '@/lib/campaigns/pre-rentree-2026/availability-message';
import {
  assignItinerary,
  MAX_STUDENT_IDLE_MINUTES,
  type ItineraryStatus,
} from '@/lib/campaigns/pre-rentree-2026/itinerary';
import {
  MAX_SUBJECTS_PER_PACK,
  type PublicPlanningAvailability,
} from '@/lib/campaigns/pre-rentree-2026/configurator';
import type {
  LandingLevel,
} from '@/lib/campaigns/pre-rentree-2026/configurator';
import type {
  PublicPlanningPack,
  PublicScheduleSlot,
  PublicScheduleSubject,
} from '@/lib/campaigns/pre-rentree-2026/public-schedule';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { SubjectBadge } from './SubjectBadge';

function subjectLabelForLevel(subject: PublicScheduleSubject, level: EntryLevelCode): string {
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

const CONFIRMABLE_ITINERARY_STATUSES = new Set<ItineraryStatus>(['COMPACT', 'NO_SHARED_DAY']);

export function StagePlanningSelector({
  levels,
  subjects,
  schedule,
  offerOptions,
  capacityByLevel,
  planningPdfHref,
  exposeRooms = false,
}: {
  levels: readonly LandingLevel[];
  subjects: readonly PublicScheduleSubject[];
  schedule: readonly PublicScheduleSlot[];
  offerOptions: readonly PublicPlanningPack[];
  capacityByLevel: Record<EntryLevelCode, { minPerCohort: number; maxPerCohort: number }>;
  planningPdfHref?: string;
  exposeRooms?: boolean;
}) {
  const [level, setLevel] = useState<EntryLevelCode | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectionLimitMessage, setSelectionLimitMessage] = useState<string | null>(null);
  const levelSelectId = useId();

  const availableSubjects = useMemo(
    () => (level ? subjects.filter((subject) => subject.levels.includes(level)) : []),
    [level, subjects],
  );

  function handleLevelChange(nextLevel: EntryLevelCode) {
    setLevel(nextLevel);
    setSelectedSubjects([]);
    setSelectionLimitMessage(null);
    track.preRentreeLevelSelected(nextLevel.toLowerCase() as never);
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjects((current) => {
      if (current.includes(subjectId)) {
        setSelectionLimitMessage(null);
        return current.filter((id) => id !== subjectId);
      }
      if (current.length >= MAX_SUBJECTS_PER_PACK) {
        setSelectionLimitMessage('4 matières maximum — retirez une matière pour en ajouter une autre.');
        return current;
      }
      const next = [...current, subjectId];
      setSelectionLimitMessage(null);
      if (level && !current.includes(subjectId)) {
        track.preRentreeSubjectSelected(level.toLowerCase() as never, subjectId, next.length);
      }
      return next;
    });
  }

  // A subject can have more than one alternative cohort (SCHEDULE-S5) — the
  // assignment engine resolves each selected subject to exactly ONE cohort's
  // 5 sessions (the one minimizing idle time), never the raw union of every
  // cohort, which would otherwise display a subject twice on the same day.
  const assignment = useMemo(() => {
    if (!level || selectedSubjects.length === 0) return null;
    return assignItinerary(level, selectedSubjects, schedule);
  }, [level, selectedSubjects, schedule]);

  const selectedSlots = useMemo(() => {
    if (!assignment) return [];
    return Object.values(assignment.sessionsBySubject)
      .flat()
      .slice()
      .sort((left, right) => (left.date === right.date ? left.startTime.localeCompare(right.startTime) : left.date.localeCompare(right.date)));
  }, [assignment]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const byDate = new Map<string, DayGroup['entries']>();
    for (const slot of selectedSlots) {
      const subject = subjects.find((candidate) => candidate.id === slot.subject);
      const label = subject && level ? subjectLabelForLevel(subject, level) : slot.subject;
      const entries = byDate.get(slot.date) ?? [];
      entries.push({ subjectId: slot.subject, label, startTime: slot.startTime, endTime: slot.endTime, room: slot.room ?? '' });
      byDate.set(slot.date, entries);
    }
    return [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, entries]) => ({ date, entries }));
  }, [selectedSlots, subjects, level]);

  const itineraryReport = assignment?.itinerary ?? null;
  const itineraryIsConfirmable = itineraryReport
    ? CONFIRMABLE_ITINERARY_STATUSES.has(itineraryReport.status)
    : false;
  const blockingConflict = !itineraryIsConfirmable;

  const dates = useMemo(() => [...new Set(selectedSlots.map((slot) => slot.date))].sort(), [selectedSlots]);
  const capacity = level ? capacityByLevel[level] : null;

  const pack = level
    ? offerOptions.find((option) => (
      option.level === level
      && option.subjectsCount === selectedSubjects.length
    )) ?? null
    : null;
  const totalHours = pack?.totalHours ?? 0;
  const publicAvailability: PublicPlanningAvailability = {
    structuralStatus: itineraryIsConfirmable ? 'STRUCTURALLY_COMPACT' : null,
    capacityStatus: 'CAPACITY_TO_CONFIRM',
  };
  const availabilityMessage = useMemo(() => {
    if (!level || !assignment || !pack || !itineraryReport) return null;
    return buildStageAvailabilityMessage({
      level,
      levels,
      subjects,
      selectedSubjectIds: selectedSubjects,
      assignment,
      totalHours: pack.totalHours,
    });
  }, [assignment, itineraryReport, level, levels, pack, selectedSubjects, subjects]);
  const availabilityHref = availabilityMessage
    ? buildWhatsAppUrl(availabilityMessage, { exactMessage: true })
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

          {selectionLimitMessage && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              {selectionLimitMessage}
            </div>
          )}

          {!selectionLimitMessage && itineraryReport?.status === 'SIMULTANEOUS' && itineraryReport.firstConflict && (
            <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
              {(() => {
                const { subjectA, subjectB } = itineraryReport.firstConflict;
                const labelA = subjects.find((candidate) => candidate.id === subjectA);
                const labelB = subjects.find((candidate) => candidate.id === subjectB);
                const a = labelA && level ? subjectLabelForLevel(labelA, level) : subjectA;
                const b = labelB && level ? subjectLabelForLevel(labelB, level) : subjectB;
                return (
                  <p>
                    <strong>{a}</strong> et <strong>{b}</strong> ont lieu au même créneau — un élève ne peut pas suivre les deux. Choisissez l’une ou l’autre.
                  </p>
                );
              })()}
            </div>
          )}

          {!selectionLimitMessage && itineraryReport?.status === 'LONG_IDLE' && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p>
                Cette combinaison impose une attente de <strong>{itineraryReport.maxIdleMinutes} minutes</strong> entre deux séances
                le même jour (au-delà des {MAX_STUDENT_IDLE_MINUTES} minutes visées). La demande de ce parcours reste désactivée :
                retirez une matière ou demandez un conseil personnalisé.
              </p>
            </div>
          )}

          {!selectionLimitMessage && (
            itineraryReport?.status === 'REQUIRES_ALTERNATIVE_COHORT'
            || itineraryReport?.status === 'REQUIRES_MANUAL_REVIEW'
          ) && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              Ce parcours nécessite une autre cohorte ou une vérification manuelle. La demande de ce parcours reste désactivée.
            </div>
          )}

          {itineraryReport?.status === 'COMPACT' && (
            <div role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
              Parcours compact — attente maximale {itineraryReport.maxIdleMinutes} min
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
                          <span className="text-sm text-lux-slate">
                            {entry.startTime}–{entry.endTime}
                            {exposeRooms ? ` · ${roomLabel(entry.room)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-lux-line bg-white p-4 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-lux-slate">Matières</dt><dd className="font-semibold text-lux-ink">{selectedSubjects.length}</dd></div>
                <div><dt className="text-xs text-lux-slate">Volume</dt><dd className="font-semibold text-lux-ink">{totalHours} h</dd></div>
                {pack && (
                  <div>
                    <dt className="text-xs text-lux-slate">Tarif</dt>
                    <dd className="font-semibold text-lux-ink">
                      {pack.pricingModel === 'PER_SUBJECT' && pack.subjectsCount > 1
                        ? `${pack.subjectsCount} × ${(pack.price / pack.subjectsCount).toLocaleString('fr-TN')} TND = ${pack.price.toLocaleString('fr-TN')} TND`
                        : `${pack.price.toLocaleString('fr-TN')} TND`}
                    </dd>
                  </div>
                )}
                <div className="col-span-2"><dt className="text-xs text-lux-slate">Dates concernées</dt><dd className="font-semibold text-lux-ink">{dates.length > 0 ? formatWeekRange(dates[0]!, dates.at(-1)!) : '—'}</dd></div>
                {capacity && publicAvailability.capacityStatus === 'CAPACITY_TO_CONFIRM' && (
                  <p className="col-span-2 text-xs text-lux-slate sm:col-span-4">
                    Capacité à confirmer · groupe prévu de {capacity.minPerCohort} à {capacity.maxPerCohort} élèves,
                    ouverture à partir de {capacity.minPerCohort} participants.
                  </p>
                )}
              </dl>

              {publicAvailability.structuralStatus && (
                <p className="mt-4 text-sm font-medium text-lux-ink">
                  Itinéraire compact proposé, sous réserve de disponibilité dans les groupes.
                </p>
              )}

              {availabilityHref && (
                <a
                  href={availabilityHref}
                  className={cn(
                    'mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white',
                    blockingConflict ? 'bg-lux-slate' : 'bg-lux-gold-deep',
                  )}
                  aria-disabled={blockingConflict}
                  onClick={(event) => {
                    if (blockingConflict) event.preventDefault();
                  }}
                >
                  Demander la disponibilité de ce parcours
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
