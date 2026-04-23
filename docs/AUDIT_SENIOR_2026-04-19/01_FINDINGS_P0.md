# FINDINGS P0 — AXE 1 : Hygiène repo / fuite de secrets

> Audit réalisé le 2026-04-19. Chaque finding cite le chemin exact et/ou le hash git.

---

## F-P0-01 — Clé SSL privée non chiffrée dans l'historique git

**Fichier :** `nginx/ssl/privkey.pem`
**Statut :** Actuellement tracké (`git ls-files nginx/ssl/privkey.pem` → présent)
**Historique :** 8 commits depuis `9fc4ca30` (2026-02-02) jusqu'au HEAD `03d69544` (2026-04-19)

```
03d69544  fix(lint): fix JSX parsing error and clean up unused vars/imports
8bc124e5  On main: brand-pack-audit-wip-3
3fe60075  chore: sync local production-like setup, ui updates, tests and aria audit
2ce874a2  chore: sync local production-like setup, ui updates, tests and aria audit
65de5c5e  Merge pull request #14 from cyranoaladin/prodready/v1
ab564f93  Merge pull request #14 from cyranoaladin/prodready/v1
9fc4ca30  feat(deploy): implement production-ready Docker deployment
c5458708  feat(deploy): implement production-ready Docker deployment
```

**Impact :** La clé privée RSA (non chiffrée, 1 704 octets) est disponible dans tout clone du repo. Toute personne ayant accès au repo GitHub peut usurper l'identité du serveur `nexusreussite.academy`, réaliser un MITM, ou décrypter le trafic TLS enregistré.
`nginx/ssl/fullchain.pem` est également tracké (MEDIUM en isolation, CRITICAL couplé à privkey.pem).

**Effort :** S (rotation + nettoyage historique = 30 min)
**LOT :** LOT 0

