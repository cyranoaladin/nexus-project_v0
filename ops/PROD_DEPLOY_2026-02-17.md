# PROD DEPLOY — 2026-02-17 — Nexus 2.0 Learning Graph v2

> **Forensic-ready audit trail** — Toutes les preuves sont copiables et vérifiables.

---

## 1. Commit déployé

```
$ git rev-parse HEAD
1012faec5fa6f9e41c1d9d01d166fa8771677fd1
```

Commits inclus :
- `59f6ca4b` — feat(nexus-2.0): Learning Graph v2 — SSN, DomainScores, Cohort, RBAC, Dataset 50Q
- `1012faec` — fix(P0): LLM failure must not block assessment results

---

## 2. Prisma Migrate Status

```
$ DATABASE_URL='postgresql://nexus_admin:***@127.0.0.1:5435/nexus_prod?schema=public' \
  npx prisma migrate status

Datasource "db": PostgreSQL database "nexus_prod", schema "public" at "127.0.0.1:5435"
11 migrations found in prisma/migrations

Database schema is up to date!
```

### Migrations appliquées (DB `_prisma_migrations`)

```
$ docker exec nexus-postgres-db psql -U nexus_admin -d nexus_prod \
  -c "SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations ORDER BY finished_at;"

              migration_name                |          finished_at          | applied_steps_count
--------------------------------------------+-------------------------------+---------------------
 20260201114538_init_postgres_prod           | 2026-02-09 23:54:58.595531+00 |                   1
 20260201201047_add_payment_idempotency      | 2026-02-09 23:54:58.60911+00  |                   1
 20260201201415_add_session_overlap_prevention| 2026-02-09 23:54:58.663605+00 |                   1
 20260201201534_add_credit_transaction_idempotency| 2026-02-09 23:54:58.681413+00 |               1
 20260201201612_add_cron_execution_tracking  | 2026-02-09 23:54:58.716525+00 |                   1
 20260202182051_add_referential_integrity_and_indexes| 2026-02-09 23:54:58.800622+00 |            1
 20260202210244_add_session_reports          | 2026-02-09 23:54:58.838865+00 |                   1
 20260214_fix_cascade_constraints            | 2026-02-14 21:20:14.241676+00 |                   1
 20260214_init_assessment_module             | 2026-02-14 21:20:14.324403+00 |                   1
 20260216_add_entitlement_engine             | 2026-02-17 07:23:23.225572+00 |                   1
 20260217_learning_graph_v2                  | 2026-02-17 21:50:57.991809+00 |                   1
(11 rows)
```

---

## 3. Extraction SQL — Existence tables et colonnes

### 3a. Tables cibles

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('domain_scores','skill_scores','progression_history','projection_history')
ORDER BY table_name;

     table_name
---------------------
 domain_scores
 progression_history
 projection_history
 skill_scores
(4 rows)
```

### 3b. Colonnes ajoutées sur `assessments`

```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'assessments'
AND column_name IN ('ssn','assessmentVersion','engineVersion','studentId','uai')
ORDER BY column_name;

    column_name    |    data_type     | is_nullable
-------------------+------------------+-------------
 assessmentVersion | text             | YES
 engineVersion     | text             | YES
 ssn               | double precision | YES
 studentId         | text             | YES
 uai               | double precision | YES
(5 rows)
```

### 3c. Indexes (13 non-pkey)

```sql
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('domain_scores','skill_scores','progression_history','projection_history','assessments')
AND indexname NOT LIKE '%pkey'
ORDER BY tablename, indexname;

                 indexname                  |      tablename
