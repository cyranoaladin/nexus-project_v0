# Pré-rentrée 2026 Sanitized Parent Guide Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire un Guide Parents exhaustif et une chaîne documentaire reproductible sans binaires ni copies de sources suivis dans Git.

**Architecture:** Les sources métier et éditoriales sont compilées par TypeScript dans un snapshot fermé. Le renderer Python consomme uniquement ce contrat, génère le guide et les six annexes dans `.artifacts/`, puis des vérificateurs séparés auditent et emballent deux ZIP. GitHub Actions reproduit le processus sans droit d’écriture ni publication.

**Tech Stack:** TypeScript/tsx/Zod, Python 3.12, JSON Schema, Jinja-free HTML escaping, WeasyPrint, qpdf, Poppler, Playwright, pytest, Jest, GitHub Actions.

---

## Chunk 1: Nettoyage de la branche et contrats du dépôt

### Task 1: Interdire les sorties et duplications suivies

**Files:**
- Modify: `.gitignore`
- Create: `scripts/pre-rentree/verify_repository_hygiene.py`
- Create: `scripts/pre-rentree/tests/test_repository_hygiene.py`
- Delete: `outputs-v5-canonical/**`
- Delete: `audit/pdf-claim-matrix.csv`
- Delete: `audit/v4-content-diff.json`
- Delete: `audit/v4-input-manifest.json`

- [ ] **Step 1: Écrire les tests rouges** vérifiant `.artifacts/`, le commentaire `Incident`, l’exception CSV d’audit structurée, l’absence de chemins de sortie suivis et l’absence de copies identiques des sources/tests/CSS.
- [ ] **Step 2: Exécuter** `python -m pytest scripts/pre-rentree/tests/test_repository_hygiene.py -q` et constater l’échec attendu.
- [ ] **Step 3: Corriger `.gitignore`, ajouter le vérificateur et supprimer les sorties suivies** sans toucher aux assets canoniques de l’application.
- [ ] **Step 4: Réexécuter le test** et `git ls-files outputs-v5-canonical .artifacts artifacts/pre-rentree-2026`.
- [ ] **Step 5: Commit** `refactor(pre-rentree): remove tracked generated package duplication`.

### Task 2: Normaliser les schémas et noms d’outils

**Files:**
- Move: `scripts/pre-rentree/publication-snapshot.schema.json` → `scripts/pre-rentree/schemas/publication-snapshot.schema.json`
- Move: `scripts/pre-rentree/owner-approval.schema.json` → `scripts/pre-rentree/schemas/owner-approval.schema.json`
- Create: `scripts/pre-rentree/schemas/review-manifest.schema.json`
- Create: `scripts/pre-rentree/package_documents.py`
- Create: `scripts/pre-rentree/verify_release.py`
- Modify: imports and tests under `scripts/pre-rentree/`

- [ ] **Step 1: Ajouter des tests rouges** pour les trois schémas fermés et les nouveaux points d’entrée.
- [ ] **Step 2: Vérifier les échecs ciblés**.
- [ ] **Step 3: Déplacer les schémas avec `git mv`, adapter les chemins, créer les CLI minimes**.
- [ ] **Step 4: Vérifier les tests et `python -m py_compile scripts/pre-rentree/*.py`**.
- [ ] **Step 5: Commit** `refactor(pre-rentree): normalize document pipeline contracts`.

## Chunk 2: Contenu éditorial et snapshot

### Task 3: Ajouter le contrat éditorial fermé

**Files:**
- Create: `content/pre-rentree-2026/parent-guide.fr.json`
- Create: `content/pre-rentree-2026/parent-guide.schema.json`
- Modify: `scripts/pre-rentree/publication-sources.ts`
- Modify: `scripts/pre-rentree/publication-snapshot-schema.ts`
- Modify: `scripts/pre-rentree/schemas/publication-snapshot.schema.json`
- Modify: `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`

