'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import {
  formatDetailedDates,
  formatPresenceRange,
  formatWeekRange,
} from '@/lib/campaigns/pre-rentree-2026/presentation';
import { SUBJECT_THEMES } from '@/lib/campaigns/pre-rentree-2026/subject-theme';
import { PRE_RENTREE_DOCUMENTS } from '@/lib/campaigns/pre-rentree-2026/documents';
import type {
  LandingLevel,
  LandingPack,
  LandingScheduleSlot,
  LandingScheduleWindow,
  LandingSubject,
  LandingPublicOrganization,
} from '@/lib/campaigns/pre-rentree-2026/configurator';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';
import type { SubjectIncompatibility } from '@/lib/campaigns/pre-rentree-2026/incompatibilities';
import {
  buildPublicSubjectScheduleRows,
  type PublicSubjectScheduleRow,
} from '@/lib/campaigns/pre-rentree-2026/public-schedule';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubjectBadge } from './SubjectBadge';
import { StagePlanningSelector } from './StagePlanningSelector';
import { useCampaignExperience } from './CampaignExperienceContext';

interface Block {
  id: string;
  startTime: string;
  endTime: string;
}

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

function CohortDetails({ row }: { row: PublicSubjectScheduleRow }) {
  return (
    <div>
      {row.cohorts.length > 1 && (
        <p className="mb-2 font-medium text-lux-ink">Deux créneaux possibles selon les autres matières :</p>
      )}
      <ul className="space-y-2">
        {row.cohorts.map((cohort) => (
          <li key={cohort.cohortId ?? 'primary'} className="text-lux-slate">
            <span className="font-semibold text-lux-ink">
              {cohort.label} · {cohort.startTime}–{cohort.endTime}
            </span>
            <span
              className="mt-1 block text-xs"
              title={formatDetailedDates(cohort.dates)}
            >
              {formatWeekRange(cohort.dates[0] ?? '', cohort.dates.at(-1) ?? '')}
              {' · '}
              {formatPresenceRange(cohort.dates)}
              {cohort.room ? ` · ${roomLabel(cohort.room)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelDesktopTable({ rows, levelLabel }: { rows: PublicSubjectScheduleRow[]; levelLabel: string }) {
  return (
    <div className="mt-6 hidden overflow-hidden rounded-2xl border border-lux-line bg-white sm:block">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">Planning — {levelLabel}</caption>
        <thead className="bg-lux-paper text-lux-ink">
          <tr>
            {['Matière', 'Volume', 'Créneaux proposés'].map((heading, index) => (
              <th key={heading} scope="col" className={cn('px-4 py-4 font-semibold', index === 0 ? 'w-[27%]' : index === 1 ? 'w-[25%]' : '')}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.subjectId} className="border-t border-lux-line align-top">
              <th scope="row" className="px-4 py-4 font-normal">
                <SubjectBadge subjectId={row.subjectId} label={row.label} />
              </th>
              <td className="px-4 py-4 font-medium text-lux-ink">
                {row.studentSessionCount} séances · {row.studentHours} h par élève
              </td>
              <td className="px-4 py-4 text-sm"><CohortDetails row={row} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LevelMobileCards({ rows }: { rows: PublicSubjectScheduleRow[] }) {
  return (
    <div className="mt-5 grid gap-3 sm:hidden">
      {rows.map((row) => (
        <article
          key={row.subjectId}
          className="min-w-0 rounded-2xl border border-lux-line bg-white p-4"
          aria-label={row.label}
        >
          <SubjectBadge subjectId={row.subjectId} label={row.label} />
          <p className="mt-3 text-sm font-semibold text-lux-ink">
            {row.studentSessionCount} séances · {row.studentHours} h par élève
          </p>
          <div className="mt-3 text-sm"><CohortDetails row={row} /></div>
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
  slot: LandingScheduleWindow['slots'][number] | undefined;
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

function ProposedGroups({
  slots,
  block,
  levels,
  subjects,
}: {
  slots: LandingScheduleWindow['slots'];
  block: Block;
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
}) {
  if (slots.length === 0) {
    return <span className="text-sm font-medium text-lux-slate">Aucun groupe sur ce créneau</span>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {slots.map((slot) => (
        <OccupiedCell
          key={`${slot.level}-${slot.subject}-${slot.room}`}
          slot={slot}
          block={block}
          levels={levels}
          subjects={subjects}
        />
      ))}
    </div>
  );
}

function WindowDesktopTable({
  window,
  blocks,
  levels,
  subjects,
  exposeRooms,
}: {
  window: LandingScheduleWindow;
  blocks: readonly Block[];
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
  exposeRooms: boolean;
}) {
  // Always show the 2 standing rooms; add any extra room (e.g. the
  // exceptional salle-3, SCHEDULE-S5) only for the window that actually uses
  // it — never a permanently-displayed 3rd column across every window.
  const extraRooms = [...new Set(window.slots.map((slot) => slot.room))]
    .filter((room) => room !== 'salle-1' && room !== 'salle-2')
    .sort();
  const rooms = ['salle-1', 'salle-2', ...extraRooms];
  const columnWidth = `${Math.floor(78 / rooms.length)}%`;

  return (
    <div className="mt-6 hidden overflow-hidden rounded-2xl border border-lux-line bg-white sm:block">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">Emploi du temps — {window.windowLabel}</caption>
        <thead className="bg-lux-paper text-lux-ink">
          <tr>
            <th scope="col" className="w-[22%] px-4 py-4 font-semibold">Créneau</th>
            {exposeRooms
              ? rooms.map((room) => (
                <th key={room} scope="col" style={{ width: columnWidth }} className="px-4 py-4 font-semibold">
                  {roomLabel(room)}
                </th>
              ))
              : <th scope="col" className="px-4 py-4 font-semibold">Groupes proposés</th>}
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.id} className="border-t border-lux-line align-top">
              <th scope="row" className="px-4 py-5 text-lux-ink">
                <span className="block font-semibold">Bloc {block.id}</span>
                <span className="mt-1 block text-sm font-normal text-lux-slate">{block.startTime}–{block.endTime}</span>
              </th>
              {exposeRooms
                ? rooms.map((room) => (
                  <td key={room} className="px-4 py-4" aria-label={`${roomLabel(room)}, bloc ${block.id}`}>
                    <OccupiedCell
                      slot={window.slots.find((slot) => slot.block === block.id && slot.room === room)}
                      block={block}
                      levels={levels}
                      subjects={subjects}
                    />
                  </td>
                ))
                : (
                  <td className="px-4 py-4">
                    <ProposedGroups
                      slots={window.slots.filter((slot) => slot.block === block.id)}
                      block={block}
                      levels={levels}
                      subjects={subjects}
                    />
                  </td>
                )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WindowMobileList({
  window,
  blocks,
  levels,
  subjects,
  exposeRooms,
}: {
  window: LandingScheduleWindow;
  blocks: readonly Block[];
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
  exposeRooms: boolean;
}) {
  const extraRooms = [...new Set(window.slots.map((slot) => slot.room))]
    .filter((room) => room !== 'salle-1' && room !== 'salle-2')
    .sort();
  const rooms = ['salle-1', 'salle-2', ...extraRooms];

  return (
    <div className="mt-5 grid gap-3 sm:hidden">
      {blocks.map((block) => (
        <article key={block.id} className="min-w-0 rounded-2xl border border-lux-line bg-white p-4">
          <h4 className="font-semibold text-lux-ink">Bloc {block.id} · {block.startTime}–{block.endTime}</h4>
          <div className="mt-3 grid gap-3">
            {exposeRooms
              ? rooms.map((room) => (
                <div key={room} className="min-w-0 rounded-xl bg-lux-paper p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">{roomLabel(room)}</p>
                  <OccupiedCell
                    slot={window.slots.find((slot) => slot.block === block.id && slot.room === room)}
                    block={block}
                    levels={levels}
                    subjects={subjects}
                  />
                </div>
              ))
              : (
                <div className="min-w-0 rounded-xl bg-lux-paper p-3">
                  <ProposedGroups
                    slots={window.slots.filter((slot) => slot.block === block.id)}
                    block={block}
                    levels={levels}
                    subjects={subjects}
                  />
                </div>
              )}
          </div>
        </article>
      ))}
    </div>
  );
}

function Organization({
  organization,
  exposeRooms,
}: {
  organization: LandingPublicOrganization;
  exposeRooms: boolean;
}) {
  return (
    <section className="mt-12 border-t border-lux-line pt-8" aria-labelledby="organization-heading">
      <h3 id="organization-heading" className="font-fraunces text-2xl text-lux-ink">Organisation pédagogique</h3>
      <div className="mt-4 rounded-2xl border border-lux-line bg-white p-5 text-sm text-lux-slate">
        <p className="font-semibold text-lux-ink">
          Deux salles permanentes et une troisième salle temporaire
        </p>
        <p className="mt-2">
          La troisième salle temporaire est utilisée uniquement au bloc C en Terminale du 24 au 28 août 2026.
          Sa capacité minimale reste compatible avec le format Premium ; aucune promesse de laboratoire n’est formulée.
        </p>
        {exposeRooms && organization.rooms.map((room) => (
          <p key={room.label} className="mt-1">{room.label} · {room.details}</p>
        ))}
      </div>
    </section>
  );
}

export function ScheduleSection({
  schedule,
  scheduleWindows,
  levels,
  subjects,
  blocks,
  organization,
  operationalGates,
  offerOptions,
  subjectIncompatibilities,
  capacityByOffer,
}: {
  schedule: LandingScheduleSlot[];
  scheduleWindows: LandingScheduleWindow[];
  levels: LandingLevel[];
  subjects: LandingSubject[];
  blocks: Block[];
  organization: LandingPublicOrganization;
  operationalGates: {
    roomAssignmentsValidated: boolean;
    teacherAssignmentsValidated: boolean;
    noTeacherConflict: boolean;
    noRoomConflict: boolean;
    noLevelConflict: boolean;
    dailyLoadValid: boolean;
  };
  offerOptions: LandingPack[];
  subjectIncompatibilities: SubjectIncompatibility[];
  capacityByOffer: Record<'FONDATIONS' | 'PREMIUM', { minPerCohort: number; maxPerCohort: number }>;
}) {
  const { configuredEntryLevel } = useCampaignExperience();
  const initialLevel = levels[0]?.id ?? 'SECONDE';
  const [level, setLevel] = useState<EntryLevelCode>(initialLevel);
  const [windowId, setWindowId] = useState(scheduleWindows[0]?.windowId ?? '');

  useEffect(() => {
    if (configuredEntryLevel) setLevel(configuredEntryLevel);
  }, [configuredEntryLevel]);

  return (
    <section className="bg-white px-4 py-14 md:py-20" aria-labelledby="schedule-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="schedule-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Planning et emplois du temps</h2>
        <p className="mt-3 max-w-3xl text-lux-slate">Consultez les créneaux par classe de rentrée ou visualisez les groupes proposés sur chaque semaine.</p>
        {(!operationalGates.roomAssignmentsValidated || !operationalGates.teacherAssignmentsValidated) && (
          <p role="note" className="mt-5 rounded-xl border border-lux-gold/40 bg-lux-gold/10 p-4 text-sm text-lux-ink">
            Les créneaux sont proposés à titre informatif. Les affectations finales sont confirmées directement aux familles.
          </p>
        )}
        <SubjectLegend />

        <StagePlanningSelector
          levels={levels}
          subjects={subjects}
          schedule={schedule}
          offerOptions={offerOptions}
          incompatibilities={subjectIncompatibilities}
          capacityByOffer={capacityByOffer}
          planningPdfHref={PRE_RENTREE_DOCUMENTS.find((doc) => doc.kind === 'planning')?.href}
          exposeRooms={operationalGates.roomAssignmentsValidated}
        />

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
            {/* Onglets par niveau : tous les panneaux sont MONTÉS côté serveur (masqués en CSS via `hidden`),
                pour un crawler, un lecteur d'écran et un navigateur sans JS (D1). */}
            <div role="tablist" aria-label="Classe de rentrée affichée" className="grid h-auto min-h-11 w-full grid-cols-1 justify-start gap-1 border border-lux-line bg-lux-paper p-1 sm:inline-flex sm:w-auto">
              {levels.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  id={`level-tab-${option.id}`}
                  aria-selected={level === option.id}
                  aria-controls={`level-panel-${option.id}`}
                  aria-label={option.label}
                  onClick={() => setLevel(option.id)}
                  className={cn('min-h-11 rounded px-3 py-1.5 text-sm', level === option.id ? 'bg-white font-semibold text-lux-ink shadow-sm' : 'text-lux-slate')}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {levels.map((option) => {
              const levelRows = buildPublicSubjectScheduleRows({
                schedule,
                subjects,
                windows: scheduleWindows,
                level: option.id,
                exposeRooms: operationalGates.roomAssignmentsValidated,
              });
              return (
                <div
                  key={option.id}
                  role="tabpanel"
                  id={`level-panel-${option.id}`}
                  aria-labelledby={`level-tab-${option.id}`}
                  hidden={level !== option.id}
                  className="mt-0"
                >
                  <LevelDesktopTable rows={levelRows} levelLabel={option.label} />
                  <LevelMobileCards rows={levelRows} />
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="by-week" className="mt-7">
            <Tabs value={windowId} onValueChange={setWindowId}>
              <TabsList aria-label="Fenêtre affichée" className="grid h-auto min-h-11 w-full grid-cols-1 justify-start gap-1 border border-lux-line bg-lux-paper p-1 sm:inline-flex sm:w-auto">
                {scheduleWindows.map((option) => (
                  <TabsTrigger key={option.windowId} value={option.windowId} aria-label={option.windowLabel} className="min-h-11">
                    {option.windowLabel}
                  </TabsTrigger>
                ))}
              </TabsList>
              {scheduleWindows.map((option) => (
                <TabsContent key={option.windowId} value={option.windowId} forceMount className="mt-0 data-[state=inactive]:hidden">
                  <WindowDesktopTable
                    window={option}
                    blocks={blocks}
                    levels={levels}
                    subjects={subjects}
                    exposeRooms={operationalGates.roomAssignmentsValidated}
                  />
                  <WindowMobileList
                    window={option}
                    blocks={blocks}
                    levels={levels}
                    subjects={subjects}
                    exposeRooms={operationalGates.roomAssignmentsValidated}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>

        <Organization
          organization={organization}
          exposeRooms={operationalGates.roomAssignmentsValidated}
        />

        <div className="mt-10">
          <h3 className="font-fraunces text-xl text-lux-ink">Documents à télécharger</h3>
          <p className="mt-1 text-sm text-lux-slate">Le planning complet et les programmes détaillés, à emporter.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {PRE_RENTREE_DOCUMENTS.map((doc) => (
              <li key={doc.href}>
                <a href={doc.href} download className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lux-gold-deep underline">
                  {doc.label} <span className="text-xs font-normal text-lux-slate">(PDF · {doc.size})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
