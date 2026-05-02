# Bilan de préparation à l'EAF - Coach

## Objectif

Permettre aux coachs de remplir un bilan pédagogique de préparation à l'Épreuve Anticipée de Français (EAF) pour leurs élèves assignés. Ce bilan permet de suivre la progression de l'élève sur les compétences clés de l'EAF et de documenter les points forts, points à travailler et objectifs.

## Routes

### API

- `GET /api/coach/students/[studentId]/eaf-preparation-report` - Récupérer le bilan EAF d'un élève
- `PUT /api/coach/students/[studentId]/eaf-preparation-report` - Créer ou mettre à jour le bilan EAF

### Dashboard

- `/dashboard/coach/eleve/[studentId]` - Page détail élève avec section Bilan de préparation à l'EAF (visible uniquement pour les élèves PREMIERE)

## Modèle de données

### EafPreparationReport

```prisma
model EafPreparationReport {
  id        String   @id @default(cuid())
  studentId String
  student   Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)

  coachId String
  coach   CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)

  // EAF rubrics (text fields, max 5000 chars each)
  linearReading        String?  @db.Text
  workPresentation     String?  @db.Text
  interview            String?  @db.Text
  oralExpression       String?  @db.Text
  writingMethod        String?  @db.Text
  languageMastery      String?  @db.Text
  literaryCulture      String?  @db.Text
  strengths            String?  @db.Text
  areasToImprove       String?  @db.Text
  nextSessionGoals     String?  @db.Text
  coachFreeComment     String?  @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // One report per coach-student pair
  @@unique([studentId, coachId])
  @@index([coachId])
  @@index([studentId])
  @@map("eaf_preparation_reports")
}
```

## RBAC

### Règles d'accès

- **COACH** : Peut lire et écrire les bilans EAF uniquement pour les élèves qui lui sont assignés via `CoachStudentAssignment`
- **ADMIN** : Non supporté par cette route dans la version actuelle (évolution future possible)
- **ASSISTANTE** : Pas d'accès via cette API
- **ELEVE/PARENT** : Pas d'accès via cette API

### Vérification d'accès

La vérification d'accès utilise le module existant `lib/rbac/coach-student-access.ts` :

```typescript
assertCoachCanAccessStudent({ coachUserId, studentId })
```

Cette fonction vérifie qu'il existe une assignation active entre le coach et l'élève via `CoachStudentAssignment`.

## Rubriques du bilan EAF

Les rubriques suivantes sont disponibles (champs texte, max 5000 caractères chacune) :

1. **Lecture linéaire** - Capacité à lire et comprendre un texte de manière fluide
2. **Présentation de l'œuvre** - Capacité à présenter l'œuvre, le contexte, l'auteur
3. **Entretien** - Capacité à répondre aux questions de l'examinateur
4. **Expression orale** - Qualité de l'expression, aisance, vocabulaire
5. **Méthode de commentaire / dissertation** - Maîtrise de la méthode, construction du plan
6. **Maîtrise de la langue** - Grammaire, orthographe, syntaxe, vocabulaire
7. **Culture littéraire** - Connaissance des œuvres, des mouvements littéraires
8. **Points forts** - Ce que l'élève maîtrise bien
9. **Points à travailler** - Ce qui nécessite encore du travail
10. **Objectifs pour la prochaine séance** - Objectifs prioritaires pour la suite
11. **Commentaire libre du coach** - Remarques libres, suggestions, observations

## Limitations

- Un seul bilan EAF actif par couple coach / élève (contrainte unique `[studentId, coachId]`)
- Chaque champ texte limité à 5000 caractères
- Le bilan est visible uniquement pour les élèves de niveau PREMIERE
- Le coach ne peut modifier que les bilans de ses propres élèves assignés

## Tests réalisés

### Tests API

- `GET report as assigned coach => 200` - ✅
- `PUT report as assigned coach => 200` - ✅
- `GET report as unassigned coach => 403` - ✅
- `PUT report as unassigned coach => 403` - ✅
- `validate field length limits (max 5000 chars)` - ✅

### Tests UI (manuels)

- Rendu du formulaire - ✅
- Chargement des valeurs existantes - ✅
- Modification d'un champ - ✅

### Tests recommandés (à ajouter)

- `GET unauthenticated => 401` - À ajouter
- `PUT unauthenticated => 401` - À ajouter
- Tests UI automatisés avec Playwright - À ajouter

## Migration

La migration `20260501120000_add_eaf_preparation_reports` crée :

- La table `eaf_preparation_reports`
- Les contraintes de clé étrangère vers `students` et `coach_profiles`
- L'index unique `[studentId, coachId]`
- Les index `coachId` et `studentId`

