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

## Preuve — Tâche 16 : CORE ne fait aucune requête RAG (7 septembre 2026)

Base applicative au moment de la preuve : commit `d02b828c4`. Périmètre : les
parcours critiques CORE livrés aux Tâches 1-15 (familles, scolarité,
assignations, planning, tableaux de bord) fonctionnent sans que
`lib/rag-client.ts`, `lib/aria/rag.ts` ou
`lib/aria/infrastructure/rag/manifest.ts` ne soient sollicités — ni au niveau
module, ni au niveau navigateur. Aucun code de `lib/rag-client.ts`,
`lib/aria/rag.ts` ou `lib/aria/infrastructure/rag/manifest.ts` n'a été modifié
par cette tâche.

- `__tests__/architecture/core-rag-independence.test.ts` (7/7, PASS) : les 15
  variables d'environnement RAG effectivement lues par le sous-système
  (`RAG_INGESTOR_URL`, `RAG_API_TOKEN`, `RAG_SEARCH_TIMEOUT`,
  `RAG_SEARCH_TIMEOUT_MS`, `ARIA_RAG_ENGINE_BASE_URL`, `RAG_BFF_SERVICE_TOKEN`,
  `ARIA_RAG_ENGINE_TIMEOUT_MS`, `ARIA_RAG_ENGINE_MAX_RESPONSE_BYTES`,
  `ARIA_RAG_SERVABLE_MANIFEST_ROOT`, `ARIA_RAG_ACTIVE_MANIFEST_SHA256`,
  `NEXUS_INTERNAL_TOKEN_SECRET`, `NEXUS_INTERNAL_TOKEN_ISSUER`,
  `NEXUS_INTERNAL_TOKEN_AUDIENCE`, `NEXUS_SSO_ISSUER`, `NEXUS_SSO_AUDIENCE`)
  sont effacées, `fetch` est remplacé par un enregistreur qui échoue au
  premier appel, puis `lib/families/create-family.ts`,
  `lib/curriculum/student-academic-profile.ts`,
  `lib/assignments/allowed-courses.ts`, `lib/planning/series.ts` et
  `lib/dashboard/student-payload.ts` sont importés et partiellement exercés.
  `EXPECTED_RAG_OUTBOUND_REQUESTS=0` est vérifié à chaque cas ; une preuve
  statique complémentaire confirme qu'aucun de ces cinq fichiers n'importe le
  sous-système RAG. Caractérisation verte d'emblée : aucune régression
  trouvée, aucun changement de production nécessaire.
- `e2e/auth/core-rag-disabled.spec.ts` (2/2, PASS — exécuté réellement, pas
  seulement rédigé) : build standalone réel, serveur Next.js en production
  sans aucune variable RAG positionnée, base et Redis jetables locaux. Le
  rôle ELEVE charge `/dashboard/eleve` (widget ARIA embarqué via
  `<AriaChatLauncher>`), ouvre le panneau ARIA sans crash ni bascule vers le
  `error.tsx` générique ; le rôle ASSISTANTE charge son tableau de bord, le
  planning (`/dashboard/assistante/planning`) et la liste des élèves
  (`/dashboard/assistante/students`). Un intercepteur de requêtes navigateur
  confirme zéro appel vers un hôte/chemin RAG (`rag`, `ingestor`,
  `aria-rag-engine`) et zéro résurgence du fallback HTTP `/search` retiré
  (PR #214, hors périmètre).
- Widget ARIA embarqué (`components/aria/AriaChatLauncher.tsx` +
  `AriaChatPanel.tsx`, seul point CORE avec un composant RAG-adjacent en
  ligne) : déjà fail-open avant cette tâche — chargement fermé par défaut,
  `publicErrorLabel()` affiche un message français au lieu de planter sur
  `RAG_UNAVAILABLE`. Aucune modification de production requise.
- Suite unitaire complète (`npx jest --config jest.unit.config.js`) : 1096
  suites / 12545 tests, 100 % PASS après ce lot.

## Preuves et changement de décision

Les valeurs ci-dessus sont des décisions documentaires, pas des variables
d'environnement ni des interrupteurs de production. Aucun code RAG n'est modifié
par ce lot. Actualiser séparément chaque décision avec SHA, date, commandes,
résultats et limites. Ne pas transformer automatiquement la réussite d'un test
unitaire en autorisation de déployer.

Matrice et preuves : `docs/audits/2026-09-06-core-platform-go-live.md`.
