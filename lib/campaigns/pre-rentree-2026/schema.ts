import { z } from 'zod';
import { PRE_RENTREE_2026_NAVIGATION } from './navigation';

/**
 * Seuil d'ouverture de groupe UNIQUE pour tous les stages de pré-rentrée 2026, toutes
 * offres et tous niveaux confondus (Fondations comme Premium) : un stage ouvre à partir
 * de ce nombre d'inscrits, sans exception ni valeur dupliquée par matière/niveau.
 * Référencé partout au lieu d'être ré-écrit (data/campaigns, offers.json,
 * pricing.canonical.json, PDF Planning, sélecteur) pour rester une source unique.
 */
export const PRE_RENTREE_MIN_COHORT_OPENING = 3;

/** Stable internal codes for the pupil's entry class in school year 2026-2027. */
export const ENTRY_LEVEL_IDS = ['QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'] as const;
export const EntryLevelCode = z.enum(ENTRY_LEVEL_IDS);
export type EntryLevelCode = z.infer<typeof EntryLevelCode>;

export const CampaignStatus = z.enum([
  'DRAFT',
  'PUBLIC_INFORMATIONAL',
  'PRE_REGISTRATION_OPEN',
  'REGISTRATION_OPEN',
  'FULL',
  'CLOSED',
  'ARCHIVED',
]);

export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const CampaignReleaseStatus = z.enum([
  'INTERNAL_DRAFT',
  'READY_FOR_REVIEW',
  'READY_FOR_OWNER_GO',
  'PUBLIC_READY',
]);

const TimeSlot = z.object({
  id: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const Level = z.discriminatedUnion('id', [
  z.object({ id: z.literal('QUATRIEME'), label: z.literal('Entrée en 4e') }),
  z.object({ id: z.literal('TROISIEME'), label: z.literal('Entrée en 3e') }),
  z.object({ id: z.literal('SECONDE'), label: z.literal('Entrée en Seconde') }),
  z.object({ id: z.literal('PREMIERE'), label: z.literal('Entrée en Première') }),
  z.object({ id: z.literal('TERMINALE'), label: z.literal('Entrée en Terminale') }),
]);

const LevelSemantics = z.object({
  kind: z.literal('ENTRY_LEVEL'),
  schoolYear: z.literal('2026-2027'),
  currentToEntry: z.object({
    CINQUIEME: z.literal('QUATRIEME'),
    QUATRIEME: z.literal('TROISIEME'),
    TROISIEME: z.literal('SECONDE'),
    SECONDE: z.literal('PREMIERE'),
    PREMIERE: z.literal('TERMINALE'),
  }).strict(),
}).strict();

const Subject = z.object({
  id: z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'SVT', 'MATHS_EXPERTES', 'PHILOSOPHIE']),
  label: z.string(),
  levels: z.array(EntryLevelCode),
  labelByLevel: z.record(z.string()).optional(),
});

const ScheduleSlot = z.object({
  level: EntryLevelCode,
  subject: z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'SVT', 'MATHS_EXPERTES', 'PHILOSOPHIE']),
  block: z.enum(['A', 'B', 'C', 'D']),
  room: z.string(),
  teacherRole: z.string().min(1),
  // Additive, backward-compatible cohort fields (SCHEDULE-S5 mission): a slot
  // without cohortId is an implicit single primary cohort, exactly as before.
  // When a (level, subject) has more than one slot in the same window, each
  // must carry a distinct cohortId within the same alternativeGroupId so the
  // assignment engine (itinerary.ts/.py) can pick the best one per family
  // instead of double-counting the subject as attended twice.
  cohortId: z.string().min(1).optional(),
  alternativeGroupId: z.string().min(1).optional(),
  isPrimary: z.boolean().optional(),
}).strict();

const ScheduleWindow = z.object({
  windowId: z.string().min(1),
  windowLabel: z.string(),
  days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  slots: z.array(ScheduleSlot),
});

const Venue = z.object({
  name: z.string(),
  city: z.string(),
  neighborhood: z.string(),
});

