# NPC Storage Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le stockage NPC persistant et fail-closed, empêcher toute finalisation sans pièces intègres, fermer la fuite `COACH_ONLY` et livrer une commande auditée de tombstone sans toucher la production.

**Architecture:** `NPC_STORAGE_ROOT` est résolue par un module serveur unique appelé par Next.js, le worker et toutes les opérations fichiers. Un verrou transactionnel commun sérialise avec les mutations de pièces, les transitions worker et la future commande de tombstone. Le schéma est uniquement étendu; le tombstone métier est une commande paramétrée séparée, prouvée sur PostgreSQL 15 jetable.

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL 15, Jest/Testing Library, Docker Compose, Node.js crypto/fs.

---

## Chunk 1: stockage canonique et schéma additif

### Task 1: Migration additive et contrat d'architecture

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260811140000_add_npc_unavailable_integrity/migration.sql`
- Create: `__tests__/architecture/npc-storage-contract.test.ts`
- Modify: `docker-compose.npc.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.e2e.yml`
- Modify: `services/npc-worker/Dockerfile`

- [ ] **Step 1: Écrire les tests rouges du schéma et des configurations actives**

Vérifier que les deux enums contiennent `UNAVAILABLE`, que les deux modèles portent `unavailableReason/unavailableAt`, que `CopyPage.sha256` est nullable, que la migration ne contient ni `UPDATE` ni identifiant CUID, et que le code/config actifs ne contiennent plus `NPC_UPLOAD_DIR`, `UPLOAD_DIR`, `process.cwd()` comme stockage NPC ou chemin NPC concret.

- [ ] **Step 2: Prouver le rouge**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/architecture/npc-storage-contract.test.ts`

Expected: FAIL sur les enums/champs et anciennes variables.

- [ ] **Step 3: Ajouter uniquement le DDL additif**

Le SQL ajoute les valeurs d'enum, les cinq colonnes nullables et une contrainte `CHECK` acceptant `NULL` ou 64 caractères hexadécimaux. Aucun DML, aucun backfill, aucun identifiant métier.

- [ ] **Step 4: Aligner les configurations sur la variable unique**

Les Compose NPC/prod exigent `${NPC_STORAGE_ROOT:?NPC_STORAGE_ROOT is required}`
et montent cette racine persistante. Le stack E2E fournit une racine nommée
jetable, montée hors des répertoires de release simulés, et force
`NPC_LLM_MODE=off`; son teardown supprime le volume. Le Dockerfile du worker ne
crée ni ne déclare de repli NPC dans l'image.

- [ ] **Step 5: Régénérer Prisma et prouver le vert ciblé**

Run: `npx npm@10.9.8 exec prisma generate && npx npm@10.9.8 test -- --runInBand __tests__/architecture/npc-storage-contract.test.ts`

Expected: PASS, et `git diff -- prisma/migrations/20260811140000_add_npc_unavailable_integrity/migration.sql` ne montre que du DDL additif.

- [ ] **Step 6: Commit**

```bash
git add prisma docker-compose.npc.yml docker-compose.prod.yml docker-compose.e2e.yml services/npc-worker/Dockerfile __tests__/architecture/npc-storage-contract.test.ts
git commit -m "feat(npc): add unavailable integrity schema"
```

### Task 2: Racine canonique fail-closed et persistance inter-release

**Files:**
- Create: `lib/npc/storage-root.ts`
- Modify: `lib/npc/config.ts`
- Modify: `lib/npc/storage.ts`
- Modify: `lib/npc/pdf-converter.ts`
- Modify: `lib/npc/index.ts`
- Modify: `instrumentation.ts`
- Modify: `services/npc-worker/index.ts`
- Rewrite: `__tests__/npc/storage.test.ts`
- Create: `__tests__/npc/storage-root.test.ts`
- Create: `__tests__/npc/storage-persistence.test.ts`
- Create: `__tests__/architecture/npc-startup-storage-guard.test.ts`

- [ ] **Step 1: Écrire les tests rouges de résolution, démarrage et persistance**

Couvrir variable absente/relative, racine inexistante, racine symlink, racine dans la release, droits insuffisants selon capacité `read-write`/`read-only`, traversée et parent symlink. Scanner les points d'entrée pour imposer le garde avant le service Next ou la boucle worker.

Créer aussi le test inter-release avec `shared/`, `release-a/` et `release-b/` :
écriture depuis A, changement de `cwd`, relecture depuis B, puis comparaison
octets/taille/SHA-256. Il doit échouer tant que le stockage dépend de `cwd`.

