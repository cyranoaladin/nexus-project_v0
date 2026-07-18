import type { PreRentreeCampaignManifest } from '@/lib/campaigns/pre-rentree-2026/schema';
import type { PreRentreePack } from '@/lib/pricing';

const SUBJECT_PUBLICATION_STYLE = {
  MATHEMATIQUES: { abbreviation: 'MATHS', color: '#1B64B0' },
  FRANCAIS: { abbreviation: 'FR', color: '#8A2743' },
  NSI: { abbreviation: 'NSI/SNT', color: '#6F42C1' },
  PHYSIQUE_CHIMIE: { abbreviation: 'PC', color: '#16847A' },
} as const;

const PUBLIC_ROOM_LABELS: Record<string, string> = {
  'salle-1': 'Salle 1',
  'salle-2': 'Salle 2',
};

export function publicSubjectLabel(
  campaign: PreRentreeCampaignManifest,
  subjectId: string,
  level: string,
): string {
  const subject = campaign.subjects.find((candidate) => candidate.id === subjectId);
  if (!subject) throw new Error(`Unknown campaign subject: ${subjectId}`);
  return subject.labelByLevel?.[level] ?? subject.label;
}
export function deriveSubjects(campaign: PreRentreeCampaignManifest) {
  return campaign.subjects.map((subject) => ({
    id: subject.id,
    label: subject.label,
    ...(subject.labelByLevel ? { labelByLevel: subject.labelByLevel } : {}),
    publicLabelByLevel: Object.fromEntries(
      campaign.levels.map((level) => [level.id, publicSubjectLabel(campaign, subject.id, level.id)]),
    ),
    ...SUBJECT_PUBLICATION_STYLE[subject.id],
  }));
}

export function deriveSchedule(campaign: PreRentreeCampaignManifest) {
  const blocks = new Map(campaign.blocks.map((block) => [block.id, block]));
  const counters = new Map<string, number>();
  const sessions: Array<{
    date: string;
    week: number;
    level: 'SECONDE' | 'PREMIERE' | 'TERMINALE';
    subjectId: 'MATHEMATIQUES' | 'PHYSIQUE_CHIMIE' | 'NSI' | 'FRANCAIS';
    subjectLabel: string;
    blockId: 'A' | 'B' | 'C' | 'D';
    startTime: string;
    endTime: string;
    roomLabel: string;
    sessionNumber: number;
  }> = [];

  const weeks = campaign.schedule.map((week) => ({
    week: week.week,
    label: week.weekLabel,
    startDate: week.weekStart,
    endDate: week.weekEnd,
    slots: week.slots.map((slot) => {
      const block = blocks.get(slot.block);
      if (!block) throw new Error(`Unknown campaign block: ${slot.block}`);
      const roomLabel = PUBLIC_ROOM_LABELS[slot.room];
      if (!roomLabel) throw new Error(`Unknown public room: ${slot.room}`);
      return {
        level: slot.level,
        subjectId: slot.subject,
        subjectLabel: publicSubjectLabel(campaign, slot.subject, slot.level),
        blockId: slot.block,
        startTime: block.startTime,
        endTime: block.endTime,
        roomLabel,
      };
    }),
  }));

  for (const week of campaign.schedule) {
    const start = new Date(`${week.weekStart}T12:00:00Z`);
    for (let day = 0; day < 5; day += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + day);
      const dateValue = date.toISOString().slice(0, 10);
      if (campaign.noClassDates.includes(dateValue)) continue;

      for (const slot of week.slots) {
        const block = blocks.get(slot.block);
        const roomLabel = PUBLIC_ROOM_LABELS[slot.room];
        if (!block || !roomLabel) throw new Error('Invalid canonical schedule reference');
        const key = `${slot.level}:${slot.subject}`;
        const sessionNumber = (counters.get(key) ?? 0) + 1;
        counters.set(key, sessionNumber);
        sessions.push({
          date: dateValue,
          week: week.week,
          level: slot.level,
          subjectId: slot.subject,
          subjectLabel: publicSubjectLabel(campaign, slot.subject, slot.level),
          blockId: slot.block,
          startTime: block.startTime,
          endTime: block.endTime,
          roomLabel,
          sessionNumber,
        });
      }
    }
  }

  return { weeks, sessions };
}

