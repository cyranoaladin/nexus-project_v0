# Pré-rentrée 2026 — classification, confidentialité et rétention

## Principe

Collecter le minimum nécessaire pour organiser et contractualiser un service destiné à des mineurs. Toute durée non déjà validée juridiquement est `LEGAL_INPUT_REQUIRED`; ce document n'invente aucun délai légal.

## Classification

| Classe | Exemples V2 | Accès | Logs/exports |
|---|---|---|---|
| publique | titre, dates, niveaux, labels modules, site Mutuelleville, tarifs publiés | tous si publié | cache autorisé, aucune PII |
| interne | codes, gates, capacité agrégée, ressources, conflits | staff selon grant | codes techniques seulement |
| pédagogique | parcours, variante, présence, besoins, bilan, travail | élève/parent autorisé, coach affecté, pédagogie | pas de contenu dans logs ; export ciblé |
| personnelle | noms, email, téléphone, école, identifiants | relation/mission légitime | redaction, hash de contact pour rapprochement |
| responsable légal | relation, type, droits, vérification, révocation | parent concerné et staff autorisé | audit sans preuve brute |
| financière | snapshot, paiement, facture, remboursement, preuve | parent avec droit, finance, admin | aucun coach/élève ; références masquées |
| sensible | données de mineur, contenus internes, justificatifs, preuves d'identité | besoin strict et permission dédiée | jamais payload complet/log standard |
| audit | acteur, action, ressource, état, corrélation, motif | admin/permissions limitées | immuable, metadata minimisée |

## Minimisation par agrégat

- Demande publique : nom du responsable, un moyen de contact au moins, prénom élève, niveau/parcours/sélections, consentements. Pas de mot de passe, adresse postale, date de naissance complète, document d'identité, informations financières ou compte définitif.
- Rapprochement : email/téléphone normalisé sert à proposer des candidats via hash ; aucune fusion automatique.
- Coach : seulement identité élève et données pédagogiques nécessaires à sa cohorte.
- Communication : template/version, paramètres strictement nécessaires, hash destinataire et référence fournisseur ; pas de copie libre du message par défaut.
- Audit/outbox : identifiants internes et codes ; payload minimisé. Jamais secret, signature, token brut, mot de passe, chemin local, numéro de carte, preuve complète.

## Matrice de rétention à valider

| Donnée | Déclencheur | Durée | Fin de durée | Exception |
|---|---|---|---|---|
| demande non convertie/contact | clôture/retrait | `LEGAL_INPUT_REQUIRED` | anonymiser coordonnées, garder agrégats non identifiants si autorisé | litige/consentement spécifique |
| consentement/preuve de demande | collecte | `LEGAL_INPUT_REQUIRED` | suppression/anonymisation liée | obligation de preuve |
| relation responsable–élève | révocation/fin | `LEGAL_INPUT_REQUIRED` | conserver trace minimale auditée, retirer accès | protection du mineur/litige |
| proposition non acceptée | expiration | `LEGAL_INPUT_REQUIRED` | anonymiser/supprimer selon politique | preuve commerciale |
| inscription/contrat/CGV snapshot | fin prestation | `LEGAL_INPUT_REQUIRED` | archivage puis disposition légale | obligation contractuelle |
| paiement/facture/remboursement/preuve | opération financière | `LEGAL_INPUT_REQUIRED` | archivage légal sécurisé | obligations comptables/fiscales |
| présence/bilan/support remis | fin pédagogique | `LEGAL_INPUT_REQUIRED` | export puis anonymisation/suppression | demande/obligation documentée |
| communication | livraison/clôture | `LEGAL_INPUT_REQUIRED` | garder métadonnées minimales ou supprimer | preuve d'information corrective |
| audit sécurité/métier | événement | `LEGAL_INPUT_REQUIRED` | agrégation/anonymisation ou purge contrôlée | enquête/litige |
| outbox technique livrée/dead-letter | terminal | `LEGAL_INPUT_REQUIRED` opérationnel | purge payload, métriques agrégées | incident ouvert |
| holds expirés/waitlist terminale | terminal | `LEGAL_INPUT_REQUIRED` | anonymisation/purge technique si autorisée | litige paiement tardif |

La publication est bloquée par `GATE-RETENTION-001` tant que le responsable juridique n'a pas validé ces durées et les mentions d'information.

## Archivage, rectification et suppression

- Archivage logique par statuts/`archivedAt`; les interfaces actives filtrent sans cacher l'historique aux rôles autorisés.
- Rectification : commande auditée, préserve l'ancienne valeur uniquement si nécessaire et minimisée ; un snapshot contractuel n'est pas réécrit, une note de correction est liée.
- Suppression légale : évaluation des obligations financières, contractuelles, pédagogiques et de sécurité ; anonymisation privilégiée quand la conservation de l'événement est nécessaire.
- Aucun hard delete en cascade d'une édition avec demande, inscription, paiement, présence, document, communication ou audit.
- V1 suit sa politique historique ; aucune purge V2 n'atteint les tables V1.

## Documents et pièces jointes

- Fichiers hors répertoire public, nom technique opaque, type/taille validés, antivirus si disponible et requis avant publication.
- DTO n'expose jamais `localPath`; accès par streaming autorisé ou URL signée courte après policy.
- Audience explicite et portée unique vérifiée ; retrait logique immédiat en cas de révocation.
- Les URLs signées ne sont pas stockées comme vérité ; elles sont générées à la demande.
- Durée de conservation, taille maximale, types permis et politique antivirus : `LEGAL_INPUT_REQUIRED`/`SECURITY_INPUT_REQUIRED` avant implémentation des uploads V2.

## Droits et exports

Les services futurs doivent permettre inventaire, export lisible, rectification et demande de suppression selon rôle et vérification d'identité. Un export parent ne couvre que les enfants liés et droits actifs, exclut données d'autres responsables non nécessaires, notes internes, secrets et audit sécurité. Tout export massif staff est paginé, justifié, auditée, chiffré au repos et expirant selon une durée `LEGAL_INPUT_REQUIRED`.

## Redaction et observabilité

- email : hash pour corrélation ou masque ; téléphone : derniers chiffres seulement si support l'exige ; noms absents des logs techniques ;
- provider payload : event ID/hash/code, jamais corps complet par défaut ;
- erreurs client : requestId et code métier, pas stack/SQL/chemin ;
- analytics : identifiants pseudonymes, aucun parcours pédagogique détaillé sans finalité validée ;
- sauvegardes : chiffrement/accès/restauration et durée `LEGAL_INPUT_REQUIRED`.

## Tests/gates

Snapshots JSON de DTO par rôle, scan PII logs, IDOR documents, URL expirée, relation révoquée, export multi-enfants, anonymisation sur jeu de test, préservation facture/audit, absence de cascade et contrôle des sauvegardes. Toute valeur de rétention absente reste un blocage de publication, pas de conception technique.
