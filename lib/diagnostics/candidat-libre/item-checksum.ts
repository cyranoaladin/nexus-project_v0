import { createHash } from 'node:crypto';

/**
 * Empreinte d'un item du diagnostic candidat libre.
 *
 * Module volontairement **pur** — sans `server-only` — pour rester importable
 * par les scripts d'exploitation qui enregistrent les validations hors du
 * runtime Next.
 *
 * L'empreinte couvre l'énoncé, les options **et** la réponse attendue : un
 * relecteur valide ce triplet, pas une question isolée. Le cas dangereux n'est
 * pas l'énoncé retouché, c'est la bonne réponse changée en silence.
 */
export function computeItemChecksum(
  item: Readonly<{ id: string; prompt: string; options?: readonly unknown[] }>,
  answerKey: unknown,
): string {
  // Sérialisation canonique : clés triées, pour qu'un simple réordonnancement
  // du JSON ne fasse pas basculer l'empreinte.
  const canonical = JSON.stringify(
    {
      id: item.id,
      prompt: item.prompt,
      options: item.options ?? [],
      answerKey: answerKey ?? null,
    },
    (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort());
      }
      return value;
    },
  );
  return createHash('sha256').update(canonical).digest('hex');
}
