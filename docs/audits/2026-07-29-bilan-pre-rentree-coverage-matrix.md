# Matrice de couverture — bilans et pré-rentrée

## Date

2026-07-29

## Légende

- **INTÉGRÉ ET TESTÉ** : raccordement effectif avec tests.
- **PRÉSENT MAIS NON RACCORDÉ** : fondation existante, sans flux bout en bout.
- **CONTRAT PRÉPARÉ** : interface et invariants testés, moteur reporté.
- **VALIDATION HUMAINE REQUISE** : blocage éditorial volontaire.
- **HORS PÉRIMÈTRE DU LOT SUIVANT** : capacité non nécessaire au moteur
  tests/bilans immédiat.
- **BLOQUÉ** : dépendance absente ; aucun fallback autorisé.

## Couverture

| Capacité | Statut | Localisation | Preuve actuelle | Prochain critère d'acceptation | Priorité |
|---|---|---|---|---|---|
| Intake parent/enfant/demande idempotent | INTÉGRÉ ET TESTÉ | `app/api/bilan-gratuit/v1`, `lib/bilans/requests` | unités + PostgreSQL réel, concurrence et rollback outbox | smoke interne avec Redis et SMTP configurés | P0 activation |
| Réponse publique anti-énumération | INTÉGRÉ ET TESTÉ | route v1 et création de demande | mêmes réponses pour compte connu/inconnu | test de production interne sans PII | P0 activation |
| Authentification parent et lien magique unique | INTÉGRÉ ET TESTÉ | `auth.ts`, `lib/bilans/auth`, page magic | expiration, révocation, rejeu et consommation concurrente | smoke SMTP interne | P0 activation |
| Autorisation parent/enfant/demande et IDOR | INTÉGRÉ ET TESTÉ | `lib/bilans/requests/access.ts`, routes `current` | scénarios parent A/parent B | pentest ciblé en staging | P0 activation |
| Rate limiting distribué fail-closed | INTÉGRÉ ET TESTÉ | `lib/rate-limit`, route v1 | Redis/Upstash indisponible → refus | backend réel configuré et test 503 | P0 activation |
| Transaction métier + outbox | INTÉGRÉ ET TESTÉ | `create-request.ts`, migration | rollback forcé et déduplication | worker/monitoring d'outbox opérationnel | P0 activation |
| Schéma et migration des demandes | INTÉGRÉ ET TESTÉ | Prisma + migration 20260729 | fresh deploy + upgrade préservant les lignes | preflight puis `migrate deploy` autorisé | P0 activation |
| CI E2E avec rate limiting distribué | INTÉGRÉ ET TESTÉ | job `e2e` de `.github/workflows/ci.yml` | Redis sain, réponse bilan générique et 169 tests Playwright locaux | run GitHub vert sur la tête finale | P0 merge |
| Décision d'exception de dépendance liée au SHA | BLOQUÉ | secret GitHub + politique d'exception pré-rentrée | le validateur refuse l'ancien secret avec `BOUND_SHA_MISMATCH` | approuver une décision liée au SHA final, ou corriger la dépendance sans exception | P0 merge externe |
| Catalogue serveur canonique | INTÉGRÉ ET TESTÉ | `lib/pre-rentree/pedagogy` | schémas, relations, hashes et IDs | conserver comme seul import applicatif | acquis |
| Catalogue bilan par défaut | INTÉGRÉ ET TESTÉ | `lib/bilans/catalog/service.ts` | 17 packs dérivés, tous non publiés | aucun adaptateur pédagogique concurrent | acquis |
| 17 modules et 85 séances | INTÉGRÉ ET TESTÉ | `modules.json`, manifeste, kits | validateurs et hash reproductible | validation humaine module par module | éditorial |
| Provenance immuable des tentatives | PRÉSENT MAIS NON RACCORDÉ | `CanonicalAssessmentAttempt` | champs ID/version/checksum et contraintes DB | écrire ces quatre valeurs lors de l'affectation, puis relire par `assertAssessmentRef` | P0 lot moteur |
| Affectation d'un test | CONTRAT PRÉPARÉ | `getAssessment(..., 'ASSIGNMENT')` | refus de tout statut non assignable | service transactionnel d'affectation + modèle décidé + IDOR | P0 lot moteur |
| Brouillon, autosave et reprise de tentative | PRÉSENT MAIS NON RACCORDÉ | fondation tentative + session bilan | aucune chaîne avec le corpus | API autosave idempotente et tests de concurrence | P0 lot moteur |
| Soumission de réponses | CONTRAT PRÉPARÉ | `AssessmentDefinition`, items stables | 408 IDs validés | persistance atomique des réponses scellées avec la référence | P0 lot moteur |
| Correction manuelle | CONTRAT PRÉPARÉ | `manual-grading.ts` | 33 réponses détectées ; statut d'attente testé | persistance review/reviewer/date/points + IDOR coach | P0 lot moteur |
| Score définitif | CONTRAT PRÉPARÉ | `assertFinalizationAllowed` | bloqué si correction manquante | moteur de score versionné, snapshot immuable, aucune réponse en attente | P0 lot moteur |
| Calibrage définitif du groupe | CONTRAT PRÉPARÉ | même garde | opération explicitement bloquée | politique versionnée et testée après correction | P1 lot moteur |
| Génération du bilan final | PRÉSENT MAIS NON RACCORDÉ | artefacts/revisions canoniques | chaîne DB existante, pas de flux corpus | générer uniquement depuis score complet et provenance scellée | P1 lot moteur |
| Publication parent/élève | CONTRAT PRÉPARÉ | audiences Prisma + garde publication | audience et révision protégées | review coach, audience, consentement et contenu approuvé | P1 lot moteur |
| Validation des 17 CPS | VALIDATION HUMAINE REQUISE | manifeste et gouvernance | statut global et module = `HUMAN_VALIDATION_REQUIRED` | responsable pédagogique + enseignant + date + nouveau hash | bloquant éditorial |
| Physique-Chimie Seconde | BLOQUÉ | absent de `modules.json` | lookup refusé et invariant explicite | cinq séances, CPS, manifeste, hashes et validation humaine | pas d'implémentation |
| Notifications équipe temps réel | HORS PÉRIMÈTRE DU LOT SUIVANT | flag `BILAN_TEAM_REALTIME_ENABLED` | flag désactivé | architecture/consentement/monitoring dédiés | P2 ultérieur |
| Enrichissement LLM | HORS PÉRIMÈTRE DU LOT SUIVANT | flag `BILAN_LLM_ENRICHMENT_ENABLED` | flag désactivé | politique de données mineurs, évaluation et fallback humain | P2 ultérieur |
| Publication directe du corpus | BLOQUÉ | aucune route publique, aucun fichier `public/` | hygiène Git + trace serveur seulement | API autorisée avec DTO minimal et statut approuvé | interdit actuellement |

## Lot suivant recommandé

Implémenter le moteur de tests et bilans sur les contrats canoniques :

1. modèle d'affectation/tentative/réponse/correction décidé par migration ;
2. référence immuable écrite à l'affectation ;
3. autosave et soumission idempotents ;
4. file de correction manuelle et autorisation coach ;
5. scoring versionné seulement lorsque toutes les corrections sont présentes ;
6. snapshots, calibrage, révision et publication par audience ;
7. tests IDOR, concurrence, reprise, migration et audit historique.

Le lot est accepté lorsque le test d'intégration bout en bout prouve qu'une
réponse courte en attente ne produit ni score définitif, ni groupe définitif,
ni bilan final.
