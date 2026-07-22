# Pré-rentrée 2026 Release Governance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un circuit local et vérifiable de revue propriétaire lié aux hashes du lot public, tout en maintenant le blocage juridique du dossier privé.

**Architecture:** Un module Python pur construit le manifest de revue, valide une décision humaine et produit un rapport sans modifier les artefacts documentaires. Un CLI mince assure la résolution explicite des chemins et les écritures atomiques. Des documents opérationnels non publics préparent les revues propriétaire, juridique et confidentialité sans créer de source canonique approuvée.

**Tech Stack:** Python 3.11, `jsonschema`, `hashlib`, `pathlib`, `pytest`, JSON Schema 2020-12.

---

## Chunk 1: Modèle et manifest de revue

### Task 1: Énumérer et hacher les artefacts soumis à revue

**Files:**
- Create: `scripts/pre-rentree/release_governance.py`
- Create: `scripts/pre-rentree/tests/test_release_governance.py`

- [ ] **Step 1: Écrire les tests rouges du manifest**

Créer des fixtures minimales avec `PUBLIC/`, `PUBLIC/HTML/`, `PUBLIC/SOCIAL/` et `AUDIT/`. Vérifier le schéma, les statuts, l’ordre déterministe et les SHA-256. Ajouter des tests pour un artefact absent, un hash PDF divergent du manifest de build et un lien symbolique.

```python
manifest = build_review_manifest(package)
assert manifest["schemaVersion"] == "1.0.0"
assert manifest["publicStatus"] == "PDF_PACKAGE_READY_FOR_OWNER_REVIEW"
assert manifest["privateStatus"] == "BLOCKED_BY_LEGAL_TERMS"
assert [item["path"] for item in manifest["artifacts"]] == sorted(expected_paths)
```

- [ ] **Step 2: Exécuter les tests et constater l’échec**

Run: `python -m pytest scripts/pre-rentree/tests/test_release_governance.py -q`

Expected: FAIL à l’import de `release_governance`.

- [ ] **Step 3: Implémenter le modèle minimal**

Ajouter `sha256_file`, `required_review_paths` et `build_review_manifest`. Résoudre chaque chemin, refuser les symlinks, exiger qu’il reste sous `package_root`, trier les chemins relatifs et vérifier les hashes PDF contre `document-build-manifest.json`.

- [ ] **Step 4: Exécuter les tests du manifest**

Run: `python -m pytest scripts/pre-rentree/tests/test_release_governance.py -q`

Expected: PASS pour les tests du manifest.

- [ ] **Step 5: Commit local**

```bash
git add scripts/pre-rentree/release_governance.py scripts/pre-rentree/tests/test_release_governance.py
git commit -m "feat: build pre-rentree owner review manifest"
```

## Chunk 2: Décision humaine et péremption

### Task 2: Valider les décisions propriétaire

**Files:**
- Create: `scripts/pre-rentree/owner-approval.schema.json`
- Modify: `scripts/pre-rentree/release_governance.py`
- Modify: `scripts/pre-rentree/tests/test_release_governance.py`

- [ ] **Step 1: Écrire les tests rouges de décision**

Tester les cas : approbation absente, `PENDING`, `APPROVED`, `REJECTED`, schéma invalide et hash obsolète. Une approbation valide doit être nominative et liée à tous les hashes structurants.

```python
decision = evaluate_owner_approval(manifest, approval, schema)
assert decision["OWNER_REVIEW_DECISION"] == "APPROVED"
assert decision["PUBLIC_STATUS"] == "PDF_PACKAGE_READY_FOR_OWNER_REVIEW"
assert decision["PRIVATE_STATUS"] == "BLOCKED_BY_LEGAL_TERMS"
```

Vérifier que `READY_TO_DISTRIBUTE`, `DISTRIBUTION_AUTHORIZED` et « prêt à diffuser » n’apparaissent jamais dans le rapport.