- [ ] **Step 1: Écrire les tests rouges** pour `additionalProperties:false`, la locale, les sections obligatoires, les `EVIDENCED_TEXT`, la validité des pointeurs et les versions indépendantes.
- [ ] **Step 2: Exécuter les tests TS ciblés et confirmer les échecs**.
- [ ] **Step 3: Ajouter le schéma et le JSON éditorial**, avec uniquement des transitions éditoriales ou des faits sourcés.
- [ ] **Step 4: Compiler le contenu dans le snapshot et valider les références** ; tout conflit lève une erreur nommant les deux sources.
- [ ] **Step 5: Réexécuter les tests et le typecheck**.
- [ ] **Step 6: Commit** `feat(pre-rentree): add structured parent-guide content contract`.

### Task 4: Séparer versions, dates et capacités

**Files:**
- Modify: `data/campaigns/pre-rentree-2026.json`
- Modify: `scripts/pre-rentree/publication-sources.ts`
- Modify: schemas TS/JSON
- Create: `docs/campaigns/pre-rentree-2026/PARCOURS360-CAPABILITY-MATRIX.md`
- Create: `generated/pre-rentree-2026/parcours360-capabilities.json` only if consumed deterministically
- Move: `generated/pre-rentree-2026-publication.snapshot.json` → `generated/pre-rentree-2026/publication.snapshot.json`

- [ ] **Step 1: Écrire les tests rouges** pour `sourceCommitDate`, `snapshotBuiltAt`, `documentEditionDate`, `documentPackageVersion=5.1.0-rc.1` et les six états de capacité.
- [ ] **Step 2: Vérifier les échecs**.
- [ ] **Step 3: Ajouter les métadonnées versionnées sans modifier la version de campagne**.
- [ ] **Step 4: Classer les capacités à partir du code présent sur la branche** ; les quatre documents personnalisés et douze tests disciplinaires ne sont pas `PUBLICLY_COMMITTED`.
- [ ] **Step 5: Ajouter la règle de compilation qui exclut toute promesse non engagée**.
- [ ] **Step 6: Reconstruire le snapshot au nouveau chemin, exécuter tests et typecheck**.
- [ ] **Step 7: Commit** `feat(pre-rentree): separate release dates and capability gates`.

## Chunk 3: Guide Parents et annexes

### Task 5: Rendre le Guide Parents complet

**Files:**
- Modify: `scripts/pre-rentree/document_model.py`
- Modify: `scripts/pre-rentree/document_templates.py`
- Modify: `scripts/pre-rentree/document_renderer.py`
- Modify: `scripts/pre-rentree/templates/document.css`
- Modify: `scripts/pre-rentree/tests/test_document_templates.py`
- Modify: `scripts/pre-rentree/tests/test_document_renderer.py`

- [ ] **Step 1: Écrire les tests rouges** pour couverture, sommaire, synthèse, méthode, trois niveaux, quatre matières, 12 modules, 60 séances, planning, tarifs, procédure à huit étapes, pratique, FAQ, CTA et absence de jargon.
- [ ] **Step 2: Exécuter les tests et constater les échecs**.
- [ ] **Step 3: Ajouter un renderer de blocs sourcés et de cartes de séances**, sans valeurs métier littérales dans les templates.
- [ ] **Step 4: Ajouter le shell familial** : lien d’évitement, landmarks, ancres, métadonnées techniques invisibles, footer éditorial, QR et liens explicites.
- [ ] **Step 5: Ajouter la mise en page A4 et mobile**, minimum 9,5 pt, sauts maîtrisés, repères matière textuels et colorés.
- [ ] **Step 6: Réexécuter les tests, inspecter le HTML et refactorer les fonctions longues**.
- [ ] **Step 7: Commit** `feat(pre-rentree): generate complete parent guide`.

### Task 6: Harmoniser les six annexes

**Files:**
- Modify: templates, CSS and tests above

