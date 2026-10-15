import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@/core-v2/generated/client';

/**
 * URL de connexion d'un rôle PostgreSQL limité, pour les tests sous le vrai rôle.
 * Le rôle reçoit un mot de passe aléatoire propre à l'exécution : la connexion est
 * authentifiée comme en production (scram), au lieu de dépendre d'un pg_hba « trust ».
 */
const ROLES_LIMITES = new Set(['nexus_core_runtime', 'nexus_core_admin_promotion', 'nexus_core_admin_authorizer']);

export async function limitedRoleUrl(client: PrismaClient, role: string): Promise<string> {
  if (!ROLES_LIMITES.has(role)) throw new Error(`LIMITED_ROLE_NOT_ALLOWED:${role}`);
  const password = randomBytes(24).toString('hex');
  // Identifiant et mot de passe contrôlés (liste fermée, hexadécimal) : pas de valeur externe dans le SQL.
  await client.$executeRawUnsafe(`ALTER ROLE ${role} PASSWORD '${password}'`);
  const url = new URL(process.env.CORE_V2_DATABASE_URL!);
  url.username = role;
  url.password = password;
  return url.toString();
}
