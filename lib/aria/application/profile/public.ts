import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { AriaError } from '../../errors';
import {
  DEFAULT_ARIA_LEARNING_PREFERENCES_V1,
  parseAriaLearningPreferencesV1,
  projectStoredAriaLearningPreferencesV1,
  type AriaLearningPreferencesV1,
  type StoredAriaLearningPreferences,
} from '../../domain/profile/preferences';
import { prismaAriaProfileRepository } from '../../infrastructure/prisma/profile-repository';

export interface AriaStoredProfile extends StoredAriaLearningPreferences {
  readonly studentId: string;
  readonly updatedAt: Date;
}

export interface AriaProfileContext {
  readonly studentId: string;
  readonly academicCourseKeys: readonly string[];
  readonly profile: AriaStoredProfile | null;
}

export interface AriaProfileRepository {
  loadByActorUserId(actorUserId: string): Promise<AriaProfileContext | null>;
  createDefault(studentId: string): Promise<AriaStoredProfile>;
  replacePreferences(
    studentId: string,
    preferences: AriaLearningPreferencesV1,
  ): Promise<AriaStoredProfile>;
}

function toProfileDto(profile: AriaStoredProfile, academicCourseKeys: readonly string[]) {
  return Object.freeze({
    studentId: profile.studentId,
    preferences: projectStoredAriaLearningPreferencesV1(profile, academicCourseKeys),
    updatedAt: profile.updatedAt.toISOString(),
  });
}

export function makeGetAriaLearningProfile(repository: AriaProfileRepository) {
  return async function getAriaLearningProfile(input: Readonly<{
    actor: { readonly userId: string; readonly role: string };
  }>) {
    const actor = resolveInteractiveStudentActor(input.actor);
    const context = await repository.loadByActorUserId(actor.userId);
    if (!context) throw new AriaError('NOT_ENROLLED', 403, 'Profil scolaire élève introuvable.');
    const profile = context.profile ?? await repository.createDefault(context.studentId);
    return toProfileDto(profile, context.academicCourseKeys);
  };
}

export function makeReplaceAriaLearningProfile(repository: AriaProfileRepository) {
  return async function replaceAriaLearningProfile(input: Readonly<{
    actor: { readonly userId: string; readonly role: string };
    preferences: unknown;
  }>) {
    const actor = resolveInteractiveStudentActor(input.actor);
    const context = await repository.loadByActorUserId(actor.userId);
    if (!context) throw new AriaError('NOT_ENROLLED', 403, 'Profil scolaire élève introuvable.');
    const preferences = parseAriaLearningPreferencesV1(
      input.preferences,
      context.academicCourseKeys,
    );
    const profile = await repository.replacePreferences(context.studentId, preferences);
    return toProfileDto(profile, context.academicCourseKeys);
  };
}

export const getAriaLearningProfileForActor = makeGetAriaLearningProfile(
  prismaAriaProfileRepository,
);
export const replaceAriaLearningProfileForActor = makeReplaceAriaLearningProfile(
  prismaAriaProfileRepository,
);

export { DEFAULT_ARIA_LEARNING_PREFERENCES_V1 };