- [ ] **Step 2: Prouver le rouge**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/npc/storage-root.test.ts __tests__/npc/storage-persistence.test.ts __tests__/architecture/npc-startup-storage-guard.test.ts`

Expected: FAIL car `storage-root.ts`, les appels de garde et la persistance
indépendante de `cwd` n'existent pas.

- [ ] **Step 3: Implémenter le module focalisé**

Exposer :

```ts
type StorageCapability = 'read-only' | 'read-write';
export function resolveNpcStorageRoot(env?: NodeJS.ProcessEnv): string;
export function assertNpcStorageReady(options: {
  capability: StorageCapability;
  releaseRoot?: string;
  env?: NodeJS.ProcessEnv;
}): string;
export async function resolveNpcStoragePath(relativePath: string): Promise<string>;
```

Utiliser `realpath`, `lstat`, `access` et une comparaison par segments; ne jamais créer la racine. Les opérations fichiers ne construisent plus elles-mêmes un chemin absolu.

- [ ] **Step 4: Brancher app, worker, stockage et conversion**

Next exige `read-write`; worker exige `read-only`. `storage.ts` renvoie aussi `sha256` calculé sur les octets écrits. `pdf-converter.ts` utilise exclusivement le résolveur sûr.

- [ ] **Step 5: Réexécuter la preuve inter-release et les gardes**

Le test déjà rouge doit maintenant survivre au changement de release et rester
indépendant du répertoire courant.

Run: `npx npm@10.9.8 test -- --runInBand __tests__/npc/storage-root.test.ts __tests__/npc/storage.test.ts __tests__/npc/storage-persistence.test.ts __tests__/architecture/npc-startup-storage-guard.test.ts`

Expected: PASS, sans skip.

- [ ] **Step 6: Commit**

```bash
git add lib/npc instrumentation.ts services/npc-worker/index.ts __tests__/npc __tests__/architecture/npc-startup-storage-guard.test.ts
git commit -m "feat(npc): enforce persistent storage root"
```

## Chunk 2: intégrité, verrou commun et mutations terminales

### Task 3: Verrou transactionnel commun et intégrité des pièces

**Files:**
- Create: `lib/npc/submission-lock.ts`
- Create: `lib/npc/submission-integrity.ts`
- Create: `lib/npc/unavailable.ts`
- Modify: `app/api/npc/submissions/[submissionId]/documents/route.ts`
- Modify: `app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts`
- Modify: `app/api/npc/submissions/[submissionId]/generate/route.ts`
- Modify: `app/api/npc/uploads/route.ts`
- Modify: `services/npc-worker/index.ts`
- Modify: `app/dashboard/coach/npc/page.tsx`
- Modify: `app/dashboard/coach/npc/submissions/[submissionId]/upload/page.tsx`
- Modify: `components/npc/coach/CopySubmissionList.tsx`
- Modify: `__tests__/api/npc.documents.route.test.ts`
- Modify: `__tests__/api/npc.generate.test.ts`
- Modify: `__tests__/api/npc.uploads.route.test.ts`
- Create: `__tests__/npc/submission-integrity.test.ts`
- Create: `__tests__/integration/npc-submission-lock.real.test.ts`
- Create: `__tests__/integration/npc-worker-integrity.real.test.ts`
- Create: `__tests__/components/npc/CoachUnavailableSubmission.test.tsx`
- Create: `scripts/testing/run-npc-real-db-tests.sh`
- Create: `__tests__/scripts/run-npc-real-db-tests.test.ts`

- [ ] **Step 1: Écrire les tests rouges d'intégrité**

Couvrir fichier valide, absent, taille divergente, SHA divergente, SHA historique absent, miroir `storedFilePath` incohérent et dérivé sortant de la racine. Le résultat ne contient aucun chemin absolu.

- [ ] **Step 2: Écrire les tests rouges de terminalité**

Pour `UNAVAILABLE`, POST document, PATCH type, DELETE document et POST generate répondent 409 et n'appellent aucune mutation Prisma. Les uploads persistants créent toujours une `CopyPage` avec `documentType`, `sizeBytes` et `sha256` explicites.

- [ ] **Step 3: Écrire les tests rouges UI, concurrence et harnais**

La vue coach affiche le statut et le motif d'indisponibilité, sans bouton de
rapport, génération ni relance. Avec deux clients Prisma et des barrières
contrôlées, couvrir tombstone contre ajout/suppression/reclassification, puis
contrôle final contre suppression. Le test de contrat du harnais emploie un faux
exécutable Docker, provoque un échec Jest et exige quand même la destruction du
seul conteneur aléatoire créé.

- [ ] **Step 4: Prouver le harnais rouge, puis le créer et le prouver vert**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/scripts/run-npc-real-db-tests.test.ts`

