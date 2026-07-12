import type { AcademicProfileSelection } from './configurator';

type SearchValue = string | string[] | undefined;
export type CampaignSearchParams = Record<string, SearchValue>;

const LEVELS = new Set(['SECONDE', 'PREMIERE', 'TERMINALE']);
const SUBJECTS = new Set(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS']);
const PACKS = new Set([
  'pre2026-pack-1',
  'pre2026-pack-2',
  'pre2026-pack-3',
  'pre2026-pack-4',
]);
const VOIES = new Set(['GENERALE', 'TECHNOLOGIQUE']);
const PREMIERE_MATHS = new Set(['MATHS_EDS', 'MATHS_HORS_EDS']);
const EAF_PROFILES = new Set(['EAF_GENERALE', 'EAF_TECHNOLOGIQUE']);
const TERMINALE_SPECIALTIES = new Set(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI']);
const TERMINALE_MATHS_OPTIONS = new Set([
  'AUCUNE',
  'MATHS_EXPERTES',
  'MATHS_COMPLEMENTAIRES',
]);

export interface PreRentreeBilanPrefill {
  programme: 'pre-rentree-2026';
  packId: string;
  level: string;
  subjectIds: string[];
  profile: AcademicProfileSelection;
}

function scalar(value: SearchValue, maximumLength = 64): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) {
    return null;
  }
  return value;
}

function optionalAllowed(value: SearchValue, allowed: ReadonlySet<string>): string | undefined | null {
  if (value === undefined) return undefined;
  const parsed = scalar(value);
  if (!parsed || !allowed.has(parsed)) return null;
  return parsed;
}

export function parsePreRentreeBilanPrefill(
  params: CampaignSearchParams | undefined,
): PreRentreeBilanPrefill | null {
  if (!params || scalar(params.programme) !== 'pre-rentree-2026') return null;
  const packId = scalar(params.pack);
  const level = scalar(params.niveau);
  const subjectsValue = scalar(params.matieres, 160);
  if (!packId || !PACKS.has(packId) || !level || !LEVELS.has(level) || !subjectsValue) {
    return null;
  }

  const rawSubjects = subjectsValue.split(',');
  const subjectIds = [...new Set(rawSubjects)];
  const packCount = Number(packId.at(-1));
  if (
    rawSubjects.length !== subjectIds.length ||
    subjectIds.length < 1 ||
    subjectIds.length > 4 ||
    subjectIds.length !== packCount ||
    subjectIds.some((subject) => !SUBJECTS.has(subject))
  ) {
    return null;
  }

  const voie = optionalAllowed(params.voie, VOIES);
  const mathsProfile = optionalAllowed(params.profil_maths, PREMIERE_MATHS);
  const eafProfile = optionalAllowed(params.profil_eaf, EAF_PROFILES);
  const mathsOption = optionalAllowed(params.option_maths, TERMINALE_MATHS_OPTIONS);
  if (voie === null || mathsProfile === null || eafProfile === null || mathsOption === null) {
    return null;
  }

  let retainedSpecialties: string[] | undefined;
  if (params.specialites !== undefined) {
    const specialties = scalar(params.specialites, 96)?.split(',');
    if (
      !specialties ||
      specialties.length > 2 ||
      new Set(specialties).size !== specialties.length ||
      specialties.some((specialty) => !TERMINALE_SPECIALTIES.has(specialty))
    ) {
      return null;
    }
    retainedSpecialties = specialties;
  }

  if (
    (level === 'SECONDE' &&
      (voie || mathsProfile || eafProfile || mathsOption || retainedSpecialties)) ||
    (level === 'PREMIERE' && (mathsOption || retainedSpecialties)) ||
    (level === 'TERMINALE' && (voie || mathsProfile || eafProfile))
  ) {
    return null;
  }

  return {
    programme: 'pre-rentree-2026',
    packId,
    level,
    subjectIds,
    profile: {
      ...(voie ? { voie } : {}),
      ...(mathsProfile ? { mathsProfile } : {}),
      ...(eafProfile ? { eafProfile } : {}),
      ...(retainedSpecialties ? { retainedSpecialties } : {}),
      ...(mathsOption ? { mathsOption } : {}),
    },
  };
}
