export type HumanRenderIdentity = Readonly<{
  displayName: string;
}>;

export type StudentUserName = Readonly<{
  firstName: string | null;
  lastName: string | null;
}>;

function normalizedNamePart(value: string | null): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

export function assertHumanRenderIdentity(identity: HumanRenderIdentity): HumanRenderIdentity {
  const displayName = identity.displayName.trim().replace(/\s+/g, ' ');
  if (displayName.length === 0) throw new Error('HUMAN_RENDER_IDENTITY_INVALID:displayName');
  return Object.freeze({ displayName });
}

export function buildHumanRenderIdentity(user: StudentUserName): HumanRenderIdentity {
  const displayName = [normalizedNamePart(user.firstName), normalizedNamePart(user.lastName)]
    .filter((part): part is string => part !== null)
    .join(' ');
  if (displayName.length === 0) throw new Error('HUMAN_RENDER_IDENTITY_MISSING');
  return Object.freeze({ displayName });
}
