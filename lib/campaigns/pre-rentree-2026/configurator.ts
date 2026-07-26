import type { EntryLevelCode } from './schema';
import { PRE_RENTREE_2026_NAVIGATION } from './navigation';
import { assignItinerary } from './itinerary';

export interface AcademicProfileSelection {
  voie?: string;
  mathsProfile?: string;
  eafProfile?: string;
  premiereSpecialtyPlan?: string;
  retainedSpecialties?: string[];
  mathsOption?: string;
}

export type ProfileSubjectCompatibilityStatus =
  | 'COMPATIBLE'
  | 'COMPATIBLE_WITH_DIFFERENTIATION'
  | 'REQUIRES_PEDAGOGICAL_REVIEW'
  | 'INCOMPATIBLE';

export interface ProfileSubjectCompatibility {
  status: ProfileSubjectCompatibilityStatus;
  messages: string[];
}

export interface LandingLevel {
  /** Stable code for the 2026-2027 entry class. */
  id: EntryLevelCode;
  label: string;
}

export interface LandingSubject {
  id: string;
  label: string;
  levels: EntryLevelCode[];
  labelByLevel?: Record<string, string>;
  summaryByLevel: Record<string, string>;
  moduleIdsByLevel: Record<string, string>;
}

export interface LandingPack {
  code: 'PACK_1' | 'PACK_2' | 'PACK_3' | 'PACK_4';
  subjectsCount: number;
  totalHours: number;
  price: number;
  deposit: number;
  balance: number;
  pricePerHour: number;
  groupMinOpen: number;
  groupMax: number;
  level?: EntryLevelCode;
  range?: 'FONDATIONS' | 'PREMIUM';
}

export interface LandingScheduleSlot {
  date: string;
  /** Stable code for the 2026-2027 entry class. */
  level: EntryLevelCode;
  subject: string;
  block: string;
  startTime: string;
  endTime: string;
  room: string;
  windowId: string;
  sessionNumber: number;
  /** Present only for a subject offered in more than one alternative cohort
   * (e.g. Première SVT, Terminale NSI/SVT) — absent means the single implicit
   * primary cohort, exactly as before this field existed. */
  cohortId?: string;
  alternativeGroupId?: string;
  isPrimary?: boolean;
}

export interface LandingModuleSlot {
  level: EntryLevelCode;
  subject: string;
  block: string;
  room: string;
}

export interface LandingScheduleWindow {
  windowId: string;
  windowLabel: string;
  days: string[];
  slots: LandingModuleSlot[];
}

export interface LandingPublicOrganization {
  educators: Array<{
    title: string;
    details: string[];
  }>;
  rooms: Array<{
    label: string;
    details: string;
  }>;
}

export interface ScheduleSummaryLine {
  subjectId: string;
  subjectLabel: string;
  dates: string[];
  startTime: string;
  endTime: string;
  windowId: string;
}

export interface SelectionSummary {
  level: EntryLevelCode;
  levelLabel: string;
  profile: AcademicProfileSelection;
  profileLabel: string;
  subjectIds: string[];
  subjectLabels: string[];
  pack: LandingPack | null;
  totalHours: number;
  sessionCount: number;
  dates: string[];
  scheduleLines: ScheduleSummaryLine[];
  requiresValidation: boolean;
}

export function getNextConfiguratorStep(step: number, level: EntryLevelCode | null): number {
  if (step === 1 && (level === 'TROISIEME' || level === 'SECONDE')) return 3;
  return Math.min(step + 1, 4);
}

export function getPreviousConfiguratorStep(step: number, level: EntryLevelCode | null): number {
  if (step === 3 && (level === 'TROISIEME' || level === 'SECONDE')) return 1;
  return Math.max(step - 1, 1);
}

export function selectPackBySubjectCount(
  packs: readonly LandingPack[],
  subjectCount: number,
  level?: EntryLevelCode,
): LandingPack | null {
  return packs.find((pack) => (
    pack.subjectsCount === subjectCount && (!level || !pack.level || pack.level === level)
  )) ?? null;
}

