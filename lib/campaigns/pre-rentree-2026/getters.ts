import 'server-only';

import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import modulesData from '@/content/pre-rentree-2026/modules.json';
import { getPreRentreePacks, getRules } from '@/lib/pricing';
import { LEGAL } from '@/lib/legal';
import {
  PreRentreeCampaignManifestSchema,
  PreRentreeModulesSchema,
} from './schema';
import type { EntryLevelCode, PreRentreeCampaignManifest } from './schema';

/**
 * Get the validated campaign manifest.
 * Server-only — never import from client components.
 */
export function getPreRentreeCampaign(): PreRentreeCampaignManifest {
  return PreRentreeCampaignManifestSchema.parse(campaignManifest);
}

/**
 * Get the 12 module programs with their 60 sessions.
 */
export function getPreRentreeModules() {
  return PreRentreeModulesSchema.parse(modulesData).modules;
}

/**
 * Get the schedule expanded to all 60 individual sessions.
 */
export function getPreRentreeSchedule() {
  const campaign = getPreRentreeCampaign();
  const sessions: Array<{
    date: string;
    level: EntryLevelCode;
    subject: string;
    block: string;
    startTime: string;
    endTime: string;
    room: string;
    week: number;
    sessionNumber: number;
  }> = [];

  for (const weekSchedule of campaign.schedule) {
    const weekStart = new Date(weekSchedule.weekStart);
    for (let day = 0; day < 5; day++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];

      if (campaign.noClassDates.includes(dateStr)) continue;

      for (const slot of weekSchedule.slots) {
        const block = campaign.blocks.find((candidate) => candidate.id === slot.block);
        if (!block) {
          throw new Error(`Unknown campaign block: ${slot.block}`);
        }
        sessions.push({
          date: dateStr,
          level: slot.level,
          subject: slot.subject,
          block: slot.block,
          startTime: block.startTime,
          endTime: block.endTime,
          room: slot.room,
          week: weekSchedule.week,
          sessionNumber: sessions.filter(
            s => s.level === slot.level && s.subject === slot.subject
          ).length + 1,
        });
      }
    }
  }

  return sessions;
}

/**
 * Get pack options with pricing resolved from canonical source.
 * Prices come from pricing.canonical.json via product IDs.
 */
export function getPreRentreePackOptions() {
  const campaign = getPreRentreeCampaign();
  const packs = getPreRentreePacks(campaign.packProductIds);

  return packs.map((pack) => ({
    id: pack.id,
    subjectsCount: pack.subjects_count,
    totalHours: pack.total_hours,
    price: pack.price_per_student,
    deposit: pack.payment.deposit,
    balance: pack.payment.solde,
    pricePerHour: pack.price_per_student_hour,
    groupMinOpen: pack.group_min_open,
    groupMax: pack.group_max,
  }));
}

/**
 * Get the full landing page DTO.
 * Combines manifest + modules + pricing into a single server-rendered payload.
 */
export function getPreRentreeLandingDTO() {
  const campaign = getPreRentreeCampaign();
  const modules = getPreRentreeModules();
  const schedule = getPreRentreeSchedule();
  const packs = getPreRentreePackOptions();
  const pricingRules = getRules();
  const subjects = campaign.subjects.map((subject) => ({
    ...subject,
    summaryByLevel: Object.fromEntries(subject.levels.map((level) => {
      const campaignModule = modules.find(
        (module) => module.level === level && module.subjectId === subject.id,
      );
      if (!campaignModule) {
        throw new Error(`Missing campaign module for ${level}/${subject.id}`);
      }
      return [level, campaignModule.subtitle];
    })),
  }));

  return {
    campaign: {
      id: campaign.campaignId,
      version: campaign.version,
      status: campaign.status,
      entryLevelSemantics: campaign.entryLevelSemantics,
      canonicalPath: campaign.canonicalPath,
      timezone: campaign.timezone,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      noClassDates: campaign.noClassDates,
      decisionDeadline: campaign.decisionDeadline,
      venue: {
        name: `${LEGAL.entity.tradeName} — ${LEGAL.addresses.pedagogique.neighborhood}`,
        neighborhood: LEGAL.addresses.pedagogique.neighborhood,
        city: LEGAL.addresses.pedagogique.city,
      },
    },
    levels: campaign.levels,
    subjects,
    blocks: campaign.blocks,
    scheduleWeeks: campaign.schedule,
    roomRoles: campaign.roomRoles,
    teacherRoles: campaign.teacherRoles,
    capacity: campaign.capacity,
    academicProfiles: campaign.academicProfiles,
    packs,
    pricingRules: {
      depositPercentage: pricingRules.payment.deposit_pct_stage,
    },
    schedule,
    modules,
    content: campaign.content,
    seo: campaign.seo,
    cta: campaign.cta,
    contact: campaign.contact,
    featureFlags: campaign.featureFlags,
    legalRefs: campaign.legalRefs,
    status: campaign.status,
  };
}
