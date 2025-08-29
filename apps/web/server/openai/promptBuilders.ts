import type { QcmSummary, StudentMeta, Variant, Volet2Summary } from '@/packages/shared/types/bilan';
import { ZodTypeAny } from 'zod';

const decisionRules = [
  'Cortex si score ≥65% et 0 domaine <50%, autonomie élevée',
  'Studio Flex si score ≥55% et ≤2 domaines faibles, motivation bonne',
  'Académies si score 40–65% avec ≥2 domaines faibles',
  'Odyssée si score <55% ou autonomie/motivation faibles, ou candidat libre',
];

export function buildMessages(opts: {
  variant: Variant | 'admin';
  student: StudentMeta;
  qcm: QcmSummary;
  volet2: Volet2Summary;
  outSchema: ZodTypeAny;
}) {
  const { variant, student, qcm, volet2, outSchema } = opts;

  const sysBase = `Tu es ARIA, l’IA éducative premium de Nexus Réussite.\n` +
    `Tu produis des contenus LaTeX professionnels, clairs et structurés.\n` +
    `Réponds en JSON strict valide selon le schéma fourni. N'inclus pas d'échappements LaTeX exotiques.`;

  const sysParent = sysBase + `\nVariante: PARENTS — ton institutionnel, rassurant, chiffres, ROI (garantie, mention, Parcoursup).`;
  const sysEleve = sysBase + `\nVariante: ELEVE — ton motivant, concret, conseils méthodo et rythme atteignable.`;
  const sysAdmin = sysBase + `\nVariante: ADMIN — synthèse opérationnelle: risques, axes critiques, recommandations d’offre avec justification matricielle.`;

  const system = variant === 'parent' ? sysParent : variant === 'eleve' ? sysEleve : sysAdmin;

  const trameCommon = [
    '1) Introduction',
    '2) Diagnostic académique (lacunes critiques vs attendus du niveau)',
    '3) Profil pédagogique (style, organisation, motivation, stress, vigilance)',
    '4) Feuille de route (3–6 mois) avec rythme hebdo et ressources',
    '5) Offres Nexus (choix principal + alternatives) justifiées par la matrice',
    '6) Conclusion adaptée à la cible',
  ];

  const instructions = { variant, trame: trameCommon, decisionRules, student, qcm, volet2 };

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ instructions, outSchema: outSchema.toString() }) },
  ] as const;
}
