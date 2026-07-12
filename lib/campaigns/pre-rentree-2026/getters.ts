import 'server-only';

import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import modulesData from '@/content/pre-rentree-2026/modules.json';
import pricingData from '@/data/pricing.canonical.json';
import { PreRentreeCampaignManifestSchema } from './schema';
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
  return modulesData.modules;
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
        const block = campaign.blocks.find(b => b.id === slot.block)!;
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
  const packs = (pricingData as any).pre_rentree_packs as Array<{
    id: string;
    subjects_count: number;
    total_hours: number;
    price_per_student: number;
    payment: { deposit: number; solde: number };
  }>;

  return packs.map(p => ({
    id: p.id,
    subjectsCount: p.subjects_count,
    totalHours: p.total_hours,
    price: p.price_per_student,
    deposit: p.payment.deposit,
    balance: p.payment.solde,
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
    packs,
    schedule,
    modules: modules.map((m: any) => ({
      id: m.id,
      level: m.level,
      subject: m.subject,
      title: m.title,
      subtitle: m.subtitle,
      sessions: m.sessions.map((s: any) => ({
        number: s.number,
        title: s.title,
        objective: s.objective,
      })),
    })),
    cta: campaign.cta,
    contact: campaign.contact,
    featureFlags: campaign.featureFlags,
    status: campaign.status,
  };
}
