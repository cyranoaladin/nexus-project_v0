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

/**
 * Capitalisation d'un nom de personne : « kamel ben rhouma » → « Kamel Ben
 * Rhouma », « JEAN-PIERRE » → « Jean-Pierre », « d'angelo » → « D'Angelo ».
 *
 * Seuls les segments entièrement en minuscules ou entièrement en majuscules
 * sont recomposés : une casse mixte volontaire (« McDonald », « DeLorme »)
 * est préservée telle quelle. Les segments sont découpés sur l'espace, le
 * trait d'union et l'apostrophe (droite ou typographique), pour que chaque
 * composant d'un prénom ou d'un nom composé porte sa majuscule.
 */
function capitalizeNameWord(word: string): string {
  const isAllLower = word === word.toLocaleLowerCase('fr-FR');
  const isAllUpper = word === word.toLocaleUpperCase('fr-FR');
  if (!isAllLower && !isAllUpper) return word;
  const lower = word.toLocaleLowerCase('fr-FR');
  return lower.replace(/(^|[\s\-'’])(\p{L})/gu, (_match, boundary: string, letter: string) => (
    `${boundary}${letter.toLocaleUpperCase('fr-FR')}`
  ));
}

export function formatPersonName(value: string): string {
  return value
    .split(' ')
    .map((word) => capitalizeNameWord(word))
    .join(' ');
}

export function assertHumanRenderIdentity(identity: HumanRenderIdentity): HumanRenderIdentity {
  const displayName = formatPersonName(identity.displayName.trim().replace(/\s+/g, ' '));
  if (displayName.length === 0) throw new Error('HUMAN_RENDER_IDENTITY_INVALID:displayName');
  return Object.freeze({ displayName });
}

export function buildHumanRenderIdentity(user: StudentUserName): HumanRenderIdentity {
  const displayName = [normalizedNamePart(user.firstName), normalizedNamePart(user.lastName)]
    .filter((part): part is string => part !== null)
    .join(' ');
  if (displayName.length === 0) throw new Error('HUMAN_RENDER_IDENTITY_MISSING');
  return Object.freeze({ displayName: formatPersonName(displayName) });
}
