# Autorité commune des téléchargements de documents

## Critères d'acceptation

- Un parent refusé par le Core ne lit ni fichier ni métadonnées privées de son ancien enfant V1 ; une panne de l'autorité renvoie503 sans fallback.
- Un guardian Core VERIFIED lit un document destiné aux parents sans dépendre du précédent ParentProfile V1.
- Les deux URL `/api/documents/{id}` et `/api/documents/{id}/download` appliquent la même visibilité : l'élève propriétaire ne lit jamais ADMIN_ONLY.
- L'autorisation précède le chargement de chemin, nom original et autres données privées ; la lecture finale est liée à l'ID, au propriétaire et au scope autorisés.
- Les archives propres au parent conservent leur accès direct ; les contrôles de coach affecté, élève propriétaire, containment et types de fichier restent effectifs.

## Défauts et correction

Quatre tests famille/métadonnées ont échoué sur le téléchargement initial, puis le cas ADMIN_ONLY a reproduit le contournement par l'URL courte. Un nouveau cas initial STUDENT_AND_COACH avait un attendu erroné : ce scope inclut bien l'élève dans la policy existante. Il est remplacé par quatre assertions positives des scopes canoniques, sans modifier cette policy.

`lib/documents/read-authority.ts` charge seulement les identifiants et visibilité, applique rôle/affectation/autorité familiale, puis lit le fichier enregistré avec une clause owner+scope. Les deux routes consomment cette décision. Le streaming par ouverture sécurisée de l'URL courte est conservé, ainsi que le containment/limite de taille de l'autre URL.

## Preuves locales du lot

Six suites API/fichiers voisines, 92 tests réussis, dont les deux suites de téléchargement (38 tests) ; tests interstores PostgreSQL dans le migrator canonique, 22 réussites au total, dont HYBRID et V2_ONLY sur le document synthétique : compte désactivé, membership PENDING, VERIFIED puis révoqué. Le test interstores qualifie les données privées et l'autorisation, pas la lecture de vrais octets. Les tests fichiers/API restent distincts. Typecheck complet, lint des fichiers concernés et sept scans de secrets réussis après l’ajout du cas coach propriétaire. Les deux imports require historiques des tests de chemin sont normalisés en import Node, sans changement des assertions.

## Compatibilité et limites

Le coach propriétaire d'un document sans profil Student est refusé par la policy commune. L'ancienne URL courte permettait tout document propre au coach ; aucun parcours métier correspondant n'est établi. Cette restriction est explicite et testée, sans élargissement des scopes. Les documents professionnels propres au coach nécessiteraient une permission de visibilité dédiée validée ; pas de réactivation implicite.

Les routes voisines de listes/uploads et les factures restent à auditer/porter. La redaction générale des exceptions est un lot séparé. Le lot ne prouve ni restauration du stockage production, ni E2E de tous les rôles, ni atomicité de révocation entre les deux bases.

## Migration et rollback

Aucune migration ; aucun ancien document ni fichier déplacé/supprimé. Retour applicatif par commit distinct si requis. Aucun déploiement.