--------------------------------------------+---------------------
 assessments_createdAt_idx                  | assessments
 assessments_publicShareId_key              | assessments
 assessments_ssn_idx                        | assessments
 assessments_status_idx                     | assessments
 assessments_studentEmail_idx               | assessments
 assessments_studentId_idx                  | assessments
 assessments_subject_grade_idx              | assessments
 domain_scores_assessmentId_idx             | domain_scores
 domain_scores_domain_idx                   | domain_scores
 progression_history_studentId_date_idx     | progression_history
 projection_history_studentId_createdAt_idx | projection_history
 skill_scores_assessmentId_idx              | skill_scores
 skill_scores_skillTag_idx                  | skill_scores
(13 rows)
```

### 3d. FK Constraints (5)

```sql
SELECT conname, conrelid::regclass AS table_from, confrelid::regclass AS table_to
FROM pg_constraint
WHERE contype = 'f'
AND (conrelid::regclass::text IN ('domain_scores','skill_scores','progression_history','projection_history')
     OR (conrelid::regclass::text = 'assessments' AND conname LIKE '%studentId%'))
ORDER BY conname;

              conname               |     table_from      |  table_to
------------------------------------+---------------------+-------------
 assessments_studentId_fkey         | assessments         | students
 domain_scores_assessmentId_fkey    | domain_scores       | assessments
 progression_history_studentId_fkey | progression_history | students
 projection_history_studentId_fkey  | projection_history  | students
 skill_scores_assessmentId_fkey     | skill_scores        | assessments
(5 rows)
```

---

## 4. Backup DB — Audit

### Commande de dump

```bash
docker exec nexus-postgres-db pg_dump -U nexus_admin -Fc nexus_prod \
  > /root/backups/nexus/nexus_prod_pre_v2_20260217_224834.dump
```

### Taille

```
-rw-r--r-- 1 root root 96K Feb 17 22:48 /root/backups/nexus/nexus_prod_pre_v2_20260217_224834.dump
```

### Taille DB non compressée

```sql
SELECT pg_size_pretty(pg_database_size('nexus_prod'));

 pg_size_pretty
----------------
 10 MB
(1 row)
```

**Explication** : 96K compressé pour 10 MB non compressé est cohérent — la DB est jeune (seed + 2 assessments smoke test). Le format `-Fc` (custom) est hautement compressé.

### pg_restore --list (contenu du dump)

```
$ docker exec nexus-postgres-db pg_restore --list /tmp/backup_audit.dump

# Nombre total d'objets : 207
# TABLE DATA entries   : 29

Tables avec données :
 TABLE DATA public CoachAvailability
 TABLE DATA public SessionBooking
 TABLE DATA public SessionNotification
 TABLE DATA public SessionReminder
 TABLE DATA public _prisma_migrations
 TABLE DATA public aria_conversations
 TABLE DATA public aria_messages
 TABLE DATA public assessments
 TABLE DATA public badges
 TABLE DATA public coach_profiles
 TABLE DATA public credit_transactions
 TABLE DATA public cron_executions
 TABLE DATA public diagnostics
 TABLE DATA public entitlements
 TABLE DATA public messages
 TABLE DATA public notifications
 TABLE DATA public parent_profiles
 TABLE DATA public payments
 TABLE DATA public pedagogical_contents
 TABLE DATA public session_reports
 TABLE DATA public sessions
 TABLE DATA public stage_reservations
 TABLE DATA public student_badges
 TABLE DATA public student_profiles
 TABLE DATA public student_reports
 TABLE DATA public students
 TABLE DATA public subscription_requests
 TABLE DATA public subscriptions
 TABLE DATA public users
```

**Verdict** : le dump contient 207 objets (schéma + données), 29 tables avec données. Ce n'est **pas** un dump vide.

---

## 5. Smoke Tests — Commandes exactes et résultats

### A. Pages publiques (HTTP 200)

```bash
$ curl -s -o /dev/null -w '%{http_code}' https://nexusreussite.academy/bilan-gratuit
→ 200

$ curl -s -o /dev/null -w '%{http_code}' https://nexusreussite.academy/stages/fevrier-2026/diagnostic
→ 200

$ curl -s -o /dev/null -w '%{http_code}' https://nexusreussite.academy/bilan-pallier2-maths
→ 200

