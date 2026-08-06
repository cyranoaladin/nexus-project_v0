import type { Prisma } from '@prisma/client';

import {
  ParentStudentConsentError,
  withParentStudentConsentTransaction,
} from '@/lib/bilans/parent-student-consent';

const CONFIRMATION = 'PREPARER_CONSENTEMENT_PARENT';
const USAGE = `Usage: tsx scripts/bilans/reconcile-parent-student-link.ts --student-id <id> --parent-email <email> --confirm ${CONFIRMATION}`;

type PendingLink = Readonly<{
  id: string;
  state: string;
}>;

export type ReconcileParentStudentLinkPort = Readonly<{
  findParentUserIdByExactEmail(email: string): Promise<string | null>;
  preparePending(input: Readonly<{ parentUserId: string; studentId: string }>): Promise<PendingLink>;
}>;

type ReconciliationPrismaClient = Readonly<{
  parentProfile: {
    findFirst(args: Readonly<{
      where: { user: { email: string } };
      select: { userId: true };
    }>): Promise<Readonly<{ userId: string }> | null>;
  };
  $transaction<T>(action: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}>;

type ParsedArguments = Readonly<{
  studentId: string;
  parentEmail: string;
}>;

type MainDependencies = Readonly<{
  port: ReconcileParentStudentLinkPort;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}>;

function parseArguments(args: readonly string[]): ParsedArguments | null {
  if (args.length !== 6) return null;

  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag === undefined || value === undefined || values.has(flag)) return null;
    if (!['--student-id', '--parent-email', '--confirm'].includes(flag)) return null;
    if (value === '' || value !== value.trim()) return null;
    values.set(flag, value);
  }

  const studentId = values.get('--student-id');
  const parentEmail = values.get('--parent-email');
  if (
    studentId === undefined
    || parentEmail === undefined
    || values.get('--confirm') !== CONFIRMATION
  ) return null;

  return Object.freeze({ studentId, parentEmail });
}

export function createPrismaReconciliationPort(
  client: ReconciliationPrismaClient,
  now: () => Date = () => new Date(),
): ReconcileParentStudentLinkPort {
  return Object.freeze({
    async findParentUserIdByExactEmail(email) {
      const parent = await client.parentProfile.findFirst({
        where: { user: { email } },
        select: { userId: true },
      });
      return parent?.userId ?? null;
    },
    preparePending: ({ parentUserId, studentId }) => withParentStudentConsentTransaction(
      client,
      (context) => context.preparePending({ parentUserId, studentId, now: now() }),
    ),
  });
}

function refusalCode(error: unknown): string {
  if (
    error instanceof ParentStudentConsentError
    || (typeof error === 'object' && error !== null && 'code' in error)
  ) {
    const code = 'code' in error ? error.code : undefined;
    if (code === 'NOT_FOUND') return 'LEGACY_OWNERSHIP_MISMATCH';
  }
  return 'PREPARATION_FAILED';
}

async function runReconciliation(
  parsed: ParsedArguments,
  port: ReconcileParentStudentLinkPort,
): Promise<Readonly<{ linkId: string; parentUserId: string; studentId: string }>> {
  const parentUserId = await port.findParentUserIdByExactEmail(parsed.parentEmail);
  if (parentUserId === null) throw new Error('PARENT_PROFILE_NOT_FOUND');

  const link = await port.preparePending({
    parentUserId,
    studentId: parsed.studentId,
  });
  if (link.state !== 'PENDING_PARENT_CONSENT') throw new Error('LINK_NOT_PENDING');

  return Object.freeze({
    linkId: link.id,
    parentUserId,
    studentId: parsed.studentId,
  });
}

export async function main(
  args: readonly string[],
  injected?: MainDependencies,
): Promise<number> {
  const parsed = parseArguments(args);
  const writeOut = injected?.stdout ?? ((line: string) => console.log(line));
  const writeError = injected?.stderr ?? ((line: string) => console.error(line));
  if (parsed === null) {
    writeError(USAGE);
    return 2;
  }

  let disconnect: (() => Promise<void>) | undefined;
  let port = injected?.port;
  if (port === undefined) {
    const { prisma } = await import('@/lib/prisma');
    port = createPrismaReconciliationPort(prisma);
    disconnect = () => prisma.$disconnect();
  }

  try {
    const result = await runReconciliation(parsed, port);
    writeOut(`CANONICAL_LINK_PREPARED=${result.linkId}:${result.studentId}:${result.parentUserId}:PENDING_PARENT_CONSENT`);
    return 0;
  } catch (error) {
    const explicit = error instanceof Error
      && ['PARENT_PROFILE_NOT_FOUND', 'LINK_NOT_PENDING'].includes(error.message)
      ? error.message
      : refusalCode(error);
    writeError(`RECONCILIATION_REFUSED=${explicit}`);
    return 1;
  } finally {
    await disconnect?.();
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  }).catch(() => {
    console.error('RECONCILIATION_REFUSED=UNEXPECTED_ERROR');
    process.exitCode = 1;
  });
}
