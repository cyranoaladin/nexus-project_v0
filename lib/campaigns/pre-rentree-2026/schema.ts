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
  whatsapp: z.string(),
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
