# 🏗️ AUDIT COMPLET DU SERVEUR MONEY FACTORY (Core)

**Date** : 13 février 2026  
**Serveur** : `moneyfactory-core` — `88.99.254.59` (Hetzner Dedicated)  
**Auditeur** : Cascade AI  

---

## 1. INFRASTRUCTURE MATÉRIELLE & OS

| Paramètre | Valeur |
|---|---|
| **OS** | Ubuntu 22.04.5 LTS (Jammy) — Kernel 5.15.0-164 |
| **CPU** | Intel Core i7-8700 @ 3.20 GHz — 6 cores / 12 threads |
| **RAM** | 64 Go (5.3 Go utilisés, 56 Go cache/buffer) |
| **Swap** | 32 Go (68 Mo utilisés) |
| **Disque** | RAID `/dev/md2` — 906 Go total, 267 Go utilisés (31%) |
| **IP publique** | `88.99.254.59` / IPv6 `2a01:4f8:10b:be6::2` |
| **Uptime** | 15 jours |
| **Température** | 55°C |

### ⚠️ Alertes système
- **Redémarrage requis** (`*** System restart required ***`)
- **17 mises à jour** en attente (10 sécurité)
- **10 mises à jour ESM** supplémentaires (ESM Apps non activé)
- **Upgrade disponible** vers Ubuntu 24.04.4 LTS

---

## 2. CARTOGRAPHIE DES DOMAINES & SOUS-DOMAINES

### 2.1 Domaines principaux

| Domaine | Type | Cible | SSL | Expiration cert |
|---|---|---|---|---|
| `nexusreussite.academy` | Reverse proxy → `:3011` | Nexus Next.js (Docker) | ✅ Let's Encrypt | 13 avr 2026 |
| `www.nexusreussite.academy` | Idem | Idem | ✅ | 13 avr 2026 |
| `mfai.app` | Statique + API proxy → `:3001` | `/var/www/mfai.app` | ✅ | 5 mars 2026 ⚠️ |
| `www.mfai.app` | Idem | Idem | ✅ | 5 mars 2026 ⚠️ |
| `journey.mfai.app` | Reverse proxy → `:3001` | Journey Frontend (PM2) | ✅ | 12 mai 2026 |
| `labomaths.tn` | Statique | `/var/www/labomaths/main` | ✅ | 10 mai 2026 |
| `www.labomaths.tn` | Idem | Idem | ✅ | 10 mai 2026 |
| `oinkonomics.fun` | Reverse proxy → `:3005` | Oinkonomics (PM2) | ✅ | 12 mai 2026 |

### 2.2 Sous-domaines Nexus

| Sous-domaine | Cible | Fonction |
|---|---|---|
| `automation.nexusreussite.academy` | `:5678` → n8n | Workflows d'automatisation |
| `whatsapp.nexusreussite.academy` | `:8081` → Evolution API | Bot WhatsApp |
| `rag-api.nexusreussite.academy` | `:8001` → Ingestor API | API RAG (ingestion + recherche) |
| `rag-ui.nexusreussite.academy` | `:18501` → Streamlit UI | Interface admin RAG (auth basic) |
| `rag.nexusreussite.academy` | Redirect → `rag-ui.*` | Alias de redirection |

### 2.3 Sous-domaines Labomaths

| Sous-domaine | Cible | Fonction |
|---|---|---|
| `nsi.labomaths.tn` | `:3003` → PM2 | App NSI |
| `maths.labomaths.tn` | `:3003` → PM2 | App Maths |
| `korrigo.labomaths.tn` | `:8088` → Docker Nginx | Korrigo (Django) |

### 🔴 ALERTE SSL
- **`mfai.app`** expire le **5 mars 2026** (dans 19 jours !)
- Vérifier le renouvellement automatique Certbot

---

## 3. ARCHITECTURE DOCKER

### 3.1 Conteneurs actifs (22 conteneurs)

#### Stack Korrigo (Django + Celery)
| Conteneur | Image | Port | État |
|---|---|---|---|
| `docker-nginx-1` | `ghcr.io/cyranoaladin/korrigo-nginx` | `8088→80` | ✅ Healthy |
| `docker-backend-1` | `ghcr.io/cyranoaladin/korrigo-backend` | `8000` (interne) | ✅ Healthy |
| `docker-celery-1` | `ghcr.io/cyranoaladin/korrigo-backend` | — | ✅ Healthy |
| `docker-celery-beat-1` | `ghcr.io/cyranoaladin/korrigo-backend` | — | ✅ Up |
| `docker-db-1` | `postgres:15-alpine` | `127.0.0.1:5432` | ✅ Healthy |
| `docker-redis-1` | `redis:7-alpine` | `6379` (interne) | ✅ Healthy |
| `docker-frontend-1` | `docker-frontend` | `5173` | ✅ Up |

