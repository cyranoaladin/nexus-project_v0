/**
 * Source unique des constantes juridiques et coordonnees.
 *
 * TOUTE page/composant affichant ces informations DOIT importer
 * depuis ce fichier. Aucune valeur en dur ailleurs.
 */

export const LEGAL = {
  entity: {
    name: 'STE M&M ACADEMY SUARL',
    tradeName: 'Nexus Réussite',
    form: 'SUARL (Société Unipersonnelle à Responsabilité Limitée)',
    taxId: '1948837 N/A/M/000',
    rne: null as string | null, // À compléter si disponible
    representative: 'Mme Molka Mezzez Ben Rhouma',
    representativeTitle: 'Gérante',
    publicationDirector: 'Mme Molka Mezzez Ben Rhouma',
  },

  addresses: {
    siege: {
      label: 'Siège social',
      full: 'Immeuble VENUS, Appt C13, Centre Urbain Nord, 1082 Tunis',
      city: 'Tunis',
      postalCode: '1082',
    },
    pedagogique: {
      label: 'Centre pédagogique',
      full: '17 rue Ali Zlitni, Manar III, Tunis',
      street: '17 rue Ali Zlitni',
      neighborhood: 'Manar III',
      city: 'Tunis',
      note: 'Les cours, stages et rendez-vous pédagogiques ont lieu au 17 rue Ali Zlitni, Manar III, Tunis.',
    },
  },

  contact: {
    phone: '+216 99 19 28 29',
    phoneRaw: '+21699192829',
    email: 'contact@nexusreussite.academy',
    whatsappNumber: '21699192829',
  },

  billing: {
    bank: 'Banque Zitouna',
    accountIdentifier: '871456',
    accountNature: 'Comptes chèques entreprises',
    rib: '25 079 000 0001569084 04',
    iban: 'TN59 25 079 000 0001569084 04',
    bic: 'BZITTNTT',
    swift: 'BZITTNTTXXX',
  },

  web: {
    domain: 'nexusreussite.academy',
    url: 'https://nexusreussite.academy',
  },

  copyright: {
    year: 2026,
    holder: 'Nexus Réussite',
    notice: (year?: number) =>
      `\u00A9 ${year ?? 2026} Nexus Réussite — Une marque exploitée par la société STE M&M ACADEMY SUARL. Le site nexusreussite.academy est la propriété exclusive de M&M ACADEMY SUARL.`,
  },

  jurisdiction: 'Tunis, Tunisie',
  applicableLaw: 'droit tunisien',
  dataProtectionLaw: 'Loi organique n\u00B0 2004-63 du 27 juillet 2004',
} as const;

export type LegalEntity = typeof LEGAL.entity;
export type LegalContact = typeof LEGAL.contact;
export type LegalBilling = typeof LEGAL.billing;

export function compactBankIdentifier(value: string): string {
  return value.replace(/\s+/g, '');
}
