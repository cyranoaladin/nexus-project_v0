/**
 * Notice de confidentialité du diagnostic candidat libre — étudiant majeur.
 *
 * Texte transcrit **verbatim** depuis
 * `NOTICE-confidentialite-candidat-libre-majeur.md`, fourni par la direction
 * pédagogique. Il n'est ni reformulé ni résumé ici : c'est un objet juridique,
 * il vient du responsable et du juriste, pas du code.
 *
 * Présentée à l'étudiant **avant tout traitement** : création de dossier,
 * réponse à un module, dépôt de document, enregistrement audio.
 *
 * La version est enregistrée avec le consentement. Publier une nouvelle
 * version invalide mécaniquement les consentements antérieurs — le
 * consentement porte sur un texte précis, pas sur « la notice » en général.
 * Ne jamais corriger le texte sans incrémenter la version.
 *
 * `v2` : passage au régime adulte. L'étudiant étant majeur, c'est son
 * consentement qui vaut ; le volet parental disparaît du texte, et le partage
 * avec un tiers devient une démarche qui lui appartient. Le passage de `v1` à
 * `v2` périme volontairement tout consentement recueilli sous `v1`.
 */

export const CANDIDATE_DIAGNOSTIC_NOTICE_VERSION = 'candidat-libre-notice.v2' as const;

export type PrivacyNoticeSection = Readonly<{
  heading: string;
  body: readonly string[];
}>;

export const CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE: Readonly<{
  version: typeof CANDIDATE_DIAGNOSTIC_NOTICE_VERSION;
  title: string;
  sections: readonly PrivacyNoticeSection[];
  consentStatement: string;
  consentCheckbox: string;
  llmConsentStatement: string;
}> = Object.freeze({
  version: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
  title: 'Ce que vous devez savoir avant de commencer',
  sections: Object.freeze([
    Object.freeze({
      heading: 'Qui traite les données',
      body: Object.freeze([
        'Nexus Réussite (STE M&M ACADEMY SUARL), Tunis. Contact vie privée : contact@nexusreussite.academy.',
      ]),
    }),
    Object.freeze({
      heading: 'Pourquoi',
      body: Object.freeze([
        'Ce diagnostic évalue la faisabilité de votre parcours de baccalauréat en candidat libre, afin d’orienter votre accompagnement. Aucune décision n’est rendue par une machine — la synthèse est établie par notre équipe pédagogique, et le diagnostic est traité sans intelligence artificielle générative (traitement déterministe), sauf consentement distinct de votre part.',
      ]),
    }),
    Object.freeze({
      heading: 'Quelles données sont traitées',
      body: Object.freeze([
        'Votre identité (nom, e-mail, coordonnées).',
        'Documents officiels que vous déposez : pièce d’identité, relevé Cyclades, bulletins, relevés de notes du baccalauréat.',
        'Vos réponses au diagnostic et vos productions académiques.',
        'Un enregistrement audio (épreuve type Grand oral).',
        'Nous ne collectons que ce qui est nécessaire à cette finalité.',
      ]),
    }),
    Object.freeze({
      heading: 'Sur quelle base',
      body: Object.freeze([
        'Sur la base de votre consentement. Vous pouvez le retirer à tout moment, sans conséquence sur les services déjà rendus.',
      ]),
    }),
    Object.freeze({
      heading: 'Qui y accède',
      body: Object.freeze([
        'Uniquement les membres de l’équipe pédagogique de Nexus affectés à votre dossier. Les données ne sont pas transmises à un service d’IA externe. L’hébergement est situé dans l’Union européenne.',
        'Si vous souhaitez qu’un tiers — par exemple un parent — accède à vos résultats, ce partage se fait à votre demande explicite : {{PARTAGE_TIERS_MODALITE}}.',
      ]),
    }),
    Object.freeze({
      heading: 'Combien de temps',
      body: Object.freeze([
        'Conservées le temps de l’accompagnement, puis une année avant suppression ou anonymisation. Documents officiels chiffrés, supprimés selon la même règle.',
      ]),
    }),
    Object.freeze({
      heading: 'Comment elles sont protégées',
      body: Object.freeze([
        'Stockage privé et chiffré des documents ; contrôle antivirus des dépôts ; accès restreint au personnel affecté ; journal d’audit.',
      ]),
    }),
    Object.freeze({
      heading: 'Vos droits',
      body: Object.freeze([
        'Accès, rectification, effacement, opposition, limitation, portabilité, et retrait du consentement. Pour les exercer : contact@nexusreussite.academy. Réponse dans les meilleurs délais après vérification de votre identité.',
      ]),
    }),
  ]),
  consentStatement:
    'J’ai lu et compris la présente notice. Je consens au traitement décrit ci-dessus par Nexus Réussite, aux seules fins du diagnostic pédagogique candidat libre, y compris le dépôt de mes documents officiels et l’enregistrement audio. Je comprends que je peux retirer ce consentement à tout moment.',
  consentCheckbox: 'Je consens au traitement décrit.',
  /**
   * Consentement distinct et facultatif, si la narration par IA est proposée.
   * Non recueilli aujourd'hui : la fonctionnalité est déterministe.
   */
  llmConsentStatement:
    'Je consens à ce qu’une IA générative, sur des données pseudonymisées, rédige mon compte rendu, relu par un enseignant avant de m’être remis.',
});

/**
 * Constantes légales encore ouvertes, en attente du juriste.
 *
 * Elles font partie du texte consenti : les renseigner **doit** incrémenter
 * `CANDIDATE_DIAGNOSTIC_NOTICE_VERSION`, les étudiants ayant alors consenti à
 * un texte différent.
 *
 * Le contact vie privée et la durée de conservation, ouverts en `v1`, sont
 * désormais renseignés. Reste la modalité de partage à un tiers.
 */
export const NOTICE_PENDING_LEGAL_CONSTANTS: readonly string[] = Object.freeze([
  '{{PARTAGE_TIERS_MODALITE}}',
]);

/**
 * Point encore indéterminé, signalé pour le juriste : le texte fixe la durée de
 * conservation à un an, mais son **point de départ** — la fin de
 * l'accompagnement — n'est pas défini de façon opérationnelle. Il faudra le
 * trancher avant de pouvoir appliquer une purge automatique.
 */
export const NOTICE_OPEN_QUESTIONS: readonly string[] = Object.freeze([
  'Point de départ opérationnel de la conservation d’un an (fin de l’accompagnement à définir).',
]);
