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
      postalCode: '2091',
      /**
       * Coordonnées et lien de la fiche Google Maps de Nexus Réussite, relevés
       * sur la fiche elle-même (identifiant de lieu 0x995daf69d139108a). Ne
       * jamais les estimer : une épingle fausse envoie une famille ailleurs.
       */
      geo: { latitude: 36.8414471, longitude: 10.1656767 },
      maps: 'https://maps.google.com/?cid=11051181929653670026',
      /**
       * Horaires d'ouverture du centre, attestés par le propriétaire le
       * 17 octobre 2026. Source unique : le JSON-LD et le texte affiché en
       * dérivent tous les deux. Un horaire faux sur une fiche locale envoie
       * une famille devant une porte close — ne jamais les deviner, et les
       * corriger ici seulement, jamais dans une page.
       */
      horaires: {
        jours: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        creneaux: [
          { opens: '09:00', closes: '13:00' },
          { opens: '14:00', closes: '19:00' },
        ],
      },
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
    /**
     * Profils officiels, publiés en `sameAs` : ils permettent aux moteurs et
     * aux assistants de reconnaître une seule et même entité d'un site à
     * l'autre. N'y mettre qu'un compte tenu par Nexus Réussite, jamais un
     * lien de publication ni une page tierce qui parle de nous.
     */
    profils: [
      'https://www.instagram.com/nexusacademy2026/',
      'https://www.facebook.com/groups/989509755402969/',
    ] as string[],
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

/**
 * Libellé français des horaires du centre, dérivé de LEGAL : « Tous les jours,
 * 9 h–13 h et 14 h–19 h ». Refuse de produire un libellé si les jours cessent
 * d'être les sept de la semaine : mieux vaut une erreur de construction qu'une
 * page qui annonce « tous les jours » un jour de fermeture.
 */
export function horairesLisibles(): string {
  const { jours, creneaux } = LEGAL.addresses.pedagogique.horaires;
  if (jours.length !== 7) throw new Error('HORAIRES_LIBELLE_A_ADAPTER');
  const heure = (valeur: string) =>
    valeur.replace(/^0/, '').replace(':00', '\u00a0h').replace(':', '\u00a0h\u00a0');
  const plages = creneaux.map((c) => `${heure(c.opens)}\u2013${heure(c.closes)}`).join(' et ');
  return `Tous les jours, ${plages}`;
}

export function compactBankIdentifier(value: string): string {
  return value.replace(/\s+/g, '');
}
