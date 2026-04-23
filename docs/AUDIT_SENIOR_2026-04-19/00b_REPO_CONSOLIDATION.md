# LOT 0.0 — Consolidation et identification du repo authoritative

> Audit 2026-04-19 — Lecture seule. Aucune modification effectuée.

---

## 1. Conclusion principale

**Repo authoritative : `cyranoaladin/nexus-project_v0`**

Preuve directe : étiquette Docker Compose sur le conteneur en production.

```
com.docker.compose.project: nexus-project_v0
com.docker.compose.project.config_files: /var/www/nexus-project_v0/docker-compose.prod.yml
com.docker.compose.project.working_dir: /var/www/nexus-project_v0
```

Le conteneur `nexus-app-prod` (image `nexus-project_v0-nexus-app`) tourne depuis 3h au moment de l'audit et répond sur `nexusreussite.academy` (HTTP 200 confirmé).

---

## 2. Cartographie des dépôts et instances

### 2.1 Repos GitHub

| Repo | Dernier push | HEAD | Statut |
|------|-------------|------|--------|
| `cyranoaladin/nexus-project_v0` | 2026-04-19T16:52:49Z | `00d54e9a` | **ACTIF — authoritative** |
| `cyranoaladin/nexus-reussite-app` | 2025-08-06T21:58:12Z | `8f029664` | **STALE — prédécesseur archivé** |

Les deux repos sont **divergents** : le commit `8f029664` (HEAD de `nexus-reussite-app`) est absent de l'historique de `nexus-project_v0` (`git cat-file -e 8f029664e4fc` → fatal). Ils ont le même `package.json` name (`nexus-reussite-app` v1.0.0), ce qui confirme la filiation mais pas la lignée git partagée.

### 2.2 Instances sur le serveur 88.99.254.59

| Chemin | Type | Git remote | HEAD serveur | Rôle |
|--------|------|-----------|-------------|------|
| `/var/www/nexus-project_v0/` | Déploiement Docker (non-git) | — | — | **Source du conteneur prod** |
| `/opt/nexus/` | Clone git | `nexus-project_v0.git` | `ba756884` | Clone de maintenance |
| `/opt/eaf/releases/20260413_002758/` | Release EAF | — | `.git_sha = unknown` | **Codebase distincte, non déployée** |

### 2.3 La codebase EAF (`nexus-reussite-eaf` v1.0.2)

`/opt/eaf/` est un projet **architecturalement différent** de `nexus-project_v0` :

- `package.json` name : `nexus-reussite-eaf` (≠ `nexus-reussite-app`)
- LLM : Mistral (standard / micro / large / reasoning / OCR / embed) — pas d'Ollama
- Architecture : monorepo avec `packages/mcp-server` (MCP, Model Context Protocol)
- Déploiement : `ecosystem.config.cjs` avec 3 processus PM2 (`eaf-nextjs`, `eaf-worker`, `eaf-mcp`)
- Config Next.js : `next.config.ts` (TypeScript) vs `next.config.mjs` dans `nexus-project_v0`
- **Aucun processus EAF actif en PM2** au moment de l'audit — non déployé
- CHANGELOG.md présent avec entrées jusqu'au 2026-04-09 — projet en cours, pas abandonné

**L'EAF est une évolution future distincte, pas un fork de `nexus-project_v0`.** Il ne fait pas l'objet de cet audit.

---

## 3. Infrastructure de production actuelle

```
nexusreussite.academy (88.99.254.59)
    │
    └── Nginx (reverse proxy)
            │
            ├── Port 3001 → nexus-app-prod (Docker)
            │       Image: nexus-project_v0-nexus-app
            │       Source: /var/www/nexus-project_v0/docker-compose.prod.yml
            │       DB: nexus-postgres-prod (pgvector/pg15)
            │
            └── Autres projets sur le même serveur :
                    journey-web (port ?)
                    korrigo backend (port 8088)
                    infra-web (port 13002)
                    compose-ollama (port 11434) ← RAG Ollama
                    compose-chroma (port 8000)  ← ChromaDB (RAG vector store)
                    compose-ingestor (port 18001)
```

**Point notable RAG :** ChromaDB (`compose-chroma-1`, v1.1.1) tourne depuis 4 semaines. Ollama tourne depuis 4 semaines. Le `nexus-postgres-db` (port 5435) tourne depuis 4 semaines — c'est probablement la DB de dev/test locale, distincte de `nexus-postgres-prod`.

---

## 4. Écart de version entre prod et local

| Instance | HEAD commit |
|----------|------------|
| Local (`nexus-project_v0`) | `00d54e9a` (2026-04-19) |
| GitHub (`nexus-project_v0`) | `00d54e9a` ← **en sync** |
| Serveur `/opt/nexus/` | `ba756884` (5 commits de retard) |
| `/var/www/nexus-project_v0/` | Non-git, construit depuis un état antérieur |

Le déploiement en production est en retard de **minimum 5 commits** par rapport à l'état local. Les commits manquants incluent potentiellement des correctifs de sécurité (à vérifier manuellement sur le serveur).

