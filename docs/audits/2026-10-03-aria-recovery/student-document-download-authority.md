# Autorisation des téléchargements documentaires

Date : 4 octobre 2026. Base testée : 71a973349981bf691939ca0dcf1dc4a455624776. Statut global : NOT_READY.

## Défauts reproduits et correction

Le téléchargement élève utilisait seulement l'identifiant et le propriétaire ; un document ADMIN_ONLY appartenant à l'élève pouvait être servi malgré son exclusion des listes. Six tests ont d'abord échoué sur ce défaut et les invariants associés. Un autre test rouge a démontré le même contournement pour un parent propriétaire dans l'autorité documentaire commune.

La route élève utilise maintenant l'autorité commune avant toute lecture de métadonnées privées ou ouverture de fichier. ADMIN_ONLY est refusé à tous les rôles non staff, même propriétaires. Les quatre autres portées restent accessibles à leur élève propriétaire. Le contrat existant des documents personnels du parent est conservé. Une indisponibilité de fichier ne révèle plus la raison interne de tombstone ; les erreurs de lecture d'autorité sont expurgées. Les réponses documentaires portent private/no-store et Vary Cookie/Authorization.

## Preuves exécutées

- Cinq suites ciblées : 54 tests réussis, dont refus avant accès au stockage, autre propriétaire, panne et absence de détails privés.
- PostgreSQL réel éphémère : une suite, huit tests réussis ; refus ADMIN_ONLY élève et parent, quatre portées autorisées, filtrage avant pagination. Les 131 migrations et leur relance réussissent ; le conteneur isolé a été arrêté.
- Typecheck et lint strict des fichiers concernés sélectionnés : réussis. Le vieux fichier student.documents.download.test.ts conserve ses avertissements préexistants ; aucune désactivation de règle ajoutée.
- Les premières fixtures positives ont été corrigées (octets du flux et e-mail de session synthétique), sans affaiblir les contrôles de production.
- Revue indépendante en lecture seule : aucun nouveau P0/P1 démontré.

## Limites et rollback

Aucun E2E de ce lot exécuté, aucune migration nouvelle, aucun accès à la production. La CI publiée sur la base ne qualifie pas ce delta. Les réponses d'authentification génériques 401/403 ne contiennent pas de document ; leur politique de cache reste à harmoniser. Rollback applicatif possible sans évolution de schéma, mais rétablir l'ancien accès ADMIN_ONLY serait une régression de sécurité.