- [ ] **Step 2: Exécuter les tests et constater l’échec**

Run: `python -m pytest scripts/pre-rentree/tests/test_release_governance.py -q`

Expected: FAIL, fonctions et schéma absents.

- [ ] **Step 3: Ajouter le schéma conditionnel**

Autoriser `PENDING`, `APPROVED`, `REJECTED`; exiger pour une décision finale `reviewedBy`, `reviewerRole`, `decidedAt`, `decisionReference` et les hashes; exiger `findings` comme tableau; refuser les propriétés inconnues.

- [ ] **Step 4: Implémenter l’évaluation**

Ajouter `review_manifest_sha256`, `build_pending_approval_template` et `evaluate_owner_approval`. Retourner `PENDING`, `APPROVED`, `REJECTED`, `STALE` ou `INVALID` sans inventer un nouveau statut de publication.

- [ ] **Step 5: Exécuter les tests de décision**

Run: `python -m pytest scripts/pre-rentree/tests/test_release_governance.py -q`

Expected: PASS.

- [ ] **Step 6: Commit local**

```bash
git add scripts/pre-rentree/owner-approval.schema.json scripts/pre-rentree/release_governance.py scripts/pre-rentree/tests/test_release_governance.py
git commit -m "feat: validate hash-bound owner decisions"
```

## Chunk 3: CLI et écritures atomiques

### Task 3: Produire le dossier de gouvernance sans écraser la décision humaine

**Files:**
- Create: `scripts/pre-rentree/verify_release_approvals.py`
- Modify: `scripts/pre-rentree/release_governance.py`
- Modify: `scripts/pre-rentree/tests/test_release_governance.py`

- [ ] **Step 1: Écrire les tests rouges du CLI**

Tester la génération sous `AUDIT/GOVERNANCE/`, l’état `PENDING`, la conservation d’un `owner-approval.json`, l’indépendance de `cwd`, `--require-owner-approval` et le nettoyage des temporaires.

- [ ] **Step 2: Exécuter les tests et constater l’échec**

Run: `python -m pytest scripts/pre-rentree/tests/test_release_governance.py -q`

Expected: FAIL, CLI absent.

- [ ] **Step 3: Implémenter les écritures atomiques**

Ajouter `atomic_json` et `write_governance_bundle`. Écrire le manifest, le modèle, une copie du schéma et la décision. Ne jamais écrire ni modifier `owner-approval.json`.

- [ ] **Step 4: Implémenter le CLI mince**

Le CLI exige `--package`, accepte `--require-owner-approval` et résout les chemins depuis `REPO_ROOT` sans dépendre de `cwd`.

- [ ] **Step 5: Exécuter les tests du CLI**

Run: `python -m pytest scripts/pre-rentree/tests/test_release_governance.py -q`

Expected: PASS.

- [ ] **Step 6: Commit local**

```bash
git add scripts/pre-rentree/verify_release_approvals.py scripts/pre-rentree/release_governance.py scripts/pre-rentree/tests/test_release_governance.py
git commit -m "feat: add pre-rentree release governance cli"
```

## Chunk 4: Dossier opérationnel non public

### Task 4: Préparer les revues propriétaire, juridique et confidentialité

**Files:**
- Create: `docs/operations/pre-rentree-2026/owner-review-checklist.md`
- Create: `docs/operations/pre-rentree-2026/legal-review-request.md`
- Create: `docs/operations/pre-rentree-2026/privacy-review-request.md`
- Create: `docs/operations/pre-rentree-2026/README.md`
- Modify: `scripts/pre-rentree/tests/test_release_governance.py`

- [ ] **Step 1: Écrire les tests de sécurité documentaire**

Vérifier que les documents portent `NON PUBLIC`, que les demandes juridiques n’utilisent pas `STATUS: APPROVED`, et qu’aucun fichier n’est créé au chemin canonique `docs/legal/pre-rentree-2026-commercial-terms-gap-analysis.md`.

