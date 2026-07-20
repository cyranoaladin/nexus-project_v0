# Système unifié de bilans — Plan d'implémentation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** livrer progressivement un diagnostic d'entrée versionné, déterministe, sécurisé et publiable pour trois audiences dans l'application Nexus existante.

**Architecture:** contrats TypeScript/Zod purs d'abord, persistance Prisma additive après ADR, adaptation des moteurs legacy, puis worker BullMQ et publication par audience. ChromaDB reste canonique et toute génération LLM est optionnelle, structurée et subordonnée aux preuves déterministes.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Zod, Prisma 6/PostgreSQL, Jest, Playwright, BullMQ/Redis, ChromaDB/FastAPI, S3/MinIO compatible.

---

## Contraintes d'exécution

- Aucun commit ou push sans instruction explicite ; les étapes « commit » habituelles sont remplacées par un checkpoint Git documenté.
- Aucun changement dans les cinq dépôts sources.
- Aucune migration destructive, `db push`, seed ou base de production.
- Toute matrice pédagogique et toute question exigent une source officielle et une validation humaine.
- Statuts : `À FAIRE`, `EN COURS`, `BLOQUÉ VALIDATION`, `PARTIEL`, `TERMINÉ`.

## Lot 1 — Audit reproductible

**Statut :** TERMINÉ pour la phase documentaire initiale ; recontrôle final à faire.

- Objectif : figer sources, Git, code effectif, qualité et décisions de reprise.
- Exigences : sections 3 à 5, 25, 29 et livrables d'audit.
- Fichiers existants : six dépôts, `Cahier_charges.md`, `nexus_bilans_audit/*`, règles internes.
- Fichiers créés : `docs/bilans/{README,CAHIER_DES_CHARGES_READING_REPORT,BASELINE_REPOSITORIES,BASELINE_TESTS,REPOSITORY_INVENTORY,CURRENT_STATE,COMPONENT_DECISIONS,TARGET_ARCHITECTURE,IMPLEMENTATION_PLAN}.md|csv`, ADR-001.
- Migration : aucune.
- Risques : omission d'un composant, confusion documentation/code, PII historique.
- Dépendances : aucune.
- Tests : états Git, empreintes, installation, Prisma validate/generate, typecheck, lint, Jest, build, sécurité repo.
- Critère de sortie : chaque dépôt et composant prioritaire possède une preuve et une décision ; sources inchangées.
- Rollback : supprimer uniquement les nouveaux documents du dépôt canonique ; aucun impact runtime.

## Lot 2 — Registre versionné des programmes

**Statut :** PARTIEL — première tranche TypeScript/Zod terminée et non branchée au runtime ; persistance et autres matières à faire.

- Objectif : résoudre sans ambiguïté programme préalable et cible par cohorte.
- Exigences : sections 6, 7, 19, tests de versionnement et cas 2026-2027.
- Fichiers existants : `programmes/mapping/*`, `lib/programme/official-pdfs.ts`, définitions diagnostics.
- Fichiers à créer : `lib/curriculum/schemas/curriculum.ts`, `lib/curriculum/registry/math.ts`, `lib/curriculum/registry/index.ts`, `lib/curriculum/version-resolution/resolve-curriculum-context.ts`, tests sous `__tests__/lib/curriculum/`.
- Migration : aucune dans la tranche 1 ; ADR puis modèles Prisma additifs dans tranche 2.
- Risques : dates d'effet erronées, versions qui se chevauchent, confusion niveau suivi/cible.
- Dépendances : sources MEN/Éduscol vérifiées et référents matière.
- Tests : Zod, plage d'effet, unicité ID, aucune ambiguïté, trois cohortes Maths 2026-2027, Terminale 2027-2028, variante inconnue.
- Critère de sortie : resolver pur reproductible, erreurs explicites, aucune notion inventée ; métadonnées officielles tracées.
- Rollback : retirer les exports du module ; aucun schéma/DB modifié.

### Task 2.1 — Contrats curriculum

