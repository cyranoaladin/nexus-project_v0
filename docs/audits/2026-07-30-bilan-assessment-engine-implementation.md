# Implémentation du moteur canonique de bilans

## Base

- date : 30 juillet 2026 ;
- branche :
  `feat/bilan-assessment-engine-v1-20260730` ;
- base stabilisée :
  `be627c788b0b60a6ab63fe7d8f903863fe837278` ;
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

Les compteurs finaux, commandes exactes, durées et SHA propre seront ajoutés
au rapport de PR après les gates globaux et le checkout de reproduction.

## Verdict intermédiaire

Le code moteur est techniquement raccordé. La mise en production reste
bloquée par la validation humaine des contenus, les secrets/connectivités
d'exploitation, la migration autorisée et le gate de risque dépendances de la
fondation.
