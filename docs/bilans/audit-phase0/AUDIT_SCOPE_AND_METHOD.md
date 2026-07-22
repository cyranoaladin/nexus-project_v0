# Périmètre et méthode

## Mandat et restrictions

Audit contradictoire de la phase 0 et du premier registre curriculum. Aucun code, schéma Prisma, migration, route, composant ou configuration n'a été corrigé. Les seules écritures intentionnelles sont les fichiers de ce dossier. Le script existant `node scripts/security/audit-api-guards.mjs` a modifié son seul horodatage dans `docs/security/API_GUARD_INVENTORY.md`; cette ligne a été immédiatement restaurée à sa valeur initiale et le diff final le confirme.

## État initial reproductible

Commandes :

```bash
pwd
git -C ./nexus-project_v0 branch --show-current
git -C ./nexus-project_v0 rev-parse HEAD
git -C ./nexus-project_v0 status --short --untracked-files=all
```

Résultat : workspace attendu ; branche `main` au lieu de `audit/bilans-phase0-independent`; HEAD `db04d23...`; un fichier suivi modifié (`.gitignore`) et vingt fichiers non suivis. Aucune branche n'a été changée.

## Sources lues

- `../Cahier_charges.md`, 2 278 lignes, lu intégralement.
- Tous les documents exigés sous `docs/bilans/`, l'ADR-001, l'ensemble des fichiers modifiés/non suivis et les règles `AGENTS.md`/`.clinerules`.
- Annexes `../nexus_bilans_audit` : Markdown, CSV, JSON, ZIP et structure XML du DOCX. Les six objets contenus dans le ZIP ont été checksumés en flux et comparés aux extractions.
- Architecture effective : `package.json`, Next/TS, middleware/instrumentation, `app/`, `lib/`, Prisma, scripts, Docker Compose, CI, déploiement et documentation d'exploitation.

## Méthodes de preuve

1. Inventaire combiné `git diff` + `git ls-files --others`, puis taille et SHA-256.
2. Recherche d'usage par `rg`; lecture numérotée avec `nl -ba` pour les chemins critiques.
3. Exécution des gates du dépôt, sans reprendre les nombres du rapport précédent.
4. Tests négatifs directs du resolver curriculum avec `npx tsx -e`.
5. Vérification des NOR et dates sur les pages officielles du Bulletin officiel : `MENE2602914A` (Seconde), `MENE2602917A` (Première spécialité), `MENE2602919A` (Terminale spécialité) et `MENE2602912A` (cycle 4).
6. Inspection SSH de production en lecture seule : hostname, PM2, conteneurs, ports, volumes, branche/HEAD, présence des répertoires de stockage. Aucune valeur de secret, donnée utilisateur ou requête DB n'a été lue.
7. Classification des preuves : `PASS`, `FAIL`, `BLOCKED_NOT_VALIDATED`, `UNKNOWN_PRODUCTION_FACT`.

## Limites

- L'accord explicite requis pour démarrer `docker-compose.test.yml` n'a pas été reçu : aucune base locale n'a été démarrée.
- Les comportements LLM/RAG n'ont pas été testés contre des fournisseurs réels afin d'éviter coûts, PII et mutation externe.
- La production observée est au commit `1b8219b1...`, différent du HEAD audité : les constats de production prouvent la topologie, pas le déploiement du changeset phase 0.
- Le DOCX a été inspecté par son contenu OOXML et son texte, pas par rendu visuel page à page.
- `REQUIREMENTS_TRACEABILITY.csv` et `FINDINGS.csv` sont présents et checksumés, mais la règle existante `*.csv` les masque dans `git status`; aucune modification de `.gitignore` n'a été faite par cet audit.

## Hashes des annexes

| Objet | SHA-256 |
|---|---|
| DOCX | `7fb20be9458f6f09a71863c767274061b064d2830dfd135185b2e455a1b83713` |
| Markdown | `27ab75ce6537299c63720a534a5413cd3c397555208fd6bdd114c99c3e36f6fe` |
| ZIP | `62a477885e545a54241452f1d409bef1824cbe0e7c11002c7470afe2e26d7d02` |

La commande exacte et les sorties synthétiques des tests sont dans `TEST_EVIDENCE.md`.
