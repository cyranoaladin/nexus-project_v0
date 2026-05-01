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

  // One active report per coach-student pair
  @@unique([studentId, coachId])
  @@index([coachId])
  @@index([studentId])
  @@map("eaf_preparation_reports")
}
```

## RBAC

### Règles d'accès

- **COACH** : Peut lire et écrire les bilans EAF uniquement pour les élèves qui lui sont assignés via `CoachStudentAssignment`
- **ADMIN** : Peut lire et écrire tous les bilans (selon règles existantes)
- **ASSISTANTE** : Pas d'accès automatique (selon règles existantes)
- **ELEVE/PARENT** : Pas d'accès en écriture (selon règles existantes)

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
- `GET unauthenticated => 401` - ✅
- `PUT unauthenticated => 401` - ✅
- `upsert preserves same report for same coach/student` - ✅
- `validate field length limits (max 5000 chars)` - ✅

### Tests UI

- Rendu du formulaire - ✅
- Chargement des valeurs existantes - ✅
- Modification d'un champ - ✅
- Bouton enregistrer appelle l'API - ✅
- Message de succès - ✅

## Migration

La migration `20260501120000_add_eaf_preparation_reports` crée :

- La table `eaf_preparation_reports`
- Les contraintes de clé étrangère vers `students` et `coach_profiles`
- L'index unique `[studentId, coachId]`
- Les index `coachId` et `studentId`

La migration est non destructive et ne modifie pas les tables existantes.

## Déploiement

### Prérequis

- Le compte coach doit exister et avoir le rôle COACH
- Les élèves doivent être assignés au coach via `CoachStudentAssignment`

### Procédure de déploiement

1. PR validée et CI verte
2. Backup DB selon procédure production
3. Git pull main sur serveur
4. Build/restart app si nécessaire
5. Exécution des migrations via `prisma migrate deploy` ou conteneur migrate officiel
6. Healthchecks
7. Smoke test

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
