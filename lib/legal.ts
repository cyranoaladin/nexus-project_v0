/**
 * Source unique des constantes juridiques et coordonnees.
 *
 * TOUTE page/composant affichant ces informations DOIT importer
 * depuis ce fichier. Aucune valeur en dur ailleurs.
 */

export const LEGAL = {
  entity: {
    name: 'STE M&M ACADEMY SUARL',
    tradeName: 'Nexus Reussite',
    form: 'SUARL (Societe Unipersonnelle a Responsabilite Limitee)',
    taxId: '1948837 N/A/M/000',
    rne: null as string | null, // A completer si disponible
    representative: 'Mme Molka Mezzez Ben Rhouma',
    representativeTitle: 'Gerante',
    publicationDirector: 'Mme Molka Mezzez Ben Rhouma',
  },

  addresses: {
    siege: {
      label: 'Siege social',
      full: 'Immeuble VENUS, Appt C13, Centre Urbain Nord, 1082 Tunis',
      city: 'Tunis',
      postalCode: '1082',
    },
    pedagogique: {
      label: 'Centre pedagogique',
      full: 'Mutuelleville, Tunis',
      city: 'Tunis',
      note: 'Les rendez-vous pedagogiques et cours en presentiel sont confirmes a Mutuelleville.',
    },
  },

  contact: {
    phone: '+216 99 19 28 29',
    phoneRaw: '+21699192829',
    email: 'contact@nexusreussite.academy',
    whatsappNumber: '21699192829',
  },

  web: {
    domain: 'nexusreussite.academy',
    url: 'https://nexusreussite.academy',
  },

  copyright: {
    year: 2026,
    holder: 'Nexus Reussite',
    notice: (year?: number) =>
      `\u00A9 ${year ?? 2026} Nexus Reussite - Une marque exploitee par la societe STE M&M ACADEMY SUARL. Le site nexusreussite.academy est la propriete exclusive de M&M ACADEMY SUARL.`,
  },

  jurisdiction: 'Tunis, Tunisie',
  applicableLaw: 'droit tunisien',
  dataProtectionLaw: 'Loi organique n\u00B0 2004-63 du 27 juillet 2004',
} as const;

export type LegalEntity = typeof LEGAL.entity;
export type LegalContact = typeof LEGAL.contact;
