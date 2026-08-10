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
 * avec un tiers devient une démarche qui lui appartient.
 *
 * `v3` : les deux emplacements laissés ouverts en `v2` sont comblés — la
 * conservation est fixée à douze mois après la dernière activité sur le
 * dossier, donc datable et automatisable, et le partage à un tiers est rédigé
 * au plus près du mécanisme réellement codé. Chaque incrément périme
 * volontairement les consentements recueillis sous la version précédente.
 */

import { LEGAL } from '@/lib/legal';

export const CANDIDATE_DIAGNOSTIC_NOTICE_VERSION = 'candidat-libre-notice.v3' as const;

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
        `${LEGAL.entity.tradeName} (${LEGAL.entity.name}), Tunis. Contact vie privée : ${LEGAL.contact.email}.`,
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
      heading: 'Qui y accède — et le partage',
      body: Object.freeze([
        'Par défaut, vous êtes seul à accéder à vos résultats. Vous pouvez, si vous le souhaitez, autoriser une personne de votre choix (par exemple un parent) à les consulter, en cochant la case prévue à cet effet lors de votre inscription. Cette autorisation est facultative, révocable à tout moment, et n’a aucun effet tant que vous ne l’avez pas donnée explicitement. En dehors de cela, les données ne sont pas transmises à un service d’IA externe ; l’hébergement est situé dans l’Union européenne.',
      ]),
    }),
    Object.freeze({
      heading: 'Combien de temps',
      body: Object.freeze([
        'Vos données sont conservées pendant douze mois à compter de votre dernière activité sur votre dossier, puis supprimées ou anonymisées automatiquement. Vos documents officiels sont conservés chiffrés et supprimés selon la même règle.',
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
        `Accès, rectification, effacement, opposition, limitation, portabilité, et retrait du consentement. Pour les exercer : ${LEGAL.contact.email}. Réponse dans les meilleurs délais après vérification de votre identité.`,
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
 * Emplacements légaux encore ouverts dans le texte. Vide en `v3` : contact,
 * conservation et partage à un tiers sont tous renseignés.
 *
 * S'il en réapparaissait, les renseigner **devrait** incrémenter
 * `CANDIDATE_DIAGNOSTIC_NOTICE_VERSION` : les étudiants auraient alors consenti
 * à un texte différent.
 */
export const NOTICE_PENDING_LEGAL_CONSTANTS: readonly string[] = Object.freeze([]);

/**
 * Aucune question juridique ouverte : l'aval du juriste sur le régime
 * applicable est acquis. Conservé comme point d'extension si une nouvelle
 * réserve apparaissait.
 *
 * Vider cette liste ne change pas le texte consenti et n'impose donc aucun
 * incrément de version — contrairement aux emplacements de
 * `NOTICE_PENDING_LEGAL_CONSTANTS`, qui en font partie.
 */
export const NOTICE_OPEN_QUESTIONS: readonly string[] = Object.freeze([]);

/** Durée de conservation, en mois, à compter de la dernière activité sur le dossier. */
export const RETENTION_MONTHS_AFTER_LAST_ACTIVITY = 12;
