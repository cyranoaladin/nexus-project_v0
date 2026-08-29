# Candidat individuel V1 Production Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrer le runtime candidat individuel V1 sur le baseline PR180, livrer un assistant staff en cinq etapes, verifier tous les invariants puis deployer une release production immuable.

**Architecture:** Snapshot controle des fichiers exclusifs depuis `e96fa67c2`, fusions hunk-par-hunk des fichiers partages sur le merge production `dc5a06b525`, sans merge historique. `dc5a06b525` et `origin/main` `9570ced0` ont le meme arbre `c0b3b726`; seul le premier conserve la filiation canonique requise. Le frontend compose les APIs existantes et n'effectue aucun calcul metier local. Le deploiement conserve Nginx, PM2 `nexus-prod`, le launcher, les symlinks et les stockages actuels.

**Tech Stack:** Node `v22.23.1`, Next.js 14, React, TypeScript, Prisma/PostgreSQL, Jest, Playwright, Docker E2E, PM2, Nginx.

---

## Chunk 1: Runtime V1 et securite

### Task 0: Figer les refs et le baseline

- [ ] Executer `git fetch --all --tags --prune`; si des tags locaux divergent, ne pas les forcer et fetcher les branches de chaque remote explicitement.
- [ ] Verifier les objets immuables `dc5a06b525`, `9570ced0`, `e96fa67c2`, `3037c439`, `feec4a427` et l'exclusion `35841bd3c`.
- [ ] Prouver que `dc5a06b525^{tree} == origin/main^{tree} == c0b3b726...` et que leur diff est vide.
- [ ] Verifier ancestry canonique et empreintes des blobs PR180 avant toute extraction.
- [ ] Utiliser Node `v22.23.1` pour tous les gates locaux.

### Task 1: Etablir les preuves RED du runtime

**Files:**
- Create from RC2 tests: `__tests__/architecture/t4-v1-release-freeze.test.ts`
- Create from RC2 tests: `__tests__/api/assistante.candidat-individuel.route.test.ts`
- Create from RC2 tests: `__tests__/lib/exams/*.test.ts`
- Create from RC2 tests: `__tests__/lib/quotes/*.test.ts`

- [ ] Extraire uniquement les tests candidat/reglementaires absents du baseline.
- [ ] Exclure explicitement `t3b1-options-mapping.test.ts`.
- [ ] Lancer les tests cibles et constater l'echec attendu par modules/routes absents.
- [ ] Consigner les erreurs RED sans modifier le moteur.

### Task 2: Transplanter les fichiers exclusifs

**Files:**
- Create: `lib/exams/{a-verifier,carte,catalog-client,emission-gate,normalize,options,parcours,profile-validation}.ts`
- Create: `lib/quotes/{candidat-individuel-api-schemas,candidat-individuel-guard.server,catalogue-schema,catalogue,emission-guard,pdf-adapter.server,pipeline-flag,pipeline,pricing-engine,profil-candidat.server,regulatory-maturity,shadow-comparison,shadow-persistence.server,warnings}.ts`
- Create: `app/api/assistante/candidat-individuel/**`
- Create: `app/api/quotes/public/[token]/pdf/route.ts`
- Create: `data/exams/bac-general-{2026,2028}.json`

- [ ] Extraire ces chemins depuis `e96fa67c2` sans toucher aux chemins PR180; tout blob repris depuis `feec4a427` doit etre prouve identique a RC2 et documente.
- [ ] Lancer les tests cibles et relever les dependances partagees encore manquantes.

