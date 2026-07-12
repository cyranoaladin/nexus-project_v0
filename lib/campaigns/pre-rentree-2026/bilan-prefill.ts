import { z } from 'zod';
import { ENTRY_LEVEL_IDS } from './schema';

type SearchValue = string | string[] | undefined;
export type CampaignSearchParams = Record<string, SearchValue>;

const SUBJECT_IDS = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS'] as const;
const PACK_IDS = [
  'pre2026-pack-1',
  'pre2026-pack-2',
  'pre2026-pack-3',
  'pre2026-pack-4',
] as const;
const VOIE_IDS = ['GENERALE', 'TECHNOLOGIQUE'] as const;
const PREMIERE_MATHS_IDS = ['MATHS_EDS', 'MATHS_HORS_EDS'] as const;
const EAF_PROFILE_IDS = ['EAF_GENERALE', 'EAF_TECHNOLOGIQUE'] as const;
const TERMINALE_SPECIALTY_IDS = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI'] as const;
const TERMINALE_MATHS_OPTION_IDS = [
  'AUCUNE',
  'MATHS_EXPERTES',
  'MATHS_COMPLEMENTAIRES',
] as const;

const LEVELS = new Set<string>(ENTRY_LEVEL_IDS);
const SUBJECTS = new Set<string>(SUBJECT_IDS);
const PACKS = new Set<string>(PACK_IDS);
const VOIES = new Set<string>(VOIE_IDS);
const PREMIERE_MATHS = new Set<string>(PREMIERE_MATHS_IDS);
const EAF_PROFILES = new Set<string>(EAF_PROFILE_IDS);
const TERMINALE_SPECIALTIES = new Set<string>(TERMINALE_SPECIALTY_IDS);
const TERMINALE_MATHS_OPTIONS = new Set<string>(TERMINALE_MATHS_OPTION_IDS);

export const PreRentreeCampaignContextSchema = z.object({
  programme: z.literal('pre-rentree-2026'),
  packId: z.enum(PACK_IDS),
  /** Stable code for the pupil's 2026-2027 entry class, never the current class. */
  level: z.enum(ENTRY_LEVEL_IDS),
  subjectIds: z.array(z.enum(SUBJECT_IDS)).min(1).max(4),
  profile: z.object({
    voie: z.enum(VOIE_IDS).optional(),
    mathsProfile: z.enum(PREMIERE_MATHS_IDS).optional(),
    eafProfile: z.enum(EAF_PROFILE_IDS).optional(),
    retainedSpecialties: z.array(z.enum(TERMINALE_SPECIALTY_IDS)).max(2).optional(),
    mathsOption: z.enum(TERMINALE_MATHS_OPTION_IDS).optional(),
  }).strict(),
}).strict().superRefine((context, refinement) => {
  const expectedSubjectCount = Number(context.packId.at(-1));
  if (
    new Set(context.subjectIds).size !== context.subjectIds.length ||
    context.subjectIds.length !== expectedSubjectCount
  ) {
    refinement.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subjectIds'],
      message: 'Le pack doit correspondre au nombre de matières uniques.',
    });
  }

  const { profile } = context;
  const invalidProfile =
    (context.level === 'SECONDE' && Object.keys(profile).length > 0) ||
    (context.level === 'PREMIERE' &&
      (!profile.voie || !profile.mathsProfile || !profile.eafProfile ||
        profile.mathsOption || profile.retainedSpecialties)) ||
    (context.level === 'TERMINALE' &&
      (!profile.mathsOption || profile.voie || profile.mathsProfile || profile.eafProfile));
  if (invalidProfile) {
    refinement.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['profile'],
      message: 'Le profil pédagogique ne correspond pas au niveau déclaré.',
    });
  }
});

export type PreRentreeBilanPrefill = z.infer<typeof PreRentreeCampaignContextSchema>;

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

  const parsed = PreRentreeCampaignContextSchema.safeParse({
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
  });
  return parsed.success ? parsed.data : null;
}
