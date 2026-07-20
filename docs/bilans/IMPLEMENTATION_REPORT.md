# Rapport d'avancement — Session du 10 juillet 2026

## A. État initial

- Workspace confirmé : `/home/alaeddine/Projets/nexus-bilans-workspace`.
- Les six dépôts attendus sont présents, sur `main`, propres au départ.
- Dépôt canonique : `nexus-project_v0` à `db04d23f3e645a2052e41e5a679a8b9443cf8dc9`.
- Dépôts sources : Maths `50690efc…`, NSI bilan `1b6c749f…`, Maths Fixed `ef70bcc8…`, app spécification `8f029664…`, NSI cours `4b76c350…`.
- Aucune modification préexistante suivie par Git.
- Les sept fichiers d'audit attendus sont présents. Aucun fichier manquant.
- Le ZIP contient six fichiers strictement identiques aux versions extraites selon SHA-256.
- Le DOCX a été rendu temporairement en PDF pour contrôle : 25 pages ; le temporaire a été supprimé.

## B. Lecture du cahier des charges

- SHA-256 : `121fe7ad9bb0bd453a2e46ef69ba9bf18f694c7f7c4a7a12c0c443d7eb82ea85`.
- Lecture intégrale des 2 278 lignes et des sections 0 à 31.
- Contraintes critiques : cohorte/version programme, preuves par compétence, scoring déterministe, trois audiences, validation humaine, worker durable, stockage objet, ChromaDB, mineurs/RGPD, accessibilité, tests et critères d'acceptation.
- Ambiguïtés principales : machine d'état de revue des questions, persistance du registre, seuils/pondérations, fournisseur objet, rétention et gouvernance PromptPack.
- Décisions : dépôt canonique et migration sélective dans ADR-001 ; premier lot purement TypeScript/Zod sans Prisma.

## C. Audit des composants

Composants inspectés dans le code : routes Assessment et pallier2, scorers, définitions et mappings, renderers, worker/report stage, client RAG, schéma Prisma, parent/ownership, worker NSI BullMQ, ingestion pgvector, chaîne math-correction, portails Maths legacy, quiz/prompts NSI et spécifications par rôle.

- À porter : fallback déterministe, compilation LaTeX durcie.
- À refactorer : les deux moteurs de scoring, submit Assessment, définitions, worker NSI, pipeline report stage, client Chroma, rattachement famille.
- À archiver : portails statiques à matching email/nom, application prototype, quiz local hardcodé.
- Candidats RAG : programmes officiels vérifiés et guides Nexus/NSI après licence, checksum et revue.
- Rejetés RAG : rapports historiques/PII, code, prompts non validés, ingestion pgvector fixe et corpus à licence incertaine.

La décision détaillée de 31 composants est dans `COMPONENT_DECISIONS.csv`.

## D. Modifications réalisées

### Documentation

- Phase 0 : README, rapport de lecture, baseline dépôts/tests, inventaire, état actuel, décisions CSV, architecture cible, plan et ADR-001.
- Versionnement : `CURRICULUM_VERSIONING.md`.
- Avancement et limites : ce rapport et `KNOWN_LIMITATIONS.md`.
- `.gitignore` : exception ciblée pour rendre `docs/bilans/COMPONENT_DECISIONS.csv` livrable malgré la règle globale `*.csv`.

### Code

- Schémas Zod des années scolaires, niveaux, voies, variantes, sources et versions curriculum.
- Registre Maths minimal de huit versions : Troisième cycle 4, Seconde GT, Première spécialité et Terminale spécialité, anciennes/nouvelles périodes.
- Validation d'intégrité : IDs uniques et absence de chevauchement.
- Resolver déterministe préalable/cible avec erreurs `NO_MATCH` et `AMBIGUOUS_MATCH`.
- Quatre cas de cohorte couverts : Seconde/Première/Terminale 2026-2027 et Terminale 2027-2028.

### Non modifié

- Aucun modèle Prisma, migration, route API, worker, interface, banque de questions ou définition des quinze diagnostics.
- Aucun dépôt source, commit, push, déploiement ou base de données.

## E. Validation

### Référence avant implémentation

| Commande | Résultat | Détail |
|---|---|---|
| `npm ci` | succès | 1 194 paquets ; 24 vulnérabilités signalées. |
| `npx prisma validate` | échec environnement | `DATABASE_URL` absent. |
| `DATABASE_URL='postgresql://nexus_test:nexus_test@127.0.0.1:5432/nexus_test?schema=public' npx prisma validate` | succès | schéma valide, aucune connexion DB. |
| même préfixe + `npx prisma generate` | succès | client 6.19.2. |
| `npm run typecheck` | succès | 0 erreur, 35,53 s. |
| `npm run lint` | succès avec dette | warnings préexistants. |
| `npm test -- --runInBand` | succès | 513 suites, 6 415 tests, 4 ignorés, 7 snapshots. |
| `npm run test:integration -- --runInBand` | échec environnement | 4 suites/16 tests échouent sans DB ; 7 suites/109 tests passent. |
| `npm run build` | succès | 143 pages, 135,48 s. |
| `npm run security:repo` | succès | aucune clé privée détectée. |
| `npm audit --json` | dette | 3 faibles, 9 modérées, 12 élevées, 0 critique. |

