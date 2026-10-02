/**
 * Provisioning idempotent et auditable de l'espace pédagogique.
 *
 *  - lecture d'abord : `planProvisioning` ne fait AUCUNE écriture ;
 *  - jamais de doublon silencieux : un utilisateur est cherché par identifiant,
 *    puis (enseignant) par email fourni, puis par nom ; un correspondant
 *    existant sans identifiant n'est adopté que sur demande explicite ;
 *  - un conflit (identifiant porté par quelqu'un d'autre, nom ambigu) bloque
 *    l'exécution entière ;
 *  - les codes personnels ne sont JAMAIS stockés en clair ni journalisés : ils
 *    sont renvoyés une seule fois à l'appelant, qui les écrit hors dépôt.
 *
 * La liste d'élèves réelle (mineurs) n'est pas versionnée : elle est fournie
 * par fichier. Le dépôt n'embarque qu'un exemple fictif.
 */
import { randomBytes } from 'node:crypto';

import type { Prisma, PrismaClient, Subject } from '@prisma/client';
import { z } from 'zod';

import { normalizeUserEmail } from '@/lib/contact/user-email';

import { ACTIVITIES } from './catalog';
import { generatePin, hashPin } from './pin';
import { normalizeUsername } from './username';

type Db = PrismaClient | Prisma.TransactionClient;

export const SUBJECT_ALIASES: Record<string, Subject> = {
  MATHS: 'MATHEMATIQUES',
  MATHEMATIQUES: 'MATHEMATIQUES',
  NSI: 'NSI',
  MATHS_EXPERTES: 'MATHS_EXPERTES',
};

const subjectSchema = z
  .string()
  .transform((v) => SUBJECT_ALIASES[v.trim().toUpperCase()])
  .refine((v): v is Subject => v !== undefined, 'Matière inconnue (MATHS, NSI, MATHS_EXPERTES)');

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/);
const nameSchema = z.string().trim().min(1).max(80);
const usernameSchema = z.string().transform((v, ctx) => {
  const n = normalizeUsername(v);
  if (!n) ctx.addIssue({ code: 'custom', message: `Identifiant invalide : ${v}` });
  return n ?? '';
});