export function toggleLimitedSelection(
  selection: readonly string[],
  value: string,
  maximum: number,
): string[] {
  if (selection.includes(value)) {
    return selection.filter((item) => item !== value);
  }
  if (selection.length >= maximum) return [...selection];
  return [...selection, value];
}

export function isAcademicProfileComplete(
  level: EntryLevelCode | null,
  profile: AcademicProfileSelection,
): boolean {
  if (level === 'TROISIEME' || level === 'SECONDE') return true;
  if (level === 'PREMIERE') {
    return Boolean(
      profile.voie &&
      profile.mathsProfile &&
      profile.eafProfile &&
      profile.premiereSpecialtyPlan,
    );
  }
  if (level === 'TERMINALE') return Boolean(profile.mathsOption);
  return false;
}

function premierePlansSubject(plan: string | undefined, subject: string): boolean {
  // SVT is commercialized in Première exactly like NSI/Physique-Chimie (see
  // content/pre-rentree-2026/offers.json) and must be gated the same way — a
  // profile plan that omits SVT must not silently declare an SVT selection
  // compatible (fixed 2026, see SCHEDULE-UX-AUDIT.md §Première profile gap).
  if (subject === 'NSI') {
    return plan === 'NSI' || plan === 'NSI_PHYSIQUE_CHIMIE' || plan === 'NSI_SVT' || plan === 'NSI_PHYSIQUE_CHIMIE_SVT';
  }
  if (subject === 'PHYSIQUE_CHIMIE') {
    return (
      plan === 'PHYSIQUE_CHIMIE' ||
      plan === 'NSI_PHYSIQUE_CHIMIE' ||
      plan === 'PHYSIQUE_CHIMIE_SVT' ||
      plan === 'NSI_PHYSIQUE_CHIMIE_SVT'
    );
  }
  if (subject === 'SVT') {
    return (
      plan === 'SVT' ||
      plan === 'NSI_SVT' ||
      plan === 'PHYSIQUE_CHIMIE_SVT' ||
      plan === 'NSI_PHYSIQUE_CHIMIE_SVT'
    );
  }
  return true;
}

export function classifyProfileSubjectCompatibility(
  level: EntryLevelCode,
  profile: AcademicProfileSelection,
  subjectIds: readonly string[],
): ProfileSubjectCompatibility {
  const messages: string[] = [];

  if (level === 'PREMIERE') {
    const eafContradiction =
      (profile.voie === 'GENERALE' && profile.eafProfile === 'EAF_TECHNOLOGIQUE') ||
      (profile.voie === 'TECHNOLOGIQUE' && profile.eafProfile === 'EAF_GENERALE');
    if (eafContradiction) {
      return {
        status: 'INCOMPATIBLE',
        messages: ['Le profil de Français EAF doit correspondre à la voie déclarée.'],
      };
    }

    if (
      subjectIds.some(
        (subject) =>
          (subject === 'NSI' || subject === 'PHYSIQUE_CHIMIE' || subject === 'SVT') &&
          !premierePlansSubject(profile.premiereSpecialtyPlan, subject),
      )
    ) {
      messages.push(
        'Une matière non déclarée parmi les enseignements envisagés nécessite une validation pédagogique.',
      );
      return { status: 'REQUIRES_PEDAGOGICAL_REVIEW', messages };
    }

    if (subjectIds.includes('MATHEMATIQUES') || subjectIds.includes('FRANCAIS')) {
      return {
        status: 'COMPATIBLE_WITH_DIFFERENTIATION',
        messages: ['Les exercices sont différenciés selon le profil déclaré.'],
      };
    }
    return { status: 'COMPATIBLE', messages };
  }

  if (level === 'TERMINALE') {
    const retained = profile.retainedSpecialties ?? [];
    if (profile.mathsOption === 'MATHS_EXPERTES' && !retained.includes('MATHEMATIQUES')) {
      return {
        status: 'INCOMPATIBLE',
        messages: ['Maths expertes nécessite la spécialité Mathématiques conservée.'],
      };
    }
    if (profile.mathsOption === 'MATHS_COMPLEMENTAIRES' && retained.includes('MATHEMATIQUES')) {
      return {
        status: 'INCOMPATIBLE',
        messages: ['Maths complémentaires ne se cumule pas avec la spécialité Mathématiques conservée.'],
      };
    }
    if (
      (subjectIds.includes('NSI') && !retained.includes('NSI')) ||
      (subjectIds.includes('PHYSIQUE_CHIMIE') && !retained.includes('PHYSIQUE_CHIMIE')) ||
      (subjectIds.includes('SVT') && !retained.includes('SVT'))
    ) {
      return {
        status: 'REQUIRES_PEDAGOGICAL_REVIEW',
        messages: [
          'Une matière de spécialité non conservée nécessite une validation pédagogique avant confirmation.',
        ],
      };
    }
    if (subjectIds.includes('MATHEMATIQUES')) {
      if (profile.mathsOption === 'MATHS_COMPLEMENTAIRES') {
        // Confirmed pedagogical gap (SCHEDULE-S5 audit): the module's 5 sessions
        // (limites, suites récurrentes, géométrie dans l'espace...) are written
        // for the spécialité EDS track, not the lighter Mathématiques
        // complémentaires programme — no differentiated complémentaires content
        // actually exists yet. Do not claim a differentiation that isn't real;
        // route to pedagogical review instead of silently approving it.
        return {
          status: 'REQUIRES_PEDAGOGICAL_REVIEW',
          messages: [
            'Le contenu du module Mathématiques cible la spécialité EDS ; Mathématiques complémentaires nécessite une validation pédagogique distincte avant confirmation.',
          ],
        };
      }
      return {
        status: 'COMPATIBLE_WITH_DIFFERENTIATION',
        messages: ['Le module de Mathématiques est différencié selon la spécialité et l’option déclarées.'],
      };
    }
  }

  return { status: 'COMPATIBLE', messages };
}

