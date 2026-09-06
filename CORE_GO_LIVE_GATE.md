# Critères indépendants de mise en service

Date : 6 septembre 2026. Base applicative : `origin/main` au commit `95f518e31`.
Périmètre de ce lot : registre des critères et destinations des rôles, sans déploiement.

## CORE_PLATFORM_GO_LIVE_READY

CORE_PLATFORM_GO_LIVE_READY = NOT_YET_VERIFIED

Cette décision concerne les identités, les familles, la scolarité, le planning,
les bilans publiés et leur visibilité, les paiements et les factures.
Elle exige des preuves sur la révision livrée :

- cinq rôles : connexion, destination, session et refus d'accès croisé ;
- création familiale canonique, demandes qualifiées et traitement explicite des entrées historiques ;
- absence de rattachement implicite à un parent technique ou à un homonyme ;
- contrôles serveur de propriété, de consentement, de publication et d'audience ;
- scolarité et planning cohérents, sans compte candidat parallèle ;
- aucune opération de crédit, aucun encaissement déduit d'une simple confirmation de réservation ;
- tests pertinents, TypeScript, lint, build et recette authentifiée sans exposition de données ;
- migrations et stockage vérifiés, sauvegarde et retour arrière exploitables ;
- révision déployée identifiée, smoke des routes publiques et recette des parcours livrés.

La seule centralisation des destinations ne satisfait pas ces critères. Les
écarts du registre `audit_dsahboard.md` doivent être traités ou explicitement
acceptés avec leur périmètre et leur justification avant décision.

## RAG_FEATURE_GO_LIVE_READY

RAG_FEATURE_GO_LIVE_READY = BLOCKED

Cette décision concerne uniquement l'activation du retrieval documentaire externe.
Elle exige le contrat du fournisseur, un corpus autorisé, une identité académique
admissible, les permissions, des citations vérifiables, la gestion de l'absence
de résultat et des erreurs, et une recette sur le staging externe prévu.
L'absence actuelle de preuve staging ne doit jamais être remplacée par des mocks
présentés comme une validation fournisseur.

External RAG staging: NON_BLOCKING_CORE / BLOCKING_RAG_FEATURE

L'indisponibilité du staging RAG ne bloque pas CORE si les fonctions RAG restent
fermées ou affichent honnêtement leur indisponibilité et si les parcours CORE
fonctionnent indépendamment. Une panne RAG qui casserait ces parcours deviendrait
un défaut CORE ; cette séparation n'autorise pas à masquer une régression.
CORE prêt n'implique pas RAG prêt ; RAG prêt n'implique pas CORE prêt.

## Preuves et changement de décision

Les valeurs ci-dessus sont des décisions documentaires, pas des variables
d'environnement ni des interrupteurs de production. Aucun code RAG n'est modifié
par ce lot. Actualiser séparément chaque décision avec SHA, date, commandes,
résultats et limites. Ne pas transformer automatiquement la réussite d'un test
unitaire en autorisation de déployer.

Matrice et preuves : `docs/audits/2026-09-06-core-platform-go-live.md`.
