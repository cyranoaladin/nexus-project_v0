import { CANDIDATE_DIAGNOSTIC_MODULES } from './definition.public';
import type { DiagnosticCampaignStatus, DiagnosticModuleStatus, DiagnosticModuleView } from './types';

const COMPLETE_STATUSES: DiagnosticModuleStatus[] = ['SUBMITTED', 'AUTO_SCORED', 'NEEDS_REVIEW', 'REVIEWED'];

export function isModuleComplete(status: DiagnosticModuleStatus) {
  return COMPLETE_STATUSES.includes(status);
}

export function resolveModuleAvailability(
  moduleKey: string,
  moduleViews: DiagnosticModuleView[],
  now = new Date(),
): { available: boolean; availableAt: Date | null; reason?: string } {
  const definition = CANDIDATE_DIAGNOSTIC_MODULES.find((module) => module.key === moduleKey);
  if (!definition) return { available: false, availableAt: null, reason: 'Module inconnu.' };

  const byKey = new Map(moduleViews.map((module) => [module.key, module]));
  for (const prerequisite of definition.prerequisites) {
    const prerequisiteView = byKey.get(prerequisite);
    if (!prerequisiteView || !isModuleComplete(prerequisiteView.status)) {
      return { available: false, availableAt: null, reason: `Le module « ${prerequisite} » doit être terminé.` };
    }
  }

  if (definition.unlockDelayHours && definition.prerequisites.length > 0) {
    const reference = byKey.get(definition.prerequisites[definition.prerequisites.length - 1]);
    const submittedAt = reference?.submittedAt ? new Date(reference.submittedAt) : null;
    if (submittedAt) {
      const availableAt = new Date(submittedAt.getTime() + definition.unlockDelayHours * 60 * 60 * 1_000);
      if (availableAt > now) {
        return { available: false, availableAt, reason: 'Ce module mesure une rétention différée.' };
      }
      return { available: true, availableAt };
    }
  }

  return { available: true, availableAt: null };
}

export function computeCompletionPercentage(moduleViews: DiagnosticModuleView[]) {
  const requiredKeys = CANDIDATE_DIAGNOSTIC_MODULES
    .filter((module) => module.audience === 'ELEVE' && module.requiredForSubmission)
    .map((module) => module.key);
  if (requiredKeys.length === 0) return 0;
  const byKey = new Map(moduleViews.map((module) => [module.key, module]));
  const completed = requiredKeys.filter((key) => {
    const moduleView = byKey.get(key);
    return moduleView && isModuleComplete(moduleView.status);
  }).length;
  return Math.round((completed / requiredKeys.length) * 100);
}

export function deriveCampaignStatus(input: {
  moduleViews: DiagnosticModuleView[];
  parentSubmitted: boolean;
  finalSubmitted: boolean;
  retentionDueAt?: Date | null;
  now?: Date;
}): DiagnosticCampaignStatus {
  const now = input.now ?? new Date();
  if (input.finalSubmitted) return 'SUBMITTED';
  if (input.retentionDueAt && input.retentionDueAt > now) return 'WAITING_RETENTION';
  const studentRequired = CANDIDATE_DIAGNOSTIC_MODULES.filter(
    (module) => module.audience === 'ELEVE' && module.requiredForSubmission && module.key !== 'validation-finale',
  );
  const byKey = new Map(input.moduleViews.map((module) => [module.key, module]));
  const studentDone = studentRequired.every((definition) => {
    const view = byKey.get(definition.key);
    return view && isModuleComplete(view.status);
  });
  if (studentDone && !input.parentSubmitted) return 'WAITING_PARENT';
  return 'ACTIVE';
}