#### Stack Nexus Réussite
| Conteneur | Image | Port | État |
|---|---|---|---|
| `nexus-next-app` | `nexus-next-app` | `3011→3000` | 🔴 **UNHEALTHY** (FailingStreak: 6490) |
| `nexus-postgres-db` | `postgres:15-alpine` | `5435→5432` | ✅ Healthy |

#### Stack Nexus Bot (WhatsApp + n8n)
| Conteneur | Image | Port | État |
|---|---|---|---|
| `nexus-whatsapp` | `atendai/evolution-api:v2.1.1` | `8081→8080` | ✅ Healthy |
| `nexus-whatsapp-db` | `postgres:15-alpine` | `5432` (interne) | ✅ Healthy |
| `nexus-whatsapp-redis` | `redis:7-alpine` | `6379` (interne) | ✅ Healthy |
| `nexus-n8n` | `docker.n8n.io/n8nio/n8n` | `5678` | ✅ Up |

#### Stack Journey / MFAI
| Conteneur | Image | Port | État |
|---|---|---|---|
| `mfai-api` | `journey-mfai-mfai-api` | `3002→3000` | ✅ Up |
| `mfai-mongo` | `mongo:latest` | `27018→27017` | ✅ Healthy |
| `mfai-redis` | `redis:7-alpine` | `127.0.0.1:6380` | ✅ Up |

#### Stack Infra RAG
| Conteneur | Image | Port | État |
|---|---|---|---|
| `infra-ollama-1` | `ollama/ollama:0.3.13` | `11434` (interne) | ✅ Healthy |
| `infra-chroma-1` | `chromadb/chroma:1.1.1` | `8000` (interne) | ✅ Healthy |
| `infra-ui-1` | `infra-ui` (Streamlit) | `127.0.0.1:18501` | ✅ Up |
| `infra-prometheus-1` | `prom/prometheus:v2.54.1` | `127.0.0.1:19090` | ✅ Healthy |

### 🔴 ALERTE CRITIQUE
**`nexus-next-app` est UNHEALTHY** depuis 6490 checks consécutifs.  
Erreur : `wget: can't connect to remote host: Connection refused`  
Logs : `Failed to find Server Action "x"` en boucle.  
→ L'app Next.js a crashé et ne répond plus sur le port 3000 interne.

### 3.2 Réseaux Docker

| Réseau | Stacks connectées |
|---|---|
| `docker_default` | Korrigo (Django) |
| `nexus_nexus-network` | Nexus Next.js + Postgres |
| `infra_rag_net` | RAG (Ollama, Chroma, Ingestor, UI, Prometheus) + WhatsApp Bot + n8n |
| `journey-mfai_mfai-network` | Journey API + Mongo + Redis |
| `korrigo_labomaths_net` | Korrigo Labomaths |

### 3.3 Volumes Docker

| Volume | Usage |
|---|---|
| `docker_postgres_data` | Korrigo PostgreSQL |
| `nexus_nexus-postgres-data` | Nexus PostgreSQL |
| `infra_rag_ollama_data` | Modèles Ollama (~19 Go) |
| `infra_rag_chroma_data` | Collections ChromaDB |
| `infra_rag_prometheus_data` | Métriques Prometheus |
| `journey-mfai_mfai-mongo-data` | MongoDB Journey |
| `journey-mfai_mfai-redis-data` | Redis Journey |
| `nexus_uploads_data` | Uploads Nexus |
| `nexus_logs_data` | Logs Nexus |

### 3.4 Images Docker — ⚠️ Nettoyage nécessaire
- **~30 anciennes images** `ghcr.io/cyranoaladin/korrigo-*` (tags SHA) occupent ~40 Go
- Recommandation : `docker image prune -a --filter "until=720h"`

---

## 4. BASES DE DONNÉES

### 4.1 PostgreSQL (4 instances)