export function requiresPedagogicalValidation(
  level: EntryLevelCode | null,
  profile: AcademicProfileSelection,
  subjectIds: readonly string[] = [],
): boolean {
  if (!level || level === 'TROISIEME' || level === 'SECONDE') return false;
  return classifyProfileSubjectCompatibility(level, profile, subjectIds).status !== 'COMPATIBLE';
}

function subjectLabel(subject: LandingSubject, level: EntryLevelCode): string {
  return subject.labelByLevel?.[level] ?? subject.label;
}

export function formatAcademicProfile(
  profile: AcademicProfileSelection,
  labels: Readonly<Record<string, string>> = {},
): string {
  const values = [
    profile.voie,
    profile.mathsProfile,
    profile.eafProfile,
    profile.premiereSpecialtyPlan,
    ...(profile.retainedSpecialties ?? []),
    profile.mathsOption,
  ].filter((value): value is string => Boolean(value));
  return values.length > 0
    ? values.map((value) => labels[value] ?? value).join(', ')
    : 'Tronc commun';
}

export function buildSelectionSummary(input: {
  level: EntryLevelCode;
  profile: AcademicProfileSelection;
  profileLabels?: Readonly<Record<string, string>>;
  subjectIds: string[];
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
  packs: readonly LandingPack[];
  schedule: readonly LandingScheduleSlot[];
}): SelectionSummary {
  const pack = selectPackBySubjectCount(input.packs, input.subjectIds.length, input.level);
  if (input.subjectIds.length > 0 && !pack) {
    throw new Error(`Missing canonical campaign pack for ${input.subjectIds.length} subjects`);
  }
  const selectedSubjects = input.subjectIds.map((id) => {
    const subject = input.subjects.find((candidate) => candidate.id === id);
    if (!subject) throw new Error(`Unknown campaign subject: ${id}`);
    return subject;
  });
  // A subject with more than one alternative cohort (see itinerary.ts) must
  // resolve to exactly one cohort's 5 sessions here — never the raw union of
  // every cohort, which would look like 10 séances for one matière.
  const assignment = input.subjectIds.length > 0
    ? assignItinerary(input.level, input.subjectIds, input.schedule)
    : null;
  const scheduleLines = selectedSubjects.map((subject) => {
    const slots = assignment ? assignment.sessionsBySubject[subject.id] ?? [] : [];
    if (slots.length !== 5) {
      throw new Error(`Missing campaign schedule for ${input.level}/${subject.id}`);
    }
    const first = slots[0];
    if (!first) throw new Error(`Missing campaign schedule for ${input.level}/${subject.id}`);
    if (!first.windowId) throw new Error(`Missing windowId for ${input.level}/${subject.id}`);
    return {
      subjectId: subject.id,
      subjectLabel: subjectLabel(subject, input.level),
      dates: [...new Set(slots.map((slot) => slot.date))].sort(),
      startTime: first.startTime,
      endTime: first.endTime,
      windowId: first.windowId,
    };
  });
  const dates = [...new Set(scheduleLines.flatMap((line) => line.dates))].sort();

  return {
    level: input.level,
    levelLabel: (() => {
      const level = input.levels.find((candidate) => candidate.id === input.level);
      if (!level) throw new Error(`Unknown campaign entry level: ${input.level}`);
      return level.label;
    })(),
    profile: input.profile,
    profileLabel: formatAcademicProfile(input.profile, input.profileLabels),
    subjectIds: input.subjectIds,
    subjectLabels: selectedSubjects.map((subject) => subjectLabel(subject, input.level)),
    pack,
    totalHours: pack ? pack.totalHours : 0,
    sessionCount: scheduleLines.reduce((total, line) => total + line.dates.length, 0),
    dates,
    scheduleLines,
    requiresValidation: true,
  };
}

