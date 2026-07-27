# QA finale de release — Pré-rentrée 2026

## Date

2026-07-26, Africa/Tunis.

## Contexte

La pile des PR #75 à #78 a été consolidée dans
`release/pre-rentree-2026-public-ready`. Les corrections fonctionnelles et
documentaires sont testées, mais ce rapport ne vaut pas GO.

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| `npm ci` | vert |
| `npm audit --omit=dev --audit-level=high` | vert, 0 vulnérabilité |
| `npm audit --audit-level=high` | rouge, 36 high |
| tests TypeScript Pré-rentrée | vert, 48 suites / 374 tests |
| tests Python Pré-rentrée | vert, 156 tests |
| pipeline Pré-rentrée build/audit/package/verify | vert et fail-closed |
| PDF publics | vert, 7 fichiers / 59 pages |
| `npm run typecheck` | vert |
| `npm run lint` | vert sous le plafond de warnings du dépôt |
| `npm run security:repo` | vert |
| `npm run sbom:runtime` | vert, CycloneDX 1.6 / 522 composants |
| tests unitaires globaux | 583 suites passées, 1 skipped ; 7143 tests passés, 4 skipped |
| intégration sans base locale | 7 suites / 109 tests verts ; 4 suites / 16 tests bloqués par `DATABASE_URL` absent |
| `npm run build` | vert, 144 pages statiques |
| mode fermé | page, API campagne et PDF publics non exposés ; Bilan accessible en lecture seule |
| candidat public contrôlé | vert, 5/5 E2E |
| QA navigateur | vert sur 390 / 768 / 1440 px |

Les suites d'intégration nécessitant PostgreSQL n'ont pas été forcées contre une
base non autorisée. Aucune écriture Bilan ou base de données n'a été effectuée.

## Cohérence métier permanente

Les assertions couvrent :

- 14 modules pédagogiques ;
- 70 séances modèles ;
- 17 cohortes ;
- 85 occurrences calendaires ;
- 5 séances et 10 h par matière pour l'élève ;
- 4 matières maximum ;
- aucune Physique-Chimie en Seconde ;
- SVT en Première et Terminale ;
- Maths expertes conditionnées à la spécialité Maths ;
- aucun itinéraire normal `LONG_IDLE` ou `SIMULTANEOUS` ;
- aucune séance après 18:30 ;
- troisième salle limitée au scope S5 et masquée publiquement ;
- aucune collision salle ou enseignant ;
- sept PDF publics ;
- aucun watermark `PUBLIC` ;
- aucun CTA contractuel ;
- calendrier social daté.

## Dependency Integrity

Le lockfile courant reste vulnérable via plusieurs chaînes de tooling qui
installent `brace-expansion <=5.0.7`. L'audit production-only est vert, mais
l'audit complet requis est rouge.

Une expérience isolée a testé les mises à jour officielles disponibles de
Jest, ESLint et du générateur SBOM. Elle réduit le nombre de vulnérabilités sans
les éliminer. ESLint 10 est en outre hors plage de peer dependency de
`eslint-config-next@15.5.20`. Aucun override incompatible, fork, patch tiers,
waiver ou baisse du seuil n'a été conservé.

Conclusion : `RELEASE BLOQUÉE PAR DEPENDENCY INTEGRITY`.

## Runbook et rollback

La recherche en lecture seule a trouvé :

- le guide générique public du dépôt ;
- un modèle de compte rendu ;
- des historiques anciens ;
- une ancienne branche de production déjà fusionnée.

Ces éléments ne constituent pas le runbook privé exigé pour cette release et
ne prouvent ni la cible actuelle, ni l'authentification, ni une bascule liée au
SHA, ni un rollback testé.

```text
PRIVATE_RUNBOOK_AVAILABLE=false
ROLLBACK_VALIDATED=false
PRE_DEPLOY_HEALTH_GREEN=not-run
```

## Décision

- `releaseStatus` reste `READY_FOR_OWNER_GO`.
- `publication_authorization` reste ouverte.
- aucun commit de GO, tag, merge ou déploiement n'est autorisé ;
- la PR finale doit rester Draft tant que Dependency Integrity n'est pas vert.

## Rollback

Aucun changement n'a été envoyé en production. Il n'y a donc rien à
rollbacker. La release précédente et son SHA n'ont pas été manipulés.