- [x] Écrire les tests échouant pour validation de version, année scolaire et périodes.
- [x] Exécuter `npm test -- --runInBand __tests__/lib/curriculum/schemas.test.ts` et constater l'échec dû au module absent.
- [x] Implémenter les schémas Zod minimaux et types dérivés.
- [x] Réexécuter le test ciblé jusqu'au vert.

### Task 2.2 — Registre Maths officiel minimal

- [x] Écrire les tests d'unicité, provenance officielle et non-chevauchement par variante.
- [x] Vérifier l'échec avant implémentation.
- [x] Ajouter uniquement les métadonnées de versions 2019/2020 et 2026 dont les dates sont confirmées par le MEN/Éduscol ; aucun domaine/notion.
- [x] Vérifier les tests.

### Task 2.3 — Resolver de cohorte

- [x] Écrire les tests des entrées Seconde, Première, Terminale 2026-2027 et Terminale 2027-2028.
- [x] Vérifier l'échec parce que le resolver n'existe pas.
- [x] Implémenter sélection exacte préalable/cible et erreurs `NO_MATCH`/`AMBIGUOUS_MATCH`.
- [x] Exécuter tests ciblés et typecheck ; suite complète à vérifier au checkpoint final.
- [x] Checkpoint Git sans commit et mise à jour de ce statut.

## Lot 3 — Rattachement élève-parent et permissions

**Statut :** À FAIRE — BLOQUÉ VALIDATION avant changement Prisma/RBAC.

- Objectif : plusieurs responsables légaux, invitation, vérification, révocation et permissions.
- Exigences : sections 11, 12, 21 et critères 2/3/12/13.
- Fichiers existants : `ParentProfile`, `Student`, routes parent, `lib/rbac`, tests IDOR.
- Fichiers à créer/modifier : ADR-002, migration additive `StudentParentLink`, services `lib/family/parent-link` et `permissions`, routes d'invitation/vérification.
- Migration : additive, backfill du parent direct, aucune suppression.
- Risques : verrouillage de comptes, IDOR, divulgation de données mineur.
- Dépendances : décision métier sur permissions et preuve du lien.
- Tests : propriété parent non lié refusé, révocation immédiate, plusieurs parents/enfants, falsification `studentId`, audit sans PII.
- Critère de sortie : ownership serveur centralisé et tests DB éphémères verts.
- Rollback : feature flag, maintien relation legacy en lecture, désactivation nouvelles routes.

## Lot 4 — Moteur universel de diagnostics

**Statut :** À FAIRE.

- Objectif : contrat unique AssessmentDefinition/Attempt/Response sans casser les flux legacy.
- Exigences : sections 8, 9, 18, 19 et définition extensible.
- Fichiers concernés : `lib/assessments/*`, `lib/diagnostics/*`, routes Assessment et pallier2.
- Fichiers à créer : schémas canoniques, catalogue data-driven, adaptateurs legacy.
- Migration : champs version/checksum/context additifs après ADR de convergence.
- Risques : divergence snapshots, fuite des réponses, rupture routes existantes.
- Dépendances : lot 2 et ADR modèle canonique.
- Tests : validation question/definition, loader serveur-only, compatibilité huit définitions legacy, catalogue filtré.
- Critère de sortie : une définition ajoutable sans nouveau moteur ni route par matière.
- Rollback : adaptateurs/feature flag, routes legacy inchangées.

## Lot 5 — Preuves et scoring déterministe

**Statut :** À FAIRE.

- Objectif : fusionner les scorers autour de SkillEvidence et ScoreSnapshot immuables.
- Exigences : sections 13, 14, 16, tests unitaires/propriétés/snapshots.
- Fichiers concernés : `score-diagnostic.ts`, `lib/assessments/scoring/*`, `DomainScore`, `SkillScore`.
- Fichiers à créer : `lib/diagnostics/scoring`, `evidence`, `inconsistencies`, `recommendations`.
- Migration : tables/champs additifs pour preuves et snapshots.
- Risques : changement de score, biais, seuils non étalonnés.
- Dépendances : lots 2 et 4, validation pédagogique des règles.
- Tests : bornes 0-100, monotonicité, NOT_STUDIED sans pénalité, couverture, confiance distincte, golden profiles.
- Critère de sortie : reproductibilité bit-à-bit avec versions et explication de chaque indice.
- Rollback : conserver scorer legacy et comparer les deux sorties sans publier la nouvelle.

