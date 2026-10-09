# Conservation et effacement : dossier de décision

5 octobre 2026, source examinée `05f425df37c1127b99cac764a3036d1d071db525`.
NOT_READY. Aucune durée légale nouvelle n’est décidée ici ; aucun effacement
ni export de données réelles n’a été exécuté. Responsable juridique/métier
nominatif à désigner avant ouverture d’un pilote collectant des données réelles.

La page `app/politique-confidentialite/page.tsx` décrit surtout les formulaires
publics et contient deux blocs explicitement marqués comme validés par le juriste.
Ils sont conservés verbatim. La validité de trente jours du lien de bilan décrite
dans cette page est une durée d’accès, pas une durée de conservation du document,
de la base, des journaux ou des sauvegardes. La page ne démontre pas une politique
complète de conservation pour les comptes, la finance et les conversations ARIA.

| Catégorie / finalité | Autorité et copies à couvrir | Décision de durée attendue | Mécanisme à valider avant activation |
|---|---|---|---|
| Identité et sessions : fournir et sécuriser l’accès | User V1/Core, sessionVersion, cookies/session, sauvegardes | Compte actif, inactif et fermé ; sessions séparément | Désactivation/révocation immédiate ; effacement ou pseudonymisation après contrôle des obligations/FK ; pas de suppression financière en cascade |
| Invitations et reset : possession et activation | Invitation Core, preuves V1, payload chiffré CoreV2JobOutbox/JobOutbox, SMTP | TTL de validité versus conservation des émissions consommées/révoquées et queues | Révocation métier, purge contrôlée des payloads après clôture ; prévoir rotation et rétention des clés de déchiffrement |
| Téléphone : vérification de possession | ParentPhoneChallenge, profils, canal externe | Challenge, tentatives et coordonnées vérifiées séparément | Expiration du challenge, révocation du canal, changement de numéro audité sans déduire un ownership |
| Famille et parcours : autorisation et historique scolaire | HouseholdParent, Student, inscriptions V1/Core, liens historiques | Lien actif/révoqué et inscription historique | Révocation des droits dès rupture ; maintien des preuves nécessaires ; aucun backfill ambigu |
| Planning, réservation et présence : exécution pédagogique | SessionBooking/PlanningSeries, stages, rapports, notifications | Événement réalisé/annulé et preuve de présence | Préservation de l’historique ; suppression/anonymisation par procédure contrôlée, compatible avec finance et contentieux |
| Ressources et documents : enseignement | Registre/version, UserDocument, stockage persistant, PDF et caches | Brouillon/publié/archivé, données personnelles et catalogue séparément | Révocation de lecture, expiration des liens, suppression logique ; purge des octets et dérivés après décision |
| Bilans/diagnostics : suivi et publication | DiagnosticBilanDraft, Bilan/StageBilan, SessionReport, PDF, liens et traces | Artefact parent/élève/interne, résultats, brouillons et versions séparément | Dépublication et révocation des liens ; traitement des copies/notifications distinct de celui du document |
| Finance : pièces et rapprochement | Invoice/InvoiceItem/InvoiceSequence, Payment, crédits, PDF, délégations et audit | Durée légale/comptable, obligations locales et litiges à confirmer | Aucun effacement irréversible automatisé ; facture émise immuable, correction par avoir ; anonymisation soumise à validation |
| ARIA : assistance pédagogique | AriaConversation/Turn/Message V1/Core, citations, provider IA, index RAG et sauvegardes | Conversations, prompts, réponses, résumés, métriques et fournisseur séparément | Contrôle ownership avant lecture/retrieval ; annulation puis effacement contrôlé des dérivés ; contrat sous-traitant et absence de rétention cachée |
| Notifications et communications : assurer le service | Notification, NotificationOutbox, JobOutbox, Meta/SMTP/SMS et webhooks | Contenu versus statut de livraison, consentement et opt-out | Opt-out, retries bornés, payload minimal ; propager les demandes pertinentes au sous-traitant sans fabriquer un statut livré |
| Prospects/formulaires : répondre à la demande | ContactLead, FamilyRequest, bilan public, newsletter, SMTP | Prospect sans suite versus client ; consentement marketing distinct | Retrait du consentement et clôture ; suppression/anonymisation après délai approuvé, pas de collecte supplémentaire |
| Audit et sécurité : intégrité et investigation | AuditEvent, audits financiers/stages, NpcAuditLog, logs applicatifs/infra | Audit métier versus télémétrie, accès et incident | Append-only pendant conservation ; purge bornée et autorisée ; redaction des secrets/PII avant émission |
| Sauvegardes : reprise après incident | DB, stockage, configuration, copies hors site et restauration isolée | Rétention par classe, rotation, gel légal et copies temporaires | Chiffrement, accès restreint, inventaire des copies, expiration ; documenter le traitement d’une restauration réintroduisant des données effacées |

## Sous-traitants et preuve attendue

Les adaptateurs SMTP et Meta officiels existent dans le code. Le fournisseur IA,
le moteur/index RAG, les services d’hébergement, d’alertes, de paiement et de
sauvegarde réellement activés doivent être confirmés par l’opérateur, par nom et
référence de contrat uniquement. Leur présence dans le code ne prouve pas leur
activation ni leurs durées de conservation. Ne fournir aucun secret ni contenu
client dans ce dossier.

Pour chaque ligne, l’approbation doit préciser : responsable, durée et point de
départ, justification juridique/métier, exceptions/gel, systèmes et copies,
mécanisme de suppression/anonymisation, délai d’exécution, preuve de contrôle et
révision de politique. Une signature datée et une référence de décision sont
nécessaires ; une durée d’expiration technique ou une mention historique ne vaut
pas approbation. Les tests synthétiques et correctifs de sécurité continuent
indépendamment. Aucun parcours supplémentaire de collecte réelle n’est ouvert.