- [ ] **Step 1: Ajouter des tests rouges** interdisant les marqueurs techniques visibles dans les sept documents publics et exigeant le titre tarifaire familial.
- [ ] **Step 2: Vérifier les échecs**.
- [ ] **Step 3: Remplacer headers/footers techniques par une identité éditoriale commune** et garder la provenance uniquement dans `<meta>` et les manifests.
- [ ] **Step 4: Réexécuter les tests**.
- [ ] **Step 5: Commit** `fix(pre-rentree): align public annexes with parent language`.

## Chunk 4: Build, audit et paquets

### Task 7: Produire uniquement sous `.artifacts`

**Files:**
- Modify: `scripts/pre-rentree/generate_documents.py`
- Modify: `scripts/pre-rentree/document_audit.py`
- Modify: `scripts/pre-rentree/document_assets.py`
- Modify: related Python tests

- [ ] **Step 1: Écrire les tests rouges** pour sept PDF/HTML, absence de `SOURCES`/`PRIVATE`, statut public/revues, HTML autonome et nettoyage atomique.
- [ ] **Step 2: Vérifier les échecs**.
- [ ] **Step 3: Supprimer la copie reproductible de sources et produire `PUBLICATION_STATUS/private-contractual-package-blocked.json` dans les audits**.
- [ ] **Step 4: Produire assets locaux, PDF, HTML, sociaux et audits sans réseau**.
- [ ] **Step 5: Retirer `pdf/ua-1` et toute revendication associée faute de veraPDF** ; conserver balises et HTML accessible.
- [ ] **Step 6: Réexécuter les tests**.
- [ ] **Step 7: Commit** `refactor(pre-rentree): build review artifacts without source copies`.

### Task 8: Vérifier et emballer deux paquets

**Files:**
- Implement: `scripts/pre-rentree/package_documents.py`
- Implement: `scripts/pre-rentree/verify_release.py`
- Modify: governance scripts and schemas
- Create/modify tests for packaging, hashes, budgets and stale approvals

- [ ] **Step 1: Écrire les tests rouges** pour contenu exact des ZIP, tri déterministe, timestamps ZIP fixes, budgets, SHA, absence de source/PII et invalidation d’approbation.
- [ ] **Step 2: Vérifier les échecs**.
- [ ] **Step 3: Implémenter les archives parents/revue avec écriture atomique**.
- [ ] **Step 4: Implémenter le vérificateur unique** : contenu, PDF, HTML, QR, licences, sécurité, dépôt, reproductibilité et gouvernance.
- [ ] **Step 5: Réexécuter les tests et comparer deux paquets**.
- [ ] **Step 6: Commit** `feat(pre-rentree): package deterministic parent and review archives`.

## Chunk 5: Documentation, licences et commandes

### Task 9: Documenter les licences tierces

**Files:**
- Create: `licenses/fonts/OFL-1.1.txt`
- Create/modify: `THIRD_PARTY_NOTICES.md`
- Modify: asset validation and tests

- [ ] **Step 1: Écrire un test rouge** liant DM Sans, Fraunces et IBM Plex Mono à une notice et au texte OFL.
- [ ] **Step 2: Vérifier l’échec**.
- [ ] **Step 3: Ajouter le texte officiel OFL 1.1 une seule fois et les notices de provenance**.
- [ ] **Step 4: Réexécuter le contrôle des licences**.
- [ ] **Step 5: Commit** `fix(repo): document embedded font licenses`.

### Task 10: Créer la documentation métier publique

**Files:**
- Create: `docs/INDEX.md`
- Create: `docs/campaigns/pre-rentree-2026/{README.md,SOURCE-OF-TRUTH-MAP.md,PARENT-GUIDE-SOURCE-MAP.md,RELEASE-PROCESS.md,OWNER-REVIEW-CHECKLIST.md,COMPLIANCE-GAPS.md,DECISIONS-REQUIRED.md,CHANGELOG.md}`
- Delete: `docs/operations/pre-rentree-2026/**`
- Modify: `README.md`
- Modify: `docs/audits/2026-07-19-pre-rentree-2026-v5-canonical.md`
- Create: `scripts/pre-rentree/README.md`