export function buildBilanUrl(input: {
  packCode: LandingPack['code'];
  level: EntryLevelCode;
  subjectIds: string[];
  profile: AcademicProfileSelection;
}): string {
  const params = new URLSearchParams({
    programme: PRE_RENTREE_2026_NAVIGATION.campaignId,
    pack: input.packCode,
    niveau: input.level,
    matieres: input.subjectIds.join(','),
  });
  if (input.profile.voie) params.set('voie', input.profile.voie);
  if (input.profile.mathsProfile) params.set('profil_maths', input.profile.mathsProfile);
  if (input.profile.eafProfile) params.set('profil_eaf', input.profile.eafProfile);
  if (input.profile.premiereSpecialtyPlan) {
    params.set('projet_specialites', input.profile.premiereSpecialtyPlan);
  }
  if (input.profile.retainedSpecialties?.length) {
    params.set('specialites', input.profile.retainedSpecialties.join(','));
  }
  if (input.profile.mathsOption) params.set('option_maths', input.profile.mathsOption);
  return `/bilan-gratuit?${params.toString()}`;
}

export function buildWhatsAppMessage(summary: SelectionSummary): string {
  const formatDate = (date: string) => new Intl.DateTimeFormat('fr-TN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Tunis',
  }).format(new Date(`${date}T12:00:00+01:00`));
  const schedule = summary.scheduleLines
    .map(
      (line) =>
        `${line.subjectLabel} : ${line.dates.map(formatDate).join(', ')} · ${line.startTime}–${line.endTime}`,
    )
    .join('\n');
  const pack = summary.pack;
  const pricing = pack
    ? `Pack : ${pack.subjectsCount} ${pack.subjectsCount === 1 ? 'matière' : 'matières'}\nTarif indicatif : ${pack.price} TND\nAcompte : ${pack.deposit} TND`
    : 'Tarif indicatif : à confirmer';

  return [
    'Bonjour, je souhaite des informations sur la Pré-rentrée Nexus 2026.',
    '',
    `Classe de rentrée : ${summary.levelLabel}`,
    `Profil : ${summary.profileLabel}`,
    `Matières : ${summary.subjectLabels.join(', ')}`,
    `Volume : ${summary.totalHours} heures`,
    `Horaires :\n${schedule}`,
    pricing,
    '',
    'Je souhaite vérifier la disponibilité et la compatibilité du groupe.',
  ].join('\n');
}
