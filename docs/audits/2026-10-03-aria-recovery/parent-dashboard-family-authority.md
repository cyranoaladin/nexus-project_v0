# Autorité familiale du dashboard parent

Date : 4 octobre 2026. Base locale : c71a3b504. Base publiée : 91161a7cf. Statut global : NOT_READY.

## Correction

Le dashboard chargeait les détails des enfants depuis le seul rattachement historique. Il charge désormais uniquement les identités stockées, consulte authorizeParentStudentRecords(read), puis borne la requête détaillée aux IDs autorisés. Une autorité indisponible donne 503 avant toute lecture détaillée. Sans enfant autorisé, aucune progression ou séance enfant ne charge. Les paiements restent ceux de l’utilisateur authentifié, sans prix d’abonnement dans la vue familiale.

## Preuves

Trois nouveaux tests échouaient sur le code précédent : enfant refusé encore exposé, panne rendue comme succès, absence de consultation d’autorité. Ils passent après correction. La campagne ciblée complète passe : 7 suites, 35 tests. Neuf échecs initiaux des anciens tests provenaient de fixtures sans identités canoniques ou d’une assertion ne prévoyant qu’une seule lecture ; les fixtures ont été complétées et les assertions protègent maintenant les deux requêtes, sans supprimer les contraintes financières ou métier.

Typecheck réussi. Lint du code et des nouveaux tests : zéro avertissement. Deux fichiers anciens conservent 24 avertissements préexistants (any et variables request inutilisées) ; le lint élargi avec max-warnings=0 échoue pour ces avertissements, sans erreur. Aucun avertissement nouveau ajouté. Revue indépendante en lecture seule : aucun nouveau P0/P1 démontré.

## Limites

Aucune migration ni modification commerciale. Discovery legacy encore utilisé, VERIFIED universel non revendiqué. Les tests PostgreSQL et E2E de ce lot ne sont pas exécutés. La CI du futur SHA reste à exécuter. Le catch historique de progression peut encore masquer une indisponibilité par une vue vide ; qualification UX restante. Aucun déploiement.

## Rollback

Retour applicatif au commit précédent selon la procédure protégée ; aucun schéma modifié. Aucun reset ou réécriture d’historique.