| Instance | Conteneur | Port | DB | User | Tables |
|---|---|---|---|---|---|
| **Nexus Prod** | `nexus-postgres-db` | `5435` | `nexus_prod` | `nexus_admin` | 25 tables (Prisma) |
| **Korrigo** | `docker-db-1` | `127.0.0.1:5432` | `viatique` | `viatique_user` | Django ORM |
| **WhatsApp** | `nexus-whatsapp-db` | interne | `evolution` | `evolution` | Evolution API |
| **MFAI Prisma** | (dans journey compose) | `127.0.0.1:5433` | `prisma` | `prisma` | Journey Prisma |

#### Tables Nexus Prod (25)
```
users, parent_profiles, student_profiles, coach_profiles, students,
subscriptions, subscription_requests, sessions, SessionBooking,
SessionNotification, SessionReminder, CoachAvailability, session_reports,
credit_transactions, payments, badges, student_badges, student_reports,
messages, notifications, aria_conversations, aria_messages,
pedagogical_contents, cron_executions, _prisma_migrations
```

**Note** : Toutes les tables sont à 8192 bytes → **base vide en production** (pas de données réelles).

### 4.2 MongoDB

| Instance | Conteneur | Port | DB | Collections |
|---|---|---|---|---|
| **Journey** | `mfai-mongo` | `27018` | `journey` | `journeys`, `agentruns`, `users`, `daoproposals`, `agentinteractionlogs` |

**Stats** : 5 collections, 0 objets, 20 Ko storage → **base vide**.

### 4.3 Redis (3 instances)

| Instance | Port | Usage |
|---|---|---|
| `docker-redis-1` | interne `6379` | Celery broker (Korrigo) |
| `nexus-whatsapp-redis` | interne `6379` | Cache Evolution API |
| `mfai-redis` | `127.0.0.1:6380` | Cache Journey API |

---

## 5. RAG & LLM

### 5.1 Ollama — Modèles installés

| Modèle | Taille | Usage |
|---|---|---|
| `qwen2.5:32b` | 19 Go | LLM principal (génération) |
| `llama3.2:latest` | 2 Go | LLM secondaire (léger) |
| `nomic-embed-text:latest` | 274 Mo | Embeddings (dim 768) |

**Config** : CPU only (pas de GPU détecté), limité à 6 CPUs / 24 Go RAM.

### 5.2 ChromaDB — Collections vectorielles

| Collection | Dimension | Distance | Usage |
|---|---|---|---|
| `web3_expert_knowledge` | 768 | cosine | Connaissances Web3 |
| `web3_rag` | 768 | cosine | RAG Web3 |
| `ressources_pedagogiques_terminale` | 768 | cosine | Ressources pédagogiques Nexus |
| `mfai-knowledge` | — | — | Base MFAI |
| `test` | — | — | Collection de test |

### 5.3 Architecture RAG

```
/srv/rag-local/
├── src/
│   ├── ingestor/          # API FastAPI (uvicorn)
│   │   ├── api.py         # Point d'entrée principal
│   │   ├── search_api.py  # Recherche sémantique
│   │   ├── catalog.py     # Catalogue SQLite admin
│   │   ├── drive_sync.py  # Sync Google Drive
│   │   ├── mm_adapter.py  # Multimodal adapter
│   │   ├── taxonomy.py    # Taxonomie Solana/Web3
│   │   └── metrics.py     # Métriques Prometheus
│   ├── ui/                # Streamlit admin UI
│   ├── backend/           # Backend additionnel
│   └── dashboard/         # Dashboard
├── infra/
│   ├── docker-compose.prod.yml
│   ├── prometheus/        # Config Prometheus
│   └── creds/             # Credentials Google Drive
└── data/                  # Données RAG uploadées
```

**Données RAG** (`/srv/rag-data/`) : 7 fichiers texte (Solana, NFT, tokenomics, régulation Web3, etc.)

### 5.4 Endpoints RAG

- **API** : `https://rag-api.nexusreussite.academy` → port `8001` (ingestor FastAPI)
- **UI Admin** : `https://rag-ui.nexusreussite.academy` → port `18501` (Streamlit, auth basic)
- **Métriques** : `127.0.0.1:19090` (Prometheus, accès local uniquement)
- **Protection** : `/metrics` restreint à `127.0.0.1`, UI protégée par `.htpasswd`

---

## 6. APPLICATIONS HÉBERGÉES

### 6.1 Nexus Réussite (`nexusreussite.academy`)