export const rosterSchema = z
  .object({
    groups: z.array(z.object({ slug: slugSchema, name: nameSchema }).strict()).min(1),
    teachers: z
      .array(
        z
          .object({
            username: usernameSchema,
            firstName: nameSchema,
            lastName: nameSchema,
            matchEmail: z.string().email().optional(),
            /** Identifiant technique du compte existant à réutiliser (lève une ambiguïté de nom). */
            matchUserId: z.string().min(1).max(64).optional(),
            teaches: z.array(z.object({ group: slugSchema, subjects: z.array(subjectSchema).min(1) }).strict()).min(1),
          })
          .strict(),
      )
      .default([]),
    students: z
      .array(
        z
          .object({
            username: usernameSchema,
            firstName: nameSchema,
            lastName: nameSchema,
            matchUserId: z.string().min(1).max(64).optional(),
            /**
             * Marque aussi ACTIVÉ un compte élève existant dont l'activation par la famille est encore en
             * attente. Par défaut ce n'est PAS fait : l'espace n'a besoin que du code personnel, et le lien
             * d'activation de la famille reste valable. À n'utiliser que sur décision explicite.
             */
            activatePending: z.boolean().optional(),
            enrollments: z.array(z.object({ group: slugSchema, subjects: z.array(subjectSchema).min(1) }).strict()).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((r, ctx) => {
    const groups = new Set(r.groups.map((g) => g.slug));
    const seen = new Set<string>();
    for (const person of [...r.teachers, ...r.students]) {
      if (seen.has(person.username)) ctx.addIssue({ code: 'custom', message: `Identifiant en double dans le fichier : ${person.username}` });
      seen.add(person.username);
    }
    for (const s of r.students) for (const e of s.enrollments) if (!groups.has(e.group)) ctx.addIssue({ code: 'custom', message: `Groupe inconnu : ${e.group}` });
    for (const t of r.teachers) for (const e of t.teaches) if (!groups.has(e.group)) ctx.addIssue({ code: 'custom', message: `Groupe inconnu : ${e.group}` });
  });

export type Roster = z.infer<typeof rosterSchema>;

export function parseRoster(raw: unknown): Roster {
  const parsed = rosterSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`Fichier de liste invalide : ${first?.path.join('.') ?? ''} ${first?.message ?? ''}`.trim());
  }
  return parsed.data;
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export type UserAction = 'CREATE' | 'ADOPT' | 'UNCHANGED' | 'NEEDS_ADOPT_FLAG' | 'CONFLICT';

export interface UserPlan {
  username: string;
  firstName: string;
  lastName: string;
  kind: 'ELEVE' | 'COACH';
  action: UserAction;
  existingUserId?: string;
  existingRole?: string;
  /** Adoption d'un compte élève en attente d'activation, explicitement autorisée. */
  willActivate?: boolean;
  reason?: string;
}

export interface ProvisioningPlan {
  users: UserPlan[];
  groupsToCreate: string[];
  enrollmentsToCreate: number;
  assignmentsToCreate: number;
  conflicts: string[];
}

interface PlanOptions {
  adopt: boolean;
}

export async function planProvisioning(db: Db, roster: Roster, options: PlanOptions): Promise<ProvisioningPlan> {
  const users: UserPlan[] = [];
  const conflicts: string[] = [];

  const people = [
    ...roster.teachers.map((t) => ({ ...t, kind: 'COACH' as const })),
    ...roster.students.map((s) => ({ ...s, kind: 'ELEVE' as const, matchEmail: undefined as string | undefined })),
  ];

  // Tous les comptes de l'espace, avec ou sans identifiant : un homonyme déjà
  // identifié autrement ne doit jamais produire un second compte.
  const candidates = await db.user.findMany({
    where: { role: { in: ['ELEVE', 'COACH', 'ADMIN'] } },
    select: { id: true, role: true, firstName: true, lastName: true, username: true, createdAt: true, activatedAt: true },
  });

  for (const p of people) {
    const base = { username: p.username, firstName: p.firstName, lastName: p.lastName, kind: p.kind };
    const byUsername = await db.user.findUnique({ where: { username: p.username }, select: { id: true, role: true, firstName: true, lastName: true } });

    if (byUsername) {
      const sameRole = p.kind === 'ELEVE' ? byUsername.role === 'ELEVE' : byUsername.role === 'COACH' || byUsername.role === 'ADMIN';
      const sameName = fold(byUsername.firstName ?? '') === fold(p.firstName) && fold(byUsername.lastName ?? '') === fold(p.lastName);
      if (sameRole && sameName) {
        users.push({ ...base, action: 'UNCHANGED', existingUserId: byUsername.id, existingRole: byUsername.role });
      } else {
        const reason = `L'identifiant ${p.username} est déjà porté par un autre compte`;
        users.push({ ...base, action: 'CONFLICT', existingUserId: byUsername.id, reason });
        conflicts.push(reason);
      }
      continue;
    }

    type Match = { id: string; role: string; firstName: string | null; lastName: string | null; username?: string | null; createdAt?: Date; activatedAt?: Date | null };
    const roleOk = (role: string) => (p.kind === 'ELEVE' ? role === 'ELEVE' : role === 'COACH' || role === 'ADMIN');
    let matches: Match[];
    if (p.matchUserId) {
      // Choix humain explicite d'un compte existant : prioritaire sur toute recherche par nom.
      matches = candidates.filter((c) => c.id === p.matchUserId && roleOk(c.role));
      if (matches.length === 0) {
        const reason = `matchUserId introuvable (ou de rôle incompatible) pour ${p.firstName} ${p.lastName}`;
        users.push({ ...base, action: 'CONFLICT', reason });
        conflicts.push(reason);
        continue;
      }
    } else {
      // Enseignant : un email fourni par l'utilisateur identifie sans ambiguïté.
      matches = p.matchEmail
        ? await db.user.findMany({ where: { email: normalizeUserEmail(p.matchEmail) }, select: { id: true, role: true, firstName: true, lastName: true, username: true, createdAt: true, activatedAt: true } })
        : [];
      if (matches.length === 0) {
        const f = fold(p.firstName);
        const l = fold(p.lastName);
        matches = candidates.filter((u) => roleOk(u.role) && fold(u.firstName ?? '') === f && fold(u.lastName ?? '') === l);
      }
    }
    const alreadyNamed = matches.find((m) => m.username);
    if (alreadyNamed) {
      const reason = `${p.firstName} ${p.lastName} a déjà un compte avec un autre identifiant : décision humaine requise`;
      users.push({ ...base, action: 'CONFLICT', existingUserId: alreadyNamed.id, reason });
      conflicts.push(reason);
      continue;
    }

    if (matches.length === 0) {
      users.push({ ...base, action: 'CREATE' });
    } else if (matches.length > 1) {
      const listed = matches.map((m) => `…${m.id.slice(-6)} (créé le ${m.createdAt?.toISOString().slice(0, 10) ?? '?'})`).join(', ');
      const reason = `Plusieurs comptes correspondent à ${p.firstName} ${p.lastName} : ${listed} — précisez matchUserId`;
      users.push({ ...base, action: 'CONFLICT', reason });
      conflicts.push(reason);
    } else {
      const m = matches[0]!;
      // Élève dont l'activation FAMILIALE est en attente : on lui ajoute un identifiant et un code d'espace
      // sans toucher à son activation (son lien d'activation reste valable). Seul `activatePending: true`,
      // décision écrite, la marque aussi activée.
      const pendingStudent = p.kind === 'ELEVE' && m.role === 'ELEVE' && !m.activatedAt && (p as { activatePending?: boolean }).activatePending === true;
      users.push({
        ...base,
        action: options.adopt ? 'ADOPT' : 'NEEDS_ADOPT_FLAG',
        existingUserId: m.id,
        existingRole: m.role,
        willActivate: pendingStudent,
        reason: options.adopt ? undefined : 'Un compte existant correspond : relancer avec --adopt pour le réutiliser',
      });
    }
  }

  const existingGroups = await db.espaceGroup.findMany({ where: { slug: { in: roster.groups.map((g) => g.slug) } }, select: { slug: true } });
  const have = new Set(existingGroups.map((g) => g.slug));

  return {
    users,
    groupsToCreate: roster.groups.filter((g) => !have.has(g.slug)).map((g) => g.slug),
    enrollmentsToCreate: roster.students.reduce((n, s) => n + s.enrollments.reduce((m, e) => m + e.subjects.length, 0), 0),
    assignmentsToCreate: roster.teachers.reduce((n, t) => n + t.teaches.reduce((m, e) => m + e.subjects.length, 0), 0),
    conflicts,
  };
}

export interface IssuedCredential {
  username: string;
  kind: 'ELEVE' | 'COACH';
  /** Code personnel (élève) ou mot de passe initial (enseignant créé). Renvoyé UNE fois. */
  secret: string;
  /** Prénom NOM, pour le fichier privé de distribution. */
  displayName?: string;
}

export async function syncActivities(db: Db): Promise<number> {
  for (const a of ACTIVITIES) {
    await db.espaceActivity.upsert({
      where: { slug: a.slug },
      create: { slug: a.slug, subject: a.subject, moduleSlug: a.moduleSlug, title: a.title, kind: a.kind, stepsTotal: a.stepsTotal, contentVersion: a.contentVersion },
      update: { subject: a.subject, moduleSlug: a.moduleSlug, title: a.title, kind: a.kind, stepsTotal: a.stepsTotal, contentVersion: a.contentVersion },
    });
  }
  return ACTIVITIES.length;
}

export async function applyProvisioning(
  client: PrismaClient,
  roster: Roster,
  options: PlanOptions,
): Promise<{ credentials: IssuedCredential[]; plan: ProvisioningPlan }> {
  return client.$transaction(
    async (tx) => {
      // Le plan est recalculé DANS la transaction : ce qui est appliqué est ce qui est vu.
      const plan = await planProvisioning(tx, roster, options);
      if (plan.conflicts.length > 0) throw new Error(`Conflits non résolus (${plan.conflicts.length}) : aucune écriture`);
      const blocked = plan.users.filter((u) => u.action === 'NEEDS_ADOPT_FLAG');
      if (blocked.length > 0) throw new Error(`${blocked.length} compte(s) existant(s) à adopter : relancer avec --adopt`);

      await syncActivities(tx);
      const credentials: IssuedCredential[] = [];
      const idByUsername = new Map<string, string>();
      const now = new Date();

      for (const u of plan.users) {
        if (u.action === 'UNCHANGED') {
          idByUsername.set(u.username, u.existingUserId!);
          continue;
        }
        if (u.action === 'ADOPT') {
          // Adoption : on ne pose QUE l'identifiant ; mot de passe/email/rôle existants intacts.
          await tx.user.update({ where: { id: u.existingUserId! }, data: { username: u.username } });
          idByUsername.set(u.username, u.existingUserId!);
          if (u.kind === 'ELEVE') {
            const pin = generatePin();
            // activatedAt n'est posé que sur décision explicite ; un compte déjà activé garde sa date.
            await tx.user.update({
              where: { id: u.existingUserId! },
              data: { pinHash: await hashPin(pin), pinSetAt: now, ...(u.willActivate ? { activatedAt: now } : {}) },
            });
            credentials.push({ username: u.username, kind: 'ELEVE', secret: pin, displayName: `${u.firstName} ${u.lastName}` });
          }
          continue;
        }
        // CREATE
        if (u.kind === 'ELEVE') {
          const pin = generatePin();
          const created = await tx.user.create({
            data: { role: 'ELEVE', username: u.username, firstName: u.firstName, lastName: u.lastName, pinHash: await hashPin(pin), pinSetAt: now, activatedAt: now },
            select: { id: true },
          });
          idByUsername.set(u.username, created.id);
          credentials.push({ username: u.username, kind: 'ELEVE', secret: pin, displayName: `${u.firstName} ${u.lastName}` });
        } else {
          const bcrypt = (await import('bcryptjs')).default;
          const initial = randomBytes(15).toString('base64url');
          const created = await tx.user.create({
            data: { role: 'COACH', username: u.username, firstName: u.firstName, lastName: u.lastName, password: await bcrypt.hash(initial, 12), activatedAt: now },
            select: { id: true },
          });
          idByUsername.set(u.username, created.id);
          credentials.push({ username: u.username, kind: 'COACH', secret: initial, displayName: `${u.firstName} ${u.lastName}` });
        }
      }

      const groupIds = new Map<string, string>();
      for (const g of roster.groups) {
        const row = await tx.espaceGroup.upsert({ where: { slug: g.slug }, create: { slug: g.slug, name: g.name }, update: {}, select: { id: true } });
        groupIds.set(g.slug, row.id);
      }

      for (const s of roster.students) {
        for (const e of s.enrollments) {
          for (const subject of e.subjects) {
            await tx.espaceEnrollment.upsert({
              where: { userId_groupId_subject: { userId: idByUsername.get(s.username)!, groupId: groupIds.get(e.group)!, subject } },
              create: { userId: idByUsername.get(s.username)!, groupId: groupIds.get(e.group)!, subject },
              update: {},
            });
          }
        }
      }
      for (const t of roster.teachers) {
        for (const e of t.teaches) {
          for (const subject of e.subjects) {
            await tx.espaceTeacherAssignment.upsert({
              where: { teacherId_groupId_subject: { teacherId: idByUsername.get(t.username)!, groupId: groupIds.get(e.group)!, subject } },
              create: { teacherId: idByUsername.get(t.username)!, groupId: groupIds.get(e.group)!, subject },
              update: {},
            });
          }
        }
      }
      return { credentials, plan };
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}

/** Nouveau code personnel : l'ancien cesse de fonctionner et les sessions ouvertes sont révoquées. */
export async function resetStudentPin(db: Db, username: string): Promise<IssuedCredential> {
  const u = normalizeUsername(username);
  if (!u) throw new Error('Identifiant invalide');
  const user = await db.user.findUnique({ where: { username: u }, select: { id: true, role: true } });
  if (!user || user.role !== 'ELEVE') throw new Error('Aucun élève avec cet identifiant');
  const pin = generatePin();
  await db.user.update({
    where: { id: user.id },
    data: { pinHash: await hashPin(pin), pinSetAt: new Date(), sessionVersion: { increment: 1 } },
  });
  return { username: u, kind: 'ELEVE', secret: pin };
}

/** Désactive un compte et révoque ses sessions ouvertes (la désactivation est aussi relue à chaque requête). */
export async function disableAccount(db: Db, username: string): Promise<void> {
  const u = normalizeUsername(username);
  if (!u) throw new Error('Identifiant invalide');
  const res = await db.user.updateMany({
    where: { username: u },
    data: { disabledAt: new Date(), sessionVersion: { increment: 1 } },
  });
  if (res.count !== 1) throw new Error('Aucun compte avec cet identifiant');
}