La migration est non destructive et ne modifie pas les tables existantes.

## Déploiement

### Prérequis

- Migration Prisma : `prisma/migrations/20260501120000_add_eaf_preparation_reports`
- Docker Compose prod : `docker-compose.prod.yml`
- Serveur production : `<PROD_SSH_TARGET>`

### Procédure de déploiement

1. Appliquer la migration Prisma sur la production :
   ```bash
   ssh <PROD_SSH_TARGET>
   cd /opt/nexus
   docker compose -f docker-compose.prod.yml run --rm migrate npx prisma migrate deploy
   ```

2. Vérifier que la table `eaf_preparation_reports` a été créée :
   ```bash
   docker exec nexus-postgres-prod psql -U nexus_admin -d nexus_prod -c "\d eaf_preparation_reports"
   ```

3. Rebuild et redémarrer l'application :
   ```bash
   docker compose -f docker-compose.prod.yml build nexus-app
   docker compose -f docker-compose.prod.yml up -d nexus-app
   ```

4. Vérifier les healthchecks :
   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl http://localhost:3001/api/health
   ```

### Historique de déploiement

#### 2026-05-01 - Déploiement PR #43 (EAF Coach Reports)

**Statut : Déployé avec réserves**

- **Migration** : Appliquée manuellement via psql (procédure officielle Prisma a échoué avec "No pending migrations")
- **Audit migration** : Table créée, structure vérifiée, Prisma migrate status = "Database schema is up to date!"
- **Backup** : nexus_prod_post_eaf_migration_20260501-191306.sql.gz (330K)
- **App health** : OK
- **Smoke test Raja** : Échec - Section EAF non visible dans l'UI pour les élèves Première
- **DB** : 0 rapport créé (smoke test non réussi)
- **RBAC** : Tests unitaires existants couvrant le cas coach non assigné (403)

**Réserves** :
- Smoke test UI non réussi - section EAF non visible dans le dashboard coach
- Cause non identifiée : les données DB confirment que Raja a des élèves Première assignés
- Fonctionnalité API non testée en production (tests unitaires OK)
- Validation UI requise avant validation complète

**Action requise** : Investigation UI pour comprendre pourquoi la section EAF ne s'affiche pas pour les élèves Première dans le dashboard coach.

#### 2026-05-01 - Déploiement PR #44 (Fix visibilité EAF)

**Statut : Déployé**

- **Commit** : 92d7ef3d fix(coach): render EAF report for Premiere students (#44)
- **Changements** :
  - Ajout de `isPremiereLevel` helper pour vérification case-insensitive du niveau
  - Mise à jour de StudentDossier pour utiliser le helper au lieu de `student.gradeLevel === 'PREMIERE'`
  - Ajout de `data-testid="eaf-preparation-report"` au composant Card pour smoke test fiable
  - Ajout de tests anti-régression pour le helper `isPremiereLevel`
- **Déploiement** : Build Docker, restart nexus-app, container healthy
- **Smoke test Raja** : Échec - Problème d'authentification Playwright (redirection vers signin page, non lié au fix)
- **DB** : 0 rapport (smoke test non réussi, aucun doublon détecté)
- **RBAC** : Tests unitaires existants couvrant le cas coach non assigné (403). Enforcement réel non testé en production (réserve).

**Réserves** :
- Smoke test Playwright échoue à cause de problèmes d'authentification (API-based auth redirige vers signin)
- Fix UI déployé mais non validé manuellement en production
- Validation manuelle requise pour confirmer que la section EAF s'affiche pour les élèves Première

**Action requise** : Validation manuelle en production - connecter en tant que coach Raja, naviguer vers le dossier d'un élève Première, vérifier que la section "Bilan de préparation à l'EAF" est visible.

### Smoke test attendu

1. Connexion coach
2. Ouverture dashboard coach
3. Ouverture d'un élève assigné de niveau PREMIERE
4. Vérification que la section "Bilan de préparation à l'EAF" est visible
5. Saisie de texte dans 2-3 rubriques
6. Sauvegarde
7. Refresh page
8. Vérification que le texte persiste
9. Vérification qu'un autre coach non assigné ne peut pas accéder (403)
10. Vérification des logs

## Notes importantes

- Cette fonctionnalité est générique et extensible à tous les coachs, pas seulement à un email spécifique
- Aucune logique hardcodée autour d'un email spécifique n'est implémentée
- Le système utilise l'infrastructure existante d'assignation coach-élève (`CoachStudentAssignment`)
- Le bilan EAF est séparé du système de bilans de stage (`StageBilan`) et des bilans canoniques (`Bilan`)