- [ ] **Step 1: Ajouter un test documentaire rouge** pour tous les chemins, statuts exacts, absence de « sans push » et absence de marquage interne trompeur.
- [ ] **Step 2: Vérifier l’échec**.
- [ ] **Step 3: Écrire les cartes, processus, checklist et écarts de conformité publics**.
- [ ] **Step 4: Corriger README et rapport historique avec la chronologie exacte**.
- [ ] **Step 5: Réexécuter les tests documentaires**.
- [ ] **Step 6: Commit** `docs(pre-rentree): document release and review process`.

### Task 11: Ajouter les commandes de premier niveau

**Files:**
- Modify: `package.json`
- Create: small safe clean/orchestration helpers only if required
- Modify: tests/docs

- [ ] **Step 1: Écrire des tests rouges** pour les neuf commandes `pre-rentree:*` et leurs chemins explicites.
- [ ] **Step 2: Vérifier l’échec**.
- [ ] **Step 3: Ajouter les scripts clean/snapshot/tests/build/audit/package/verify/ci**.
- [ ] **Step 4: Exécuter chaque commande individuellement**.
- [ ] **Step 5: Commit** `build(pre-rentree): expose reproducible document commands`.

## Chunk 6: CI et validation finale

### Task 12: Ajouter la CI documentaire dédiée

**Files:**
- Create: `.github/workflows/pre-rentree-documents.yml`
- Add workflow contract tests

- [ ] **Step 1: Écrire le test rouge** pour triggers, `contents:read`, versions, commandes, double build, diff snapshot, hygiène, sécurité, ZIP, artefacts et absence de déploiement.
- [ ] **Step 2: Vérifier l’échec**.
- [ ] **Step 3: Implémenter le workflow sans token d’écriture**.
- [ ] **Step 4: Valider le YAML et le test de contrat**.
- [ ] **Step 5: Commit** `ci(pre-rentree): add reproducible document workflow`.

### Task 13: Générer, auditer et revoir visuellement

**Files:**
- Local only: `.artifacts/pre-rentree-2026/**`
- Modify only source/test files if a defect is found, always through a new RED/GREEN cycle

- [ ] **Step 1: Exécuter clean, snapshot, tests, build, audit et package**.
- [ ] **Step 2: Exécuter un second build propre avec le même `SOURCE_DATE_EPOCH` et comparer tous les artefacts déterministes**.
- [ ] **Step 3: Inspecter les rasters de toutes les pages et les captures desktop/mobile** ; enregistrer `ASSISTANT_VISUAL_REVIEW`, jamais une revue propriétaire.
- [ ] **Step 4: Corriger chaque défaut par test rouge puis rebuild**.
- [ ] **Step 5: Exécuter sécurité dépôt + historique de branche, vérifier absence de chemin local et PII**.
- [ ] **Step 6: Commit** `chore(pre-rentree): finalize audits and review package` seulement si des sources suivies ont changé.

### Task 14: Vérification, push et suivi GitHub

**Files:**
- Update PR body and reply to the blocking review through GitHub after evidence exists

- [ ] **Step 1: Exécuter toutes les commandes finales demandées**, `npm run typecheck`, `git diff --check` et vérifier un worktree propre.
- [ ] **Step 2: Lire les résultats complets et ne déclarer que les preuves observées**.
- [ ] **Step 3: Pousser sans force sur `codex/pre-rentree-2026-v5-canonical`**.
- [ ] **Step 4: Vérifier le SHA distant et que la PR reste brouillon**.
- [ ] **Step 5: Surveiller la CI dédiée jusqu’au résultat terminal ; corriger tout échec dans le périmètre**.
- [ ] **Step 6: Mettre à jour le corps de PR et répondre au commentaire de revue avec la matrice de preuves**.
- [ ] **Step 7: Fournir le rapport final factuel avec SHA, tailles, tests, CI, paquets et statuts de gouvernance**.