const CapacityByOffer = z.object({
  FONDATIONS: z.object({ minPerCohort: z.literal(PRE_RENTREE_MIN_COHORT_OPENING), maxPerCohort: z.literal(6) }).strict(),
  PREMIUM: z.object({ minPerCohort: z.literal(PRE_RENTREE_MIN_COHORT_OPENING), maxPerCohort: z.literal(5) }).strict(),
}).strict();

const Contact = z.object({
  whatsappChannel: z.string(),
  whatsappMessage: z.string(),
  email: z.string().email(),
});

const FeatureFlags = z.object({
  showPricing: z.boolean(),
  showSchedule: z.boolean(),
  showPrograms: z.boolean(),
  enablePreRegistration: z.boolean(),
  showAvailability: z.boolean(),
  enablePayment: z.boolean(),
});

const ProfileOption = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const AcademicProfiles = z.object({
  QUATRIEME: z.object({}).strict(),
  TROISIEME: z.object({}).strict(),
  SECONDE: z.object({}).strict(),
  PREMIERE: z.object({
    voies: z.array(ProfileOption).length(2),
    mathsProfiles: z.array(ProfileOption).length(2),
    eafProfiles: z.array(ProfileOption).length(2),
    specialtyPlans: z.array(ProfileOption).length(8),
  }),
  TERMINALE: z.object({
    retainedSpecialties: z.object({
      label: z.string().min(1),
      minSelections: z.literal(0),
      maxSelections: z.literal(2),
      options: z.array(ProfileOption).min(3),
    }),
    mathsOptions: z.array(ProfileOption).length(3),
  }),
});

const CampaignContent = z.object({
  hero: z.object({
    eyebrow: z.string().min(1),
    h1: z.string().min(1),
    subtitle: z.string().min(1),
  }),
  method: z.array(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
  })).length(4),
  practical: z.object({
    audience: z.string().min(1),
    material: z.string().min(1),
    materialsBySubject: z.object({
      MATHEMATIQUES: z.object({ label: z.string().min(1), description: z.string().min(1) }),
      FRANCAIS: z.object({ label: z.string().min(1), description: z.string().min(1) }),
      NSI: z.object({ label: z.string().min(1), description: z.string().min(1) }),
      PHYSIQUE_CHIMIE: z.object({ label: z.string().min(1), description: z.string().min(1) }),
      SVT: z.object({ label: z.string().min(1), description: z.string().min(1) }),
      MATHS_EXPERTES: z.object({ label: z.string().min(1), description: z.string().min(1) }),
      PHILOSOPHIE: z.object({ label: z.string().min(1), description: z.string().min(1) }),
    }).strict(),
    preRegistrationNotice: z.string().min(1),
    noOnlinePaymentNotice: z.string().min(1),
    groupCompositionNotice: z.string().min(1),
    groupNotOpenedProcedure: z.string().min(1),
    adaptationNotice: z.string().min(1),
    recordingConsentNotice: z.string().min(1),
  }),
  // `id` is a stable slug (never renamed once assigned — PDFs/tests may
  // reference it). `published` gates public rendering: only entries with
  // published: true are compiled into the site's FAQ (public-surface.ts
  // filters on this flag rather than re-declaring a parallel hardcoded list).
  // `answer` may contain `{{placeholder}}` tokens resolved at compile time
  // against live derived facts (dates, subject lists, price ranges) — see
  // resolveFaqTemplate in public-surface.ts. A published entry's static text
  // must never freeze a number that is meant to stay derived.
  faq: z.array(z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().min(1),
    published: z.boolean(),
  })).length(24),
});

const SeoContract = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  canonical: z.literal('/stages/pre-rentree-2026'),
  ogImage: z.string().startsWith('/'),
});

