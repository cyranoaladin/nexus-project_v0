# Pré-rentrée 2026 — socle de sécurité V2

## Date et périmètre

- Audit : 11 juillet 2026, fuseau `Africa/Tunis`.
- Référence `origin/main` : `db04d23f3e645a2052e41e5a679a8b9443cf8dc9`.
- Branche de sécurité inspectée en lecture seule : `g-sec/api-guards`, `8f3356f1f45eed4c45327d852a9a3b516e3eff2f`.
- Aucun commit de cette branche n'est présumé fusionné ; aucune garantie qui lui est propre n'est créditée à `origin/main`.
- Périmètre : guards API, Stage V1, documents, factures, paiements et webhook ClicToPay, audit et risques IDOR.

## Verdict du gate

`GATE-SEC-BASE-001 = DESIGN_BASELINE_DEFINED`.

Ce statut signifie que le contrat minimal exigé par V2 est défini et que l'architecture actuelle permet de l'implémenter de façon additive. Il ne signifie ni `IMPLEMENTED`, ni `VERIFIED_IN_PRODUCTION`. Le développement en `DRAFT` peut être préparé ; toute exposition V2 reste bloquée jusqu'à preuve des contrôles décrits ici.

## Garanties réellement disponibles dans origin/main

| Domaine | Garantie observée | Limite |
|---|---|---|
| Authentification | `requireAuth`, `requireRole`, `requireAnyRole` et `apiGuard` centralisent une partie des contrôles | certaines erreurs d'authentification ne sont pas converties en refus fail-closed homogène |
| RBAC | politiques et helpers de rôles existants | rôle seul insuffisant pour la portée parent, élève ou coach |
| Stage admin | routes administratives Stage protégées par un rôle staff | logique V1 non adaptée aux agrégats V2 |
| Stage parent/élève | rôle vérifié | propriété déterminée par email ou par la relation V1 unique dans plusieurs parcours |
| Factures | lecture scindée admin/parent, réponse 404 sans fuite d'existence | la V2 doit ajouter la relation responsable–élève vérifiée et la portée inscription |
| Inscription publique V1 | validation stricte et limitation de débit présentes | capacité non atomique, identité et consentements insuffisamment structurés |
| Paiement | transaction sérialisable observée sur une validation et index d'idempotence externe | modèles V1 en `Float`, adaptation obligatoire vers les millimes V2 |
| Planning | `btree_gist` et contrainte d'exclusion existent pour `SessionBooking` | aucune garantie équivalente pour `StageSession`, salle, élève ou cohorte |
| Audit | journaux spécialisés (`BusinessConfigAudit`, événements facture, `NpcAuditLog`) | pas de journal V2 générique et corrélé |

## Garanties présentes uniquement sur g-sec/api-guards

La branche renforce notamment les téléchargements de documents, les périmètres de stockage, la portée facture et certains chemins paiement/webhook. Les fichiers concernés comprennent `app/api/documents/[id]/download/route.ts`, `lib/documents/storage-root.ts`, les routes ClicToPay, les guards et les routes de facture. Ces apports constituent des références de conception, pas une dépendance V2 : la migration V2 devra revalider les invariants sur sa propre base Git.

## Garanties absentes ou insuffisantes partout

1. Relation plusieurs-à-plusieurs, active et vérifiée, entre responsables légaux et élèves.
2. Autorisation ABAC combinant rôle, relation, affectation, état et portée de ressource.
3. Garantie atomique de capacité par cohorte avec maintien temporaire de place.
4. Exclusion des collisions enseignant, salle, cohorte et élève pour les séances V2.
5. Outbox transactionnelle et audit V2 couvrant états, identité, argent et arbitrage.
6. Séparation stricte demande, proposition, inscription, affectation, paiement et remboursement.
7. DTO V2 sans exposition de modèles Prisma et sans finance coach/élève.
8. Politique uniforme d'idempotence pour commandes publiques, paiements et webhooks.

## Risques concrets du domaine V1 à ne pas reproduire