Expected avant implémentation: FAIL car le script n'existe pas.

Le script lance un conteneur aléatoire, installe un `trap` avant toute opération,
attend la santé, applique les migrations, exécute uniquement les tests NPC réels,
puis fait toujours `docker rm -f` et supprime son volume/réseau. Son test de
contrat simule un échec Jest et prouve que le cleanup est encore appelé.

Run: `npx npm@10.9.8 test -- --runInBand __tests__/scripts/run-npc-real-db-tests.test.ts`

Expected après implémentation: PASS.

- [ ] **Step 5: Prouver tous les rouges**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/npc/submission-integrity.test.ts __tests__/api/npc.documents.route.test.ts __tests__/api/npc.generate.test.ts __tests__/api/npc.uploads.route.test.ts __tests__/components/npc/CoachUnavailableSubmission.test.tsx __tests__/scripts/run-npc-real-db-tests.test.ts`

Expected: FAIL sur les contrôles, 409 et SHA.

Run: `bash scripts/testing/run-npc-real-db-tests.sh __tests__/integration/npc-submission-lock.real.test.ts __tests__/integration/npc-worker-integrity.real.test.ts`

Expected: FAIL fonctionnel sur l'absence de verrou commun et la finalisation sans
intégrité, après démarrage/migration réussis du PostgreSQL jetable.

- [ ] **Step 6: Implémenter le verrou et l'état indisponible**

`withLockedCopySubmission(tx, id, callback)` exécute `SELECT ... FOR UPDATE`, relit le statut dans la transaction puis appelle le callback. `markSubmissionUnavailable` met à jour la soumission et seulement les pages fautives, avec un horodatage commun et un `NpcAuditLog`, sans toucher au rapport.

- [ ] **Step 7: Brancher toutes les mutations sous verrou**

Création, reclassification, suppression, mise en file et finalisation prennent le verrou puis relisent le statut. La suppression disque intervient seulement après commit DB; une erreur disque est auditée sans revenir à un état DB mensonger.

- [ ] **Step 8: Durcir le worker et la vue coach**

Contrôler les sources avant diagnostic et, sous le même verrou, juste avant création du rapport + `COMPLETED`. En cas de défaut, marquer `UNAVAILABLE`; `handleJobFailure` relit sous verrou et ne transforme jamais cet état en `ANALYSIS_FAILED`.

La liste et la page d'upload coach traitent `UNAVAILABLE` comme terminal,
affichent le motif et ne rendent aucune action de rapport/génération/relance.

- [ ] **Step 9: Prouver les courses sur PostgreSQL réel**

Tester deux clients Prisma et des barrières contrôlées : tombstone contre ajout/suppression/reclassification, puis contrôle final contre suppression. Une seule séquence valide doit gagner, jamais `COMPLETED` avec pièce absente.

Run: `bash scripts/testing/run-npc-real-db-tests.sh __tests__/integration/npc-submission-lock.real.test.ts __tests__/integration/npc-worker-integrity.real.test.ts`

Expected: PASS sur PostgreSQL jetable, sans skip.

- [ ] **Step 10: Commit**

```bash
git add lib/npc app/api/npc app/dashboard/coach/npc components/npc/coach services/npc-worker scripts/testing/run-npc-real-db-tests.sh __tests__/api __tests__/npc __tests__/integration __tests__/components/npc/CoachUnavailableSubmission.test.tsx __tests__/scripts/run-npc-real-db-tests.test.ts
git commit -m "fix(npc): block completion without intact sources"
```

### Task 4: Type documentaire explicite de bout en bout

**Files:**
- Modify: `app/api/npc/uploads/route.ts`
- Modify: `app/api/npc/submissions/[submissionId]/documents/route.ts`
- Modify: `components/npc/coach/FileUploadZone.tsx`
- Modify: `__tests__/api/npc.uploads.route.test.ts`
- Modify: `__tests__/api/npc.documents.route.test.ts`
- Modify: `__tests__/components/npc/FileUploadZone.test.tsx`
- Modify: `__tests__/architecture/npc-storage-contract.test.ts`

- [ ] **Step 1: Ajouter les tests rouges d'absence de type**

Les deux API répondent 400 si le champ est absent. Le flux historique accepte uniquement la valeur explicite `STUDENT_COPY`. L'interface commence à `null`, affiche un choix obligatoire et bloque l'envoi.

- [ ] **Step 2: Prouver le rouge**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/api/npc.uploads.route.test.ts __tests__/api/npc.documents.route.test.ts __tests__/components/npc/FileUploadZone.test.tsx`

