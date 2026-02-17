# Stratégie Migrations — Nexus Réussite

## État actuel (Feb 2026)

### Drift constaté

Le schéma Prisma local est en avance sur l'historique de migrations.
Cause : certaines colonnes (`activatedAt`, `activationToken`, `activationExpiry` sur `users`)
ont été ajoutées via `db push` sans migration correspondante.

Conséquence : `prisma migrate dev` détecte un drift et demande un reset.

### Tables ajoutées via `db push` (sans migration)

- `invoices` (moteur facturation)
- `invoice_items` (lignes de facture)
- `invoice_sequences` (compteur numérotation atomique)

### Migrations existantes (appliquées en prod)

```
prisma/migrations/
├── 20260127_init/
├── 20260128_add_aria_conversations/
├── 20260129_add_badges_and_reports/
├── 20260130_add_subscription_requests_and_notifications/
├── 20260131_add_session_booking_system/
├── 20260201201415_add_session_overlap_prevention/
├── 20260201201534_add_credit_transaction_idempotency/
├── 20260214_fix_cascade_constraints/
├── 20260214_init_assessment_module/
└── 20260214_add_diagnostics_v2_columns/
```

## Procédure de reset dev (si nécessaire)

```bash
# 1. Sauvegarder les données dev si besoin
pg_dump -h 127.0.0.1 -p 5435 -U nexus_admin nexus_reussite_prod > backup_dev.sql

# 2. Reset complet (supprime toutes les données)
npx prisma migrate reset --force

# 3. Re-seed
npx prisma db seed

# 4. Vérifier
npx prisma migrate status
```

## Procédure standard de migration (flux normal)

```bash
# 1. Modifier prisma/schema.prisma
# 2. Générer la migration
npx prisma migrate dev --name <nom_descriptif>

# 3. Vérifier le SQL généré dans prisma/migrations/<timestamp>_<nom>/migration.sql
# 4. Tester
npm run test:unit

# 5. En production
npx prisma migrate deploy
```

## Plan de retour à `prisma migrate` — Procédure opérable

> **Objectif** : zéro improvisation le jour du déploiement facturation.
> Chaque étape est un copier-coller. Pas de décision à prendre en live.

### Pré-requis

- Accès SSH au serveur `88.99.254.59`
- Container `nexus-postgres-db` running (port 5435)
- Backup récent de la DB prod (cf. procédure de reset ci-dessus)

### Étape 1 — Snapshot du schéma prod actuel

```bash
# Sur la machine dev, connectée à la DB prod (ou copie locale)
# Génère le SQL delta entre les migrations existantes et le schéma Prisma actuel
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > /tmp/baseline_invoicing.sql

# Vérifier le contenu (doit contenir CREATE TABLE invoices, invoice_items, invoice_sequences
# + ALTER TABLE users ADD activatedAt/activationToken/activationExpiry
# + tout autre drift)
cat /tmp/baseline_invoicing.sql
```

### Étape 2 — Créer la migration baseline

```bash
# Créer le dossier de migration (date du jour)
MIGRATION_NAME="20260217_baseline_invoicing_and_drift"
mkdir -p prisma/migrations/${MIGRATION_NAME}

# Copier le SQL généré
cp /tmp/baseline_invoicing.sql prisma/migrations/${MIGRATION_NAME}/migration.sql

# Marquer comme "déjà appliquée" (la DB a déjà ces tables via db push)
npx prisma migrate resolve --applied ${MIGRATION_NAME}
```

### Étape 3 — Valider en dev

```bash
# Doit afficher "Database schema is up to date"
npx prisma migrate status

# Doit passer SANS demander de reset
npx prisma migrate dev --name test_post_baseline

# Si ça passe → supprimer la migration test
rm -rf prisma/migrations/*test_post_baseline*

# Régénérer le client
npx prisma generate

# Tests
npm run test:unit
```

### Étape 4 — Déployer en prod

```bash
# Sur le serveur (88.99.254.59)
ssh root@88.99.254.59

# Backup avant migration
docker exec nexus-postgres-db pg_dump -U nexus_admin nexus_prod > /root/backups/pre_baseline_$(date +%Y%m%d_%H%M%S).sql

# Pull et deploy
cd /opt/nexus
git pull origin main

# Appliquer les migrations
docker exec nexus-next-app npx prisma migrate deploy

# Vérifier
docker exec nexus-next-app npx prisma migrate status

# Rebuild si nécessaire
docker compose up -d --build nexus-next-app
```

### Étape 5 — Vérification post-deploy

```bash
# Vérifier que les tables existent
docker exec nexus-postgres-db psql -U nexus_admin -d nexus_prod -c "\dt invoices"
docker exec nexus-postgres-db psql -U nexus_admin -d nexus_prod -c "\dt invoice_items"
docker exec nexus-postgres-db psql -U nexus_admin -d nexus_prod -c "\dt invoice_sequences"

# Vérifier le statut des migrations
docker exec nexus-next-app npx prisma migrate status
# Attendu : "Database schema is up to date"
```

### Rollback (si échec)

```bash
# Restaurer le backup
docker exec -i nexus-postgres-db psql -U nexus_admin -d nexus_prod < /root/backups/pre_baseline_YYYYMMDD_HHMMSS.sql

# Revenir au commit précédent
cd /opt/nexus
git checkout HEAD~1
docker compose up -d --build nexus-next-app
```

## Règles

1. **Jamais `db push` en prod** — uniquement `migrate deploy`
2. **Toute modification de schéma** → migration nommée via `migrate dev`
3. **Tester la migration** sur une copie de la DB prod avant déploiement
4. **Documenter** chaque migration dans le message de commit
5. **Backup obligatoire** avant chaque `migrate deploy` en prod
6. **Ne jamais supprimer** une migration déjà appliquée en prod
