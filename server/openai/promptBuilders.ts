import { ZodTypeAny } from 'zod';

export function buildMessages(opts: { outSchema: ZodTypeAny; variant: 'parent' | 'eleve' | 'admin'; student: any; qcm: any; volet2: any; }) {
  const { outSchema, variant, student, qcm, volet2 } = opts;
  const sys = `Tu es ARIA, IA éducative premium de Nexus Réussite. Réponds en JSON strict selon le schéma.`;
  const trame = ['intro', 'diagnostic', 'profil', 'feuille de route', 'offres', 'conclusion'];
  return [
    { role: 'system', content: sys },
    { role: 'user', content: JSON.stringify({ variant, student, qcm, volet2, trame, outSchema: outSchema.toString() }) },
  ] as const;
}
