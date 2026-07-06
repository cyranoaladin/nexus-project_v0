import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { prisma } from '@/lib/prisma';
import { CONTACT_LEAD_RETENTION_DAYS } from '@/lib/crm/contact-leads';

type ContactLeadRetentionStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'ENROLLED' | 'LOST';

export type ContactLeadRetentionLead = {
  id: string;
  email: string;
  status: ContactLeadRetentionStatus | string;
  createdAt: Date;
};

export type ContactLeadRetentionPlanItem = {
  id: string;
  reason: 'retention_expired' | 'parent_erasure_request';
  status: string;
  ageDays: number;
  emailHash: string;
};

export type ContactLeadRetentionPlan = {
  now: string;
  retentionDays: number;
  scanned: number;
  toAnonymize: ContactLeadRetentionPlanItem[];
};

const RETENTION_PURGE_STATUSES = new Set(['NEW', 'CONTACTED', 'LOST']);
const ERASURE_ALLOWED_STATUSES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'LOST']);

function ageDays(createdAt: Date, now: Date): number {
  return Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000);
}

function sanitizeIdForAlias(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80) || 'lead';
}

export function hashContactLeadErasureEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export function buildContactLeadRetentionPlan({
  leads,
  now = new Date(),
  retentionDays = CONTACT_LEAD_RETENTION_DAYS,
  erasureEmailHashes = [],
}: {
  leads: ContactLeadRetentionLead[];
  now?: Date;
  retentionDays?: number;
  erasureEmailHashes?: string[];
}): ContactLeadRetentionPlan {
  const erasureSet = new Set(erasureEmailHashes.map((hash) => hash.trim().toLowerCase()).filter(Boolean));
  const toAnonymize: ContactLeadRetentionPlanItem[] = [];

  for (const lead of leads) {
    const leadAgeDays = ageDays(lead.createdAt, now);
    const emailHash = hashContactLeadErasureEmail(lead.email);
    const status = String(lead.status);

    const retentionExpired =
      leadAgeDays >= retentionDays && RETENTION_PURGE_STATUSES.has(status);
    const erasureRequested =
      erasureSet.has(emailHash) && ERASURE_ALLOWED_STATUSES.has(status);

    if (!retentionExpired && !erasureRequested) continue;

    toAnonymize.push({
      id: lead.id,
      reason: erasureRequested ? 'parent_erasure_request' : 'retention_expired',
      status,
      ageDays: leadAgeDays,
      emailHash,
    });
  }

  return {
    now: now.toISOString(),
    retentionDays,
    scanned: leads.length,
    toAnonymize,
  };
}

function anonymizedLeadData(id: string) {
  return {
    name: 'Lead anonymisé',
    email: `erased-${sanitizeIdForAlias(id)}@deleted.nexus.local`,
    phone: null,
    profile: null,
    interest: null,
    urgency: null,
    source: 'retention-anonymized',
    notes: null,
    status: 'LOST' as const,
  };
}

export async function runContactLeadRetention({
  prismaClient = prisma,
  now = new Date(),
  retentionDays = CONTACT_LEAD_RETENTION_DAYS,
  erasureEmailHashes = [],
  apply = false,
}: {
  prismaClient?: typeof prisma;
  now?: Date;
  retentionDays?: number;
  erasureEmailHashes?: string[];
  apply?: boolean;
}) {
  const leads = await prismaClient.contactLead.findMany({
    where: {
      status: { not: 'ENROLLED' },
    },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
    },
  }) as ContactLeadRetentionLead[];

  const plan = buildContactLeadRetentionPlan({
    leads,
    now,
    retentionDays,
    erasureEmailHashes,
  });

  if (apply) {
    for (const item of plan.toAnonymize) {
      await prismaClient.contactLead.update({
        where: { id: item.id },
        data: anonymizedLeadData(item.id),
      });
    }
  }

  return {
    dryRun: !apply,
    scanned: plan.scanned,
    planned: plan.toAnonymize.length,
    applied: apply ? plan.toAnonymize.length : 0,
    reasons: plan.toAnonymize.reduce<Record<string, number>>((acc, item) => {
      acc[item.reason] = (acc[item.reason] ?? 0) + 1;
      return acc;
    }, {}),
    retentionDays: plan.retentionDays,
  };
}

function parseArgs(argv: string[]) {
  const args = new Set(argv);
  const erasureEmailHashes: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--email-hash' && argv[index + 1]) {
      erasureEmailHashes.push(argv[index + 1]);
      index++;
    }
    if (arg === '--email-hashes-file' && argv[index + 1]) {
      const content = readFileSync(argv[index + 1], 'utf8');
      erasureEmailHashes.push(
        ...content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      );
      index++;
    }
  }

  return {
    apply: args.has('--apply'),
    erasureEmailHashes,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runContactLeadRetention(options);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith('contact-leads-retention.ts')) {
  main()
    .catch((error) => {
      console.error('[contact-leads-retention] failed', {
        name: error instanceof Error ? error.name : 'Error',
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect?.();
    });
}