### Task 3: Fusionner les contrats partages et Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260824090000_add_profil_candidat/migration.sql`
- Create: `prisma/migrations/20260824093000_add_parcours_type/migration.sql`
- Create: `prisma/migrations/20260825080000_add_quote_deposit_columns/migration.sql`
- Create: `prisma/migrations/20260825100000_add_profil_lot3_fields/migration.sql`
- Create: `prisma/migrations/20260826070000_add_dispenses_declarees/migration.sql`
- Create: `prisma/migrations/20260826080000_add_quote_regulatory_maturity/migration.sql`
- Create: `prisma/migrations/20260826090000_add_shadow_comparison_log/migration.sql`
- Create: `prisma/migrations/20260826100000_add_p3_eligibilite_audit/migration.sql`
- Create: `prisma/migrations/20260826110000_add_profil_candidat_review_revision/migration.sql`
- Create: `prisma/migrations/20260826162643_add_quote_payment_policy/migration.sql`
- Modify: `data/pricing.canonical.json`
- Modify: `data/pricing-client-data.generated.json`
- Modify: `data/exams/bac-general-2027.json`
- Modify: `lib/config/schemas.ts`
- Modify: `lib/exams/{catalog,schema}.ts`
- Modify: `lib/pricing.ts`
- Modify: `lib/quote/pdf.ts`
- Modify: `lib/quotes/{margin.server,pdf-adapter,persistence.server,public-view.server,pricing,recommendation,schemas,snapshot.server}.ts`
- Modify: `lib/rate-limit/sensitive.ts`
- Modify: routes/pages Quote partagees uniquement si requis par les tests.

- [ ] Ajouter seulement les enums, relations, modeles et colonnes candidat aux definitions actuelles.
- [ ] Fusionner catalogue, paiement D4, marge, hash/rotation, vue famille et PDF sans remplacer les correctifs `main`.
- [ ] Conserver le rejet des etats publics dans `lib/config/schemas.ts`.
- [ ] Regenerer les donnees pricing avec le script existant identifie dans le depot.
- [ ] Executer Prisma generate/validate et les tests cibles jusqu'au GREEN.
- [ ] Executer le gel V1 et les recettes R1/R2; refactorer uniquement apres GREEN.
- [ ] Verifier explicitement marge `<30` BLOCKED, `30-40` HUMAN_REVIEW_REQUIRED, `>=40` MARGIN_OK, cout `BLENDED_FALLBACK`/`BUSINESS_CONFIG`, remise max 20% non cumulative et marge apres remise.
- [ ] Verifier explicitement zero TND fail-closed, P3 bloque, `GROUP_PENDING`, effectifs 1/2 non groupe confirme, tous les deferred, identite obligatoire avant publication.
- [ ] Verifier hash-only, rotation/revocation, token aleatoire refuse, redaction famille et PDF humanise sans codes ni raisons internes.

## Chunk 2: Frontend staff final

### Task 4: Ecrire les tests RED du wizard staff

**Files:**
- Create: `__tests__/components/dashboard/assistante/CandidatIndividuelWorkspace.test.tsx`
- Modify: `e2e/auth/candidat-individuel-pipeline.spec.ts`
- Modify: `e2e/auth/candidat-individuel-a11y-keyboard.spec.ts`

- [ ] Tester cinq etapes, progression accessible, JSON replie et absence de codes techniques.
- [ ] Tester recherche/rattachement responsable et eleve sans ID manuel.
- [ ] Tester anti-stale apres modification d'un profil simule.
- [ ] Tester les effectifs 1, 2 et 4 et le rejet de vide, 0 et 2.5.
- [ ] Tester lifecycle brouillon, publication, lien, rotation, PDF et erreurs humanisees.
- [ ] Lancer les tests composant et constater le RED attendu.

### Task 5: Restaurer les handlers valides et composer l'UX

**Files:**
- Create/Modify: `components/dashboard/assistante/CandidatIndividuelWorkspace.tsx`
- Create/Modify: `app/dashboard/assistante/candidat-individuel/page.tsx`

- [ ] Restaurer depuis `feec4a427` les handlers/API pour identite, effectifs, devis, publication, lien et PDF.
- [ ] Ajouter stepper cinq etapes, rail resume responsive et `Options avancees` replie.
- [ ] Humaniser enums, gates et erreurs; garder les codes uniquement en avance staff.
- [ ] N'afficher que les actions possibles et expliquer chaque blocage en francais.
- [ ] Invalider toute simulation devenue stale; verrouiller ou reviser apres creation du devis.
- [ ] Executer les tests composant jusqu'au GREEN, puis refactorer sans modifier les payloads.

### Task 6: Validation visuelle locale

**Files:**
- Test: `e2e/auth/candidat-individuel-pipeline.spec.ts`
- Test: `e2e/auth/candidat-individuel-a11y-keyboard.spec.ts`

- [ ] Construire et lancer l'environnement E2E isole.
- [ ] Executer le parcours candidat complet, securite du lien, rotation et PDF.
- [ ] Capturer desktop, tablette et mobile dans les artefacts de test.
- [ ] Inspecter les captures avec `view_image` et corriger par un nouveau cycle RED/GREEN si necessaire.

