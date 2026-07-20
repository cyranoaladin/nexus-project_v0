import { z } from 'zod';
import { ENTRY_LEVEL_IDS } from './schema';
import { classifyProfileSubjectCompatibility } from './configurator';
import { PRE_RENTREE_2026_NAVIGATION } from './navigation';

type SearchValue = string | string[] | undefined;
export type CampaignSearchParams = Record<string, SearchValue>;

const SUBJECT_IDS = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'PHILOSOPHIE'] as const;
const PACK_CODES = [
  'PACK_1',
  'PACK_2',
  'PACK_3',
  'PACK_4',
] as const;
const VOIE_IDS = ['GENERALE', 'TECHNOLOGIQUE'] as const;
const PREMIERE_MATHS_IDS = ['MATHS_EDS', 'MATHS_HORS_EDS'] as const;
const EAF_PROFILE_IDS = ['EAF_GENERALE', 'EAF_TECHNOLOGIQUE'] as const;
const PREMIERE_SPECIALTY_PLAN_IDS = [
  'AUCUNE_NSI_PC',
  'NSI',
  'PHYSIQUE_CHIMIE',
  'NSI_PHYSIQUE_CHIMIE',
] as const;
const TERMINALE_SPECIALTY_IDS = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI'] as const;
const TERMINALE_MATHS_OPTION_IDS = [
  'AUCUNE',
  'MATHS_EXPERTES',
  'MATHS_COMPLEMENTAIRES',
] as const;

const LEVELS = new Set<string>(ENTRY_LEVEL_IDS);
const SUBJECTS = new Set<string>(SUBJECT_IDS);
const PACKS = new Set<string>(PACK_CODES);
const VOIES = new Set<string>(VOIE_IDS);
const PREMIERE_MATHS = new Set<string>(PREMIERE_MATHS_IDS);
const EAF_PROFILES = new Set<string>(EAF_PROFILE_IDS);
const PREMIERE_SPECIALTY_PLANS = new Set<string>(PREMIERE_SPECIALTY_PLAN_IDS);
const TERMINALE_SPECIALTIES = new Set<string>(TERMINALE_SPECIALTY_IDS);
const TERMINALE_MATHS_OPTIONS = new Set<string>(TERMINALE_MATHS_OPTION_IDS);

export const PreRentreeCampaignContextSchema = z.object({
  programme: z.literal(PRE_RENTREE_2026_NAVIGATION.campaignId),
  packCode: z.enum(PACK_CODES),
  /** Stable code for the pupil's 2026-2027 entry class, never the current class. */
  level: z.enum(ENTRY_LEVEL_IDS),
  subjectIds: z.array(z.enum(SUBJECT_IDS)).min(1).max(4),
  profile: z.object({
    voie: z.enum(VOIE_IDS).optional(),
    mathsProfile: z.enum(PREMIERE_MATHS_IDS).optional(),
    eafProfile: z.enum(EAF_PROFILE_IDS).optional(),
    premiereSpecialtyPlan: z.enum(PREMIERE_SPECIALTY_PLAN_IDS).optional(),
    retainedSpecialties: z.array(z.enum(TERMINALE_SPECIALTY_IDS)).max(2).optional(),
    mathsOption: z.enum(TERMINALE_MATHS_OPTION_IDS).optional(),
  }).strict(),
}).strict().superRefine((context, refinement) => {
  const expectedSubjectCount = Number(context.packCode.at(-1));
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
    ((context.level === 'TROISIEME' || context.level === 'SECONDE') && Object.keys(profile).length > 0) ||
    (context.level === 'PREMIERE' &&
      (!profile.voie || !profile.mathsProfile || !profile.eafProfile || !profile.premiereSpecialtyPlan ||
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
  const compatibility = classifyProfileSubjectCompatibility(
    context.level,
    context.profile,
    context.subjectIds,
  );
  if (compatibility.status === 'INCOMPATIBLE') {
    refinement.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['profile'],
      message: compatibility.messages.join(' '),
    });
  }
});

export type PreRentreeBilanPrefill = z.infer<typeof PreRentreeCampaignContextSchema>;

function toEntryLevel(studentGrade: string): PreRentreeBilanPrefill['level'] | null {
  const normalized = studentGrade
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized === '3e' || normalized === 'troisieme') return 'TROISIEME';
  if (normalized === 'seconde') return 'SECONDE';
  if (normalized === 'premiere') return 'PREMIERE';
  if (normalized === 'terminale') return 'TERMINALE';
  return null;
}

/**
 * Rebuilds the optional campaign lead context from the fields actually sent by
 * the parent. The URL prefill is only an initial selection, never a source of
 * truth after the form has been edited.
 */
export function synchronizePreRentreeCampaignContext({
  campaignContext,
  studentGrade,
  subjects,
}: {
  campaignContext: PreRentreeBilanPrefill | undefined;
  studentGrade: string;
  subjects: readonly string[];
}): PreRentreeBilanPrefill | null {
  if (!campaignContext) return null;

  const level = toEntryLevel(studentGrade);
  if (!level || level !== campaignContext.level) return null;

  if (
    subjects.length < 1 ||
    subjects.length > 4 ||
    new Set(subjects).size !== subjects.length ||
    subjects.some((subject) => !SUBJECTS.has(subject))
  ) {
    return null;
  }

  const parsed = PreRentreeCampaignContextSchema.safeParse({
    programme: campaignContext.programme,
    packCode: `PACK_${subjects.length}`,
    level,
    subjectIds: subjects,
    profile: campaignContext.profile,
  });
  return parsed.success ? parsed.data : null;
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
  if (!params || scalar(params.programme) !== PRE_RENTREE_2026_NAVIGATION.campaignId) return null;
  const packCode = scalar(params.pack);
  const level = scalar(params.niveau);
  const subjectsValue = scalar(params.matieres, 160);
  if (!packCode || !PACKS.has(packCode) || !level || !LEVELS.has(level) || !subjectsValue) {
    return null;
  }

  const rawSubjects = subjectsValue.split(',');
  const subjectIds = [...new Set(rawSubjects)];
  const packCount = Number(packCode.at(-1));
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
  const premiereSpecialtyPlan = optionalAllowed(
    params.projet_specialites,
    PREMIERE_SPECIALTY_PLANS,
  );
  const mathsOption = optionalAllowed(params.option_maths, TERMINALE_MATHS_OPTIONS);
  if (
    voie === null ||
    mathsProfile === null ||
    eafProfile === null ||
    premiereSpecialtyPlan === null ||
    mathsOption === null
  ) {
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
    ((level === 'TROISIEME' || level === 'SECONDE') &&
      (voie || mathsProfile || eafProfile || premiereSpecialtyPlan || mathsOption || retainedSpecialties)) ||
    (level === 'PREMIERE' && (mathsOption || retainedSpecialties)) ||
    (level === 'TERMINALE' && (voie || mathsProfile || eafProfile || premiereSpecialtyPlan))
  ) {
    return null;
  }

  const parsed = PreRentreeCampaignContextSchema.safeParse({
    programme: PRE_RENTREE_2026_NAVIGATION.campaignId,
    packCode,
    level,
    subjectIds,
    profile: {
      ...(voie ? { voie } : {}),
      ...(mathsProfile ? { mathsProfile } : {}),
      ...(eafProfile ? { eafProfile } : {}),
      ...(premiereSpecialtyPlan ? { premiereSpecialtyPlan } : {}),
      ...(retainedSpecialties ? { retainedSpecialties } : {}),
      ...(mathsOption ? { mathsOption } : {}),
    },
  });
  return parsed.success ? parsed.data : null;
}