### TDD et vérification après implémentation

| Commande | Résultat | Détail |
|---|---|---|
| `npm test -- --runInBand __tests__/lib/curriculum/schemas.test.ts` avant code | échec attendu | module absent. |
| même commande après code | succès | 6/6. |
| `npm test -- --runInBand __tests__/lib/curriculum/registry.test.ts` avant code | échec attendu | module absent. |
| même commande après code | succès | 3/3. |
| `npm test -- --runInBand __tests__/lib/curriculum/version-resolution.test.ts` avant code | échec attendu | module absent. |
| même commande avec test ambiguïté avant garde | échec attendu | aucune erreur levée. |
| `npm test -- --runInBand __tests__/lib/curriculum` | succès | 3 suites, 15 tests. |
| `npx eslint lib/curriculum __tests__/lib/curriculum --max-warnings 0` | succès | 0 warning, 1,49 s. |
| `npm run typecheck` | succès | 0 erreur, 39,45 s. |
| `npm test -- --runInBand --silent` | succès | 516 suites, 6 430 tests, 4 ignorés, 7 snapshots ; 61,94 s. |
| `npm run lint` avec comptage | succès | 296 warnings globaux préexistants, sous le seuil 300. |
| `npm run build` | succès | compilation, types, 143 pages, standalone ; 116,81 s. |
| `git diff --check` | succès | aucune erreur d'espace. |

Limites : l'intégration DB et l'E2E n'ont pas été relancés faute d'environnement éphémère configuré. Aucun test ne prétend couvrir une persistance qui n'existe pas dans cette tranche.

## F. État pédagogique

Aucun des quinze diagnostics demandés n'a été commencé ou publié pendant cette session. Il n'existe donc aucun nombre de questions, couverture ou validation à déclarer pour ces diagnostics.

Le registre Maths couvre uniquement les métadonnées de programme nécessaires aux transitions suivantes :

- entrée en Seconde 2026-2027 ;
- entrée en Première spécialité Maths 2026-2027 ;
- entrée en Terminale spécialité Maths 2026-2027 ;
- entrée en Terminale spécialité Maths 2027-2028.

Aucune matrice de domaines/notions/compétences n'a été produite. Les mappings existants et futures banques restent à valider humainement. Les variantes enseignement scientifique, complémentaires et expertes ne sont pas enregistrées dans cette tranche.

## G. État de sécurité

- Aucun nouveau point d'entrée, accès DB, stockage, journal ou traitement de PII.
- Le resolver est pur, sans secret ni données individuelles.
- Aucune donnée élève n'a été copiée depuis les dépôts sources.
- Les cinq dépôts sources sont restés propres.
- Risques ouverts : Assessment public/ownership, lien multi-parent, publication par audience, IDOR futur, URLs objet signées, rétention, historique PII, fire-and-forget et logs legacy.
- Le contrôle de dépôt trouve zéro clé privée ; `npm audit` reste à traiter avec 24 vulnérabilités.

## H. Prochaines actions

### P0 avant poursuite

1. Archiver localement les sources officielles, calculer checksums et ajouter un statut de revue Nexus distinct du statut de publication officielle.
2. Ajouter les variantes Maths manquantes et les matières restantes avec validation des métadonnées.
3. Configurer PostgreSQL éphémère et rendre les tests d'intégration explicites/skip-safe sans `DATABASE_URL`.
4. ADR de convergence `Assessment`/`Diagnostic`/`Bilan` et ADR famille multi-responsables.
5. Concevoir le worker BullMQ avant de modifier la route submit.

### P1 avant pilote

1. Lien parent-enfant et tests IDOR réels.
2. Contrat universel, SkillEvidence et ScoreSnapshot.
3. Worker durable, trois rapports, revue/publication et stockage objet.
4. Manifeste RAG ChromaDB avec licences/checksums et citations.
5. Définitions initiales en statut de revue.

### P2 avant production

1. Banques validées par référents, golden set et étalonnage des seuils.
2. E2E multi-rôles, indisponibilités et accessibilité.
3. Politique RGPD de rétention/purge/export, sauvegarde et runbooks.
4. Traitement des vulnérabilités npm et réduction de la dette lint/logs.

### P3 amélioration

1. Imports historiques anonymisés après audit juridique.
2. Statistiques de groupe et psychométrie étalonnée.
3. Consolidation des renderers PDF après mesure opérationnelle.

## Déploiement et rollback

Aucun déploiement n'est requis ou autorisé. Le lot est non branché au runtime. Son rollback consiste à retirer `lib/curriculum`, ses tests et sa documentation ; aucune migration ni donnée ne serait affectée.