Expected: FAIL sur le défaut silencieux.

- [ ] **Step 3: Implémenter sans modifier le défaut Prisma historique**

Valider le champ brut, sans `|| 'STUDENT_COPY'`. Rendre le choix humain explicite et transmettre la valeur. Le test d'architecture scanne chaque `copyPage.create/upsert` actif pour imposer `documentType`.

- [ ] **Step 4: Prouver le vert et commit**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/api/npc.uploads.route.test.ts __tests__/api/npc.documents.route.test.ts __tests__/components/npc/FileUploadZone.test.tsx __tests__/architecture/npc-storage-contract.test.ts`

```bash
git add app/api/npc components/npc/coach/FileUploadZone.tsx __tests__
git commit -m "fix(npc): require explicit document type"
```

## Chunk 3: confidentialité et commande auditée

### Task 5: Politique canonique de visibilité famille

**Files:**
- Create: `lib/npc/report-visibility.ts`
- Modify: `app/dashboard/parent/npc/page.tsx`
- Modify: `app/dashboard/eleve/npc/page.tsx`
- Modify: `components/npc/parent/ParentReportList.tsx`
- Modify: `components/npc/student/StudentReportList.tsx`
- Create: `__tests__/npc/report-visibility.test.ts`
- Create: `__tests__/components/npc/FamilyReportVisibility.test.tsx`
- Create: `__tests__/pages/npc-family-pages.test.tsx`

- [ ] **Step 1: Écrire la matrice rouge**

Pour parent et élève : `COACH_ONLY` ne transmet/rend aucune carte, donnée ou URL; `COACH_AND_STUDENT` rend l'aperçu et le lien; `STUDENT_SUMMARY_ONLY` rend uniquement `studentSummary`, sans diagnostic ni lien. `UNAVAILABLE` est exclu des listes et compteurs famille.

- [ ] **Step 2: Prouver le rouge**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/npc/report-visibility.test.ts __tests__/components/npc/FamilyReportVisibility.test.tsx __tests__/pages/npc-family-pages.test.tsx`

Expected: FAIL, les composants actuels rendent le diagnostic `COACH_ONLY`.

- [ ] **Step 3: Implémenter la politique partagée et deux défenses**

La fonction pure retourne `hidden | full | summary`. Les pages filtrent avant calcul des compteurs et réduisent le payload aux champs autorisés; les composants refusent encore `hidden` et ne lisent jamais `diagnostic` en mode `summary`.

- [ ] **Step 4: Prouver le vert et commit**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/npc/report-visibility.test.ts __tests__/components/npc/FamilyReportVisibility.test.tsx __tests__/pages/npc-family-pages.test.tsx`

```bash
git add lib/npc/report-visibility.ts app/dashboard/parent/npc app/dashboard/eleve/npc components/npc/parent components/npc/student __tests__
git commit -m "fix(npc): hide coach-only reports from families"
```

### Task 6: Commande paramétrée de tombstone

**Files:**
- Create: `lib/npc/tombstone/types.ts`
- Create: `lib/npc/tombstone/export.ts`
- Create: `lib/npc/tombstone/service.ts`
- Create: `lib/npc/tombstone/cli.ts`
- Create: `scripts/npc/tombstone-submission.ts`
- Modify: `package.json`
- Create: `__tests__/npc/tombstone-cli.test.ts`
- Create: `__tests__/npc/tombstone-export.test.ts`
- Create: `__tests__/integration/npc-tombstone-command.real.test.ts`

- [ ] **Step 1: Écrire les tests rouges de CLI et d'export**

Exiger tous les arguments (`submission-id`, statut initial, 4 pièces, report id/statut/visibilité, motif, acteur, export absolu), UID root, parent root-only existant, absence de symlink et fichier inexistant. Prouver `O_EXCL|O_NOFOLLOW`, mode 0600, fsync, relecture, JSON canonique et empreinte.

L'interface publique exacte est :

```bash
npm run npc:tombstone -- \
  --submission-id <id> \
  --expected-initial-status <status> \
  --expected-page-count 4 \
  --expected-report-id <id> \
  --expected-report-status <status> \
  --expected-report-visibility <visibility> \
  --reason <reason> \
  --actor-id <id> \
  --actor-role <role> \
  --export-file <absolute-json-path>
