import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@/core-v2/generated/client';

/** Disposable trust-authentication only; production installs private credentials. */
export async function installTestAdminPromotionRoles(client: PrismaClient): Promise<void> {
  const sql = await readFile(join(process.cwd(), 'scripts/core-v2/provision-admin-authority.sql'), 'utf8');
  // Provisioning SQL is a repository-owned constant, not request input.
  await client.$transaction(async tx => {
    const commands = sql.replace(/^--.*$/gm, '').trim();
    const block = commands.match(/^DO \$\$[\s\S]*?END \$\$;/)?.[0];
    if (!block) throw new Error('TEST_AUTHORITY_PROVISIONING_INVALID');
    await tx.$executeRawUnsafe(block);
    for (const statement of commands.slice(block.length).split(';').map(value => value.trim()).filter(Boolean))
      await tx.$executeRawUnsafe(statement);
    await tx.$executeRawUnsafe('ALTER ROLE nexus_core_admin_authorizer LOGIN');
  });
}
