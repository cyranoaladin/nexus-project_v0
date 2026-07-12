export interface AcademicProfileSelection {
  voie?: string;
  mathsProfile?: string;
  eafProfile?: string;
  retainedSpecialties?: string[];
  mathsOption?: string;
}

export interface LandingLevel {
  id: string;
  label: string;
}

export interface LandingSubject {
  id: string;
  label: string;
  levels: string[];
  labelByLevel?: Record<string, string>;
}

export interface LandingPack {
  id: string;
  subjectsCount: number;
  totalHours: number;
  price: number;
  deposit: number;
  balance: number;
  pricePerHour: number;
  groupMinOpen: number;
  groupMax: number;
}

export interface LandingScheduleSlot {
  date: string;
  level: string;
  subject: string;
  block: string;
  startTime: string;
  endTime: string;
  room: string;
  week: number;
  sessionNumber: number;
}

export interface ScheduleSummaryLine {
  subjectId: string;
  subjectLabel: string;
  dates: string[];
  startTime: string;
  endTime: string;
  week: number;
}

export interface SelectionSummary {
  level: string;
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

export function getNextConfiguratorStep(step: number, level: string | null): number {
  if (step === 1 && level === 'SECONDE') return 3;
  return Math.min(step + 1, 4);
}

export function getPreviousConfiguratorStep(step: number, level: string | null): number {
  if (step === 3 && level === 'SECONDE') return 1;
  return Math.max(step - 1, 1);
}

export function selectPackBySubjectCount(
  packs: readonly LandingPack[],
  subjectCount: number,
): LandingPack | null {
  return packs.find((pack) => pack.subjectsCount === subjectCount) ?? null;
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

export function requiresPedagogicalValidation(
  level: string | null,
  profile: AcademicProfileSelection,
): boolean {
  if (level === 'PREMIERE') {
    return Boolean(profile.mathsProfile || profile.eafProfile);
  }
  if (level !== 'TERMINALE') return false;
  return Boolean(
    profile.retainedSpecialties?.includes('MATHEMATIQUES') ||
      (profile.mathsOption && profile.mathsOption !== 'AUCUNE'),
  );
}

function subjectLabel(subject: LandingSubject, level: string): string {
  return subject.labelByLevel?.[level] ?? subject.label;
}

export function formatAcademicProfile(profile: AcademicProfileSelection): string {
  const values = [
    profile.voie,
    profile.mathsProfile,
    profile.eafProfile,
    ...(profile.retainedSpecialties ?? []),
    profile.mathsOption,
  ].filter((value): value is string => Boolean(value) && value !== 'AUCUNE');
  return values.length > 0 ? values.join(', ') : 'Tronc commun';
}

export function buildSelectionSummary(input: {
  level: string;
  profile: AcademicProfileSelection;
  subjectIds: string[];
  levels: readonly LandingLevel[];
  subjects: readonly LandingSubject[];
  packs: readonly LandingPack[];
  schedule: readonly LandingScheduleSlot[];
}): SelectionSummary {
  const pack = selectPackBySubjectCount(input.packs, input.subjectIds.length);
  const selectedSubjects = input.subjectIds
    .map((id) => input.subjects.find((subject) => subject.id === id))
    .filter((subject): subject is LandingSubject => Boolean(subject));
  const scheduleLines = selectedSubjects.map((subject) => {
    const slots = input.schedule.filter(
      (slot) => slot.level === input.level && slot.subject === subject.id,
    );
    const first = slots[0];
    return {
      subjectId: subject.id,
      subjectLabel: subjectLabel(subject, input.level),
      dates: [...new Set(slots.map((slot) => slot.date))].sort(),
      startTime: first?.startTime ?? '',
      endTime: first?.endTime ?? '',
      week: first?.week ?? 0,
    };
  });
  const dates = [...new Set(scheduleLines.flatMap((line) => line.dates))].sort();

  return {
    level: input.level,
    levelLabel:
      input.levels.find((level) => level.id === input.level)?.label ?? input.level,
    profile: input.profile,
    profileLabel: formatAcademicProfile(input.profile),
    subjectIds: input.subjectIds,
    subjectLabels: selectedSubjects.map((subject) => subjectLabel(subject, input.level)),
    pack,
    totalHours: pack?.totalHours ?? 0,
    sessionCount: scheduleLines.reduce((total, line) => total + line.dates.length, 0),
    dates,
    scheduleLines,
    requiresValidation: requiresPedagogicalValidation(input.level, input.profile),
  };
}

export function buildBilanUrl(input: {
  packId: string;
  level: string;
  subjectIds: string[];
  profile: AcademicProfileSelection;
}): string {
  const params = new URLSearchParams({
    programme: 'pre-rentree-2026',
    pack: input.packId,
    niveau: input.level,
    matieres: input.subjectIds.join(','),
  });
  if (input.profile.voie) params.set('voie', input.profile.voie);
  if (input.profile.mathsProfile) params.set('profil_maths', input.profile.mathsProfile);
  if (input.profile.eafProfile) params.set('profil_eaf', input.profile.eafProfile);
  if (input.profile.retainedSpecialties?.length) {
    params.set('specialites', input.profile.retainedSpecialties.join(','));
  }
  if (input.profile.mathsOption) params.set('option_maths', input.profile.mathsOption);
  return `/bilan-gratuit?${params.toString()}`;
}

export function buildWhatsAppMessage(summary: SelectionSummary): string {
  const schedule = summary.scheduleLines
    .map(
      (line) =>
        `${line.subjectLabel} : ${line.dates.join(', ')} · ${line.startTime}–${line.endTime}`,
    )
    .join('\n');
  const pack = summary.pack;
  const pricing = pack
    ? `Pack : ${pack.id}\nTarif indicatif : ${pack.price} TND\nAcompte : ${pack.deposit} TND`
    : 'Tarif indicatif : à confirmer';

  return [
    'Bonjour, je souhaite des informations sur la Pré-rentrée Nexus 2026.',
    '',
    `Niveau : ${summary.levelLabel}`,
    `Profil : ${summary.profileLabel}`,
    `Matières : ${summary.subjectLabels.join(', ')}`,
    `Volume : ${summary.totalHours} heures`,
    `Horaires :\n${schedule}`,
    pricing,
    '',
    'Je souhaite vérifier la disponibilité et la compatibilité du groupe.',
  ].join('\n');
}
