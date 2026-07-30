# Implémentation du moteur canonique de bilans

## Base

- date : 30 juillet 2026 ;
- branche :
  `feat/bilan-assessment-engine-v1-20260730` ;
- base stabilisée :
  `8596dce21f22f9bcad5f3b4583898ef6395a60f9` ;
- dépendance : draft PR #88 ;
- activation et déploiement : non réalisés.

## Livré

- projection publique du catalogue sans corrigé ;
- paquets de revue non signés liés aux 17 hashes ;
- affectations avec provenance immuable ;
- tentative reprenable, autosave optimiste, soumission et scellement ;
- correction automatique QCM et file manuelle à lease ;
- décisions append-only et révisions contrôlées ;
- score brut déterministe versionné, provisoire sous flag seulement ;
- calibrage réel conservé en attente ;
- bilan déterministe par audience ;
- revue nominative, publication idempotente et révocation historique ;
- audit et outbox atomiques ;
- routes v1 sécurisées et interfaces famille/équipe minimales ;
- migrations fresh/upgrade testées.

## Décisions de sécurité

Les 17 modules réels sont refusés à l'affectation. La fixture positive n'est
injectable que depuis les tests de service. Les corrigés ne sont pas présents
dans les payloads ou le HTML famille. Les dénis de propriété sont
non énumérables. Les mutations exigent rate limiting distribué.

Une publication active bloque toute révision de correction jusqu'à sa
révocation. Une audience révoquée peut être régénérée sans interrompre les
autres audiences.

## Migration

La migration est additive et réutilise les modèles de tentative, score,
artifact, révision, revue et outbox. Elle ajoute uniquement des modèles
consommés par le moteur. Les maximums historiques inconnus restent `NULL`.

Le rollback est applicatif (flags/workers) ; une migration compensatoire est
requise pour toute évolution SQL après utilisation.

## Vérifications

Les gates exécutés avant le checkout final ont donné :

- tests unitaires globaux : 620 suites réussies, 1 ignorée ; 7 584 tests
  réussis, 4 ignorés ;
- tests DB globaux : 17 suites, 205 tests réussis ;
- intégration PostgreSQL/Redis : 14 suites, 149 tests réussis ;
- tests moteur DB ciblés : 24 tests réussis ;
- tests moteur, API et interfaces ciblés : 20 tests réussis ;
- Playwright complet : 228 tests réussis ;
- corpus TypeScript : 53 suites, 404 tests réussis ;
- corpus Python : 267 tests réussis, 2 ignorés ;
- build : 146 routes, artefact standalone valide ;
- audit production : zéro vulnérabilité ;
- audit complet : 36 entrées high d'outillage, zéro critical ;
- Prisma validate/generate, typecheck, lint et sécurité dépôt : verts.

Le rapport de PR et le rapport final portent les commandes exactes, durées,
SHA poussé et preuve de reproduction depuis un checkout détaché propre.

## Verdict intermédiaire

Le code moteur est techniquement raccordé. La mise en production reste
bloquée par la validation humaine des contenus, les secrets/connectivités
d'exploitation, la migration autorisée et le gate de risque dépendances de la
fondation.