export function derivePacks(packs: PreRentreePack[]) {
  return packs.map((pack) => {
    if (pack.price_per_student - pack.payment.deposit !== pack.payment.solde) {
      throw new Error(`Canonical pricing arithmetic mismatch for ${pack.id}`);
    }
    return {
      subjectCount: pack.subjects_count,
      title: pack.title,
      hoursPerSubject: pack.hours_per_subject,
      totalHours: pack.total_hours,
      sessionsPerSubject: pack.sessions_per_subject,
      sessionDurationHours: pack.session_duration_h,
      groupMin: pack.group_min_open,
      groupMax: pack.group_max,
      price: pack.price_per_student,
      deposit: pack.payment.deposit,
      balance: pack.payment.solde,
      pricePerHour: pack.price_per_student_hour,
    };
  });
}

export function derivePublicationMode(campaign: PreRentreeCampaignManifest) {
  if (
    campaign.status !== 'PRE_REGISTRATION_OPEN' ||
    !campaign.featureFlags.enablePreRegistration ||
    campaign.featureFlags.enablePayment
  ) {
    throw new Error('Campaign is not in the canonical pre-registration-only state');
  }
  return 'PRE_REGISTRATION_ONLY' as const;
}

export function deriveApprovedPublicClaims(campaign: PreRentreeCampaignManifest) {
  const claims = [
    ['hero-title', 'MARKETING', campaign.content.hero.h1, '/content/hero/h1'],
    ['hero-subtitle', 'DATES_AND_AUDIENCE', campaign.content.hero.subtitle, '/content/hero/subtitle'],
    ['audience', 'AUDIENCE', campaign.content.practical.audience, '/content/practical/audience'],
    ['material', 'MATERIAL', campaign.content.practical.material, '/content/practical/material'],
    ['pre-registration', 'PRE_REGISTRATION', campaign.content.practical.preRegistrationNotice, '/content/practical/preRegistrationNotice'],
    ['no-online-payment', 'PRE_REGISTRATION', campaign.content.practical.noOnlinePaymentNotice, '/content/practical/noOnlinePaymentNotice'],
    ['group-composition', 'CAPACITY', campaign.content.practical.groupCompositionNotice, '/content/practical/groupCompositionNotice'],
    ['group-not-opened', 'PRE_REGISTRATION', campaign.content.practical.groupNotOpenedProcedure, '/content/practical/groupNotOpenedProcedure'],
    ...campaign.content.method.map((item, index) => [
      `method-${index + 1}`,
      'METHOD',
      `${item.title}. ${item.description}`,
      `/content/method/${index}`,
    ]),
    ...Object.entries(campaign.content.practical.materialsBySubject).map(([subjectId, item]) => [
      `material-${subjectId.toLowerCase().replaceAll('_', '-')}`,
      'MATERIAL',
      `${item.label}. ${item.description}`,
      `/content/practical/materialsBySubject/${subjectId}`,
    ]),
  ] as const;

  return [
    ...claims.map(([id, type, text, pointer]) => ({
      id,
      type,
      text,
      source: { path: 'data/campaigns/pre-rentree-2026.json', pointer },
    })),
    {
      id: 'group-size',
      type: 'CAPACITY',
      text: `Groupes de ${campaign.capacity.minPerCohort} à ${campaign.capacity.maxPerCohort} élèves`,
      source: { path: 'data/campaigns/pre-rentree-2026.json', pointer: '/capacity' },
    },
    {
      id: 'decision-deadline',
      type: 'DEADLINE',
      text: 'Décision communiquée le 10 août à 18 h.',
      source: { path: 'data/campaigns/pre-rentree-2026.json', pointer: '/decisionDeadline' },
    },
    {
      id: 'adaptation-notice',
      type: 'PEDAGOGY',
      text: 'Le programme et le niveau des exercices sont adaptés au profil déclaré et à la composition pédagogique du groupe.',
      source: { path: 'OWNER_MISSION', pointer: '/PHASE_4/adaptation-notice' },
    },
    {
      id: 'recording-consent',
      type: 'CONSENT',
      text: 'Tout enregistrement pédagogique est facultatif et soumis à un consentement séparé.',
      source: { path: 'OWNER_MISSION', pointer: '/PHASE_4/enregistrement-oral' },
    },
    {
      id: 'public-cta',
      type: 'CTA',
      text: 'Se pré-inscrire ou demander un conseil',
      source: { path: 'OWNER_MISSION', pointer: '/PHASE_5/CTA' },
    },
  ];
}