## Lot 6 — Interface de questionnaire

**Statut :** À FAIRE.

- Objectif : catalogue, démarrage, autosave, reprise, soumission et accessibilité.
- Exigences : sections 8.2, 20, 22.
- Fichiers concernés : dashboards élève, pages questionnaire legacy, API Assessment.
- Fichiers à créer : composants génériques par type, routes attempt/save/submit, section dashboard.
- Migration : tentative/réponse si non couverte au lot 4.
- Risques : réponse correcte exposée, perte autosave, chronométrage discriminant.
- Dépendances : lots 3 à 5.
- Tests : clavier, mobile, pause/reprise, autosave idempotent, temps additionnel, réponses privées, E2E élève.
- Critère de sortie : parcours interrompu/repris et score disponible après soumission.
- Rollback : feature flag catalogue et maintien pages legacy.

## Lot 7 — Worker durable

**Statut :** À FAIRE.

- Objectif : supprimer les traitements critiques fire-and-forget.
- Exigences : sections 18.3 et principe non négociable worker.
- Fichiers concernés : route submit, `BilanGenerator`, `lib/reports/stage`, worker source NSI en lecture.
- Fichiers à créer : `workers/reports/*`, queue config, DLQ, métriques, commande worker.
- Migration : ReportJob ou adaptation additive du modèle existant.
- Risques : double traitement, job perdu, logs PII, dépendance Redis.
- Dépendances : lots 4/5 et ADR worker.
- Tests : restart, retry, backoff fake timers, lock, checksum, concurrence, DLQ, LLM indisponible.
- Critère de sortie : aucune génération critique lancée sans persistance ; score disponible indépendamment.
- Rollback : consommation worker désactivable, jobs conservés, fallback déterministe synchrone court seulement.

## Lot 8 — Bilans multi-audiences

**Statut :** À FAIRE.

- Objectif : contrats et rendus élève, parent et Nexus avec preuves.
- Exigences : sections 15/16 et critères 10-13.
- Fichiers concernés : bilan-renderer, generators, stage schema, composants bilan.
- Fichiers à créer : `lib/reports/schemas`, context, generators, renderers.
- Migration : DiagnosticReport/ReportVersion additifs après ADR.
- Risques : faits inventés, verbatims privés, mélange audience.
- Dépendances : lots 5 et 7.
- Tests : preuves référencées, aucune compétence absente, ton audience, fallback, snapshots.
- Critère de sortie : trois artefacts cohérents, score identique, contenu interdit absent.
- Rollback : rendre uniquement le fallback déterministe versionné.

## Lot 9 — Revue et publication

**Statut :** À FAIRE.

- Objectif : validation humaine, historique, publication et régénération non destructive.
- Exigences : sections 15.4, 20.3, 23.
- Fichiers concernés : panel coach, routes generated reports, modèles Bilan/Report.
- Fichiers à créer : HumanReview, ReportPublication, journal audit et UI revue.
- Migration : additive.
- Risques : auto-publication, écrasement d'une version validée, IDOR.
- Dépendances : lots 3 et 8.
- Tests : parent avant/après publication, Nexus toujours interdit, régénération conserve version validée, audit modification.
- Critère de sortie : aucun rapport parent sans revue initiale et publication explicite.
- Rollback : révoquer publication, conserver versions/audit.

## Lot 10 — RAG et citations

**Statut :** À FAIRE.

