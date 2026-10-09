# Voie PostgreSQL dédiée au test réel Golden Family

2026-10-05. Base locale 12e0b9346 ; SHA distant de diagnostic 7e54e4c382bcc955953a612854b1bf553c97f51b.

Cause CI : Integration Tests avait 68 suites / 397 tests verts et une suite / deux tests rouges E2E_DATABASE_NOT_DISPOSABLE. Le garde exact nexus_e2e + E2E_DISPOSABLE_STACK refuse légitimement la base générale nexus_disposable_test. Ce garde n’est pas élargi.

Le fichier réel est déplacé dans __tests__/e2e/ et collecté par jest.golden-family-real.config.js. Le job Integration Tests lance obligatoirement test:golden-family:disposable avant sa suite générale. Le nouvel orchestrateur vérifie la cible générale locale marquée, crée une base nexus_e2e neuve (existence = échec), migre le schéma et exécute le fichier déplacé. Il exige exactement deux tests réussis, zéro pending et une sortie zéro. Aucune annotation skip, assertion affaiblie ou ignore runtime ajoutée. L’ancienne suite générale n’a pas à charger un helper sous un contrat de base incompatible.

Preuve finale isolée 1791161203 : préflight/reprise migration stages, restauration chiffrée synthétique, 29 tests PostgreSQL métier puis deux tests réels Golden verts ; source stable et instance tmpfs arrêtée. Quatre essais négatifs du nouvel orchestrateur : marker absent, hôte non local, nom production, cible E2E au lieu de base générale ; tous arrêtés à target-guard avant CREATE DATABASE. Typecheck et lint ciblé renouvelés : verts. Aucune restauration ou opération de production.

Revue indépendante en lecture seule : aucun nouveau P0/P1 démontré ; base existante refusée, aucune réutilisation/drop/reset. Limite : qualification navigateur et CI complète du prochain SHA restent obligatoires. L’exclusion stage demeure limitée aux séances de stage, sans garantie intercalendriers.

## Renouvellement du contrat unitaire — 2026-10-05

Sur dc54d6d, le job Integration Tests réussit ; le job Unit Tests échoue sur une assertion historique d’absence du répertoire `__tests__/e2e`, désormais utilisé par le fixture PostgreSQL Golden. Reproduction locale : 15 réussites, 1 échec causal. Le contrat précise l’interdiction de tout spec Playwright dans ce répertoire, exige exactement le test Golden Jest et vérifie son rattachement à la configuration et à la commande CI obligatoire. Après correction : 16 réussites, aucun test ignoré. Aucune assertion métier du fixture Golden modifiée.
