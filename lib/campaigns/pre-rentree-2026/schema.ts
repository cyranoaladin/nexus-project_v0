import { z } from 'zod';

export const CampaignStatus = z.enum([
  'DRAFT',
  'PRE_REGISTRATION_OPEN',
  'REGISTRATION_OPEN',
  'FULL',
  'CLOSED',
  'ARCHIVED',
]);

export type CampaignStatus = z.infer<typeof CampaignStatus>;

const TimeSlot = z.object({
  id: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const Level = z.object({
  id: z.enum(['SECONDE', 'PREMIERE', 'TERMINALE']),
  label: z.string(),
});

const Subject = z.object({
  id: z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS']),
  label: z.string(),
  levels: z.array(z.string()),
  labelByLevel: z.record(z.string()).optional(),
});

const ScheduleSlot = z.object({
  level: z.enum(['SECONDE', 'PREMIERE', 'TERMINALE']),
  subject: z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS']),
  block: z.enum(['A', 'B', 'C', 'D']),
  room: z.string(),
});

const WeekSchedule = z.object({
  week: z.number().int().min(1).max(2),
  weekLabel: z.string(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(ScheduleSlot),
});

const Venue = z.object({
  name: z.string(),
  city: z.string(),
  neighborhood: z.string(),
});

const Capacity = z.object({
  minPerCohort: z.literal(3),
  maxPerCohort: z.literal(5),
});

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
  SECONDE: z.object({}).strict(),
  PREMIERE: z.object({
    voies: z.array(ProfileOption).length(2),
    mathsProfiles: z.array(ProfileOption).length(2),
    eafProfiles: z.array(ProfileOption).length(2),
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
    material: z.string().min(1),
    preRegistrationNotice: z.string().min(1),
    noOnlinePaymentNotice: z.string().min(1),
    groupCompositionNotice: z.string().min(1),
    groupNotOpenedProcedure: z.string().min(1),
  }),
  faq: z.array(z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
  })).length(16),
});

const SeoContract = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  canonical: z.literal('/stages/pre-rentree-2026'),
  ogImage: z.string().startsWith('/'),
});

export const PreRentreeCampaignManifestSchema = z.object({
  campaignId: z.literal('pre-rentree-2026'),
  version: z.string(),
  status: CampaignStatus,
  canonicalPath: z.literal('/stages/pre-rentree-2026'),
  shortPath: z.literal('/pre-rentree'),
  timezone: z.literal('Africa/Tunis'),
  startDate: z.literal('2026-08-17'),
  endDate: z.literal('2026-08-28'),
  noClassDates: z.array(z.string()).min(2),
  decisionDeadline: z.string(),
  venue: Venue,
  levels: z.array(Level).length(3),
  subjects: z.array(Subject).length(4),
  blocks: z.array(TimeSlot).length(4),
  schedule: z.array(WeekSchedule).length(2),
  roomRoles: z.record(z.array(z.string())),
  teacherRoles: z.record(z.object({
    subjects: z.array(z.string()),
    maxHoursPerDay: z.number(),
  })),
  capacity: Capacity,
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
  level: z.enum(['SECONDE', 'PREMIERE', 'TERMINALE']),
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
  modules: z.array(CampaignModule).length(12),
});

export type PreRentreeCampaignModule = z.infer<typeof CampaignModule>;