| Priorité | Constat | Exigence V2 |
|---|---|---|
| P0 | comptage puis création de réservation Stage hors transaction | allocation uniquement sous verrou de cohorte, avec clé d'idempotence |
| P0 | lecture parent/élève ou rapprochement fondé sur l'email | relation responsable–élève vérifiée, active et autorisée |
| P0 | webhook ClicToPay dont la vérification dépend de la présence d'un secret | secret obligatoire ; absence ou signature invalide = refus et aucune mutation |
| P0 | contrôles documents et chemins de stockage non uniformes sur main | identifiant opaque, contrôle de propriété, chemin canonique, URL signée ou streaming autorisé |
| P1 | confirmation V1 pouvant créer un compte système et marquer un paiement sans preuve fournisseur | demande sans compte, liaison vérifiée, réconciliation fournisseur distincte |
| P1 | coach Stage pouvant voir une liste trop large de PII | uniquement ses cohortes actives et données pédagogiques nécessaires |
| P1 | audit fragmenté | événement V2 immuable, acteur, ressource, transition, corrélation, données minimisées |
| P2 | erreurs d'authentification non homogènes | wrapper fail-closed unique et réponses sans détail sensible |

## Socle minimal obligatoire V2

### Authentification et sessions

- Toute route non publique appelle un guard serveur avant la lecture métier.
- Toute exception d'authentification devient un refus ; aucune poursuite avec un utilisateur nul ou un rôle par défaut.
- Les actions mutantes protégées par cookie appliquent la protection CSRF du dépôt ou un mécanisme équivalent vérifié.
- Les webhooks utilisent signature, horodatage/rejeu si fourni, secret obligatoire et idempotence persistée.

### Autorisation

- Les décisions passent par des fonctions de politique centralisées décrites dans [la matrice d'autorisation](../specs/pre-rentree-2026-authorization-matrix.md).
- Un rôle ne confère jamais implicitement la propriété d'une ressource.
- Parent : relation responsable–élève `VERIFIED`, active à l'instant d'accès et droit adéquat.
- Coach : affectation active à la cohorte ou à la séance ; aucun accès financier.
- Élève : identité liée au `Student` concerné ; aucune finance par défaut.
- Staff : permission V2 explicite et portée d'édition ; opérations financières et pédagogiques séparées.
- Tout identifiant fourni est re-filtré par la portée autorisée ; une ressource hors portée répond `404` sauf exigence d'audit interne.

### Écriture, audit et confidentialité

- Les routes délèguent aux services ; aucun composant ni route n'écrit directement dans Prisma.
- Mutation métier, événement d'audit et événement outbox sont atomiques lorsque requis.
- Aucun secret, preuve complète, numéro financier, token, contenu pédagogique sensible ou PII superflue dans les logs.
- Exports massifs soumis à permission dédiée, justification et audit.
- Documents servis après contrôle d'audience et de propriété, avec noms de stockage non devinables.

## Matrice fail-closed minimale

| Situation | Réponse | Mutation | Audit |
|---|---|---|---|
| session absente/invalide | 401 | aucune | métrique sans PII |
| rôle non autorisé | 403 | aucune | tentative agrégée ; détail seulement si utile |
| ressource hors portée | 404 | aucune | événement de sécurité interne si signal pertinent |
| relation parent non vérifiée/expirée | 404 | aucune | refus corrélé |
| affectation coach absente/expirée | 404 | aucune | refus corrélé |
| signature webhook absente/invalide | 401/400 | aucune | empreinte technique, jamais le secret |
| clé d'idempotence réutilisée avec un autre payload | 409 | aucune | conflit d'idempotence |
| contrainte DB de capacité/collision | 409/422 traduit | transaction annulée | événement métier si nécessaire |

## Conditions de preuve avant activation

- tests unitaires des politiques et tests d'intégration IDOR parent/coach/élève/staff ;
- test d'absence de finance dans les DTO coach et élève ;
- test webhook signé, invalide, répété et reçu en retard ;
- revue des routes V2 prouvant l'appel systématique aux services et politiques ;
- tests de stockage documentaire et redaction des logs ;
- test de concurrence capacité et contraintes de planning ;
- revue du différentiel avec la branche de sécurité au moment de l'implémentation ;
- preuve que les flags public, API et dashboards restent désactivés avant validation.

## Conclusion

La sécurité V2 est architecturalement réalisable sans refondre préalablement toute l'authentification V1, à condition de ne réutiliser ni ses raccourcis de propriété par email, ni ses mutations Stage. La V2 doit superposer une couche ABAC, une relation responsable–élève vérifiée, des services transactionnels et un audit/outbox dédiés. Le gate reste bloquant pour l'activation tant que ces garanties ne sont pas implémentées et testées.
