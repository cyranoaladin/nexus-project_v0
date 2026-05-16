# NSI Pratique 2026 — Production Runbook

## 1. Routes élève
Interface accessible aux rôles `ELEVE` :
- `/dashboard/eleve/nsi-pratique-2026` : tableau de bord de progression NSI pratique.

## 2. Routes coach
Interface accessible aux rôles `COACH` et `ADMIN` :
- `/dashboard/coach/nsi-pratique-2026` : vue cohorte des élèves et leur progression.

## 3. API élève
Endpoints authentifiés (NextAuth + RBAC `ELEVE`) :
- `GET /api/eleve/nsi-pratique-2026/progress` : retourne la progression de l'utilisateur connecté.
- `PUT /api/eleve/nsi-pratique-2026/progress` : persiste la progression côté serveur.
  - Payload : `{ data: { subjects, patterns, flashcards, fiveDayPlan, selfAssessment, mockExams, oralPhrases } }`
  - Validation Zod `.strict()` : seules les clés listées ci-dessus sont acceptées.
  - Clés interdites (rejetées 400) : `userId`, `email`, `password`, `token`, `role`, `secret`, `apiKey`.
  - Taille max : 200 KB.

## 4. API coach
Endpoints authentifiés (NextAuth + RBAC `COACH`/`ADMIN`) :
- `GET /api/coach/nsi-pratique-2026/students` : liste des élèves assignés au coach, avec résumé de progression.
  - Réponse : `{ students: [...], count: N }`
- `GET /api/coach/nsi-pratique-2026/students/{studentId}/progress` : détail complet de la progression d'un élève.
  - Contrainte : le `studentId` est l'ID du profil student (ex: `stu_rania_nsi`), pas le userId.
  - Un coach ne peut consulter que les élèves qui lui sont rattachés via `coach_student_assignments`.

## 5. Table Prisma

```prisma
model NsiPracticeProgress {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  data      Json     // Full NsiProgress object (même structure que localStorage)
  version   Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("nsi_practice_progress")
}
```

## 6. Migration
- Fichier : `prisma/migrations/20260516000000_add_nsi_practice_progress/`
- Table créée : `nsi_practice_progress`
- Appliquée en production le 2026-05-16.

## 7. Vérifier la santé

```bash
# Containers
docker ps --format "table {{.Names}}\t{{.Status}}" | grep nexus

# Logs récents (erreurs)
docker logs nexus-app-prod --since 10m 2>&1 | grep -Ei "error|exception|failed|prisma" || echo "OK"
docker logs nexus-postgres-prod --since 10m 2>&1 | grep -Ei "error|fatal|panic" || echo "OK"

# Table NSI en DB
docker exec nexus-postgres-prod psql -U nexus_admin -d nexus_reussite_prod \
  -c "SELECT COUNT(*), MAX(\"updatedAt\") FROM nsi_practice_progress;"
```

## 8. Tester une synchro élève

```bash
# Vérifier la progression d'un élève en DB
docker exec nexus-postgres-prod psql -U nexus_admin -d nexus_reussite_prod \
  -c "SELECT \"userId\", \"version\", \"updatedAt\", length(data::text) as data_size FROM nsi_practice_progress;"
```

Via l'UI :
1. Connexion élève → Dashboard → NSI Pratique.
2. Modifier une auto-évaluation ou un statut de sujet.
3. Attendre le message "Progression synchronisée avec le serveur."
4. Déconnexion → Reconnexion → Vérifier que la progression est conservée.

## 9. Vérifier qu'un coach voit ses élèves

```bash
# Vérifier les assignments coach-student
docker exec nexus-postgres-prod psql -U nexus_admin -d nexus_reussite_prod \
  -c "SELECT csa.\"coachId\", cp.pseudonym, csa.\"studentId\", csa.subjects, csa.status
      FROM coach_student_assignments csa
      JOIN coach_profiles cp ON csa.\"coachId\" = cp.id
      WHERE 'NSI' = ANY(csa.subjects) AND csa.status = 'ACTIVE';"
```

Via l'UI :
1. Connexion coach → Dashboard → NSI Pratique 2026.
2. La page affiche la liste des élèves avec leur progression.
3. Cliquer sur un élève pour voir le détail.

## 10. Restaurer depuis backup DB

Le backup a été créé avant le déploiement NSI :
```
/root/backup_before_nsi_progress_20260516_091750.sql
```

Pour restaurer (ATTENTION : perte de données post-backup) :
```bash
# 1. Arrêter l'app
docker compose -f docker-compose.prod.yml stop nexus-app-prod

# 2. Restaurer
docker exec -i nexus-postgres-prod psql -U nexus_admin -d nexus_reussite_prod < /root/backup_before_nsi_progress_20260516_091750.sql

# 3. Redémarrer
docker compose -f docker-compose.prod.yml up -d nexus-app-prod
```

## 11. Rollback Docker

Image backup disponible : `nexus-app-prod-backup-before-nsi-20260515_231418:latest`

```bash
# Rollback vers l'image précédente
docker tag nexus-app-prod-backup-before-nsi-20260515_231418:latest nexus-nexus-app:latest
docker compose -f docker-compose.prod.yml up -d nexus-app-prod
```

## 12. Dette technique résiduelle

- **Validation Zod `.passthrough()`** : les sous-objets (subjects, patterns, etc.) acceptent des clés supplémentaires via `.passthrough()`. Seul le niveau racine est `.strict()`.
- **Pas de rate limiting** : les endpoints PUT ne sont pas protégés contre les abus.
- **Pas de versioning optimiste** : pas de gestion de conflit si deux sessions écrivent en même temps.
- **Worker NPC** : le worker `nexus-npc-worker-prod` n'est pas directement lié au NSI mais tourne sur le même stack.

## 13. Plan de nettoyage Docker

| Image | Taille | Action | Échéance |
|---|---|---|---|
| `nexus-nexus-app:latest` | 903 MB | Garder | Active |
| `nexus-npc-worker:latest` | 2.63 GB | Garder | Active |
| `nexus-migrate:latest` | 2.74 GB | Garder | Active |
| `nexus-app-prod-backup-*` | 993 MB | Garder puis supprimer | 2026-06-01 |
| `nexus-project_v0-nexus-app` | 900 MB | Supprimer | Immédiat |
| `nexus-project_v0-npc-worker` | 2.62 GB | Supprimer | Immédiat |
| `nexus-project_v0-migrate` | 2.74 GB | Supprimer | Immédiat |
| `nexus-next-app` | 3.84 GB | Supprimer | Immédiat |
| Build cache reclaimable | ~168 GB | Purger (>72h) | Immédiat |

## 14. Limites actuelles

- **Login cyranoaladin** : non testé directement en production faute de mot de passe disponible. Le compte existe en DB et dispose des assignments coach NSI.
- **Feature gating abonnement** : non activé. Tout élève `TERMINALE` avec `NSI` dans ses spécialités peut accéder à la fonctionnalité.
- **Backup Docker** : l'image backup (`nexus-app-prod-backup-before-nsi-*`) doit être purgée après stabilisation (recommandé : après le 2026-06-01).
- **NSI_INITIAL_PASSWORD** : la variable d'environnement n'est plus définie sur le serveur. Si un test UI automatisé est nécessaire, retrouver ou réinitialiser les mots de passe.
- **Scripts de maintenance** : `prod-upsert-nsi-users.ts` déplacé vers `/root/nexus-maintenance-scripts/` (hors du workspace Git).
