'use client';

import { useEffect, useMemo, useState } from 'react';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import {
  formatDetailedDates,
  formatPresenceRange,
  formatWeekRange,
} from '@/lib/campaigns/pre-rentree-2026/presentation';
import { SUBJECT_THEMES } from '@/lib/campaigns/pre-rentree-2026/subject-theme';
import type {
  LandingLevel,
  LandingScheduleSlot,
  LandingScheduleWeek,
  LandingSubject,
  LandingTeacherRole,
} from '@/lib/campaigns/pre-rentree-2026/configurator';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubjectBadge } from './SubjectBadge';
import { useCampaignExperience } from './CampaignExperienceContext';

interface Block {
  id: string;
  startTime: string;
  endTime: string;
}

interface ModuleRow {
  subjectId: string;
  label: string;
  week: number;
  dates: string[];
  startTime: string;
  endTime: string;
  room: string;
  sessionCount: number;
  hours: number;
}

type RoomRoles = Record<string, readonly string[]>;
type TeacherRoles = Record<string, LandingTeacherRole>;

const TEACHER_ROLE_PRESENTATION: Readonly<Record<string, {
  title: string;
  details: string[];
}>> = {
  MATHS_NSI_SNT_TEACHER: {
    title: 'Enseignant Mathématiques / NSI / SNT',
    details: [
      'Semaine 1 : Mathématiques',
      'Semaine 2 : SNT et NSI',
      'Six créneaux de module au total · aucune simultanéité',
    ],
  },
  FRENCH_TEACHER: {
    title: 'Enseignant de Français',
    details: [
      'Semaine 1',
      'Français Seconde · EAF Première · expression et oral Terminale',
    ],
  },
  PHYSICS_CHEMISTRY_TEACHER: {
    title: 'Enseignant de Physique-Chimie',
    details: [
      'Semaine 2',
      'Entrée en Seconde · Entrée en Première · Entrée en Terminale',
    ],
  },
};

function durationHours(start: string, end: string): number {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number);
  return (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
}

function subjectLabel(subjects: readonly LandingSubject[], id: string, level: EntryLevelCode): string {
  const subject = subjects.find((candidate) => candidate.id === id);
  return subject?.labelByLevel?.[level] ?? subject?.label ?? id;
}

function entryLabel(levels: readonly LandingLevel[], id: EntryLevelCode): string {
  return levels.find((candidate) => candidate.id === id)?.label ?? id;
}

function roomLabel(room: string): string {
  const number = room.match(/(\d+)$/)?.[1];
  return number ? `Salle ${number}` : room;
}

function moduleRows(
  schedule: readonly LandingScheduleSlot[],
  subjects: readonly LandingSubject[],
  level: EntryLevelCode,
): ModuleRow[] {
  const subjectIds = [...new Set(
    schedule.filter((slot) => slot.level === level).map((slot) => slot.subject),
  )];
  return subjectIds.map((subjectId) => {
    const slots = schedule
      .filter((slot) => slot.level === level && slot.subject === subjectId)
      .sort((left, right) => left.date.localeCompare(right.date));
    const first = slots[0];
    return {
      subjectId,
      label: subjectLabel(subjects, subjectId, level),
      week: first?.week ?? 0,
      dates: slots.map((slot) => slot.date),
      startTime: first?.startTime ?? '',
      endTime: first?.endTime ?? '',
      room: first?.room ?? '',
      sessionCount: slots.length,
      hours: first ? durationHours(first.startTime, first.endTime) * slots.length : 0,
    };
  });
}

function SubjectLegend() {
  return (
    <ul aria-label="Légende des matières" className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:gap-3">
      {Object.values(SUBJECT_THEMES).map((theme) => (
        <li key={theme.family} className="flex min-w-0 items-center gap-2 text-sm font-medium text-lux-ink">
          <span aria-hidden="true" className={cn('h-3 w-3 shrink-0 rounded-sm', theme.markerClass.split(' ')[0])} />
          <span>{theme.label}</span>
        </li>
      ))}
    </ul>
  );
}

