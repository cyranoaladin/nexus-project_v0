# Jobs Dashboard (FastAPI)

Ce document recense les deux workers Python responsables de l’actualisation du Dashboard Élève. Ils sont empaquetés avec l’API FastAPI (`apps/api`) et peuvent être exécutés en CLI ou programmés via cron/systemd.

## 1. Dashboard Summary Refresh

- **Module** : `app.jobs.dashboard_refresh_worker`
- **Commande** :
  ```bash
  PYTHONPATH=apps/api \
  apps/api/.venv/bin/python -m app.jobs.dashboard_refresh_worker --interval 60
  ```
- **Rafraîchissement ponctuel** :
  ```bash
  PYTHONPATH=apps/api \
  apps/api/.venv/bin/python -m app.scripts.refresh_dashboard_summary --concurrently
  ```
- **Paramètres** :
  - `--interval` (secondes) : délai entre deux scrutations des événements `DASHBOARD_SUMMARY_REFRESH_REQUESTED`.
  - `--once` : traite le backlog une seule fois puis termine.
- **Notes** :
  - `app.scripts.refresh_dashboard_summary` déclenche un rafraîchissement immédiat (utile après une migration ou un import massif).
  - Utilisez `--concurrently` si la base PostgreSQL supporte `REFRESH MATERIALIZED VIEW CONCURRENTLY` (version ≥ 15).
- **Effet** :
  1. Détecte les événements d’actualisation `dashboard_summary` émis lors des actions (tâches, évaluations…).
  2. Rafraîchit la vue matérialisée `mv_dashboard_summary` pour les élèves concernés.
  3. Écrit un événement `DASHBOARD_SUMMARY_REFRESH_COMPLETED` avec la liste des élèves traités.

> 🛠️ **Cron suggéré** : toutes les 5 minutes (`*/5 * * * *`).

## 2. Parent Report Worker

- **Module** : `app.jobs.parent_report_worker`
- **Commande** :
  ```bash
  PYTHONPATH=apps/api \
  apps/api/.venv/bin/python -m app.jobs.parent_report_worker --regenerate
  ```
- **Paramètres** :
  - `--student-id` : peut être répété pour cibler un ou plusieurs élèves (UUID). Sans ce paramètre, le worker traite tous les élèves.
  - `--period` : chaîne `YYYY-MM` permettant de générer un rapport rétroactif.
  - `--regenerate` : force la régénération même si un rapport est déjà en cache pour la période.
- **Effet** :
  1. Agrège les KPIs (`progress`, tâches, sessions) via les services Dashboard.
  2. Met à jour la table `reports` (`summary_md`, `kpis_json`, `payload`).
  3. Retourne un résumé par élève (utilisé dans `tests/test_parent_report_worker.py`).

> 🛠️ **Cron suggéré** : tous les lundis à 06h00 (`0 6 * * 1`) ou à adapter selon la fréquence souhaitée des emails parents.

## 3. Dépendances & Vérifications

- **Python env** : activer le virtualenv `apps/api/.venv` avant d’exécuter les commandes.
- **Variables d’environnement** : le worker se base sur `DATABASE_URL` (comme l’API). S’assurer qu’elle est définie.
- **Logs** : les deux scripts utilisent `logging` (niveau INFO par défaut). Injecter `LOG_LEVEL=DEBUG` si besoin via `PYTHONPATH=... LOG_LEVEL=DEBUG python -m app.jobs...`.
- **Tests** :
  - `tests/test_parent_report_worker.py` vérifie la génération côté job.
  - `tests/test_agents_router.py` couvre la route `/agents/reporter/bulk` exposée pour automatiser depuis le back-office.

## 4. Intégration API (Agents)

L’API expose un endpoint pour déclencher la génération depuis une interface coach/admin :

```http
POST /agents/reporter/bulk
Headers: { "X-Role": "coach" | "admin" }
Body: { "student_ids": ["<uuid>"], "period": "2025-11", "regenerate": true }
```

- Retour : liste de rapports (`reports[]`) compatibles avec `ParentReportResponse`.
- Règles :
  - `coach`/`parent` : doivent fournir explicitement les `student_ids` autorisés.
  - `admin` : peut omettre `student_ids` pour tout régénérer.

Ces workers complètent les exigences « Dashboard Élève » : le premier maintient les KPI temps réel, le second fournit les synthèses parentales périodiques.