export const PreRentreeCampaignManifestSchema = z.object({
  campaignId: z.literal(PRE_RENTREE_2026_NAVIGATION.campaignId),
  version: z.string(),
  status: CampaignStatus,
  releaseStatus: CampaignReleaseStatus,
  canonicalPath: z.literal(PRE_RENTREE_2026_NAVIGATION.path),
  shortPath: z.literal('/pre-rentree'),
  timezone: z.literal('Africa/Tunis'),
  startDate: z.literal('2026-08-17'),
  endDate: z.literal('2026-08-28'),
  noClassDates: z.array(z.string()),
  decisionDeadline: z.string(),
  venue: Venue,
  levels: z.array(Level).length(5),
  entryLevelSemantics: LevelSemantics,
  subjects: z.array(Subject).length(7),
  blocks: z.array(TimeSlot).length(4),
  schedule: z.array(ScheduleWindow).length(3),
  // Rooms: 3 permanent, banalized, interchangeable rooms — no subject
  // compatibility, no "temporary room" concept. The only room constraint is
  // structural (validator R2): at most 3 concurrent groups per (window,
  // block), i.e. never more groups than physical rooms exist.
  rooms: z.array(z.string().min(1)).length(3),
  // Teacher roles: TEACHER_A_MATHS_NSI remains the sole lycée (Seconde/
  // Première/Terminale) maths+NSI+maths-expertes teacher. TEACHER_B_MATHS_
  // COLLEGE is a second, distinct maths teacher scoped to the collège level
  // (4e) only — it must never be assigned a lycée-level slot, so the "one
  // maths/NSI teacher" invariant at lycée levels still holds. TEACHER_C_
  // FRANCAIS covers Français (4e/3e/2de/1re) AND Philosophie (Terminale) —
  // sole Lettres/Philosophie teacher.
  // maxHoursPerDay is informative only (validator R3 reports load, never
  // blocks on it) — kept optional rather than removed so any role that does
  // want to declare a real-world cap still can, without the field being load
  // -bearing for validation.
  teacherRoles: z.record(z.object({
    subjects: z.array(z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'SVT', 'MATHS_EXPERTES'])).min(1),
    maxHoursPerDay: z.number().int().min(1).max(12).optional(),
    assigned: z.boolean(),
  }).strict()),
  capacityByOffer: CapacityByOffer,
  operationalGates: z.object({
    roomAssignmentsValidated: z.boolean(),
    teacherAssignmentsValidated: z.boolean(),
    noTeacherConflict: z.boolean(),
    noRoomConflict: z.boolean(),
    noLevelConflict: z.boolean(),
    dailyLoadValid: z.boolean(),
  }).strict(),
  packProductIds: z.array(z.string()).length(4),
  academicProfiles: AcademicProfiles,
  content: CampaignContent,
  seo: SeoContract,
  contact: Contact,
  cta: z.object({
    primary: z.object({ label: z.string(), action: z.string() }),
    secondary: z.object({ label: z.string(), action: z.string() }),
    whatsapp: z.object({ label: z.string(), action: z.string() }),
    bilanGratuit: z.object({ label: z.string(), path: z.string() }),
  }),
  featureFlags: FeatureFlags,
  contentRefs: z.object({ modules: z.string() }),
  legalRefs: z.object({ cgv: z.string(), commercialTerms: z.string() }),
  analyticsEventPrefix: z.literal('pre_rentree'),
});

export type PreRentreeCampaignManifest = z.infer<typeof PreRentreeCampaignManifestSchema>;

const ModuleSession = z.object({
  number: z.number().int().min(1).max(5),
  title: z.string().min(1),
  objective: z.string().min(1),
  topics: z.array(z.string().min(1)).min(1),
  method: z.string().min(1),
  deliverable: z.string().min(1),
});

const CampaignModule = z.object({
  id: z.string().min(1),
  publicationStatus: z.enum(['PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION', 'DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION', 'VALIDATED']).optional(),
  objective: z.string().min(1).optional(),
  equipment: z.string().min(1).optional(),
  level: EntryLevelCode,
  subjectId: z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'SVT', 'MATHS_EXPERTES']),
  subject: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  prerequisites: z.string().min(1),
  differentiation: z.string().min(1),
  quickAssessment: z.string().min(1),
  sessions: z.array(ModuleSession).length(5),
});

export const PreRentreeModulesSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  modules: z.array(CampaignModule).length(14),
});

export type PreRentreeCampaignModule = z.infer<typeof CampaignModule>;