## Chunk 3: Quality gates et revue

### Task 7: Executer les gates locaux complets

- [ ] `npm ci`.
- [ ] Verifier `node --version == v22.23.1` avant chaque gate.
- [ ] Prisma generate et validate avec environnement de validation non secret.
- [ ] `npm run typecheck`.
- [ ] `npm run lint`.
- [ ] Unitaires complets avec environnement de test documente.
- [ ] DB integration candidat sur PostgreSQL jetable.
- [ ] Gel V1 et tests PR180: acces authentifie, route officielle fail-closed, racine scanner absente/illisible/vide, detection par empreinte/contenu et sortie sans chemin sensible.
- [ ] Verifier que la CI PR180 et ses commandes restent presentes sans regression.
- [ ] Scanner source forbidden artifacts.
- [ ] `npm run build`.
- [ ] `npm run artifact:audit` et scanner de l'artefact standalone.
- [ ] E2E candidat complet et relever les comptes exacts.
- [ ] Faire relire spec puis qualite; corriger tout finding Critical/Important.
- [ ] Creer un commit d'integration propre et enregistrer son SHA exact comme `NEW_RELEASE_SHA`.

## Chunk 4: Production directe et rollback

### Task 8: Preflight et backup production

- [ ] Relever `OLD_RELEASE`, PM2, health, utilisateur enfant, migrations appliquees et espace disque sans lire l'env.
- [ ] Verifier localement et sur le serveur le runtime Node exact `v22.23.1`.
- [ ] Comparer les noms de migrations runtime/DB et calculer exactement les pending.
- [ ] Stopper si une migration est destructive, inattendue ou si le baseline est introuvable.
- [ ] Creer un dump custom timestamp dans le repertoire de backup persistant via les variables internes du conteneur.
- [ ] Verifier taille non nulle et `pg_restore --list`; consigner chemin, taille et timestamp.

### Task 9: Construire release immuable et migrer

- [ ] Creer `/var/www/nexus-releases/<sha>-candidat-v1-<timestamp>` sans modifier la release courante.
- [ ] Reproduire le packaging standalone attendu par le launcher, y compris `.next/standalone/server.js`, static, public et runtime embarque Node `v22.23.1` possede par `root:root` et lisible/executable par `nexusapp`.
- [ ] Executer `prisma migrate deploy` avec `/etc/nexus/nexus-prod.env` sans afficher de valeur.
- [ ] Verifier le nouveau compte de migrations.

### Task 10: Cutover, activation et smoke

- [ ] Basculer atomiquement `/var/www/nexus-project_v0` vers la nouvelle release.
- [ ] Redemarrer uniquement `pm2 restart nexus-prod`.
- [ ] Verifier que le child tourne sous `nexusapp`.
- [ ] Executer `nginx -t` sans reload si la configuration est inchangee.
- [ ] Pendant que le pipeline reste `OFF`, verifier health local/public, homepage, login, refus staff sans auth, token aleatoire 404 et absence de 500.
- [ ] Passer a `ACTIVE_INTERNAL` via API admin auditee si automatisable; sinon laisser `OFF` et consigner une seule action manuelle precise.
- [ ] Apres activation interne, executer le parcours staff synthetique profil -> simulation -> devis -> publication -> lien -> rotation -> famille -> PDF.
- [ ] Confirmer `ACTIVE_PUBLIC = NO`.
- [ ] Observer PM2/Nginx/app/DB et scanner les logs pour noms de secrets, tokens famille et URL tokenisees sans afficher leurs valeurs ou correspondances.
- [ ] En cas de P0/P1, repointer atomiquement vers `OLD_RELEASE`, redemarrer uniquement `nexus-prod` et refaire health/smoke.
- [ ] Ne restaurer la DB que sur incompatibilite reelle; avant restore, verifier `users_household_name_key_idx` et `nexus_household_name_key()`.

### Task 11: Rapport factuel

**Files:**
- Create: `docs/audits/candidat-individuel-production-release-2026-08-29.md`

- [ ] Consigner baseline, strategie, SHA, fichiers, comptes de tests, backup, migrations, releases, health, smoke, flag et rollback.
- [ ] Ne consigner aucun secret, token famille brut ni URL tokenisee.
