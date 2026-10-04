# Autorité familiale avant lecture des comptes rendus de séance

Date : 4 octobre 2026. Base publiée : 91161a7cf. Statut global : NOT_READY.

## Défaut reproduit

La route GET autorisait le parent historique du booking sans consulter la façade familiale actuelle. Elle chargeait également le contenu avant l’autorisation et rendait un résultat vide à un tiers si aucun compte rendu n’existait. Cinq tests rouges ont reproduit les refus manquants, la panne non fermée et l’absence du guard.

## Correction

Charger seulement les identifiants coach/élève du booking. Pour un parent : mapper User.id vers Student.id côté serveur et consulter resolveParentStudentAccess(read). Refuser le lien révoqué/PENDING, le mapping absent et une panne d’autorité (503). Le rôle COACH/ÉLÈVE doit correspondre à l’identité personnelle du booking ; les rôles staff existants sont conservés. Ne charger le rapport qu’après décision et le filtrer par sessionId ET Student.userId du booking. Ne plus charger les relations privées user/coach/session inutiles. Cache privé/no-store, Vary Cookie/Authorization et marqueur d’erreur constant.

## Preuves

- Rouge : 5 échecs sur 5, dont 200 pour parent refusé/panne et tiers devant un rapport absent.
- Vert élargi : 4 suites / 47 tests (route, autorité familiale et assessments voisins).
- Typecheck et lint ciblé réussis ; revue indépendante readonly : aucun nouveau P0/P1 démontré, filtre relationnel Prisma valide.
- Preuves privées : .artifacts/recovery/session-report-family-*-private.log.

## Limites

Aucune migration. La façade existante conserve LEGACY_ALLOWED en V1_ONLY ou HYBRID non migré ; ce correctif ne prétend pas imposer VERIFIED à toutes les familles. Sa qualification PostgreSQL/E2E et la CI du prochain SHA restent nécessaires. Les listes parent et le salon vidéo présentent encore d’autres contournements de la façade identifiés en revue et seront traités séparément. Aucun déploiement effectué.
