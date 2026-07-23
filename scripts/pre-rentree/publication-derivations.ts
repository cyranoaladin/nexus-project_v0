import type { PreRentreeCampaignManifest } from '@/lib/campaigns/pre-rentree-2026/schema';
import type { PreRentreeCampaignModule } from '@/lib/campaigns/pre-rentree-2026/schema';
import type { PreRentreePedagogyFramework } from '@/lib/campaigns/pre-rentree-2026/content-schema';
import type { PreRentreePack } from '@/lib/pricing';

const SUBJECT_PUBLICATION_STYLE = {
  MATHEMATIQUES: { abbreviation: 'MATHS', color: '#1B64B0' },
  FRANCAIS: { abbreviation: 'FR', color: '#8A2743' },
  NSI: { abbreviation: 'NSI', color: '#6F42C1' },
  PHYSIQUE_CHIMIE: { abbreviation: 'PC', color: '#16847A' },
  PHILOSOPHIE: { abbreviation: 'PHILO', color: '#8A5A28' },
  SVT: { abbreviation: 'SVT', color: '#047857' },
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
    level: PreRentreeCampaignManifest['levels'][number]['id'];
    subjectId: PreRentreeCampaignManifest['subjects'][number]['id'];
    subjectLabel: string;
    blockId: 'A' | 'B' | 'C' | 'D' | 'E';
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

export function derivePedagogyArtifacts(
  modules: readonly PreRentreeCampaignModule[],
  framework: PreRentreePedagogyFramework,
) {
  const codeByModule = new Map(framework.moduleCodes.map((entry) => [entry.moduleId, entry]));
  const quickAssessments: Array<Record<string, unknown>> = [];
  const sessionDeliverables: Array<Record<string, unknown>> = [];
  const positioningTests = modules.map((module, moduleIndex) => {
    const code = codeByModule.get(module.id);
    if (!code) throw new Error(`Missing positioning-test code for ${module.id}`);
    const pattern = framework.subjectPatterns[module.subjectId];
    const questions = module.sessions.map((session) => {
      const sessionRef = `${module.id}#session-${session.number}`;
      const topics = session.topics.join(', ');
      quickAssessments.push({
        id: `QA-${module.id}-${session.number}`,
        sessionRef,
        durationMinutes: framework.quickAssessmentDurationMinutes,
        domain: session.topics[0],
        prompt: `${pattern.taskLead} ${session.objective.toLocaleLowerCase('fr-FR')}. En cinq à dix minutes, produisez une réponse autonome qui utilise au moins deux éléments parmi : ${topics}.`,
        correction: `${pattern.correctionLead} : ${topics}. Une réponse partielle est reprise avec l’élève avant la séance suivante.`,
        successCriterion: `La démarche répond à l’objectif « ${session.objective} » et mobilise correctement au moins deux notions annoncées.`,
        expectedLevel: module.level,
        captureMode: 'Grille ACQUIS / FRAGILE / LACUNE et commentaire factuel court',
      });
      sessionDeliverables.push({
        id: `DEL-${module.id}-${session.number}`,
        sessionRef,
        title: session.deliverable,
        objective: session.objective,
        instructions: [
          `Relire l’objectif de la séance : ${session.objective}.`,
          `Réaliser la production « ${session.deliverable} » en suivant cette méthode : ${session.method}.`,
          `Faire apparaître explicitement les notions suivantes : ${topics}.`,
          'Relire, corriger puis dater la version finale avant de la ranger dans le dossier de stage.',
        ],
        expectedEvidence: [
          `Une production complète correspondant à « ${session.deliverable} ».`,
          `Une trace de vérification portant sur ${session.topics.slice(0, 2).join(' et ')}.`,
        ],
        selfCheck: [
          'J’ai traité toutes les étapes de la consigne.',
          'J’ai utilisé le vocabulaire et les notions de la séance.',
          'J’ai vérifié ma production et corrigé les erreurs repérées.',
        ],
      });
      return {
        number: session.number,
        domain: session.topics[0],
        prompt: `${pattern.taskLead} ${session.objective.toLocaleLowerCase('fr-FR')}. Votre production doit mobiliser : ${topics}.`,
        correction: `${pattern.correctionLead} : ${topics}. La méthode attendue est : ${session.method}.`,
        points: 4,
        errorTypes: pattern.errorTypes,
      };
    });
    return {
      id: code.code,
      moduleId: module.id,
      version: framework.version,
      durationMinutes: framework.positioningDurationMinutes,
      materialAllowed: code.material,
      domains: module.sessions.map((session) => session.topics[0]),
      questions,
      totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
      rubric: framework.rubric,
      errorTypes: pattern.errorTypes,
      coherenceChecks: [
        'Cinq domaines évalués et cinq questions présentes.',
        'Le total du barème vaut 20 points.',
        'Chaque question possède un corrigé et une typologie d’erreurs.',
      ],
      anonymousSample: {
        sampleId: `SAMPLE-ANON-${String(moduleIndex + 1).padStart(2, '0')}`,
        ...framework.anonymousSample,
      },
    };
  });

  return { positioningTests, quickAssessments, sessionDeliverables };
}

export function derivePublicationMode(campaign: PreRentreeCampaignManifest) {
  if (campaign.featureFlags.enablePayment) {
    throw new Error('The public campaign page cannot collect payment');
  }
  if (campaign.status === 'DRAFT') return 'REVIEW' as const;
  if (campaign.status === 'REGISTRATION_OPEN') return 'RELEASE' as const;
  throw new Error(`Unsupported publication state: ${campaign.status}`);
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
    ...Object.entries(campaign.capacityByOffer).map(([range, capacity]) => ({
      id: `group-size-${range.toLowerCase()}`,
      type: 'CAPACITY',
      text: `${range === 'FONDATIONS' ? 'Fondations' : 'Premium'} : groupes de ${capacity.minPerCohort} à ${capacity.maxPerCohort} élèves`,
      source: { path: 'data/campaigns/pre-rentree-2026.json', pointer: `/capacityByOffer/${range}` },
    })),
    {
      id: 'decision-deadline',
      type: 'DEADLINE',
      text: 'Décision communiquée le 10 août à 18 h.',
      source: { path: 'data/campaigns/pre-rentree-2026.json', pointer: '/decisionDeadline' },
    },
    {
      id: 'adaptation-notice',
      type: 'PEDAGOGY',
      text: campaign.content.practical.adaptationNotice,
      source: { path: 'data/campaigns/pre-rentree-2026.json', pointer: '/content/practical/adaptationNotice' },
    },
    {
      id: 'recording-consent',
      type: 'CONSENT',
      text: campaign.content.practical.recordingConsentNotice,
      source: { path: 'data/campaigns/pre-rentree-2026.json', pointer: '/content/practical/recordingConsentNotice' },
    },
    {
      id: 'public-cta',
      type: 'CTA',
      text: campaign.cta.primary.label,
      source: { path: 'data/campaigns/pre-rentree-2026.json', pointer: '/cta/primary/label' },
    },
  ];
}
