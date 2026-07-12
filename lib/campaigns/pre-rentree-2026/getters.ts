import 'server-only';

import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import modulesData from '@/content/pre-rentree-2026/modules.json';
import { getPreRentreePacks } from '@/lib/pricing';
import {
  PreRentreeCampaignManifestSchema,
  PreRentreeModulesSchema,
} from './schema';
import type { PreRentreeCampaignManifest } from './schema';

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
    level: string;
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

  return {
    campaign: {
      id: campaign.campaignId,
      version: campaign.version,
      status: campaign.status,
      canonicalPath: campaign.canonicalPath,
      timezone: campaign.timezone,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      noClassDates: campaign.noClassDates,
      decisionDeadline: campaign.decisionDeadline,
      venue: campaign.venue,
    },
    levels: campaign.levels,
    subjects: campaign.subjects,
    blocks: campaign.blocks,
    capacity: campaign.capacity,
    academicProfiles: campaign.academicProfiles,
    packs,
    schedule,
    modules,
    content: campaign.content,
    seo: campaign.seo,
    cta: campaign.cta,
    contact: campaign.contact,
    featureFlags: campaign.featureFlags,
    status: campaign.status,
  };
}