| Paramètre | Valeur |
|---|---|
| **Stack** | Next.js 14 + Prisma + PostgreSQL 15 |
| **Chemin** | `/opt/nexus/` |
| **Docker** | `nexus-next-app` (port 3011) + `nexus-postgres-db` (port 5435) |
| **État** | 🔴 **UNHEALTHY** — app crashée |
| **DB** | `nexus_prod` — 25 tables, **toutes vides** |
| **Env** | `NODE_ENV=production`, `NEXTAUTH_URL=https://nexusreussite.academy` |
| **OpenAI** | `sk-placeholder-pour-le-build` ⚠️ **Clé placeholder !** |

**Problèmes identifiés** :
1. **App crashée** : `Failed to find Server Action "x"` en boucle → build corrompu ou mismatch client/serveur
2. **Clé OpenAI placeholder** : ARIA (IA pédagogique) ne peut pas fonctionner
3. **Base vide** : Aucun utilisateur, aucune donnée → pas de seed en production

### 6.2 Korrigo (`korrigo.labomaths.tn`)

| Paramètre | Valeur |
|---|---|
| **Stack** | Django + Celery + PostgreSQL + Redis + Nginx |
| **Chemin** | `/infra/docker/` (compose) |
| **Docker** | 7 conteneurs (backend, celery, celery-beat, nginx, db, redis, frontend) |
| **État** | ✅ Tous healthy |
| **Deploy** | CI/CD via GitHub Actions → `ghcr.io/cyranoaladin/korrigo-*:SHA` |
| **DB** | `viatique` (PostgreSQL 15) |

### 6.3 MFAI.app (`mfai.app`)

| Paramètre | Valeur |
|---|---|
| **Stack** | Express.js + SQLite (email capture) |
| **Chemin** | `/var/www/mfai.app/` |
| **Serve** | Nginx statique + proxy `/api` → `:3001` |
| **État** | ✅ Fonctionnel |
| **Deploy** | `~/deploy_mfai.sh` (git pull + npm install + pm2 reload) |

### 6.4 Journey MFAI (`journey.mfai.app`)

| Paramètre | Valeur |
|---|---|
| **Stack** | Express.js (mf-back) + MongoDB + Redis + Prisma |
| **Chemin** | `/srv/journey-mfai/` |
| **Docker** | `mfai-api` (port 3002) + `mfai-mongo` + `mfai-redis` |
| **PM2** | `journey-frontend` (port 3001), `journey-simulator` (port 3003) |
| **État** | ✅ Fonctionnel |
| **Deploy** | `~/deploy_journey.sh` (git pull + docker compose up --build) |
| **Features** | Agents IA, journeys, DAO proposals, Solana Web3 |

### 6.5 Oinkonomics (`oinkonomics.fun`)

| Paramètre | Valeur |
|---|---|
| **Stack** | Next.js |
| **PM2** | `oinkonomics` (port 3005) |
| **État** | ✅ Online |

### 6.6 Labomaths (`labomaths.tn`)

| Paramètre | Valeur |
|---|---|
| **Stack** | Statique HTML |
| **Chemin** | `/var/www/labomaths/` |
| **Sous-sites** | `main/` (360 Ko), `maths/` (325 Mo), `nsi/` (125 Mo), `korrigo/` (15 Go) |
| **État** | ✅ Fonctionnel |

### 6.7 NSI App (`nsi.labomaths.tn`)

| Paramètre | Valeur |
|---|---|
| **PM2** | `nsi-app` |
| **État** | 🔴 **ERRORED** (689+ restarts) |

---

## 7. PROCESSUS & ORCHESTRATION

### 7.1 PM2 (4 processus)

| ID | Nom | Port | État | RAM |
|---|---|---|---|---|
| 0 | `oinkonomics` | 3005 | ✅ Online | 62 Mo |
| 1 | `journey-frontend` | 3001 | ✅ Online | 61 Mo |
| 2 | `journey-simulator` | 3003 | ✅ Online | 55 Mo |
| 8 | `nsi-app` | — | 🔴 Errored | 0 Mo |

### 7.2 Systemd

| Service | État |
|---|---|
| `docker.service` | ✅ Running |
| `nginx.service` | ✅ Running |
| `pm2-root.service` | ✅ Running |
| `containerd.service` | ✅ Running |

### 7.3 Cron

```
30 03 * * * /root/backup_auto.sh >> /var/log/backup_cron.log 2>&1
```
→ Backup automatique quotidien à 3h30.

### 7.4 Scripts de déploiement