function LevelDesktopTable({ rows, levelLabel }: { rows: ModuleRow[]; levelLabel: string }) {
  return (
    <div className="mt-6 hidden overflow-hidden rounded-2xl border border-lux-line bg-white sm:block">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">Planning — {levelLabel}</caption>
        <thead className="bg-lux-paper text-lux-ink">
          <tr>
            {['Matière', 'Semaine', 'Dates', 'Créneau', 'Salle', 'Volume'].map((heading, index) => (
              <th key={heading} scope="col" className={cn('px-3 py-4 font-semibold', index === 0 ? 'w-[29%]' : '')}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.subjectId} className="border-t border-lux-line align-top">
              <th scope="row" className="px-3 py-4 font-normal">
                <SubjectBadge subjectId={row.subjectId} label={row.label} />
              </th>
              <td className="px-3 py-4 font-semibold text-lux-ink">Semaine {row.week}</td>
              <td className="px-3 py-4 text-lux-slate" title={formatDetailedDates(row.dates)}>
                <span className="block font-medium text-lux-ink">{formatWeekRange(row.dates[0] ?? '', row.dates.at(-1) ?? '')}</span>
                <span className="mt-1 block text-xs">du lundi au vendredi</span>
              </td>
              <td className="px-3 py-4 font-medium text-lux-ink">{row.startTime}–{row.endTime}</td>
              <td className="px-3 py-4 text-lux-slate">{roomLabel(row.room)}</td>
              <td className="px-3 py-4 font-medium text-lux-ink">{row.sessionCount} séances · {row.hours} h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LevelMobileCards({ rows }: { rows: ModuleRow[] }) {
  return (
    <div className="mt-5 grid gap-3 sm:hidden">
      {rows.map((row) => (
        <article
          key={row.subjectId}
          className="min-w-0 rounded-2xl border border-lux-line bg-white p-4"
          aria-label={`${row.label}, semaine ${row.week}`}
        >
          <SubjectBadge subjectId={row.subjectId} label={row.label} />
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div><dt className="text-xs text-lux-slate">Semaine</dt><dd className="font-medium text-lux-ink">Semaine {row.week}</dd></div>
            <div><dt className="text-xs text-lux-slate">Salle</dt><dd className="font-medium text-lux-ink">{roomLabel(row.room)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-lux-slate">Présence</dt><dd className="font-medium text-lux-ink" title={formatDetailedDates(row.dates)}>{formatPresenceRange(row.dates)}</dd></div>
            <div><dt className="text-xs text-lux-slate">Créneau</dt><dd className="font-medium text-lux-ink">{row.startTime}–{row.endTime}</dd></div>
            <div><dt className="text-xs text-lux-slate">Volume</dt><dd className="font-medium text-lux-ink">{row.sessionCount} séances · {row.hours} h</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function OccupiedCell({
  slot,
  block,
  levels,
  subjects,
}: {
  slot: LandingScheduleWeek['slots'][number] | undefined;
  block: Block;
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
}) {
  if (!slot) {
    return <span className="text-sm font-medium text-lux-slate">Libre</span>;
  }
  const label = subjectLabel(subjects, slot.subject, slot.level);
  return (
    <div aria-label={`${label}, ${entryLabel(levels, slot.level)}, bloc ${block.id}`}>
      <SubjectBadge subjectId={slot.subject} label={label} className="w-full" />
      <p className="mt-2 text-sm font-semibold text-lux-ink">{entryLabel(levels, slot.level)}</p>
      <p className="mt-1 text-xs text-lux-slate">Bloc {block.id} · {durationHours(block.startTime, block.endTime)} h</p>
    </div>
  );
}

function WeekDesktopTable({
  week,
  blocks,
  levels,
  subjects,
}: {
  week: LandingScheduleWeek;
  blocks: readonly Block[];
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
}) {
  const label = `Semaine ${week.week} · ${formatWeekRange(week.weekStart, week.weekEnd)}`;
  return (
    <div className="mt-6 hidden overflow-hidden rounded-2xl border border-lux-line bg-white sm:block">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">Emploi du temps — {label}</caption>
        <thead className="bg-lux-paper text-lux-ink">
          <tr>
            <th scope="col" className="w-[22%] px-4 py-4 font-semibold">Créneau</th>
            <th scope="col" className="w-[39%] px-4 py-4 font-semibold">Salle 1</th>
            <th scope="col" className="w-[39%] px-4 py-4 font-semibold">Salle 2</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.id} className="border-t border-lux-line align-top">
              <th scope="row" className="px-4 py-5 text-lux-ink">
                <span className="block font-semibold">Bloc {block.id}</span>
                <span className="mt-1 block text-sm font-normal text-lux-slate">{block.startTime}–{block.endTime}</span>
              </th>
              {['salle-1', 'salle-2'].map((room) => (
                <td key={room} className="px-4 py-4" aria-label={`${roomLabel(room)}, bloc ${block.id}`}>
                  <OccupiedCell
                    slot={week.slots.find((slot) => slot.block === block.id && slot.room === room)}
                    block={block}
                    levels={levels}
                    subjects={subjects}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeekMobileList({
  week,
  blocks,
  levels,
  subjects,
}: {
  week: LandingScheduleWeek;
  blocks: readonly Block[];
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
}) {
  return (
    <div className="mt-5 grid gap-3 sm:hidden">
      {blocks.map((block) => (
        <article key={block.id} className="min-w-0 rounded-2xl border border-lux-line bg-white p-4">
          <h4 className="font-semibold text-lux-ink">Bloc {block.id} · {block.startTime}–{block.endTime}</h4>
          <div className="mt-3 grid gap-3">
            {['salle-1', 'salle-2'].map((room) => (
              <div key={room} className="min-w-0 rounded-xl bg-lux-paper p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">{roomLabel(room)}</p>
                <OccupiedCell
                  slot={week.slots.find((slot) => slot.block === block.id && slot.room === room)}
                  block={block}
                  levels={levels}
                  subjects={subjects}
                />
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function Organization({ teacherRoles, roomRoles }: { teacherRoles: TeacherRoles; roomRoles: RoomRoles }) {
  const roles = Object.keys(teacherRoles)
    .map((roleId) => TEACHER_ROLE_PRESENTATION[roleId])
    .filter((role): role is NonNullable<typeof role> => Boolean(role));
  const salleOne = roomRoles['salle-1'] ?? [];
  const salleTwo = roomRoles['salle-2'] ?? [];
  return (
    <section className="mt-12 border-t border-lux-line pt-8" aria-labelledby="organization-heading">
      <h3 id="organization-heading" className="font-fraunces text-2xl text-lux-ink">Organisation pédagogique</h3>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {roles.map((role) => (
          <article key={role.title} data-testid="teacher-role" className="rounded-2xl border border-lux-line bg-lux-paper p-5">
            <h4 className="font-semibold text-lux-ink">{role.title}</h4>
            <ul className="mt-3 space-y-1 text-sm text-lux-slate">
              {role.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-lux-line bg-white p-5 text-sm text-lux-slate">
        <p className="font-semibold text-lux-ink">Deux salles pédagogiques</p>
        <p className="mt-2">Salle 1 · {salleOne.includes('MATHEMATIQUES') ? 'Mathématiques' : ''} / {salleOne.includes('NSI') ? 'NSI / SNT' : ''}</p>
        <p className="mt-1">Salle 2 · {salleTwo.includes('FRANCAIS') ? 'Français' : ''} puis {salleTwo.includes('PHYSIQUE_CHIMIE') ? 'Physique-Chimie' : ''}</p>
      </div>
    </section>
  );
}

export function ScheduleSection({
  schedule,
  scheduleWeeks,
  levels,
  subjects,
  blocks,
  roomRoles,
  teacherRoles,
}: {
  schedule: LandingScheduleSlot[];
  scheduleWeeks: LandingScheduleWeek[];
  levels: LandingLevel[];
  subjects: LandingSubject[];
  blocks: Block[];
  roomRoles: RoomRoles;
  teacherRoles: TeacherRoles;
}) {
  const { configuredEntryLevel } = useCampaignExperience();
  const initialLevel = levels[0]?.id ?? 'SECONDE';
  const [level, setLevel] = useState<EntryLevelCode>(initialLevel);
  const [week, setWeek] = useState(String(scheduleWeeks[0]?.week ?? 1));
  const rows = useMemo(() => moduleRows(schedule, subjects, level), [schedule, subjects, level]);

  useEffect(() => {
    if (configuredEntryLevel) setLevel(configuredEntryLevel);
  }, [configuredEntryLevel]);

  return (
    <section className="bg-white px-4 py-14 md:py-20" aria-labelledby="schedule-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="schedule-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Planning et emplois du temps</h2>
        <p className="mt-3 max-w-3xl text-lux-slate">Consultez les créneaux par classe de rentrée ou visualisez l’occupation des deux salles sur chaque semaine.</p>
        <SubjectLegend />

        <Tabs
          defaultValue="by-level"
          className="mt-7"
          onValueChange={(value) => track.preRentreeScheduleViewed(value === 'by-level' ? 'by_level' : 'by_week')}
        >
          <TabsList aria-label="Vue du planning" className="grid h-auto min-h-11 w-full grid-cols-1 justify-start gap-1 border border-lux-line bg-lux-paper p-1 sm:inline-flex sm:w-auto">
            <TabsTrigger value="by-level" aria-label="Par classe de rentrée" className="min-h-11">Par classe de rentrée</TabsTrigger>
            <TabsTrigger value="by-week" aria-label="Emploi du temps par semaine" className="min-h-11">Emploi du temps par semaine</TabsTrigger>
          </TabsList>

          <TabsContent value="by-level" className="mt-7">
            <Tabs value={level} onValueChange={(value) => setLevel(value as EntryLevelCode)}>
              <TabsList aria-label="Classe de rentrée affichée" className="grid h-auto min-h-11 w-full grid-cols-1 justify-start gap-1 border border-lux-line bg-lux-paper p-1 sm:inline-flex sm:w-auto">
                {levels.map((option) => (
                  <TabsTrigger key={option.id} value={option.id} aria-label={option.label} className="min-h-11">{option.label}</TabsTrigger>
                ))}
              </TabsList>
              {levels.map((option) => (
                <TabsContent key={option.id} value={option.id} className="mt-0">
                  <LevelDesktopTable rows={rows} levelLabel={option.label} />
                  <LevelMobileCards rows={rows} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="by-week" className="mt-7">
            <Tabs value={week} onValueChange={setWeek}>
              <TabsList aria-label="Semaine affichée" className="grid h-auto min-h-11 w-full grid-cols-1 justify-start gap-1 border border-lux-line bg-lux-paper p-1 sm:inline-flex sm:w-auto">
                {scheduleWeeks.map((option) => (
                  <TabsTrigger key={option.week} value={String(option.week)} aria-label={`Semaine ${option.week} · ${formatWeekRange(option.weekStart, option.weekEnd)}`} className="min-h-11">
                    Semaine {option.week} · {formatWeekRange(option.weekStart, option.weekEnd)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {scheduleWeeks.map((option) => (
                <TabsContent key={option.week} value={String(option.week)} className="mt-0">
                  <WeekDesktopTable week={option} blocks={blocks} levels={levels} subjects={subjects} />
                  <WeekMobileList week={option} blocks={blocks} levels={levels} subjects={subjects} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>

        <Organization teacherRoles={teacherRoles} roomRoles={roomRoles} />
      </div>
    </section>
  );
}