$ curl -s -o /dev/null -w '%{http_code}' https://nexusreussite.academy/auth/signin
→ 200
```

### B. RBAC — Négatif (sans session)

```bash
$ curl -s https://nexusreussite.academy/api/admin/directeur/stats
→ HTTP 403
{"success":false,"error":"Accès non autorisé. Rôle ADMIN requis."}

$ curl -s -X POST https://nexusreussite.academy/api/admin/recompute-ssn \
  -H "Content-Type: application/json" -d '{"type":"MATHS"}'
→ HTTP 403
{"success":false,"error":"Accès non autorisé. Rôle ADMIN requis."}
```

### B. RBAC — Positif (session ADMIN réelle)

```bash
# Login
$ CSRF=$(curl -s -c cookies.txt https://nexusreussite.academy/api/auth/csrf \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")
$ curl -s -c cookies.txt -b cookies.txt -X POST \
  https://nexusreussite.academy/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=admin%40nexus-reussite.com&password=admin123&csrfToken=$CSRF&json=true"
→ HTTP 200 {"url":"https://nexusreussite.academy/dashboard/admin"}

# directeur/stats
$ curl -s -b cookies.txt https://nexusreussite.academy/api/admin/directeur/stats
→ HTTP 200
{
  "success": true,
  "kpis": {
    "totalAssessments": 2,
    "completedAssessments": 2,
    "averageSSN": 36.1,
    "averageGlobalScore": 24.5,
    "activeStudents": 3,
    "stageConversionRate": null
  },
  "distribution": {
    "excellence": 0, "tres_solide": 0, "stable": 0,
    "fragile": 1, "prioritaire": 1
  },
  "subjectAverages": [{"subject": "MATHS", "avgSSN": 36.1}],
  "alerts": [
    {"studentName": "Smoke Zero Score", "ssn": 19.8, "subject": "MATHS"}
  ],
  "monthlyProgression": [{"month": "2026-02", "avgSSN": 36.1, "count": 2}]
}
```

### C. Workflow Assessment — Submit → Result → DomainScores

#### Assessment 1 (réponses mixtes)

```bash
$ curl -s -X POST https://nexusreussite.academy/api/assessments/submit \
  -H "Content-Type: application/json" \
  -d '{"subject":"MATHS","grade":"TERMINALE","studentData":{"email":"smoke-test-prod@nexus-reussite.com","name":"Smoke Test Prod"},"answers":{"MATH-COMB-01":"a","MATH-COMB-02":"a","MATH-COMB-03":"b","MATH-COMB-04":"a","MATH-COMB-05":"a","MATH-COMB-06":"c","MATH-ANA-01":"b","MATH-ANA-02":"a","MATH-ANA-03":"c","MATH-ANA-04":"d","MATH-ANA-05":"a","MATH-ANA-06":"b","MATH-GEO-01":"a","MATH-GEO-02":"b","MATH-GEO-03":"d","MATH-GEO-04":"a","MATH-PROB-01":"a","MATH-PROB-02":"c","MATH-PROB-03":"b","MATH-PROB-04":"a","MATH-LOGEXP-01":"b","MATH-LOGEXP-02":"a","MATH-LOGEXP-03":"c"},"duration":600000}'
→ HTTP 201
{"success":true,"assessmentId":"cmlr595yp0000mh01hzyr7ryn"}

# Result (après processing LLM ~2min)
$ curl -s https://nexusreussite.academy/api/assessments/cmlr595yp0000mh01hzyr7ryn/result
→ HTTP 200
{
  "status": "COMPLETED",
  "globalScore": 49,
  "ssn": 52.4,
  "domainScores": [
    {"domain": "combinatoire", "score": 67},
    {"domain": "geometrie", "score": 50},
    {"domain": "probabilites", "score": 50},
    {"domain": "analyse", "score": 33}
  ],
  "generationStatus": "COMPLETE",
  "cohortMean": 49, "cohortStd": 15, "cohortN": 1, "isLowSample": true
}
```

#### Assessment 2 (toutes réponses fausses — preuve score=0)

```bash
$ curl -s -X POST https://nexusreussite.academy/api/assessments/submit \
  -H "Content-Type: application/json" \
  -d '{"subject":"MATHS","grade":"TERMINALE","studentData":{"email":"smoke-zero@nexus-reussite.com","name":"Smoke Zero Score"},"answers":{"MATH-COMB-01":"b","MATH-COMB-02":"b","MATH-COMB-03":"b","MATH-COMB-04":"b","MATH-COMB-05":"b","MATH-COMB-06":"b","MATH-ANA-01":"d","MATH-ANA-02":"d","MATH-ANA-03":"d","MATH-ANA-04":"d","MATH-ANA-05":"d","MATH-ANA-06":"d","MATH-GEO-01":"d","MATH-GEO-02":"d","MATH-GEO-03":"d","MATH-GEO-04":"d","MATH-PROB-01":"d","MATH-PROB-02":"d","MATH-PROB-03":"d","MATH-PROB-04":"d","MATH-LOGEXP-01":"d","MATH-LOGEXP-02":"d","MATH-LOGEXP-03":"d"},"duration":120000}'
→ HTTP 201
{"success":true,"assessmentId":"cmlr5dciy0002mh01mqwba975"}

# Result
$ curl -s https://nexusreussite.academy/api/assessments/cmlr5dciy0002mh01mqwba975/result
→ HTTP 200
{
  "status": "COMPLETED",
  "globalScore": 0,
  "ssn": 19.8,
  "domainScores": [
    {"domain": "combinatoire", "score": 0},
    {"domain": "analyse", "score": 0},
    {"domain": "geometrie", "score": 0},
    {"domain": "probabilites", "score": 0}
  ],
  "generationStatus": "COMPLETE"
}
```

**Preuve** : `score=0` persisté et affiché correctement.

---

## 6. Exigence B — Recompute SSN (contrôlé)

```bash
$ curl -s -b cookies.txt -X POST \
  https://nexusreussite.academy/api/admin/recompute-ssn \
  -H "Content-Type: application/json" -d '{"type":"MATHS"}'
→ HTTP 200
{
  "success": true,
  "type": "MATHS",
  "updated": 2,
  "cohort": {
    "mean": 24.5,
    "std": 24.5,
    "sampleSize": 2
  },
  "audit": {
    "previousMean": 24.5,
    "previousStd": 24.5,
    "currentMean": 24.5,
    "currentStd": 24.5,
    "delta": {
      "meanDelta": 0,
      "stdDelta": 0,
      "sampleDelta": 0
    }
  }
}
```

**Verdict** : endpoint fonctionne, audit log présent, calcul mean/std ne plante pas. Exécuté une seule fois.

---

## 7. Exigence C — Test résilience LLM (Ollama down)

### Protocole

1. Vérifier Ollama UP : `infra-ollama-1 Up 3 days (healthy)`
2. Stop Ollama : `docker stop infra-ollama-1`
3. Submit assessment pendant Ollama down
4. Vérifier result accessible + fallback

### Résultats

```bash
# Submit pendant Ollama down
$ curl -s -X POST https://nexusreussite.academy/api/assessments/submit \
  -H "Content-Type: application/json" \
  -d '{"subject":"MATHS","grade":"TERMINALE","studentData":{"email":"resilience-test@nexus.com","name":"Resilience Test LLM Down"},"answers":{"MATH-COMB-01":"a",...},"duration":60000}'
→ HTTP 201
{"success":true,"assessmentId":"cmlr5so170004mh014v6uncz6"}

# DB après 30s
SELECT status, "globalScore", ssn, "errorCode", "errorDetails"
FROM assessments WHERE id = 'cmlr5so170004mh014v6uncz6';

  status   | globalScore | ssn  |       errorCode        |                 errorDetails
-----------+-------------+------+------------------------+----------------------------------------------
 COMPLETED |         100 | 86.2 | LLM_GENERATION_FAILED  | Failed to generate ELEVE bilan: fetch failed
(1 row)

# domain_scores persistées malgré LLM down
SELECT domain, score FROM domain_scores
WHERE "assessmentId" = 'cmlr5so170004mh014v6uncz6';

    domain    | score
--------------+-------
 analyse      |   100
 combinatoire |   100
(2 rows)

# Result API
$ curl -s https://nexusreussite.academy/api/assessments/cmlr5so170004mh014v6uncz6/result
→ HTTP 200
{
  "id": "cmlr5so170004mh014v6uncz6",
  "status": "COMPLETED",
  "globalScore": 100,
  "ssn": 86.2,
  "domainScores": [
    {"domain": "combinatoire", "score": 100},
    {"domain": "analyse", "score": 100}
  ],
  "generationStatus": "FAILED",
  "llmUnavailableMessage": "L'analyse IA personnalisée est temporairement indisponible. Vos scores et résultats sont disponibles.",
  "errorCode": "LLM_GENERATION_FAILED"
}
```

### Verdict résilience

| Critère | Résultat |
|---|---|
| `status` reste `COMPLETED` | ✅ |
| `errorCode` = `LLM_GENERATION_FAILED` | ✅ |
| `generationStatus` = `FAILED` | ✅ |
| `llmUnavailableMessage` présent | ✅ |
| `globalScore`, `ssn`, `domainScores` accessibles | ✅ |
| Result API retourne HTTP 200 | ✅ |

**Ollama redémarré après test** : `docker start infra-ollama-1` → `Up 5 seconds (health: starting)`

---

## 8. Résumé des assessments en prod post-déploiement

```sql
SELECT id, status, "globalScore", ssn, "errorCode", "assessmentVersion"
FROM assessments ORDER BY "createdAt";

            id             |  status   | globalScore | ssn  |       errorCode        |   assessmentVersion
---------------------------+-----------+-------------+------+------------------------+------------------------
 cmlr595yp0000mh01hzyr7ryn | COMPLETED |          49 | 52.4 |                        | maths_terminale_spe_v1
 cmlr5dciy0002mh01mqwba975 | COMPLETED |           0 | 19.8 |                        | maths_terminale_spe_v1
 cmlr5so170004mh014v6uncz6 | COMPLETED |         100 | 86.2 | LLM_GENERATION_FAILED  | maths_terminale_spe_v1
(3 rows)
```

---

## 9. Environnement prod vérifié

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://nexus_admin:***@postgres-db:5432/nexus_prod` |
| `NEXTAUTH_URL` | `https://nexusreussite.academy` |
| `NEXTAUTH_SECRET` | `***` (présent) |
| `OLLAMA_URL` | `http://ollama:11434` |
| `OLLAMA_MODEL` | `llama3.2:latest` |
| Disque | 19% utilisé (701G libre) |
| PostgreSQL | accepting connections (healthy) |
| Container | `nexus-next-app` Up (healthy) |

---

## 10. Stratégie migration/build — Post-mortem

### Problème rencontré

Le container Docker `nexus-next-app` (ancien build) ne contenait pas la migration `20260217_learning_graph_v2`.
`npx prisma migrate deploy` depuis le container retournait "No pending migrations".

### Solution appliquée

Migration exécutée **depuis le host** (`/opt/nexus`) avec une `DATABASE_URL` pointant vers `127.0.0.1:5435` (port exposé du container PostgreSQL), puis rebuild du container Docker.

### Règle standardisée

Voir `ops/RUNBOOK_MIGRATION_PROD.md`.

---

*Généré le 2026-02-17 à 23:15 UTC+01:00*
*Opérateur : Cascade AI*
*Validé par : Lead (en attente)*