- [ ] **Step 2: Exécuter les tests et constater l’échec**

Run: `python -m pytest scripts/pre-rentree/tests/test_release_governance.py -q`

Expected: FAIL, documents absents.

- [ ] **Step 3: Rédiger la checklist propriétaire**

Couvrir provenance, six PDF, six HTML, trois visuels, programmes, planning, prix, CTA, contact, conditions publiques, accessibilité, revue visuelle et décision finale.

- [ ] **Step 4: Rédiger les demandes de revue**

Présenter chaque clause comme `À APPROUVER / CORRIGER / REFUSER`, inclure les métadonnées requises et distinguer conditions commerciales de notice de confidentialité. Ne pas prétendre que les textes sont canoniques ou approuvés.

- [ ] **Step 5: Exécuter les tests documentaires**

Run: `python -m pytest scripts/pre-rentree/tests/test_release_governance.py -q`

Expected: PASS.

- [ ] **Step 6: Commit local**

```bash
git add docs/operations/pre-rentree-2026 scripts/pre-rentree/tests/test_release_governance.py
git commit -m "docs: add pre-rentree approval review kit"
```

## Chunk 5: Intégration et vérification finale

### Task 5: Générer l’état PENDING sur le paquet réel

**Files:**
- Generate: `outputs-v5-canonical/AUDIT/GOVERNANCE/review-manifest.json`
- Generate: `outputs-v5-canonical/AUDIT/GOVERNANCE/owner-approval.template.json`
- Generate: `outputs-v5-canonical/AUDIT/GOVERNANCE/owner-approval.schema.json`
- Generate: `outputs-v5-canonical/AUDIT/GOVERNANCE/release-decision.json`
- Modify: `docs/audits/2026-07-19-pre-rentree-2026-v5-canonical.md`

- [ ] **Step 1: Exécuter le CLI sur le paquet réel**

```bash
python scripts/pre-rentree/verify_release_approvals.py --package outputs-v5-canonical
```

Expected: `OWNER_REVIEW_DECISION=PENDING`, public inchangé, privé bloqué.

- [ ] **Step 2: Vérifier le mode strict**

```bash
python scripts/pre-rentree/verify_release_approvals.py --package outputs-v5-canonical --require-owner-approval
```

Expected: code non nul documenté, sans modification des PDF ni de la v4.

- [ ] **Step 3: Lancer les vérifications fraîches**

```bash
python -m pytest scripts/pre-rentree/tests -q
npm test -- --runInBand --runTestsByPath \
  __tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts \
  __tests__/campaigns/pre-rentree-2026.test.ts \
  __tests__/campaigns/pre-rentree-2026-structure.test.ts \
  __tests__/campaigns/pre-rentree-2026-public-claims.test.ts
npm run typecheck
python -m py_compile scripts/pre-rentree/*.py
git diff --check
```

Expected: toutes les suites réussissent; le mode strict reste le seul échec intentionnel.

- [ ] **Step 4: Mettre à jour l’audit final**

Documenter le manifest de revue, son SHA, l’état `PENDING`, l’absence d’approbation humaine et le maintien du blocage privé.

- [ ] **Step 5: Revue de code locale**

Inspecter sécurité des chemins, validation de schéma, atomicité, déterminisme, non-écrasement et vocabulaire interdit. Corriger tout P0/P1 avant commit.

- [ ] **Step 6: Commit local final**

```bash
git add scripts/pre-rentree docs/operations/pre-rentree-2026 docs/audits/2026-07-19-pre-rentree-2026-v5-canonical.md
git commit -m "feat: govern pre-rentree owner review"
```

- [ ] **Step 7: Conserver la branche sans push**

Vérifier `git status --short`, conserver `codex/pre-rentree-2026-v5-canonical` et ne pas pousser ni fusionner sans validation explicite.
