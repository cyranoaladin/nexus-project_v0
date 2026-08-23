import type { EvidenceItem } from './question-evidence';

type HumanFacingEvidenceOverride = Readonly<{
  optionTextById: Readonly<Record<string, string>>;
  shortCorrection: string;
}>;

const HUMAN_FACING_EVIDENCE_OVERRIDES: Readonly<Record<string, Readonly<Record<string, HumanFacingEvidenceOverride>>>> = Object.freeze({
  'entree-terminale-maths-complementaires-v1': Object.freeze({
    'ETL-MCO-PRO-02': Object.freeze({
      optionTextById: Object.freeze({
        B: 'Oui : la probabilité qu’elle soit porteuse est d’environ 59,5 %',
      }),
      shortCorrection: 'Par la formule de Bayes, P(porteur | test positif) = 0,03 × 0,95 / (0,03 × 0,95 + 0,97 × 0,02) ≈ 59,5 %. Une personne testée positive est donc probablement porteuse.',
    }),
  }),
});

/**
 * Projette exclusivement les textes destinés aux restitutions humaines.
 *
 * Cette copie immuable ne modifie jamais l'identité d'une option, son statut
 * de correction ni son ordre. La banque validée reste donc l'unique source du
 * scoring et conserve son checksum ; seul son libellé de restitution est
 * remplacé lorsqu'une correction éditoriale explicite existe.
 */
export function projectHumanFacingEvidenceItem(packSlug: string, item: EvidenceItem): EvidenceItem {
  const override = HUMAN_FACING_EVIDENCE_OVERRIDES[packSlug]?.[item.itemId];
  const options = item.options.map((option) => Object.freeze({
    ...option,
    text: override?.optionTextById[option.id] ?? option.text,
  }));

  return Object.freeze({
    ...item,
    options: Object.freeze(options),
    shortCorrection: override?.shortCorrection ?? item.shortCorrection,
  });
}
