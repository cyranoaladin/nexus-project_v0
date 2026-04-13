// ─────────────────────────────────────────────────────────────
// Business configuration — teacher costs, thresholds, group limits
// Single source of truth for economic parameters
// ─────────────────────────────────────────────────────────────

export type Subject = "francais" | "maths" | "nsi" | "physique" | "grandOral";

/**
 * Teacher cost billing model:
 * - "per_group_per_hour": flat rate per hour regardless of student count
 * - "per_student_per_90min": cost scales with student count (per 1h30 session)
 */
export type CostModel = "per_group_per_hour" | "per_student_per_90min";

export interface SubjectCostConfig {
  model: CostModel;
  /** For per_group_per_hour: TND per hour per group */
  ratePerHourGroup?: number;
  /** For per_student_per_90min: TND per student per 1h30 session */
  ratePerStudentPer90min?: number;
}

export const TEACHER_COSTS: Record<Subject, SubjectCostConfig> = {
  francais: {
    model: "per_student_per_90min",
    ratePerStudentPer90min: 80,
  },
  maths: {
    model: "per_group_per_hour",
    ratePerHourGroup: 60,
  },
  nsi: {
    model: "per_group_per_hour",
    ratePerHourGroup: 100,
  },
  physique: {
    model: "per_group_per_hour",
    ratePerHourGroup: 100,
  },
  grandOral: {
    model: "per_group_per_hour",
    ratePerHourGroup: 100,
  },
};

/** Maximum students per group */
export const MAX_STUDENTS = 6;

/**
 * Calculate teacher cost for a subject given hours and student count.
 *
 * - per_group_per_hour: cost = rate × hours (independent of students)
 * - per_student_per_90min: cost = rate × students × (hours / 1.5)
 *   Each 1h30 session = 1 billing unit per student.
 */
export function calculateSubjectCost(
  subject: Subject,
  hours: number,
  students: number
): number {
  const config = TEACHER_COSTS[subject];
  if (config.model === "per_group_per_hour") {
    return (config.ratePerHourGroup ?? 0) * hours;
  }
  // per_student_per_90min
  const sessions = hours / 1.5;
  return (config.ratePerStudentPer90min ?? 0) * students * sessions;
}