Les 5 commits de retard (local HEAD → `ba756884`) :
```
00d54e9a  chore: snapshot arborescence prod 2026-04-19
7933736b  fix(data): remove stray 'symbols and formulas'...
e6d3ed4e  fix(latex): fix MathBlock multiline...
1a0994ea  fix(latex): render mixed text+math tableau cells...
fc3605f2  fix(e2e): align contract tests with actual app behavior
ba756884  feat(maths-1ere): RAG enrichment per chapter  ← production actuelle
```

---

## 5. Exposition de `nginx/ssl/privkey.pem`

| Périmètre | Exposé ? | Nombre de commits |
|-----------|---------|------------------|
| `cyranoaladin/nexus-project_v0` (GitHub) | **OUI** | 8 commits |
| Repo local (`/home/alaeddine/Bureau/nexus-project_v0`) | **OUI** | 8 commits |
| `/opt/nexus/` (clone serveur prod) | **OUI** | 3 commits + fichiers présents sur disque |
| `cyranoaladin/nexus-reussite-app` (GitHub) | NON | Pas de répertoire `nginx/ssl/` |
| `/opt/eaf/` (EAF, non déployé) | À vérifier | — |

**Conclusion :** La clé privée SSL est exposée dans le repo GitHub public `nexus-project_v0` ET sur le disque du serveur de production (`/opt/nexus/nginx/ssl/privkey.pem`). C'est le finding le plus critique de l'AXE 1.

Le fait que `nexus-reussite-app` ne contienne pas `nginx/ssl/` suggère que cette fuite est apparue lors de la migration vers `nexus-project_v0` (à partir de `9fc4ca30`, 2026-02-02 `feat(deploy): implement production-ready Docker deployment`).

---

## 6. Stratégie de consolidation

### Décision recommandée

**Archiver `cyranoaladin/nexus-reussite-app`**, conserver `cyranoaladin/nexus-project_v0` comme seul repo actif.

### Plan en 4 étapes

**Étape 1 — Archivage de `nexus-reussite-app`** (10 min, aujourd'hui)
Action : Sur GitHub, `Settings → Danger Zone → Archive this repository`.
Raison : 8 mois sans activité, divergent, pas en production. Le garder visible crée de la confusion mais pas de risque sécurité (absence de `privkey.pem` confirmée).
Critère : Repo archivé, aucun nouveau push possible.

**Étape 2 — Nettoyage historique `nexus-project_v0`** (30 min, LOT 0)
Action : `bash scripts/cleanup-repo.sh --apply` sur le repo local → force-push GitHub.
Périmètre : `nginx/ssl/privkey.pem`, `nginx/ssl/fullchain.pem`, `parent.json`, `student.json`, `get-users-temp.mjs`.
Critère : `git log --all --full-history --oneline -- nginx/ssl/privkey.pem | wc -l == 0` sur GitHub.

**Étape 3 — Nettoyage `/opt/nexus/` sur le serveur prod** (20 min, LOT 0)
Action : Sur le serveur, dans `/opt/nexus/`, exécuter :
```bash
cd /opt/nexus
git fetch origin
git reset --hard origin/main  # après force-push du step 2
# ou : git filter-repo côté serveur si le remote n'est pas encore propre
rm nginx/ssl/privkey.pem nginx/ssl/fullchain.pem
```
Critère : `ls /opt/nexus/nginx/ssl/` → vide ou absent.

**Étape 4 — Régénération du certificat SSL** (15 min)
Action : Révoquer le certificat actuel, en générer un nouveau (Let's Encrypt ou CA actuelle). Déployer via les secrets Docker ou une variable d'env, jamais via un fichier committé.
Critère : `openssl s_client -connect nexusreussite.academy:443 -showcerts` → nouveau certificat avec date d'émission post-nettoyage.

### Ce que le LOT 0 doit couvrir

Le LOT 0 (défini dans `05_FEUILLE_ROUTE_LOTS.md`) doit être **appliqué sur deux périmètres** :

| Périmètre | Action |
|-----------|--------|
| Repo local + GitHub `nexus-project_v0` | `scripts/cleanup-repo.sh --apply` + force-push |
| Serveur prod `/opt/nexus/` | Pull après force-push + suppression manuelle des `.pem` |

Il n'est **pas nécessaire** d'intervenir sur `nexus-reussite-app` (pas de fuite détectée) ni sur `/opt/eaf/` (non déployé, à auditer séparément si le projet EAF avance).

---

## 7. Réponses aux questions du LOT 0.0

| Question | Réponse |
|----------|---------|
| Quel repo est tiré en production ? | `cyranoaladin/nexus-project_v0` (preuve : labels Docker Compose) |
| Les deux repos partagent-ils une lignée git ? | **Non** — commits divergents, `8f029664` absent de `nexus-project_v0` |
| La fuite `privkey.pem` existe-t-elle dans les deux ? | `nexus-project_v0` : OUI (8 commits). `nexus-reussite-app` : NON. |
| Stratégie de consolidation | Archiver `nexus-reussite-app`, nettoyer `nexus-project_v0`, rien à faire sur EAF (audit séparé) |