- Objectif : manifeste gouverné, ingestion ChromaDB, retrieval filtré et citations.
- Exigences : sections 6, 17 et critères 15/16.
- Fichiers concernés : `lib/rag-client.ts`, service externe documenté, ressources sources.
- Fichiers à créer : schéma manifeste, validateur, client citations, politiques, fixtures retrieval.
- Migration : métadonnées de sources/chunks si stockées transactionnellement.
- Risques : licence, obsolescence, PII, double source de vérité.
- Dépendances : lot 2 et validation juridique/pédagogique.
- Tests : refus non approuvé, checksum, filtres curriculum, citation source/chunk existants, panne Chroma.
- Critère de sortie : aucun document sans APPROVED et aucune PII dans collection globale.
- Rollback : désactiver collection/version par manifeste ; fallback sans RAG.

## Lot 11 — Premières définitions de diagnostics

**Statut :** À FAIRE.

- Objectif : créer les quinze définitions demandées sans banque publiée.
- Exigences : section 24 et périmètre disciplinaire.
- Fichiers à créer : packs versionnés sous `data/diagnostics/definitions/review/`.
- Migration : import idempotent éventuel.
- Risques : programme incorrect, mauvais intitulé SNT/Français Terminale.
- Dépendances : lots 2/4/10 et référents matière.
- Tests : schéma, IDs, programmes préalable/cible, durée, audiences, revue humaine requise.
- Critère de sortie : quinze définitions validables, toutes en DRAFT/REVIEW.
- Rollback : retirer du catalogue sans supprimer historique.

## Lot 12 — Banques de questions en revue pédagogique

**Statut :** À FAIRE.

- Objectif : exemples représentatifs, jamais publiés automatiquement.
- Exigences : sections 9, 10, 23, 26.
- Fichiers à créer : banques review, fiches de validation, validator CLI.
- Migration : Question/QuestionVersion additive ou import dry-run.
- Risques : erreurs, biais, droits, exposition answers/tests.
- Dépendances : lot 11 et enseignants référents.
- Tests : statut forcé review, conformité IDs, barème, assets/licence, payload client expurgé.
- Critère de sortie : validation technique complète et liste explicite des validations humaines restantes.
- Rollback : ne pas importer/publier ; archiver version rejetée.

## Lot 13 — Tests de pilote

**Statut :** À FAIRE.

- Objectif : golden set et parcours contrôlés multi-rôles.
- Exigences : sections 26, 27 et phase 9.
- Fichiers à créer : fixtures profils, E2E, tests propriétés, scripts environnement éphémère.
- Migration : seed de test uniquement.
- Risques : données réelles, tests flaky, seuils non étalonnés.
- Dépendances : lots 3 à 12.
- Tests : nominal, interruption, RAG/LLM/PDF KO, aménagement, parent incorrect, IDOR, profils de référence.
- Critère de sortie : résultats revus par enseignants et sécurité, aucun P0 ouvert.
- Rollback : désactiver feature flag pilote et supprimer données de test éphémères.

## Lot 14 — Documentation d'exploitation

**Statut :** À FAIRE.

- Objectif : rendre ajout matière, exploitation worker, incident et purge reproductibles.
- Exigences : section 28 et livrables d'exploitation.
- Fichiers à créer : runbooks worker/RAG/PDF, sécurité/RGPD, ajout matière, backup/restore, incident/DLQ.
- Migration : aucune.
- Risques : documentation divergente du runtime.
- Dépendances : tous lots techniques.
- Tests : commandes de smoke en staging, revue croisée, liens et exemples vérifiés.
- Critère de sortie : un mainteneur peut ajouter une matière sans dupliquer le moteur et restaurer un service en échec.
- Rollback : versionner la documentation avec chaque contrat ; ne jamais masquer une ancienne procédure sans changelog.

## Priorités immédiates

- P0 : terminer lot 2 tranche pure, configurer une DB de test éphémère, ADR famille et convergence des modèles, concevoir worker durable.
- P1 avant pilote : lots 3 à 10, premières définitions validées, sécurité/IDOR et stockage objet.
- P2 avant production : quinze banques revues, tests E2E complets, rétention RGPD, observabilité et runbooks.
- P3 : migration des exemples historiques anonymisés, visualisations de groupe et optimisation psychométrique.
