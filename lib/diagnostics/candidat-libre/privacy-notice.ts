/**
 * Notice de confidentialité du diagnostic candidat libre.
 *
 * Rédigée par la direction pédagogique. Présentée au parent et à l'élève
 * **avant tout traitement** : création de dossier, réponse à un module, dépôt
 * de document ou enregistrement audio.
 *
 * La version est enregistrée avec le consentement. Publier une nouvelle
 * version invalide mécaniquement les consentements antérieurs : le
 * consentement porte sur un texte précis, pas sur « la notice » en général.
 * Ne jamais corriger le texte sans incrémenter la version.
 *
 * Régime juridique applicable (loi tunisienne 2004-63 / INPDP, RGPD le cas
 * échéant), durées exactes de conservation et formalités éventuelles pour un
 * traitement portant sur un mineur : à valider par un juriste. Les
 * emplacements correspondants sont laissés explicites plutôt que comblés par
 * une valeur inventée.
 */

export const CANDIDATE_DIAGNOSTIC_NOTICE_VERSION = 'candidat-libre-notice.v1' as const;

export type PrivacyNoticeSection = Readonly<{
  heading: string;
  body: readonly string[];
}>;

export const CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE: Readonly<{
  version: typeof CANDIDATE_DIAGNOSTIC_NOTICE_VERSION;
  title: string;
  sections: readonly PrivacyNoticeSection[];
  parentConsentStatement: string;
  parentConsentCheckbox: string;
  studentAssentStatement: string;
}> = Object.freeze({
  version: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
  title: 'Ce que vous devez savoir avant de commencer',
  sections: Object.freeze([
    Object.freeze({
      heading: 'Qui traite les données',
      body: Object.freeze([
        'Nexus Réussite (STE M&M ACADEMY SUARL), Tunis.',
        'Pour toute question sur vos données ou vos droits : {{CONTACT_VIE_PRIVEE}}.',
      ]),
    }),
    Object.freeze({
      heading: 'Pourquoi',
      body: Object.freeze([
        "Ce diagnostic évalue la faisabilité d'un parcours de baccalauréat en candidat libre pour votre enfant, afin d'orienter son accompagnement.",
        "Il ne s'agit pas d'une décision automatisée : aucune conclusion n'est rendue par une machine. La synthèse est établie par notre équipe pédagogique, et le diagnostic est traité sans intelligence artificielle générative.",
      ]),
    }),
    Object.freeze({
      heading: 'Quelles données sont traitées',
      body: Object.freeze([
        "Identité du parent et de l'élève (nom, e-mail, coordonnées).",
        'Documents officiels que vous déposez : pièce d’identité, relevé Cyclades, bulletins scolaires, relevés de notes du baccalauréat.',
        "Réponses de l'élève au diagnostic, et productions académiques.",
        'Un enregistrement audio (épreuve type Grand oral).',
        'Nous ne collectons que ce qui est nécessaire à cette finalité.',
      ]),
    }),
    Object.freeze({
      heading: 'Sur quelle base',
      body: Object.freeze([
        "Sur la base de votre consentement, en tant que titulaire de l'autorité parentale — votre enfant étant mineur.",
        'Vous pouvez retirer ce consentement à tout moment, sans conséquence sur les services déjà rendus.',
      ]),
    }),
    Object.freeze({
      heading: 'Qui y accède',
      body: Object.freeze([
        "Uniquement les membres de l'équipe pédagogique de Nexus affectés au dossier de votre enfant.",
        "Les données ne sont pas transmises à un service d'IA externe. L'hébergement est situé dans l'Union européenne.",
      ]),
    }),
    Object.freeze({
      heading: 'Combien de temps',
      body: Object.freeze([
        "Les données sont conservées le temps de l'accompagnement, puis {{DUREE_CONSERVATION}} avant suppression ou anonymisation.",
        'Les documents officiels sont conservés de façon chiffrée et supprimés selon la même règle.',
      ]),
    }),
    Object.freeze({
      heading: 'Comment elles sont protégées',
      body: Object.freeze([
        "Séparation stricte entre l'espace du parent et celui de l'élève ; stockage privé et chiffré des documents ; contrôle antivirus des dépôts ; accès restreint au personnel affecté ; journal d'audit.",
      ]),
    }),
    Object.freeze({
      heading: 'Vos droits',
      body: Object.freeze([
        "Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité, ainsi que du retrait du consentement.",
        'Pour les exercer : {{CONTACT_VIE_PRIVEE}}. Nous répondons dans les meilleurs délais après vérification de votre identité.',
      ]),
    }),
  ]),
  parentConsentStatement:
    "En tant que titulaire de l'autorité parentale sur {{ELEVE_NOM}}, je déclare avoir lu et compris la présente notice. Je consens au traitement décrit ci-dessus par Nexus Réussite, aux seules fins du diagnostic pédagogique candidat libre, y compris le dépôt des documents officiels de mon enfant et l'enregistrement audio. Je comprends que je peux retirer ce consentement à tout moment.",
  parentConsentCheckbox: 'Je consens au traitement décrit, pour mon enfant mineur.',
  studentAssentStatement:
    "J'ai compris à quoi sert ce diagnostic et j'accepte d'y participer.",
});

/**
 * Constantes légales que le texte laisse ouvertes en attente du juriste.
 *
 * Elles font partie du texte consenti : les renseigner **doit** incrémenter
 * `CANDIDATE_DIAGNOSTIC_NOTICE_VERSION`, car les familles auront alors consenti
 * à un texte différent.
 */
export const NOTICE_PENDING_LEGAL_CONSTANTS: readonly string[] = Object.freeze([
  '{{CONTACT_VIE_PRIVEE}}',
  '{{DUREE_CONSERVATION}}',
]);

/**
 * Variables interpolées par dossier au moment du consentement.
 *
 * Elles ne font **pas** partie du texte légal versionné : le nom de l'élève
 * change à chaque famille sans que le texte consenti change. Les renseigner ne
 * doit donc jamais incrémenter la version de la notice.
 */
export const NOTICE_PER_DOSSIER_VARIABLES: readonly string[] = Object.freeze([
  '{{ELEVE_NOM}}',
]);
