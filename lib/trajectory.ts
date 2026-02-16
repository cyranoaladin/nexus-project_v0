/**
 * Trajectory Engine — Strategic progression planning for students.
 *
 * A Trajectory defines a long-term objective with milestones and a time horizon.
 * It complements the reactive Next Step Engine with a proactive strategic layer.
 *
 * Phase 1: Backend foundation only (types, CRUD, validation).
 * Phase 2 (future): Auto-generation from Nexus Index data, milestone tracking.
 */

import { prisma } from '@/lib/prisma';
import type { TrajectoryStatus } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Valid horizon values */
export type TrajectoryHorizon = '3_MONTHS' | '6_MONTHS' | '12_MONTHS';

/** A single milestone within a trajectory */
export interface Milestone {
  id: string;
  title: string;
  targetDate: string; // ISO date string
  completed: boolean;
  completedAt: string | null; // ISO date string
}

/** Input for creating a new trajectory */
export interface CreateTrajectoryInput {
  studentId: string; // Student.id (not userId)
  title: string;
  description?: string;
  targetScore?: number;
  horizon: TrajectoryHorizon;
  milestones?: Omit<Milestone, 'completed' | 'completedAt'>[];
  createdBy?: string;
}

/** Trajectory with computed progress */
export interface TrajectoryWithProgress {
  id: string;
  title: string;
  description: string | null;
  targetScore: number | null;
  horizon: string;
  startDate: Date;
  endDate: Date;
  status: TrajectoryStatus;
  milestones: Milestone[];
  progress: number; // 0–100 based on milestones completed
  daysRemaining: number;
  createdAt: Date;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HORIZON_DAYS: Record<TrajectoryHorizon, number> = {
  '3_MONTHS': 90,
  '6_MONTHS': 180,
  '12_MONTHS': 365,
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Create a new trajectory for a student.
 */
export async function createTrajectory(
  input: CreateTrajectoryInput
): Promise<TrajectoryWithProgress> {
  const horizonDays = HORIZON_DAYS[input.horizon];
  if (!horizonDays) {
    throw new Error(`Invalid horizon: ${input.horizon}`);
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const milestones: Milestone[] = (input.milestones ?? []).map((m) => ({
    ...m,
    completed: false,
    completedAt: null,
  }));

  const trajectory = await prisma.trajectory.create({
    data: {
      studentId: input.studentId,
      title: input.title,
      description: input.description ?? null,
      targetScore: input.targetScore ?? null,
      horizon: input.horizon,
      startDate,
      endDate,
      milestones: milestones as unknown as Record<string, unknown>[],
      createdBy: input.createdBy ?? null,
    },
  });

  return enrichTrajectory(trajectory);
}

/**
 * Get the active trajectory for a student (most recent ACTIVE one).
 */
export async function getActiveTrajectory(
  studentId: string
): Promise<TrajectoryWithProgress | null> {
  const trajectory = await prisma.trajectory.findFirst({
    where: {
      studentId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!trajectory) return null;
  return enrichTrajectory(trajectory);
}

/**
 * Complete a milestone within a trajectory.
 */
export async function completeMilestone(
  trajectoryId: string,
  milestoneId: string
): Promise<TrajectoryWithProgress> {
  const trajectory = await prisma.trajectory.findUnique({
    where: { id: trajectoryId },
  });

  if (!trajectory) {
    throw new Error('Trajectory not found');
  }

  const milestones = parseMilestones(trajectory.milestones);
  const milestone = milestones.find((m) => m.id === milestoneId);

  if (!milestone) {
    throw new Error('Milestone not found');
  }

  milestone.completed = true;
  milestone.completedAt = new Date().toISOString();

  // Check if all milestones are completed
  const allCompleted = milestones.every((m) => m.completed);

  const updated = await prisma.trajectory.update({
    where: { id: trajectoryId },
    data: {
      milestones: milestones as unknown as Record<string, unknown>[],
      status: allCompleted ? 'COMPLETED' : undefined,
    },
  });

  return enrichTrajectory(updated);
}

/**
 * Update trajectory status.
 */
export async function updateTrajectoryStatus(
  trajectoryId: string,
  status: TrajectoryStatus
): Promise<TrajectoryWithProgress> {
  const updated = await prisma.trajectory.update({
    where: { id: trajectoryId },
    data: { status },
  });

  return enrichTrajectory(updated);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse milestones from Prisma Json field */
export function parseMilestones(raw: unknown): Milestone[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m: Record<string, unknown>) => ({
    id: String(m.id ?? ''),
    title: String(m.title ?? ''),
    targetDate: String(m.targetDate ?? ''),
    completed: Boolean(m.completed),
    completedAt: m.completedAt ? String(m.completedAt) : null,
  }));
}

/** Enrich a raw trajectory with computed progress */
function enrichTrajectory(
  trajectory: {
    id: string;
    title: string;
    description: string | null;
    targetScore: number | null;
    horizon: string;
    startDate: Date;
    endDate: Date;
    status: TrajectoryStatus;
    milestones: unknown;
    createdAt: Date;
  }
): TrajectoryWithProgress {
  const milestones = parseMilestones(trajectory.milestones);
  const completedCount = milestones.filter((m) => m.completed).length;
  const progress =
    milestones.length > 0
      ? Math.round((completedCount / milestones.length) * 100)
      : 0;

  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (trajectory.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  return {
    id: trajectory.id,
    title: trajectory.title,
    description: trajectory.description,
    targetScore: trajectory.targetScore,
    horizon: trajectory.horizon,
    startDate: trajectory.startDate,
    endDate: trajectory.endDate,
    status: trajectory.status,
    milestones,
    progress,
    daysRemaining,
    createdAt: trajectory.createdAt,
  };
}