```

`package.json` déclare `"npc:tombstone": "tsx scripts/npc/tombstone-submission.ts"`.

- [ ] **Step 2: Prouver le rouge**

Run: `npx npm@10.9.8 test -- --runInBand __tests__/npc/tombstone-cli.test.ts __tests__/npc/tombstone-export.test.ts`

Expected: FAIL car la commande n'existe pas.

- [ ] **Step 3: Implémenter parsing et export sans identifiant métier**

Le CLI n'affiche ni URL DB ni PII. Le service reçoit un objet typé; le snapshot exclut les relations `User` et les secrets. L'opération et l'audit utilisent une clé déterministe dérivée des paramètres, jamais du nom d'un dossier pilote.

La clé couvre : version de protocole, identifiant de soumission, statut initial
attendu, nombre de pièces, identifiant/statut/visibilité du rapport, motif,
identifiant et rôle de l'acteur. Elle exclut la destination d'export et tout
horodatage généré afin que deux exécutions concurrentes avec des destinations
différentes convergent vers le même audit.

- [ ] **Step 4: Écrire le test PostgreSQL rouge du protocole complet**

Semer un dossier synthétique de quatre pièces, un rapport attendu, un job, des audits existants et deux dossiers témoins. Vérifier l'ordre export puis validation, refus exact si 3/5 pièces ou rapport divergent, rollback DB, conservation rapport/job/fichiers/témoins.

Run: `bash scripts/testing/run-npc-real-db-tests.sh __tests__/integration/npc-tombstone-command.real.test.ts`

Expected: FAIL fonctionnel car le service transactionnel n'est pas encore
implémenté, après migration réussie du PostgreSQL jetable.

- [ ] **Step 5: Implémenter la transaction verrouillée**

Sous `SELECT ... FOR UPDATE`, capturer les lignes, écrire/vérifier l'export, revalider snapshot et DB, faire `updateMany` avec compte exact 1+4 puis `npcAuditLog.create` d'identifiant déterministe. Reprendre un export valide après échec DB; retourner `already-applied` uniquement si le contrat idempotent est exact.

- [ ] **Step 6: Prouver idempotence, reprise et concurrence**

Deux clients concurrents ciblent le même dossier; exactement un audit existe. Une seconde exécution n'écrit rien. Un état partiel, un motif différent ou un audit manquant/surnuméraire est refusé.

Run: `bash scripts/testing/run-npc-real-db-tests.sh __tests__/integration/npc-tombstone-command.real.test.ts`

Expected: PASS sur le PostgreSQL jetable; export 0600 vérifié; aucune connexion production.

- [ ] **Step 7: Commit**

```bash
git add lib/npc/tombstone scripts/npc package.json package-lock.json __tests__/npc __tests__/integration/npc-tombstone-command.real.test.ts
git commit -m "feat(npc): add audited tombstone command"
```

## Chunk 4: preuves de clone, non-régression et livraison

### Task 7: Clone PostgreSQL 15 jetable et preuve exécutable

**Files:**
- Create: `scripts/testing/verify-npc-storage-hardening.sh`
- Create: `scripts/testing/run-with-disposable-stack.sh`
- Create: `__tests__/scripts/verify-npc-storage-hardening.test.ts`
- Create: `__tests__/scripts/run-with-disposable-stack.test.ts`
- Create: `docs/audits/2026-08-11-npc-storage-hardening-results.md`

- [ ] **Step 1: Écrire le test rouge du harnais**

Le script doit créer des noms aléatoires, poser les `trap` de destruction avant
toute création, utiliser PostgreSQL 15, appliquer toutes les migrations deux
fois, semer uniquement des données synthétiques et exécuter la vraie commande
dans un conteneur Node jetable avec UID 0. Le dépôt est monté en lecture seule;
seuls un répertoire d'export temporaire root-only et le stockage synthétique sont
inscriptibles. Il invoque exactement `npm run npc:tombstone --` avec les flags de
Task 6. Toute URL reste masquée dans les sorties.

- [ ] **Step 2: Prouver le rouge puis implémenter**

Le wrapper générique de lanes lance directement un conteneur PostgreSQL 15 au nom
aléatoire, sans `container_name` ni projet Compose partagé, et installe son `trap`
avant la création. Il attend `pg_isready`, résout le port loopback aléatoire,
exporte `DATABASE_URL` et `TEST_DATABASE_URL` uniquement au sous-processus,
applique `prisma migrate deploy`, lance la commande reçue, puis détruit exactement
ce conteneur dans tous les cas. Le stockage PostgreSQL est jetable et aucun volume
nommé n'est partagé. Son test injecte une commande en échec et un faux exécutable
Docker pour prouver attente, migration, propagation d'environnement et cleanup
ciblé.

Run: `npx npm@10.9.8 test -- --runInBand __tests__/scripts/verify-npc-storage-hardening.test.ts __tests__/scripts/run-with-disposable-stack.test.ts`

Expected avant implémentation: FAIL. Expected après: PASS.

- [ ] **Step 3: Exécuter la preuve réelle sur clone**

Run: `bash scripts/testing/verify-npc-storage-hardening.sh`

Expected: migration 1 puis 0 pending au second passage; export 0600; tombstone exact 1+4; refus sur divergence; seconde exécution `already-applied`; témoins inchangés; conteneur détruit par `trap`.

- [ ] **Step 4: Documenter uniquement des preuves publiables**

Consigner SHA de branche, commandes, comptes exacts, statuts, durées et limites sans hôte, port, chemin production, credential, URL ni identifiant pilote. Rappeler que la commande production n'a pas été exécutée.

- [ ] **Step 5: Commit**

```bash
git add scripts/testing/verify-npc-storage-hardening.sh scripts/testing/run-with-disposable-stack.sh __tests__/scripts/verify-npc-storage-hardening.test.ts __tests__/scripts/run-with-disposable-stack.test.ts docs/audits/2026-08-11-npc-storage-hardening-results.md
git commit -m "test(npc): prove hardening on disposable database"
```

### Task 8: Gate complet et PR

**Files:**
- Modify: `docs/audits/2026-08-11-npc-storage-hardening-results.md`

- [ ] **Step 1: Vérifier le diff et les invariants**

Run: `git diff origin/main...HEAD --check`

Run: `npx npm@10.9.8 test -- --runInBand __tests__/architecture/npc-storage-contract.test.ts`

Expected: le garde sémantique limité aux modules NPC, points d'entrée et
configurations de déploiement actifs ne trouve aucun identifiant pilote, ancienne
variable, repli ou chemin d'infrastructure NPC concret.

- [ ] **Step 2: Lancer les gates statiques et unitaires sans filtre**

Run: `npx npm@10.9.8 run lint`

Run: `npx npm@10.9.8 run typecheck`

Run: `npx npm@10.9.8 test -- --runInBand`

Run: `npx npm@10.9.8 run security:repo && npx npm@10.9.8 run check:test-quarantines && npx npm@10.9.8 run check:no-hardcoded`

Expected: 0 échec, 0 skip injustifié; seuls les avertissements préexistants explicitement recensés restent.

- [ ] **Step 3: Lancer les lanes base réelle, concurrence et E2E sur environnement jetable**

Run: `bash scripts/testing/run-with-disposable-stack.sh npx npm@10.9.8 run test:integration`

Run: `bash scripts/testing/run-with-disposable-stack.sh npx npm@10.9.8 run test:db`

Run: `npx npm@10.9.8 run test:e2e:full`

Expected: 0 échec et aucun conteneur/volume jetable restant après le gate. Le
wrapper `run-with-disposable-stack.sh` détruit uniquement son conteneur PostgreSQL
aléatoire, même si le test échoue; le lanceur E2E possède son propre `trap` et un
projet Compose isolé.

- [ ] **Step 4: Construire avec LLM neutralisé**

Run: `NPC_LLM_MODE=off npx npm@10.9.8 run build`

Expected: build et audit artefact verts; aucun appel LLM.

- [ ] **Step 5: Mettre le rapport à jour avec les nombres exacts**

Inscrire suites, tests, skips, durées, preuve migration/commande et risques restants. Ne jamais remplacer un échec par une affirmation de vert.

- [ ] **Step 6: Commit final, push et draft PR**

```bash
git add docs/audits/2026-08-11-npc-storage-hardening-results.md
git commit -m "docs: record npc hardening verification"
git push -u origin agent/npc-storage-hardening
gh pr create --draft --base main --head agent/npc-storage-hardening --title "fix(npc): harden persistent storage and pilot tombstone tooling" --reviewer abenrhouma --body-file docs/audits/2026-08-11-npc-storage-hardening-results.md
```

Expected: PR ouverte pour `abenrhouma`, non mergée, aucun déploiement et aucun tombstone production.
