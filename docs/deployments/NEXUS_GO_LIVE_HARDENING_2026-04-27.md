# NEXUS GO LIVE HARDENING — 2026-04-27

## Contexte

Ce document consolide l'état de la mise en production pédagogique du 2026-04-27,
les actions d'urgence effectuées, et les correctifs de pérennisation appliqués.

---

## 1. Commit de production

| | Valeur |
|---|---|
| Commit final hardening | `8df32b89` |
| Commit GO LIVE pédagogique | `f220713b` |
| Commit CI fixes | `f4b8605e` |
| Branch | `main` |
| Origin | `github.com:cyranoaladin/nexus-project_v0` |
| URL prod | `https://nexusreussite.academy` |
| Serveur | `<PROD_HOST>` |
| Répertoire prod | `/opt/nexus` |

---

## 2. Migration survivalMode

### Contexte

Les colonnes `survivalMode*` et les tables `survival_progress`/`survival_attempts`
ont été ajoutées au schéma Prisma mais la migration n'avait pas été appliquée
en production, causant une erreur P2022 (`column students.survivalMode does not exist`).

### Action d'urgence effectuée

1. Le SQL a été exécuté directement via `docker exec nexus-postgres-prod psql`
2. La migration a été enregistrée manuellement dans `_prisma_migrations`

### État final

- **Fichier migration** : `prisma/migrations/20260504000000_add_survival_mode/migration.sql` ✅
- **Migration enregistrée en prod** : `_prisma_migrations` → `finished_at: 2026-04-27` ✅
- **Colonnes présentes** :
  - `students.survivalMode` (boolean, NOT NULL, DEFAULT false) ✅
  - `students.survivalModeReason` (text, nullable) ✅
  - `students.survivalModeBy` (text, nullable) ✅
  - `students.survivalModeAt` (timestamp, nullable) ✅
- **Tables** : `survival_progress`, `survival_attempts` ✅
- **Reproductible** : Oui — `prisma migrate deploy` appliquera la migration sur un fresh deploy ✅

### Migration coach_student_assignments (détectée et corrigée)

Migration `20260425230000_add_coach_student_assignments` absente de `_prisma_migrations` prod.

- SQL appliqué via `docker exec` (idempotent — toutes les instructions utilisent `IF NOT EXISTS`)
- Enregistrée dans `_prisma_migrations`
- Table `coach_student_assignments` vérifiée présente

---

## 3. Réseau Docker

### Problème

L'app (`nexus-app-prod`) et la DB (`nexus-postgres-prod`) étaient sur des réseaux différents :
- DB : `nexus-project_v0_nexus-network` (réseau créé par le compose original)
- App : `nexus_nexus-network` (réseau créé par le compose depuis `/opt/nexus`)

Une connexion manuelle avait été effectuée :
```bash
docker network connect nexus-project_v0_nexus-network nexus-app-prod
```

Cette connexion ne survit pas à un `docker compose up -d nexus-app`.

### Correction (commit `8df32b89`)

`docker-compose.prod.yml` — section `networks` :

```yaml
networks:
  nexus-network:
    external: true
    name: nexus-project_v0_nexus-network
```

Tous les services (`postgres`, `migrate`, `nexus-app`) utilisent `nexus-network`,
qui se résout maintenant vers le réseau externe existant.

### État après correction

```
nexus-app-prod  : nexus-project_v0_nexus-network (172.18.0.3)
nexus-postgres-prod : nexus-project_v0_nexus-network (172.18.0.2)
```

Plus aucune intervention manuelle requise après un redémarrage.

---

## 4. Procédure de redéploiement app (sans toucher la DB)

```bash
ssh root@<PROD_HOST>
cd /opt/nexus

# 1. Récupérer les dernières modifications
git fetch origin --prune
git pull --ff-only origin main

# 2. Valider la config Compose
docker compose -f docker-compose.prod.yml config | grep -E "nexus-network|external"

# 3. Rebuild et redémarrer l'app uniquement
docker compose -f docker-compose.prod.yml build nexus-app
docker compose -f docker-compose.prod.yml up -d --no-deps nexus-app

# 4. Attendre le démarrage (healthcheck)
sleep 15

# 5. Vérifier les réseaux
docker inspect nexus-app-prod --format "{{json .NetworkSettings.Networks}}" | python3 -m json.tool

# 6. Vérifier le health
curl -s http://127.0.0.1:3001/api/health
```

