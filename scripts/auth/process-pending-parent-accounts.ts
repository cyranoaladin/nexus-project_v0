import { readFile } from 'node:fs/promises'

import { prisma } from '@/lib/prisma'
import {
  PENDING_PARENT_MAX_BATCH_SIZE,
  PENDING_PARENT_POLICY_VERSION,
} from '@/lib/auth/pending-account-policy'
import {
  inventoryPendingParentAccounts,
  processPendingParentPlan,
  type PendingLifecycleAction,
  type PendingLifecyclePlan,
} from '@/lib/auth/pending-account-lifecycle'

const DEFAULT_MODE = 'dry-run'
const CONFIRMATIONS: Record<Exclude<PendingLifecycleAction, 'NONE'>, string> = {
  RECONCILE_LINK: 'RECONCILE_PENDING_PARENT_LINK',
  INVALIDATE_EXPIRED_TOKEN: 'INVALIDATE_EXPIRED_PARENT_TOKEN',
  PURGE_GRAPH: 'PURGE_ELIGIBLE_PENDING_PARENT',
}

type Command = Readonly<{
  mode: 'dry-run' | 'execute'
  batchSize: number
  planFile?: string
  confirmation?: string
}>

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

function parseArguments(args: readonly string[]): Command {
  const allowed = new Set(['--execute', '--batch-size', '--plan-file', '--confirm'])
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!
    if (!argument.startsWith('--') || !allowed.has(argument)) throw new Error('PENDING_COMMAND_INVALID_ARGUMENT')
    if (argument !== '--execute') index += 1
  }
  const mode = args.includes('--execute') ? 'execute' : DEFAULT_MODE
  const batchSize = Number(valueAfter(args, '--batch-size') ?? PENDING_PARENT_MAX_BATCH_SIZE)
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > PENDING_PARENT_MAX_BATCH_SIZE) {
    throw new Error('PENDING_COMMAND_INVALID_BATCH')
  }
  const planFile = valueAfter(args, '--plan-file')
  const confirmation = valueAfter(args, '--confirm')
  if (mode === 'execute') {
    if (!planFile || !confirmation) throw new Error('PENDING_COMMAND_PLAN_AND_CONFIRMATION_REQUIRED')
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PENDING_PARENT_PROCESSING !== 'true') {
      throw new Error('PENDING_COMMAND_PRODUCTION_AUTHORIZATION_REQUIRED')
    }
  } else if (planFile || confirmation) {
    throw new Error('PENDING_COMMAND_DRY_RUN_ARGUMENT_INVALID')
  }
  return { mode, batchSize, ...(planFile ? { planFile } : {}), ...(confirmation ? { confirmation } : {}) }
}

function lifecycleContext() {
  const planSecret = process.env.PENDING_PARENT_PLAN_HMAC_SECRET ?? ''
  const environmentId = process.env.PENDING_PARENT_ENVIRONMENT_ID ?? ''
  return { planSecret, environmentId }
}

async function readPlan(path: string): Promise<PendingLifecyclePlan> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (!parsed || typeof parsed !== 'object') throw new Error('PENDING_COMMAND_PLAN_INVALID')
  return parsed as PendingLifecyclePlan
}

export async function main(args: readonly string[]): Promise<number> {
  try {
    const command = parseArguments(args)
    const now = new Date()
    const context = lifecycleContext()
    const audit = command.mode === 'dry-run'
      ? await inventoryPendingParentAccounts(prisma, { now, batchSize: command.batchSize, ...context })
      : await (async () => {
          const plan = await readPlan(command.planFile!)
          if (plan.action === 'NONE' || command.confirmation !== CONFIRMATIONS[plan.action]) {
            throw new Error('PENDING_COMMAND_CONFIRMATION_REQUIRED')
          }
          return processPendingParentPlan(prisma, { now, batchSize: command.batchSize, plan, ...context })
        })()
    console.log(JSON.stringify({ event: 'PENDING_PARENT_LIFECYCLE', policyVersion: PENDING_PARENT_POLICY_VERSION, ...audit }))
    return 0
  } catch (error) {
    console.error(JSON.stringify({
      event: 'PENDING_PARENT_LIFECYCLE_REFUSED',
      code: error instanceof Error ? error.message : 'UNEXPECTED_ERROR',
      policyVersion: PENDING_PARENT_POLICY_VERSION,
    }))
    return 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((code) => { process.exitCode = code })
}
