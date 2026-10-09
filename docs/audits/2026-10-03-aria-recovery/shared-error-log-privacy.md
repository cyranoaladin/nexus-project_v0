# Frontière de confidentialité commune aux logs d’erreur

Date : 2026-10-05. Base publiée : 16ae686d5b54cc70fbc57ffc16f883e9650036c1. Statut NOT_READY.

## Défaut et critères
Le helper TypeScript était utilisé par environ 90 routes et conservait message, stack, cause et objets arbitraires. Ses variantes de scripts faisaient de même. Des erreurs driver peuvent ainsi divulguer requêtes, données privées, credentials ou chemins ; une cause cyclique peut faire échouer le log. Aucun usage de ces valeurs pour une décision métier ou réponse HTTP n’a été trouvé dans la revue ciblée.

Aucun texte libre, stack, cause, propriété arbitraire ou hook de sérialisation ne doit sortir. Seuls des noms et codes opérationnels explicitement allowlistés sont conservés. Les réponses client, transactions, autorisations et retries ne changent pas.

## Correction
Une seule implémentation CommonJS pure, sans dépendance ni effet de bord, sert les façades TypeScript et ESM. Elle ignore les valeurs primitives/objets arbitraires ; les descriptors évitent d’appeler les getters d’Error ; les proxies hostiles retournent un résumé constant contrôlé. Une déclaration de type assure la frontière TypeScript. Le job unitaire exécute également les six tests Node de compatibilité des façades CJS/ESM.

## Preuves
Dix tests rouges sur l’ancien helper, puis dix verts. Les tests documentaire/architecture avec le nouveau helper : trois suites, 52 tests verts. Node CJS/ESM : six tests verts. Aucune temporisation, exception lint, test ignoré ou seuil réduit. Un premier lancement ciblé nommait un fichier de test inexistant : échec de collecte, corrigé avec le vrai fichier `admin.documents.route.test.ts`, sans modification produit correspondante. Un import require dans un prototype échouait au lint : la solution finale partage directement le module pur sans dérogation.

## Portée et limites
Les logs directs qui contournent ce helper et les préfixes interpolés doivent encore être audités. Un TypeError sans nom propre devient Error : précision réduite volontairement. Le build standalone doit renouveler la preuve d’inclusion du module pur sur le SHA publié. Aucun secret ou donnée client utilisé, aucun accès ni changement production. Deux prototypes non suivis créés par cette session puis remplacés ont été retirés ; aucun fichier utilisateur/historique supprimé. Rollback applicatif par commit inverse, sans migration.

Typecheck et lint ciblé finaux réussis ; découverte des lanes : 1726 fichiers déclarés accessibles, aucun orphelin. Revue en lecture seule : aucun nouveau P0/P1 démontré. La suite complète et la CI doivent être renouvelées sur le prochain checkpoint.