**Actions requises :**
1. Révoquer et régénérer le certificat SSL (Let's Encrypt ou CA actuelle).
2. Supprimer des 8 commits via `git filter-repo`.
3. Ajouter `nginx/ssl/` à `.gitignore`.
4. Force-push après nettoyage historique.

---

## F-P0-02 — Tokens de session Playwright dans l'historique git

**Fichiers :** `parent.json` (racine) + `student.json` (racine)
**Historique :**
- `parent.json` : ~29 commits depuis `5daeddb7` (2026-02-??) jusqu'à `f5c7e49e` (2026-04-17, date de suppression du tracking)
- `student.json` : 6 commits depuis `3fe60075` (2026-02-13) jusqu'à `f5c7e49e` (2026-04-17)

**Contenu des fichiers :** Cookies NextAuth (`authjs.session-token` JWE, `authjs.csrf-token`). Ces tokens peuvent être rejouées pour usurper la session d'un utilisateur de test.

**Impact :** Faible sur les users de production (comptes de test uniquement), MAIS si les comptes de test partagent des hachages de mot de passe avec des comptes réels ou si le `NEXTAUTH_SECRET` est le même entre test et prod, le risque remonte à CRITICAL.
**Effort :** S
**LOT :** LOT 0

**Actions requises :**
1. Invalider les sessions en changeant `NEXTAUTH_SECRET` en prod (si identique à test).
2. Supprimer de l'historique via `git filter-repo`.
3. Vérifier que `e2e/fixtures/*.json` est correctement ignoré (`.gitignore` ligne actuelle : `e2e/fixtures/*.json` → OK).

---

## F-P0-03 — Secrets dans `.env.production` (fichier local, non commité)

**Fichier :** `.env.production` (1 677 octets, modifié 2026-04-19 13:38)
**Statut git :** NON commité (couvert par `.env.*` dans `.gitignore`) → risque local uniquement

**Secrets réels présents :**

| Variable | Valeur (tronquée) | Risque si exposée |
|----------|-------------------|-------------------|
| `POSTGRES_PASSWORD` | `test_password_for_smoke_test` | DB prod compromise |
| `DATABASE_URL` | `postgresql://nexus_admin:test_password_...@postgres:5432/nexus_prod` | idem |
| `NEXTAUTH_SECRET` | `V+2iklnFo...` (base64 32B) | Forge de session JWT |
| `SMTP_PASSWORD` | `NexusReussite2025@NSI` | Prise de contrôle email |
| `RAG_API_TOKEN` | `59e3c474...` (hex 64 chars) | Accès API RAG externe |

**Variables placeholder (pas de rotation requise) :** `OPENAI_API_KEY`, `KONNECT_API_KEY`, `KONNECT_WALLET_ID`, `KONNECT_WEBHOOK_SECRET`.

**Note :** `POSTGRES_PASSWORD=test_password_for_smoke_test` est visuellement une valeur de test mais est utilisée dans `DATABASE_URL` pointant vers `nexus_prod`. Si c'est bien le mot de passe de la base de production, il est trivial à deviner.

**Effort :** S (rotation SMTP + NEXTAUTH_SECRET + RAG token = 20 min)
**LOT :** LOT 0

**Actions requises :**
1. Changer `SMTP_PASSWORD` sur Hostinger.
2. Régénérer `NEXTAUTH_SECRET` : `openssl rand -base64 32`.
3. Régénérer le token RAG API sur `rag-api.nexusreussite.academy`.
4. Changer le mot de passe PostgreSQL si `test_password_for_smoke_test` est réellement utilisé en prod.
5. Créer `.env.production` via un gestionnaire de secrets (Vault, Docker Secrets, ou variables d'environnement PM2/système) — ne jamais écrire ce fichier sur disque en clair.

---

## F-P0-04 — Fichiers d'arborescence serveur et artifacts commités

**Fichiers trackés actuellement :**

| Fichier | Taille | Problème |
|---------|--------|---------|
| `arborescence.txt` | 31 KB | Structure complète du projet exposée |
| `arborescence_complete.txt` | 50 KB | Idem, version étendue |
| `prod-tree-2026-04-19.txt` | 68 KB | Arborescence serveur prod (commitée malgré la règle `.gitignore` `prod-tree*.txt`) |

**Le fichier `prod-tree-2026-04-19.txt` a été commité en force** dans `00d54e9a` (HEAD), en violation de la règle `.gitignore` existante. Cela révèle la structure complète du serveur de production.

**Impact :** Faible en isolation, mais expose la surface d'attaque (chemins, services, noms de fichiers).
**Effort :** XS
**LOT :** LOT 0

**Actions requises :**
1. `git rm --cached arborescence.txt arborescence_complete.txt prod-tree-2026-04-19.txt`
2. Ajouter `arborescence*.txt` au `.gitignore`.
3. Supprimer `prod-tree-2026-04-19.txt` du commit HEAD (amend ou nouveau commit).

---

## F-P0-05 — Absence de pre-commit hook

**Fichier :** `.git/hooks/` (uniquement des `.sample`, aucun hook actif)
**Statut :** Aucune protection contre les commits accidentels de secrets.

**Preuve :** Les findings F-P0-01 et F-P0-02 ont été générés malgré l'existence de règles `.gitignore` → ces fichiers ont été committés avant l'ajout des règles, ou via `git add -f`.

**Impact :** Sans hook, un développeur peut committer `.env.production`, `*.pem`, ou `credentials*.json` sans avertissement.
**Effort :** S
**LOT :** LOT 0

**Actions requises :**
1. Installer `scripts/pre-commit-hook.sh` dans `.git/hooks/pre-commit`.
2. Bloquer : `*.pem`, `*.key`, `*.p12`, `.env*` (sauf `.example`), `*credentials*.json`, `*.bak`, `parent.json`, `student.json`, `admin.json`.
3. (Optionnel) Intégrer `detect-secrets` ou `trufflehog` en CI.

---

## F-P1-01 — Règles `.gitignore` incomplètes

**Fichier :** `.gitignore`
**Manquant :**
- `nginx/ssl/` ou `*.pem` / `*.key` — privkey.pem est tracké (cf. F-P0-01)
- `arborescence*.txt` — présent dans git mais non ignoré (cf. F-P0-04)
- `!.env.production.example` — la négation pour le `.example` de production n'est pas dans les négations actuelles (mineur)

**Impact :** Ces absences permettent le re-commit des fichiers sensibles après nettoyage historique.
**Effort :** XS
**LOT :** LOT 0

---

## F-P1-02 — `get-users-temp.mjs` dans l'historique git

**Fichier :** `get-users-temp.mjs` (2 commits : `f5c7e49e`, `2d269d88`)
**Contenu** (ligne critique) : requête Prisma `findMany` sur `User` avec `select: { password: true }` — expose les hashs bcrypt.
**Statut actuel :** Non tracké (ajouté au `.gitignore` en `f5c7e49e`).
**Impact :** Historique contient un script qui loggait les hashs de mots de passe.
**Effort :** XS (nettoyage historique)
**LOT :** LOT 0

---

## F-P2-01 — Doublons de fichiers à faible risque

**PDF dupliqué :**
- `app/programme/maths-1ere/programme_eds_maths_premiere.pdf` (MD5 : `bfcf80f497b5962fd86ee609f50af068`)
- `programmes/programme_eds_maths_premiere.pdf` (MD5 identique)

**Fichiers markdown specs dans les routes Next.js :**
- `app/programme/maths-1ere/cahier_charges_maths_1ere_v2.md`
- `app/programme/maths-1ere/cahier_charges_page_maths_premiere.md`
- `app/bilan-pallier2-maths/cahier_charges_questionnaire_stage.md`
- `app/bilan-pallier2-maths/cahier_charges_questionnaire_stage_v2.md`

**Impact :** Risque faible (pas de secrets), mais les fichiers `.md` sont servis statiquement par Next.js et gonflent le bundle.
**Effort :** XS
**LOT :** LOT 1

---

## Récapitulatif des credentials à révoquer/rotater

| Credential | Fichier source | Exposé en git ? | Action |
|------------|---------------|-----------------|--------|
| `privkey.pem` SSL | `nginx/ssl/privkey.pem` | OUI (8 commits) | Révoquer + régénérer certificat |
| `NEXTAUTH_SECRET` | `.env.production` (local) | NON | Rotation recommandée (précaution) |
| `SMTP_PASSWORD` (`NexusReussite2025@NSI`) | `.env.production` (local) | NON | Rotation recommandée |
| `RAG_API_TOKEN` | `.env.production` (local) | NON | Rotation recommandée |
| `POSTGRES_PASSWORD` | `.env.production` (local) | NON | Évaluer si mot de passe prod réel |
| Tokens session `parent.json` | Historique git | OUI (29 commits) | Invalider via rotation NEXTAUTH_SECRET |
| Tokens session `student.json` | Historique git | OUI (6 commits) | Idem |
| Hashs bcrypt dans `get-users-temp.mjs` | Historique git | OUI (2 commits) | Nettoyage historique suffisant |