**Important** : Ne jamais lancer `docker compose down` ou `docker compose up` sans `--no-deps`
car cela recréerait `nexus-postgres-prod` depuis zéro (perte des données si le volume n'est pas externe).

---

## 5. Appliquer une migration Prisma en prod

```bash
ssh root@<PROD_HOST>
cd /opt/nexus

# Méthode 1 : Via le service migrate du Compose (recommandé)
docker compose -f docker-compose.prod.yml run --rm migrate

# Méthode 2 : Directement via psql (pour migrations urgentes)
cat prisma/migrations/<nom>/migration.sql | \
  docker exec -i nexus-postgres-prod psql -U nexus_admin -d nexus_prod

# Enregistrement manuel si méthode 2 :
docker exec nexus-postgres-prod psql -U nexus_admin -d nexus_prod -c "
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
VALUES (gen_random_uuid()::text, md5('<migration_name>'), NOW(), '<migration_name>', 1)
ON CONFLICT (migration_name) DO NOTHING;
"
```

---

## 6. Vérifications health post-déploiement

```bash
# Health interne
curl -s http://127.0.0.1:3001/api/health

# Routes critiques
for url in \
  https://nexusreussite.academy/api/health \
  https://nexusreussite.academy/programme/maths-1ere-stmg \
  https://nexusreussite.academy/dashboard/eleve \
  https://nexusreussite.academy/dashboard/eleve/automatismes \
  https://nexusreussite.academy/dashboard/coach/students \
  https://nexusreussite.academy/dashboard/assistante \
  https://nexusreussite.academy/dashboard/assistante/assignments
do
  CODE=$(curl -s -L -o /dev/null -w "%{http_code}" "$url")
  echo "$CODE  $url"
done

# Logs
docker logs nexus-app-prod --tail 50 2>&1 | grep -iE "error|prisma|fatal"
```

---

## 7. Procédure de rollback

```bash
ssh root@<PROD_HOST>
cd /opt/nexus

# Rollback sur un commit précis
git checkout <commit_sha>

# Rebuild et redémarrer
docker compose -f docker-compose.prod.yml build nexus-app
docker compose -f docker-compose.prod.yml up -d --no-deps nexus-app

# Vérifier
curl -s http://127.0.0.1:3001/api/health
```

**Note** : Le rollback applicatif ne rollbacke pas les migrations DB.
Si une migration doit être annulée, une migration compensatoire doit être créée.

---

## 8. Routes critiques vérifiées (2026-04-27)

### Anonyme (sans session)

| Route | Code final | Comportement |
|---|---|---|
| `/api/health` | 200 | ✅ vraie réponse JSON `{status:"ok"}` |
| `/dashboard/eleve` | 200 | redirect → `/auth/signin?callbackUrl=...` (RBAC normal) |
| `/dashboard/eleve/automatismes` | 200 | redirect → `/auth/signin` (RBAC normal) |
| `/dashboard/eleve/programme/maths` | 200 | redirect → `/auth/signin` (RBAC normal) |
| `/programme/maths-1ere-stmg` | 200 | redirect → `/dashboard/eleve/programme/maths` puis `/auth/signin` |
| `/dashboard/coach/students` | 200 | redirect → `/auth/signin` (RBAC normal) |
| `/dashboard/assistante` | 200 | redirect → `/auth/signin` (RBAC normal) |
| `/dashboard/assistante/assignments` | 200 | redirect → `/auth/signin` (RBAC normal) |

**Aucun 500, aucun 404.** Toutes les routes protégées finissent en page signin avec
HTTP 200, ce qui est le comportement attendu de NextAuth pour des routes guardées
sans session.

### Authentifié — compte STMG de recette

Compte de recette : `student46-1@nexus.local` (mot de passe non exposé dans ce document — voir secrets manager interne).

Test Playwright headless réalisé le 2026-04-27 :

| Vérification | Résultat |
|---|---|
| Login NextAuth | ✅ redirige vers `/dashboard/eleve` |
| Dashboard chargé | ✅ HTTP 200, title `Dashboard \| Nexus Réussite` |
| Carte `AutomatismesDashboardCard` (EDS) masquée | ✅ absente du dashboard STMG |
| Garde `/dashboard/eleve/automatismes` active | ✅ écran "Parcours STMG" rendu |
| Bouton "Mon tableau de bord STMG" présent | ✅ |
| Bouton "Maths STMG" présent | ✅ |
| `/programme/maths-1ere-stmg` accessible authentifié | ✅ HTTP 200 |
| Erreurs JS console | 0 |
| Réponses HTTP ≥ 500 | 0 |

---

## 9. Dette restante

### P0 (bloquant pour les utilisateurs)
- Aucun

### P1 (à traiter dans la prochaine semaine)
- **Workflow coach → ressource → élève non testé end-to-end** :
  la table `coach_student_assignments` est vide en prod (0 assignment actif). Le code
  RBAC `isCoachRattachedToStudent` passe par fallback `sessionBooking`. Validation
  statique uniquement (route handlers + tests Jest). À tester réellement quand un
  premier coach sera assigné à un élève.
- **`20260501000000_add_maths_progress` `applied_steps_count = 0`** : ANALYSÉ ET BÉNIN.
  La table `maths_progress` est intégralement présente (31 colonnes, 4 indexes incluant
  `track`, `userId+level+track` unique). L'`applied_steps_count = 0` est la signature
  de `prisma migrate resolve --applied`, utilisé pour marquer la migration comme
  appliquée car la table préexistait dans la DB depuis l'init original. Aucun drift.
- Vérifier que `prisma migrate status` ne rapporte pas de drift après le prochain
  `prisma migrate deploy` (vérifié 2026-04-27 : `Database schema is up to date! 28 migrations`).

### P2 (dette technique non urgente)
- Supprimer le réseau `nexus_nexus-network` résiduel en prod (inactif depuis la correction)
  ```bash
  docker network rm nexus_nexus-network  # seulement si aucun container ne l'utilise
  ```
- Variables recommandées manquantes (non bloquantes — dégradation gracieuse) :

  | Variable | Fonction | Impact en absence |
  |---|---|---|
  | `OLLAMA_URL` | URL service LLM Ollama local | Les appels ARIA/IA locaux retournent un fallback ; à vérifier qu'aucune route `/api/aria/**` ne renvoie 500 sans cette var |
  | `RAG_INGESTOR_URL` | URL ingestor du pipeline RAG | L'ingestion documentaire vers le RAG est désactivée ; les recherches sémantiques peuvent tomber sur un index vide |
  | `RAG_API_TOKEN` | Bearer token pour `https://rag-api.nexusreussite.academy` | Idem ci-dessus ; vérifier que l'absence de token ne produit pas de log d'erreur répété |
  | `CLICTOPAY_API_KEY` | Clé Banque Zitouna ClicToPay | Aucun paiement ne peut être initié ; UI paiement doit masquer le bouton ou afficher un état "indisponible" |
  | `TELEGRAM_BOT_TOKEN` | Token bot notifications Telegram | Les notifications Telegram sont silencieusement ignorées ; à auditer dans `lib/notifications/**` |

  **Action P2** : vérifier pour chacune que son absence produit une dégradation gracieuse
  (log `warn` + fallback) et **non** une erreur silencieuse ou un 500.

- **Jeu de comptes de recette à préparer** (P2) :
  - Élève Première EDS
  - Élève Première STMG (actuellement : `student46-1@nexus.local`)
  - Élève Terminale
  - Coach (assigné à l'un des élèves)
  - Assistante
  - Admin

---

## 10. Décision de clôture

```text
Décision de clôture :
- Aucun P0 restant.
- Production reproductible.
- GO LIVE élèves validé.
- GO LIVE STMG validé en authentifié (Playwright, compte student46-1).
- GO LIVE EDS validé techniquement (routes, build, absence de 500).
- GO LIVE assistante validé techniquement (build/routes).
- GO LIVE coach validé statiquement (handlers + tests Jest).
- E2E coach → ressource → élève classé P1, faute d'assignation réelle en production.
  Checklist + spec Playwright squelette prêts pour exécution dès premier assignment :
    - docs/qa/COACH_RESOURCE_STUDENT_E2E_CHECKLIST.md
    - e2e/real/coach-resource-student.spec.ts (skippé sans RUN_COACH_RESOURCE_E2E=1)
- Pas de réouverture de chantier P0 tant qu'un incident réel n'est pas observé.
```

---

## 11. État final des validations

| Vérification | État |
|---|---|
| `tsc --noEmit` | ✅ 0 erreur |
| `prisma validate` | ✅ Schema valide |
| `prisma generate` | ✅ |
| Tests Jest (390 suites) | ✅ 5163 tests passés |
| Build Docker | ✅ |
| Health prod | ✅ 200 |
| Réseau app↔db | ✅ Automatique |
| Migration survivalMode | ✅ Appliquée et enregistrée |
| Migration coach_student_assignments | ✅ Appliquée et enregistrée |
| Routes critiques | ✅ Toutes 200 |

---

*Document généré le 2026-04-27 — commit `8df32b89`*