| Script | Cible | Méthode |
|---|---|---|
| `~/deploy_mfai.sh` | MFAI.app | git pull + npm install + pm2 reload |
| `~/deploy_journey.sh` | Journey | git pull + docker compose up --build |

---

## 8. SÉCURITÉ

### 8.1 Firewall (UFW)

```
Default: deny (incoming), allow (outgoing), deny (routed)
22/tcp          ALLOW IN    Anywhere
80,443/tcp      ALLOW IN    Anywhere (Nginx Full)
```
✅ Bon : seuls SSH, HTTP et HTTPS sont ouverts.

### 8.2 Ports exposés publiquement

| Port | Service | Risque |
|---|---|---|
| 22 | SSH | ✅ OK |
| 80/443 | Nginx | ✅ OK |
| 3002 | MFAI API | ⚠️ Exposé publiquement (devrait être `127.0.0.1`) |
| 3011 | Nexus Next.js | ⚠️ Exposé publiquement (devrait être `127.0.0.1`) |
| 5173 | Korrigo Frontend | ⚠️ Exposé publiquement |
| 5435 | Nexus PostgreSQL | ⚠️ Exposé publiquement ! |
| 5678 | n8n | ⚠️ Exposé publiquement (pas d'auth Nginx) |
| 8081 | WhatsApp API | ⚠️ Exposé publiquement |
| 8088 | Korrigo Nginx | ⚠️ Exposé publiquement |
| 27018 | MongoDB | 🔴 **CRITIQUE** — Exposé publiquement ! |

### 8.3 Problèmes de sécurité

| Sévérité | Problème |
|---|---|
| 🔴 **CRITIQUE** | MongoDB (`27018`) exposé sur `0.0.0.0` sans authentification |
| 🔴 **CRITIQUE** | PostgreSQL Nexus (`5435`) exposé sur `0.0.0.0` |
| 🔴 **CRITIQUE** | `fail2ban` **non installé** — aucune protection brute-force SSH |
| 🔴 **CRITIQUE** | Nexus `OPENAI_API_KEY=sk-placeholder-pour-le-build` |
| 🟠 **HAUTE** | n8n (`5678`) exposé sans auth Nginx (accès direct possible) |
| 🟠 **HAUTE** | WhatsApp API key en clair dans docker-compose : `NexusSecureKey2026!` |
| 🟠 **HAUTE** | Korrigo DB password par défaut : `viatique_password` |
| 🟠 **HAUTE** | MFAI Prisma DB credentials : `prisma/prisma` (défaut) |
| 🟡 **MOYENNE** | Serveur tourne en `root` exclusivement |
| 🟡 **MOYENNE** | Redémarrage système requis (non effectué depuis 15 jours) |
| 🟡 **MOYENNE** | 30+ anciennes images Docker (~40 Go de déchets) |

---

## 9. CARTOGRAPHIE RÉSEAU COMPLÈTE

```
Internet
    │
    ├── :22  ─────────────── SSH (root)
    │
    ├── :80  ─────────────── Nginx (redirect → HTTPS)
    │
    ├── :443 ─────────────── Nginx HTTPS
    │   ├── nexusreussite.academy ──────→ :3011 → nexus-next-app (Docker) 🔴
    │   ├── automation.nexusreussite.academy → :5678 → nexus-n8n (Docker)
    │   ├── whatsapp.nexusreussite.academy ─→ :8081 → nexus-whatsapp (Docker)
    │   ├── rag-api.nexusreussite.academy ──→ :8001 → infra-ingestor (Docker)
    │   ├── rag-ui.nexusreussite.academy ───→ :18501 → infra-ui (Docker) [auth basic]
    │   ├── mfai.app ──────────────────────→ statique + :3001 API
    │   ├── journey.mfai.app ──────────────→ :3001 → journey-frontend (PM2)
    │   ├── labomaths.tn ──────────────────→ statique /var/www/labomaths/main
    │   ├── nsi.labomaths.tn ──────────────→ :3003 → journey-simulator (PM2)
    │   ├── maths.labomaths.tn ────────────→ :3003 → journey-simulator (PM2)
    │   ├── korrigo.labomaths.tn ──────────→ :8088 → docker-nginx (Korrigo)
    │   └── oinkonomics.fun ───────────────→ :3005 → oinkonomics (PM2)
    │
    ├── :3002 ────────────── MFAI API (Docker) ⚠️ public
    ├── :3011 ────────────── Nexus Next.js (Docker) ⚠️ public
    ├── :5173 ────────────── Korrigo Frontend (Docker) ⚠️ public
    ├── :5435 ────────────── Nexus PostgreSQL (Docker) 🔴 public
    ├── :5678 ────────────── n8n (Docker) ⚠️ public
    ├── :8081 ────────────── WhatsApp API (Docker) ⚠️ public
    ├── :8088 ────────────── Korrigo Nginx (Docker) ⚠️ public
    └── :27018 ───────────── MongoDB (Docker) 🔴 public

Interne uniquement (127.0.0.1) :
    ├── :5432 ────────────── Korrigo PostgreSQL ✅
    ├── :6380 ────────────── MFAI Redis ✅
    ├── :18501 ───────────── RAG UI (Streamlit) ✅
    └── :19090 ───────────── Prometheus ✅
```

---

## 10. UTILISATION DISQUE

| Chemin | Taille | Contenu |
|---|---|---|
| `/var/lib/docker` | **50 Go** | Images, volumes, overlays Docker |
| `/var/www/labomaths` | **17 Go** | Sites statiques (dont korrigo 15 Go) |
| `/srv/journey-mfai` | 3.3 Go | Journey MFAI (code + node_modules) |
| `/opt/nexus` | 2 Go | Nexus Réussite |
| `/opt/nexus-bot` | 53 Mo | Bot WhatsApp + n8n |
| `/var/www/mfai.app` | 37 Mo | MFAI landing page |
| `/srv/rag-local` | 1.6 Mo | Code RAG (données dans volumes Docker) |
| **Total utilisé** | **267 Go / 906 Go** (31%) | |

---

## 11. RECOMMANDATIONS PRIORITAIRES

### 🔴 P0 — Critiques (à faire immédiatement)

1. **Réparer `nexus-next-app`** : Rebuild et redéployer (`docker compose up -d --build`)
2. **Fermer MongoDB au public** : Changer `27018:27017` → `127.0.0.1:27018:27017`
3. **Fermer PostgreSQL Nexus au public** : Changer `5435:5432` → `127.0.0.1:5435:5432`
4. **Installer fail2ban** : `apt install fail2ban && systemctl enable fail2ban`
5. **Renouveler le certificat `mfai.app`** : `certbot renew` (expire dans 19 jours)
6. **Configurer une vraie clé OpenAI** pour Nexus (remplacer `sk-placeholder`)

### 🟠 P1 — Haute priorité

7. **Restreindre les ports Docker** : Bind `127.0.0.1` pour tous les ports non-Nginx
8. **Sécuriser n8n** : Ajouter auth basic Nginx ou restreindre l'accès
9. **Changer les mots de passe par défaut** : Korrigo DB, MFAI Prisma DB, WhatsApp API key
10. **Réparer `nsi-app`** (PM2 errored, 689+ restarts)
11. **Redémarrer le serveur** (reboot requis depuis 15 jours)
12. **Nettoyer les images Docker** : `docker image prune -a --filter "until=720h"` (~30 Go récupérables)

### 🟡 P2 — Moyenne priorité

13. **Créer un utilisateur non-root** pour les services
14. **Activer ESM Apps** pour les mises à jour de sécurité supplémentaires
15. **Seeder la base Nexus** en production (actuellement vide)
16. **Configurer des backups DB** automatiques (seul `backup_auto.sh` existe, vérifier son contenu)
17. **Mettre à jour Ollama** (0.3.13 → dernière version)
18. **Documenter l'architecture** dans un README serveur

---

## 12. RÉSUMÉ EXÉCUTIF

| Métrique | Valeur |
|---|---|
| **Applications hébergées** | 7 (Nexus, Korrigo, MFAI, Journey, Oinkonomics, Labomaths, NSI) |
| **Conteneurs Docker** | 22 actifs |
| **Bases de données** | 4 PostgreSQL + 1 MongoDB + 3 Redis + 1 ChromaDB |
| **Modèles LLM** | 3 (Qwen 2.5 32B, Llama 3.2, Nomic Embed) |
| **Collections RAG** | 5 (Web3, pédagogique, MFAI, test) |
| **Domaines** | 4 principaux + 8 sous-domaines |
| **Certificats SSL** | 10 (tous Let's Encrypt) |
| **Santé globale** | 🟡 **Dégradée** — 2 services down, vulnérabilités réseau critiques |
| **Utilisation ressources** | CPU: 0.15 load, RAM: 8%, Disque: 31% — **très sous-utilisé** |
