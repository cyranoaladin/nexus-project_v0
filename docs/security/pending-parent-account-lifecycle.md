# Cycle de vie des inscriptions Parent inachevées

## Politique versionnée

- Version : `2026-08-04.v2`.
- Expiration d’un jeton d’activation : 72 heures UTC.
- Seuil d’éligibilité : 90 jours UTC depuis le filigrane d’activité du graphe.
- Plan dry-run : 15 minutes.
- Taille maximale d’un lot : 100 graphes.

Le filigrane temporel est le maximum de `User.createdAt`, `User.updatedAt`, des dates de création/mise à jour du `Student` et de son `User`, et des dates de demande/mise à jour des liens canoniques. Il est ancré sur le `User Parent`, mais une réémission, une réconciliation ou une activité structurelle récente repousse donc le seuil. Un Parent activé sort entièrement de la cohorte.

## Classification fermée

| État | Signification |
|---|---|
| `RECONCILIATION_REQUIRED` | Propriété legacy unique démontrée, lien canonique absent. |
| `TOKEN_INVALIDATION_ELIGIBLE` | Jeton expiré cohérent à invalider avant une éventuelle purge future. |
| `PURGE_ELIGIBLE` | Graphe cohérent, ancien, sans jeton ni aucune relation externe. |
| `HUMAN_REVIEW_REQUIRED` | Donnée métier, contact externe, consentement ou relation contradictoire. |
| `NOT_ELIGIBLE` | Activation valide, activité trop récente ou compte hors cohorte. |
| `INCONSISTENT_GRAPH` | Structure, dates ou couple jeton/expiration incohérents. |

Une purge n’est proposée qu’après réconciliation et invalidation séparées. Toute FK externe vers le Parent, son profil, le Student ou son User bloque la purge, même avec `ON DELETE CASCADE`. Les tables et colonnes sont découvertes dans le seul schéma `public`; toute introspection composite ou invalide échoue fermée.

## Dry-run et exécution

Le dry-run produit un plan opaque par graphe : version de politique, dates d’émission/expiration, liaison HMAC à l’environnement, clé opaque, empreinte HMAC du graphe, classification, nombre agrégé de lignes et action. Aucun email, nom, identifiant brut, jeton ou hash n’est exposé.

L’exécution exige `--execute`, un fichier de plan et une confirmation correspondant à l’action. Elle reprend un verrou advisory transactionnel, verrouille les graphes par ordre stable avec `FOR UPDATE SKIP LOCKED`, relit le graphe et recalcule l’empreinte sous isolation `SERIALIZABLE`. Un plan expiré, modifié, rejoué, provenant d’un autre environnement ou visant un graphe changé est refusé. En production, `ALLOW_PENDING_PARENT_PROCESSING=true` reste une autorisation opérationnelle séparée et non activée par le code.

## Réconciliation et suppression

La réconciliation réutilise le contexte transactionnel canonique `ParentStudentConsent` et crée seulement `PENDING_PARENT_CONSENT`. Elle ne crée ni User, ni Student, ni tentative.

La suppression explicite uniquement le lien non consenti, le Student, son User, le ParentProfile et le User Parent. Toute référence métier ou de contact découverte interdit l’action. Le rollback transactionnel prévient tout graphe partiel.

## Exploitation

La commande `npm run auth:pending-accounts` est dry-run par défaut. Le secret HMAC de plan et l’identifiant d’environnement sont obligatoires et extérieurs au dépôt. Une purge en production demeure interdite sans autorisation ultérieure explicite.
