/**
 * Lecture du résumé de l'archive historique POO, tel qu'écrit par
 * `scripts/espace/legacy-poo.ts inventory --snapshot-out` dans
 * <DOCUMENT_STORAGE_ROOT>/espace/legacy/inventory.json.
 *
 * Ce module ne lit JAMAIS la base legacy elle-même (répertoire privé du
 * service historique, hors de portée de l'application) et n'écrit rien. Le
 * fichier est traité comme non fiable : taille bornée, schéma strict.
 * Le statut « associé » vient de la table `espace_legacy_links`, en direct.
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { getDocumentStorageRoot } from '@/lib/documents/storage-root';
import { prisma } from '@/lib/prisma';

export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

const text = (max: number) => z.string().max(max);

const snapshotSchema = z
  .object({
    generatedAt: text(40),
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    count: z.number().int().min(0).max(100_000),
    traces: z
      .array(
        z.object({
          id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
          alias: text(60),
          groupe: text(80),
          session: text(80),
          received: text(50),
          sha: text(128),
          summary: z
            .object({
              completedSteps: z.number().int().min(0).max(64),
              requiredSteps: z.number().int().min(0).max(64),
              currentStep: text(64),
              elapsedSeconds: z.number().min(0).max(86400),
              updatedAt: text(50),
            })
            .nullable(),
          problem: text(300).nullable(),
        }),
      )
      .max(5000),
  })
  .strict();

export type LegacySnapshot = z.infer<typeof snapshotSchema>;

export type LegacyArchiveRow = LegacySnapshot['traces'][number] & {
  status: 'NON_ASSOCIE' | 'ASSOCIE';
  linkedTo: string | null;
};

export type LegacyArchiveView =
  | { state: 'ABSENT' }
  | { state: 'INVALID' }
  | { state: 'READY'; generatedAt: string; sourceSha256: string; count: number; traces: LegacyArchiveRow[] };

export function legacySnapshotPath(): string {
  return path.join(getDocumentStorageRoot(), 'espace', 'legacy', 'inventory.json');
}

export async function readLegacySnapshot(file: string): Promise<LegacySnapshot | 'ABSENT' | 'INVALID'> {
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return 'ABSENT';
  }
  if (size > MAX_SNAPSHOT_BYTES) return 'INVALID';
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(await readFile(file, 'utf8')));
    return parsed.success ? parsed.data : 'INVALID';
  } catch {
    return 'INVALID';
  }
}

export async function getLegacyArchiveView(file?: string): Promise<LegacyArchiveView> {
  let target: string;
  try {
    target = file ?? legacySnapshotPath();
  } catch {
    return { state: 'ABSENT' }; // racine de stockage non configurée : rien à montrer
  }
  const snapshot = await readLegacySnapshot(target);
  if (snapshot === 'ABSENT') return { state: 'ABSENT' };
  if (snapshot === 'INVALID') return { state: 'INVALID' };

  const links = await prisma.espaceLegacyLink.findMany({
    where: { legacyTraceId: { in: snapshot.traces.map((t) => t.id) } },
    select: { legacyTraceId: true, student: { select: { firstName: true, lastName: true } } },
  });
  const linked = new Map(links.map((l) => [l.legacyTraceId, [l.student.firstName, l.student.lastName].filter(Boolean).join(' ') || 'Élève']));

  return {
    state: 'READY',
    generatedAt: snapshot.generatedAt,
    sourceSha256: snapshot.sourceSha256,
    count: snapshot.count,
    traces: snapshot.traces.map((t) => ({
      ...t,
      status: linked.has(t.id) ? 'ASSOCIE' : 'NON_ASSOCIE',
      linkedTo: linked.get(t.id) ?? null,
    })),
  };
}
