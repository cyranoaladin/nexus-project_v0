import { getPreRentreeCampaign } from './campaign-source';
import { compileCommercialPublicationContract } from './commercial-contract';
import { getPreRentreeLevelCapacities } from './offer-options';
import { maxIdleMinutesAcrossPublishedItineraries } from './itinerary-facts';
import type { EntryLevelCode, SubjectCode } from './schema';

/**
 * Every number and list the campaign's editorial text is allowed to state,
 * derived once from the canonical data.
 *
 * Editorial strings in data/campaigns/pre-rentree-2026.json carry
 * `{{placeholder}}` tokens instead of frozen values, and both consumers — the
 * public page (public-surface.ts) and the publication snapshot pipeline
 * (scripts/pre-rentree/publication-derivations.ts) — resolve them here. That
 * is what makes "the page says 4 levels, the PDF says 5" impossible rather
 * than merely unlikely.
 */

function formatAmount(value: number): string {
  return `${value.toLocaleString('fr-TN')} TND`;
}

function joinFrench(values: readonly string[], conjunction: 'et' | 'ou'): string {
  if (values.length <= 1) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} ${conjunction} ${values.at(-1)}`;
}

function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-TN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(new Date(`${isoDate}T12:00:00+01:00`));
}

/** Resolves `{{token}}` against `vars`; an unknown token is a build error. */
export function resolveCampaignTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in vars)) throw new Error(`Unknown campaign template placeholder: ${match}`);
    return vars[key]!;
  });
}

export function buildCampaignTemplateVars(): Record<string, string> {
  const campaign = getPreRentreeCampaign();
  const contract = compileCommercialPublicationContract();
  const approved = new Set(
    contract.proofs.proofs.filter((proof) => proof.status === 'APPROVED').map((proof) => proof.proofId),
  );
  const offers = contract.offers
    .filter((offer) => offer.publiclyEligible)
    .filter((offer) => offer.proofIds.every((proofId) => approved.has(proofId)));

  const levelLabelById = new Map(campaign.levels.map((level) => [level.id, level.label]));
  const levelIds = campaign.levels.map((level) => level.id);
  const shortLabel = (level: EntryLevelCode) => (levelLabelById.get(level) ?? level).replace(/^Entrée en /, '');

  const subjectLabel = (level: EntryLevelCode, subject: SubjectCode) => {
    const entry = campaign.subjects.find((candidate) => candidate.id === subject);
    if (!entry) throw new Error(`Unknown campaign subject: ${subject}`);
    return (entry.labelByLevel as Partial<Record<string, string>> | undefined)?.[level] ?? entry.label;
  };
  const subjectsOf = (level: EntryLevelCode) => [
    ...new Set(offers.filter((offer) => offer.level === level).flatMap((offer) => offer.subjects)),
  ].sort((left, right) => left.localeCompare(right));

  const capacities = getPreRentreeLevelCapacities();
  const capacityOf = (level: EntryLevelCode) => {
    const capacity = capacities.find((candidate) => candidate.level === level);
    if (!capacity) throw new Error(`Missing capacity for level: ${level}`);
    return capacity;
  };

  const quatriemeOffer = offers.find((offer) => offer.level === 'QUATRIEME');
  if (!quatriemeOffer) throw new Error('No published QUATRIEME offer to derive the 4e facts from.');

  return {
    firstDate: formatLongDate(campaign.startDate),
    lastDate: formatLongDate(campaign.endDate),

    niveaux: joinFrench(levelIds.map(shortLabel), 'et'),
    niveauxOu: joinFrench(levelIds.map(shortLabel), 'ou'),
    nombreNiveaux: String(levelIds.length),

    gammeFondations: joinFrench(
      capacities.filter((capacity) => capacity.range === 'FONDATIONS').map((capacity) => shortLabel(capacity.level)),
      'et',
    ),
    gammePremium: joinFrench(
      capacities.filter((capacity) => capacity.range === 'PREMIUM').map((capacity) => shortLabel(capacity.level)),
      'et',
    ),

    secondeMatieres: joinFrench(subjectsOf('SECONDE').map((s) => subjectLabel('SECONDE', s)), 'et'),
    quatriemeMatieres: joinFrench(subjectsOf('QUATRIEME').map((s) => subjectLabel('QUATRIEME', s)), 'et'),
    terminaleMatieres: joinFrench(subjectsOf('TERMINALE').map((s) => subjectLabel('TERMINALE', s)), 'et'),
    nombreMatieresTerminale: String(subjectsOf('TERMINALE').length),
    plafondPackTerminale: String(capacityOf('TERMINALE').maximumSubjects),

    // Effectifs PER LEVEL — never "Fondations : 3 à 6", which the 4e made false.
    effectifsParNiveau: levelIds
      .map((level) => `${levelLabelById.get(level)} : ${capacityOf(level).minPerCohort} à ${capacityOf(level).maxPerCohort} élèves`)
      .join(' · '),
    effectifQuatriemeMin: String(capacityOf('QUATRIEME').minPerCohort),
    effectifQuatriemeMax: String(capacityOf('QUATRIEME').maxPerCohort),

    tarifMin: formatAmount(Math.min(...offers.map((offer) => offer.price))),
    tarifMax: formatAmount(Math.max(...offers.map((offer) => offer.price))),
    tarifQuatrieme: formatAmount(quatriemeOffer.price),
    acompteQuatrieme: formatAmount(quatriemeOffer.deposit),
    soldeQuatrieme: formatAmount(quatriemeOffer.balance),

    seancesParMatiere: String(quatriemeOffer.sessions),
    heuresParMatiere: String(quatriemeOffer.hours),
    dureeSeance: String(quatriemeOffer.sessionDurationHours),
    attenteMaximaleMinutes: String(maxIdleMinutesAcrossPublishedItineraries()),
  };
}
