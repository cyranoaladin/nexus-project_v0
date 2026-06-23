# AUDIT DB / PROFILS / RÔLES / PARCOURS / DOCUMENTS — NEXUS RÉUSSITE

**Date** : 2026-04-25  
**Version** : v1.0  
**Statut** : Audit initial post-déploiement PR #24  
**Auteur** : Cascade (AI Assistant)  
**Scope** : Lecture seule, aucune modification production

---

## 1. Résumé Exécutif

### 1.1 État Général
| Aspect | Évaluation | Commentaire |
|--------|------------|-------------|
| **Schéma Prisma** | 🟡 Partiellement complet | Modèles de base présents mais manques structurels critiques |
| **Alignement DB** | 🟢 Bon | 49 tables, migrations à jour, colonnes PR #24 déployées |
| **RBAC** | 🟡 Fonctionnel mais limité | Permissions centralisées dans `lib/rbac.ts` |
| **Associations Coach-Élève** | 🔴 **CRITIQUE : Manquant** | Pas de table de liaison explicite |
| **Documents** | 🟡 Basique | Modèle `UserDocument` existant mais pas d'assignation fine |
| **Dashboards** | 🟡 Partiels | Élève OK, Coach incomplet, Admin/Assistante limités |

### 1.2 Risque Principal
**Risque Critique** : L'absence d'une table `CoachStudentAssignment` ou équivalent empêche :
- Un coach de voir explicitement "ses" élèves
- L'assistante de gérer les associations coach-élève
- La traçabilité historique des affectations
- La segmentation claire des responsabilités pédagogiques

### 1.3 Priorité
1. **P0** : Créer le modèle d'association Coach-Élève
2. **P1** : Compléter les dashboards Coach et Assistante
3. **P2** : Implémenter l'assignation fine des documents
4. **P3** : Standardiser les workflows d'onboarding

---

## 2. Cartographie Actuelle

### 2.1 Modèles Utilisateurs et Rôles

#### 2.1.1 Enum UserRole (Prisma)
```prisma
enum UserRole {
  ADMIN         // Super administrateur
  ASSISTANTE    // Gestion opérationnelle
  COACH         // Accompagnement pédagogique
  PARENT        // Parent d'élève
  ELEVE         // Élève
}
```

**Analyse** :
- ✅ 5 rôles bien définis
- ❌ Pas de SUPER_ADMIN distinct de ADMIN
- ❌ Pas de granularité (ex: COACH_MATHS vs COACH_GENERAL)
- ❌ Rôles mutuellement exclusifs (pas de multi-rôles)

#### 2.1.2 Model User (Prisma)
```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  firstName       String?
  lastName        String?
  phone           String?
  userRole        UserRole  // Rôle principal
  
  // Relations profils
  student         Student?
  parentProfile   ParentProfile?
  coachProfile    CoachProfile?
  
  // Relations documents
  documents       UserDocument[]
  documentsUploaded UserDocument[] @relation("DocumentUploader")
  
  // Relations stages et notes
  stageReservations StageReservation[]
  stageBilans     StageBilan[]
  coachNotesAuthored CoachNote[]
  coachNotesAbout CoachNote[]
  
  // Relations progression
  mathsProgress   MathsProgress[]
}
```

**Analyse** :
- ✅ One-to-One avec profils spécifiques (Student, ParentProfile, CoachProfile)
- ✅ Relations documents bidirectionnelles
- ❌ Pas de champs pour permissions additionnelles
- ❌ Pas d'audit trail (createdBy, updatedBy)

### 2.2 Profil Élève (Student)

#### 2.2.1 Model Student (Prisma)
```prisma
model Student {
  id              String    @id @default(cuid())
  userId          String    @unique
  parentId        String?   // Lien vers parent
  
  // Informations pédagogiques (PR #24)
  grade           String?   // Legacy, à migrer vers gradeLevel
  gradeLevel      GradeLevel?        // PREMIERE, TERMINALE, etc.
  academicTrack   AcademicTrack?     // EDS_GENERALE, STMG, etc.
  specialties     Subject[]            // Spécialités choisies
  stmgPathway     StmgPathway?       // RHC, MERCATIQUE, etc. (si STMG)
  updatedTrackAt  DateTime?           // Date de dernière modification
  
  // Mode survie (PR #24)
  survivalMode    Boolean   @default(false)
  survivalModeReason String?
  survivalModeBy  String?
  survivalModeAt  DateTime?
  
  // Relations
  user            User      @relation(fields: [userId], references: [id])
  parent          ParentProfile? @relation(fields: [parentId], references: [id])
  subscriptions   Subscription[]
  sessions        Session[]
  reports         StudentReport[]
  trajectories    Trajectory[]
  assessments     Assessment[]
  survivalProgress SurvivalProgress?
  badges          StudentBadge[]
  
  // Progression
  mathsProgress   MathsProgress[]
}
```

**Analyse** :
- ✅ Champs PR #24 présents et conformes
- ✅ Support EDS Maths et STMG avec pathway
- ✅ Spécialités stockées comme array
- ❌ Pas de "parcours actif" dénormalisé pour affichage rapide
- ❌ Pas d'historique des changements de filière
- ❌ Pas de lien explicite vers coach(s)

#### 2.2.2 Enums Pédagogiques
```prisma
enum GradeLevel {
  SECONDE
  PREMIERE
  TERMINALE
  POSTBAC
}

enum AcademicTrack {
  EDS_GENERALE    // Enseignement de spécialité Général
  STMG            // Sciences et Technologies du Management et de la Gestion
  STI2D           // Sciences et Technologies de l'Industrie et du Développement Durable
  ST2S            // Sciences et Technologies de la Santé et du Social
  STL             // Sciences et Technologies de Laboratoire
  STD2A           // Sciences et Technologies du Design et des Arts
  STMG_NON_LYCEEN // STMG hors lycée (post-bac?)
}

enum StmgPathway {
  RHC             // Ressources Humaines et Communication
  MERCATIQUE      // Mercatique (Marketing)
  GF              // Gestion et Finance
  SIG             // Systèmes d'Information et de Gestion
  INDETERMINE     // Non choisi
}

enum Subject {
  MATHS
  NSI
  PHYSIQUE_CHIMIE
  SVT
  SES
  HISTOIRE_GEO
  ANGLAIS
  ESPAGNOL
  // ... etc
}
```

**Analyse** :
- ✅ Granularité suffisante pour distinguer les filières
- ✅ STMG avec pathways spécifiques
- ❌ Pas d'enum `LearningPath` ou `ProductCode` explicite
- ❌ Pas de correspondance automatique track → parcours disponibles

### 2.3 Profil Coach (CoachProfile)

```prisma
model CoachProfile {
  id              String    @id @default(cuid())
  userId          String    @unique
  
  // Identité professionnelle
  title           String?   // Agrégé, Certifié, etc.
  pseudonym       String    @unique  // Hélios, Zénon, etc.
  tag             String?   // 🎓, 🎯, etc.
  description     String?
  philosophy      String?
  expertise       String?
  
  // Spécialités
  subjects        Json      @default("[]") // Array des matières
  
  // Disponibilités
  availableOnline   Boolean @default(true)
  availableInPerson Boolean @default(true)
  
  // Relations
  user            User      @relation(fields: [userId], references: [id])
  sessions        Session[]
  reports         StudentReport[]
  stageSessions   StageSession[]
  stageBilans     StageBilan[]
  stageAssignments StageCoach[]
  
  // ❌ MANQUANT : Relation explicite vers élèves assignés
}
```

**Analyse** :
- ✅ Profil riche avec métadonnées
- ✅ Spécialités flexibles (JSON)
- ✅ Intégration Stages
- 🔴 **CRITIQUE** : Aucune relation directe Student[] ou équivalent
- 🔴 Le coach ne peut pas "voir ses élèves" sans passer par Session ou Stage

### 2.4 Profil Parent (ParentProfile)

```prisma
model ParentProfile {
  id              String    @id @default(cuid())
  userId          String    @unique
  
  // Informations
  address         String?
  city            String?
  country         String    @default("Tunisie")
  
  // Tracking bilan gratuit
  bilanGratuitCompletedAt DateTime?
  bilanGratuitDismissedAt DateTime?
  
  // Relations
  user            User      @relation(fields: [userId], references: [id])
  children        Student[] // One-to-Many : un parent peut avoir plusieurs enfants
}
```

**Analyse** :
- ✅ Un parent peut avoir plusieurs enfants (Student[])
- ✅ Structure simple et fonctionnelle
- ❌ Pas de lien vers coachs des enfants
- ❌ Pas de permissions déléguées (ex: parent peut-il voir les notes?)

### 2.5 Documents (UserDocument)

```prisma
model UserDocument {
  id              String    @id @default(cuid())
  
  // Métadonnées
  title           String
  originalName    String
  mimeType        String
  sizeBytes       Int
  localPath       String    // Chemin stockage interne
  
  // Propriétaire (élève ou autre)
  userId          String
  user            User      @relation("UserDocuments", fields: [userId], references: [id])
  
  // Uploadeur (coach, assistante, ou élève lui-même)
  uploadedById    String?
  uploadedBy      User?     @relation("DocumentUploader", fields: [uploadedById], references: [id])
  
  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // ❌ MANQUANT : 
  // - Type de document (cours, exercice, bilan, etc.)
  // - Visibilité (élève seul, parent, coach, etc.)
  // - Parcours/matière associée
  // - Groupe d'élèves (pour documents partagés)
}
```

**Analyse** :
- ✅ Stockage technique fonctionnel
- ✅ Traçabilité de l'uploadeur
- 🔴 **IMPORTANT** : Pas de typologie documentaire
- 🔴 Pas de contrôle de visibilité fin
- 🔴 Pas d'assignation à un groupe d'élèves
- 🔴 Uniquement lié à un userId (pas de polymorphisme élève/groupe)

---

## 3. Relations et Associations

### 3.1 Matrice des Relations Actuelles

| Entité A | Relation | Entité B | Type | Commentaire |
|----------|----------|----------|------|---------------|
| User | 1:1 | Student | Optionnelle | Un user est optionnellement un élève |
| User | 1:1 | CoachProfile | Optionnelle | Un user est optionnellement un coach |
| User | 1:1 | ParentProfile | Optionnelle | Un user est optionnellement un parent |
| ParentProfile | 1:N | Student | Multiple | Un parent a plusieurs enfants |
| Student | N:1 | ParentProfile | Optionnelle | Un élève a un parent (optionnel) |
| Student | 1:N | MathsProgress | Multiple | Progression par niveau (EDS/Terminale) |
| Student | 1:1 | SurvivalProgress | Optionnelle | Mode survie STMG |
| Student | 1:N | Assessment | Multiple | Bilans passés |
| CoachProfile | 1:N | Session | Multiple | Séances données par le coach |
| CoachProfile | 1:N | StageCoach | Multiple | Assignations stages |
| **CoachProfile** | **??** | **Student** | **MANQUANT** | **Pas de lien direct !** |

### 3.2 Diagnostic : Association Coach-Élève

**Problème identifié** : Il n'existe actuellement aucun modèle explicite liant un coach à un élève en dehors du contexte d'une séance (Session) ou d'un stage (StageCoach).

**Conséquences** :
1. Un coach ne peut pas lister "ses élèves" sans passer par l'historique des séances
2. Impossible de savoir quel coach est responsable d'un élève en dehors des séances programmées
3. Pas de gestion d'équipe pédagogique (coach principal + coach secondaire)
4. Pas d'historique des changements de coach
5. Impossible d'assigner un document à "tous les élèves d'un coach"

**Workarounds actuels possibles** (à vérifier dans le code) :
- Via `StudentReport` (coachId est présent dans ce modèle)
- Via `CoachNote` (coachId + studentId)
- Via `Session` (coachId + studentId)

Mais aucune de ces tables n'est une table d'association déclarative et gérable par l'assistante.

---

## 4. Dashboards

### 4.1 Inventaire des Dashboards Existants

| Dashboard | Route | État | Commentaire |
|-----------|-------|------|-------------|
| **Élève** | `/dashboard/eleve` | 🟢 Fonctionnel | PR #24 complété, SSoT via `/api/student/dashboard` |
| **Parent** | `/dashboard/parent` | 🟡 Partiel | Page enfants présente, mais fonctionnalités limitées |
| **Coach** | `/dashboard/coach` | 🔴 **Incomplet** | Stages présents, mais pas de "mes élèves" clair |
| **Assistante** | `/dashboard/assistante` | 🟡 Limité | Stages OK, mais pas de gestion élèves/coaches |
| **Admin** | `/dashboard/admin` | 🟡 Basique | Pas identifié dans l'audit |

### 4.2 Analyse Dashboard Élève (Référence)

**Points forts** (post-PR #24) :
- SSoT (Single Source of Truth) via API `/api/student/dashboard`
- Détection automatique EDS vs STMG
- Cockpit adaptatif selon filière
- Mode Survie STMG fonctionnel
- Automatismes intégrés
- Documents visibles (si présents)

**API utilisées** :
- `GET /api/student/dashboard` → Données agrégées
- `GET /api/student/documents` → Documents
- `GET /api/student/resources` → Ressources pédagogiques
- `GET /api/student/survival/progress` → Mode survie
- `GET /api/student/automatismes/*` → Entraînement

### 4.3 Analyse Dashboard Coach

**Constats** :
- Route existante : `/dashboard/coach/*`
- Stages : Fonctionnel (`/dashboard/coach/stages`)
- Mais : **Pas de page "Mes élèves" claire**
- Les coachs interagissent via :
  - `Session` (séances)
  - `StageCoach` (stages)
  - `CoachNote` (notes privées)
  - `StudentReport` (rapports)

**Manques** :
- Liste des élèves assignés
- Vue d'ensemble des parcours
- Déclenchement de bilans
- Dépôt de documents ciblés

### 4.4 Analyse Dashboard Assistante

**Constats** :
- Route : `/dashboard/assistante/*`
- Stages : Fonctionnel
- Gestion des réservations : Présente

**Manques identifiés** :
- Création d'élèves (probablement via admin ou inscription)
- Création de coachs
- Association coach-élève
- Modification des parcours
- Upload document groupe

---

## 5. Routes API Critiques

### 5.1 Inventaire des Routes par Domaine

#### 5.1.1 Élève (`/api/student/*`)
```
/api/student/dashboard           → Données agrégées dashboard
/api/student/documents           → CRUD documents
/api/student/resources           → Ressources pédagogiques
/api/student/sessions            → Séances
/api/student/stages              → Stages
/api/student/trajectory          → Trajectoire
/api/student/nexus-index         → Indice Nexus
/api/student/survival/*          → Mode survie STMG
/api/student/automatismes/*      → Entraînement EDS
```

#### 5.1.2 Documents (`/api/student/documents/*`)
```
GET    /api/student/documents              → Liste documents
POST   /api/student/documents              → Upload
GET    /api/student/documents/[id]/download → Download (protégé ?)
```

**Analyse sécurité documents** :
- La route download vérifie-t-elle que l'utilisateur est bien le propriétaire ou a les droits ?
- À vérifier dans le code source

#### 5.1.3 Coach / Admin / Assistante
```
Routes identifiées dans l'audit :
- /api/stages/* (gestion stages)
- /api/students/[studentId]/badges
```

**Manques** :
- Pas de `/api/coach/students` (liste élèves assignés)
- Pas de `/api/admin/students` (gestion élèves)
- Pas de `/api/admin/coaches` (gestion coaches)
- Pas de `/api/assistante/assignments` (association coach-élève)

---

## 6. RBAC et Permissions

### 6.1 Architecture Actuelle

**Fichier** : `lib/rbac.ts`

```typescript
// Types d'actions
export type Action = 
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  | 'MANAGE' | 'VALIDATE' | 'READ_SELF' | 'READ_OWN';

// Ressources
export type Resource = 
  | 'USER' | 'STUDENT' | 'COACH' | 'PARENT'
  | 'SESSION' | 'BILAN' | 'STAGE' | 'DOCUMENT'
  | 'RESERVATION' | 'PAYMENT' | 'SUBSCRIPTION'
  | 'TRAJECTORY' | 'NOTIFICATION' | 'CONFIG' | 'REPORT';

// Matrice des permissions (simplifiée)
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    { action: 'MANAGE', resource: 'USER' },
    { action: 'MANAGE', resource: 'STUDENT' },
    { action: 'MANAGE', resource: 'COACH' },
    // ... tout est MANAGE
  ],
  [UserRole.ASSISTANTE]: [
    { action: 'READ', resource: 'USER' },
    { action: 'READ', resource: 'STUDENT' },
    { action: 'UPDATE', resource: 'STUDENT' },
    { action: 'VALIDATE', resource: 'BILAN' },
    { action: 'MANAGE', resource: 'RESERVATION' },
    // ... mais pas CREATE_USER, pas MANAGE_COACH
  ],
  [UserRole.COACH]: [
    { action: 'READ', resource: 'STUDENT' }, // Tous les élèves ?
    { action: 'CREATE', resource: 'SESSION' },
    { action: 'READ', resource: 'BILAN' },
    // ... manque READ_OWN_STUDENTS
  ],
  // ... etc
};
```

### 6.2 Problèmes Identifiés

| Problème | Sévérité | Description |
|----------|----------|-------------|
| Pas de `READ_OWN` pour Coach | 🔴 Haute | Un coach peut théoriquement lire tous les élèves, pas seulement les siens |
| Pas de permission `ASSIGN` | 🔴 Haute | Impossible de contrôler qui peut associer coach-élève |
| Pas de `DOCUMENT_UPLOAD` spécifique | 🟡 Moyenne | Pas de distinction upload pour soi vs pour autrui |
| Pas de scope par parcours | 🟡 Moyenne | Un coach Maths ne devrait pas voir les bilans NSI ? |

### 6.3 Fichier `lib/rbac/coach-student-access.ts`

Ce fichier existe mais n'a pas été audité en détail. Il pourrait contenir la logique manquante d'association.

---

## 7. Gaps Identifiés (Synthèse)

### 7.1 Gaps Modèles DB

| Gap | Priorité | Impact | Solution esquissée |
|-----|----------|--------|-------------------|
| **Pas de CoachStudentAssignment** | P0 | 🔴 Bloquant | Créer modèle liaison avec dates, status, type |
| **Pas de StudentGroup/Class** | P1 | 🟡 Limitant | Pour cohortes, classes, groupes de stages |
| **Pas de DocumentAssignment** | P1 | 🟡 Limitant | Assignation documents à groupe ou élève |
| **Pas d'historique Track changes** | P2 | 🟢 Info | Log changements de filière |
| **Pas de LearningPath enum** | P2 | 🟡 Limitant | EDS_MATHS_P1, STMG_MATHS_P1, etc. |

### 7.2 Gaps API

| Gap | Priorité | Impact |
|-----|----------|--------|
| **GET /api/coach/students** | P0 | Coach ne peut pas lister ses élèves |
| **POST /api/admin/students** | P1 | Pas de création élève par admin/assistante |
| **POST /api/admin/coaches** | P1 | Pas de création coach |
| **POST /api/assistante/assignments** | P0 | Pas d'association coach-élève |
| **POST /api/documents/assign** | P1 | Pas d'assignation document groupe |

### 7.3 Gaps Dashboards

| Gap | Priorité | Impact |
|-----|----------|--------|
| **Dashboard Coach - Mes Élèves** | P0 | Vue d'ensemble manquante |
| **Dashboard Coach - Dépôt Document** | P1 | Fonctionnalité probablement absente |
| **Dashboard Assistante - Gestion Élèves** | P1 | Pas d'interface de gestion |
| **Dashboard Assistante - Association** | P0 | Interface d'assignation manquante |

---

## 8. Architecture Cible Recommandée

### 8.1 Modèles à Ajouter

#### 8.1.1 CoachStudentAssignment (P0)
```prisma
model CoachStudentAssignment {
  id              String    @id @default(cuid())
  
  // Relations
  coachId         String
  coach           CoachProfile @relation(fields: [coachId], references: [id])
  
  studentId       String
  student         Student   @relation(fields: [studentId], references: [id])
  
  // Métadonnées d'assignation
  assignedById    String    // Qui a fait l'assignation (assistante/admin)
  assignedBy        User    @relation(fields: [assignedById], references: [id])
  
  // Période de validité
  startsAt        DateTime  @default(now())
  endsAt          DateTime?  // NULL = actif indéfiniment
  
  // Type d'assignation
  assignmentType  AssignmentType @default(PRIMARY)
  // PRIMARY = coach principal
  // SECONDARY = coach secondaire (spécialiste)
  // STAGE = assignation stage uniquement
  
  // Matières concernées (pour spécialistes)
  subjects        Subject[] // Si vide = toutes matières
  
  // Status
  status          AssignmentStatus @default(ACTIVE)
  
  // Notes
  notes           String?
  
  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([coachId, studentId, status], name: "unique_active_assignment")
  @@index([coachId, status])
  @@index([studentId, status])
  @@map("coach_student_assignments")
}

enum AssignmentType {
  PRIMARY    // Coach référent
  SECONDARY  // Spécialiste (maths, français...)
  STAGE      // Uniquement pour un stage
  TEMPORARY  // Remplacement
}

enum AssignmentStatus {
  ACTIVE
  SUSPENDED
  ENDED
}
```

#### 8.1.2 StudentGroup (P1)
```prisma
model StudentGroup {
  id              String    @id @default(cuid())
  name            String
  description     String?
  
  // Type de groupe
  groupType       GroupType @default(COHORT)
  // COHORT = Cohorte annuelle
  // CLASS = Classe physique
  // STAGE = Groupe de stage
  // CUSTOM = Groupe ad-hoc
  
  // Caractéristiques pédagogiques (optionnel)
  targetGradeLevel    GradeLevel?
  targetAcademicTrack AcademicTrack?
  
  // Relations
  members         StudentGroupMember[]
  documents       DocumentGroupAssignment[]
  
  // Gestion
  createdById     String
  createdBy       User      @relation(fields: [createdById], references: [id])
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@map("student_groups")
}

model StudentGroupMember {
  id          String    @id @default(cuid())
  groupId     String
  group       StudentGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  
  studentId   String
  student     Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  joinedAt    DateTime  @default(now())
  leftAt      DateTime?
  
  @@unique([groupId, studentId, joinedAt])
  @@map("student_group_members")
}
```

#### 8.1.3 DocumentAssignment (P1)
```prisma
// Extension du modèle UserDocument existant
// OU création d'un modèle d'assignation séparé

model DocumentVisibility {
  id              String    @id @default(cuid())
  documentId      String
  document        UserDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  
  // Cible de l'assignation (un seul des deux)
  userId          String?   // Élève individuel
  user            User?     @relation(fields: [userId], references: [id])
  
  groupId         String?   // Groupe d'élèves
  group           StudentGroup? @relation(fields: [groupId], references: [id])
  
  // Type de visibilité
  visibilityType  VisibilityType @default(PRIVATE)
  // PRIVATE = uniquement userId
  // COACH = userId + son coach
  // PARENT = userId + son parent
  // GROUP = membres du groupId
  
  // Métadonnées
  documentType    DocumentType @default(OTHER)
  // COURS, EXERCICE, BILAN, CORRECTION, PLANNING, ANNEXE, OTHER
  
  subject         Subject?  // Matière concernée (optionnel)
  
  createdAt       DateTime  @default(now())
  expiresAt       DateTime? // Date d'expiration (optionnel)
  
  @@index([documentId])
  @@index([userId])
  @@index([groupId])
  @@map("document_visibilities")
}

enum DocumentType {
  COURS
  EXERCICE
  BILAN
  CORRECTION
  PLANNING
  ANNEXE
  OTHER
}

enum VisibilityType {
  PRIVATE    // Uniquement l'élève
  COACH      // Élève + coach assigné
  PARENT     // Élève + parent
  GROUP      // Groupe entier
  PUBLIC     // Tous (rare, pour documents communs)
}
```

### 8.2 Enums à Ajouter

```prisma
// Dans le fichier schema.prisma

enum AssignmentType {
  PRIMARY
  SECONDARY
  STAGE
  TEMPORARY
}

enum AssignmentStatus {
  ACTIVE
  SUSPENDED
  ENDED
}

enum GroupType {
  COHORT
  CLASS
  STAGE
  CUSTOM
}

enum DocumentType {
  COURS
  EXERCICE
  BILAN
  CORRECTION
  PLANNING
  ANNEXE
  OTHER
}

enum VisibilityType {
  PRIVATE
  COACH
  PARENT
  GROUP
  PUBLIC
}

// Enum pour les parcours produits (optionnel mais recommandé)
enum ProductPath {
  EDS_MATHS_PREMIERE
  EDS_MATHS_TERMINALE
  STMG_MATHS_PREMIERE
  STMG_MATHS_TERMINALE
  NSI_PREMIERE
  NSI_TERMINALE
  EAF_PREMIERE
  EAF_TERMINALE
}
```

---

## 9. Matrice de Permissions Cible

### 9.1 Matrice Détaillée

| Action | ÉLÈVE | PARENT | COACH | ASSISTANTE | ADMIN |
|--------|-------|--------|-------|------------|-------|
| **Voir dashboard** | ✅ Soi | ✅ Enfants | ✅ Élèves assignés | ✅ Tous | ✅ Tous |
| **Modifier profil** | ✅ Soi | ❌ Non | ❌ Non | ✅ Tous | ✅ Tous |
| **Voir documents** | ✅ Siens | ✅ Enfants | ✅ Assignés | ✅ Tous | ✅ Tous |
| **Upload document** | ✅ Soi | ❌ Non | ✅ Assignés | ✅ Tous | ✅ Tous |
| **Assigner document groupe** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui | ✅ Oui |
| **Voir bilans** | ✅ Siens | ✅ Enfants | ✅ Assignés | ✅ Tous | ✅ Tous |
| **Créer bilan** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui | ✅ Oui |
| **Valider bilan** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui | ✅ Oui |
| **Voir progression** | ✅ Siennes | ✅ Enfants | ✅ Assignés | ✅ Toutes | ✅ Toutes |
| **Créer élève** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui | ✅ Oui |
| **Créer coach** | ❌ Non | ❌ Non | ❌ Non | ❌ Non | ✅ Oui |
| **Associer coach-élève** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui | ✅ Oui |
| **Modifier parcours** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui | ✅ Oui |
| **Gérer stages** | ❌ Non | ❌ Non | ✅ Si animateur | ✅ Oui | ✅ Oui |
| **Voir paiements** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui | ✅ Oui |
| **Gérer réservations** | ❌ Non | ❌ Non | ❌ Non | ✅ Oui | ✅ Oui |

### 9.2 Nouvelles Permissions à Ajouter au RBAC

```typescript
// Dans lib/rbac.ts

export type Resource = 
  | ... // existants
  | 'COACH_ASSIGNMENT'  // Nouveau : gestion associations
  | 'STUDENT_GROUP'     // Nouveau : gestion groupes
  | 'DOCUMENT_ASSIGNMENT'; // Nouveau : assignation documents

// Actions supplémentaires si nécessaire
export type Action = 
  | ... // existants
  | 'ASSIGN'      // Pour assigner coach/élève/document
  | 'UNASSIGN';   // Pour retirer une assignation
```

---

## 10. Workflows Cibles

### 10.1 Workflow : Association Coach-Élève (par Assistante)

```
1. Assistante se connecte → Dashboard Assistante
2. Navigue vers "Gestion Coachs" ou "Associations"
3. Sélectionne un coach (search/filter)
4. Clique "Assigner des élèves"
5. Interface de sélection multi-élèves :
   - Liste des élèves sans coach principal
   - Filtre par niveau/filière
   - Checkbox pour sélection multiple
6. Pour chaque élève, choisit :
   - Type : Principal / Secondaire / Stage
   - Matières (si Secondaire)
   - Date début (défaut: maintenant)
   - Date fin (optionnel)
7. Valide → Création en batch des CoachStudentAssignment
8. Notifications (optionnel) :
   - Email au coach
   - Notification élève (si activé)
9. Dashboard coach mis à jour → Élèves visibles
```

### 10.2 Workflow : Dépôt de Document par Coach

```
1. Coach connecté → Dashboard Coach → "Mes Élèves"
2. Sélectionne un élève (ou groupe via multi-select)
3. Clique "Déposer un document"
4. Formulaire d'upload :
   - Fichier (drag & drop)
   - Titre
   - Type : Cours / Exercice / Bilan / Correction / Planning / Autre
   - Matière (si applicable)
   - Visibilité :
     * Élève uniquement
     * Élève + Parent
     * Élève + Coach (soi)
     * Groupe (si sélection groupe)
   - Date d'expiration (optionnel)
5. Upload → Création UserDocument + DocumentVisibility
6. Élève voit le document dans son dashboard → Rubrique Documents
7. Notifications (optionnel) :
   - Notification push à l'élève
   - Email récapitulatif au parent
```

### 10.3 Workflow : Changement de Parcours (par Assistante)

```
1. Assistante se connecte → "Gestion Élèves"
2. Recherche l'élève (nom/email)
3. Ouvre fiche élève
4. Section "Parcours Actuel" affiche :
   - Niveau : Première
   - Filière : Générale
   - Spécialités : Maths, NSI
   - Parcours actif : EDS Maths Première
5. Clique "Modifier le parcours"
6. Formulaire de modification :
   - Nouveau niveau (si changement année)
   - Nouvelle filière (Générale ↔ STMG)
   - Si STMG : choix de la voie (RHC, Mercatique...)
   - Nouvelles spécialités (multi-select)
7. Validation avec confirmation :
   - "Attention : Changement de filière va migrer la progression"
   - Option : "Conserver l'accès à l'ancien parcours en lecture"
8. Sauvegarde :
   - UPDATE Student
   - Log dans une table d'historique (StudentTrackHistory ?)
   - Recalcul des droits d'accès
   - Mise à jour des entitlements
9. Dashboard élève automatiquement adapté au nouveau parcours
```

---

## 11. Plan d'Implémentation Recommandé

### Phase A — Fondations (Semaine 1)

**Objectif** : Poser les bases modèles et migrations

| Tâche | Détails | Livrable |
|-------|---------|----------|
| A1 | Créer modèle `CoachStudentAssignment` | PR #1 |
| A2 | Créer enums `AssignmentType`, `AssignmentStatus` | PR #1 |
| A3 | Migration Prisma safe | migration.sql |
| A4 | Seed données test | seed.ts |
| A5 | Mettre à jour `CoachProfile` avec relation | PR #1 |
| A6 | Mettre à jour `Student` avec relation inverse | PR #1 |

**Validation** :
- `prisma migrate dev` passe
- `prisma generate` OK
- Seeds créent des assignations test
- Rétro-compatibilité : ancien code fonctionne toujours

### Phase B — API Core (Semaine 2)

**Objectif** : Rendre les données accessibles

| Tâche | Détails | Livrable |
|-------|---------|----------|
| B1 | `GET /api/coach/students` | Route API |
| B2 | `GET /api/assistante/coaches` | Route API |
| B3 | `POST /api/assistante/assignments` | Route API |
| B4 | `DELETE /api/assistante/assignments/[id]` | Route API |
| B5 | `GET /api/assistante/students` avec filtres | Route API |
| B6 | Guards ownership : coach ne voit que ses élèves | RBAC |
| B7 | Tests unitaires API | Jest |

**Validation** :
- Postman/Insomnia : toutes routes fonctionnent
- Tests Jest passent
- Pas de régression routes existantes

### Phase C — Dashboards (Semaine 3)

**Objectif** : Interfaces utilisateur

| Tâche | Détails | Livrable |
|-------|---------|----------|
| C1 | Dashboard Coach → Page "Mes Élèves" | page.tsx |
| C2 | Dashboard Coach → Fiche élève détaillée | component |
| C3 | Dashboard Coach → Upload document | feature |
| C4 | Dashboard Assistante → Gestion Élèves | page.tsx |
| C5 | Dashboard Assistante → Gestion Coachs | page.tsx |
| C6 | Dashboard Assistante → Interface Association | component |
| C7 | Dashboard Assistante → Modification Parcours | feature |

**Validation** :
- Tests E2E Playwright
- Review UI/UX
- Responsive mobile

### Phase D — Documents Avancés (Semaine 4)

**Objectif** : Système documentaire complet

| Tâche | Détails | Livrable |
|-------|---------|----------|
| D1 | Créer modèle `StudentGroup` (si P1 validé) | PR |
| D2 | Créer modèle `DocumentVisibility` | PR |
| D3 | Migration et seeds | migration.sql |
| D4 | `POST /api/documents/assign` (groupe) | Route API |
| D5 | Dashboard Élève → Rubrique Documents enrichie | page.tsx |
| D6 | Filtres documents (type, matière, date) | component |

**Validation** :
- Upload/download fonctionnels
- Permissions respectées
- Tests E2E

### Phase E — Tests et Refinement (Semaine 5)

**Objectif** : Qualité et robustesse

| Tâche | Détails | Livrable |
|-------|---------|----------|
| E1 | Tests E2E complets workflows | test.spec.ts |
| E2 | Tests de charge API | k6/artillery |
| E3 | Audit sécurité permissions | rapport |
| E4 | Documentation utilisateur | docs/ |
| E5 | Formation équipe (si nécessaire) | session |

---

## 12. Fichiers à Modifier (Index)

### 12.1 Prisma Schema
- `prisma/schema.prisma` → Ajouter modèles et enums

### 12.2 API Routes (Nouvelles)
```
app/api/coach/students/route.ts
app/api/assistante/coaches/route.ts
app/api/assistante/students/route.ts
app/api/assistante/assignments/route.ts
app/api/assistante/assignments/[id]/route.ts
app/api/documents/assign/route.ts (si D4)
```

### 12.3 API Routes (Modifiées)
```
app/api/student/documents/route.ts → Ajouter visibilité
app/api/student/dashboard/route.ts → Enrichir données coach si applicable
```

### 12.4 Dashboards (Nouveaux)
```
app/dashboard/coach/students/page.tsx
app/dashboard/coach/students/[studentId]/page.tsx
app/dashboard/assistante/students/page.tsx
app/dashboard/assistante/coaches/page.tsx
app/dashboard/assistante/assignments/page.tsx
```

### 12.5 Dashboards (Modifiés)
```
app/dashboard/coach/page.tsx → Ajouter lien "Mes Élèves"
app/dashboard/coach/layout.tsx → Navigation mise à jour
app/dashboard/eleve/documents/page.tsx → Enrichir affichage
```

### 12.6 Lib (Modifiés)
```
lib/rbac.ts → Ajouter permissions
lib/rbac/coach-student-access.ts → Implémenter logique ownership
types/index.ts → Ajouter types TypeScript
```

---

## 13. Risques et Garde-Fous

### 13.1 Risques Techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Migration lourde échoue | Moyenne | Haut | Backup DB avant, test sur staging |
| Régression permissions | Moyenne | Haut | Tests E2E exhaustifs avant merge |
| Performance requêtes N+1 | Moyenne | Moyen | Index SQL, review requêtes Prisma |
| Conflits avec PR #24 | Faible | Moyen | Rebase régulier, communication |

### 13.2 Risques Métier

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Coachs perdent accès temporairement | Faible | Haut | Migration avec données seedées, rollback plan |
| Assistantes ne comprennent pas interface | Moyenne | Moyen | Documentation, tooltips, formation |
| Élèves voient documents non assignés | Faible | Critique | Tests permissions, audit avant déploiement |

### 13.3 Garde-Fous à Implémenter

```typescript
// Dans les guards API

// 1. Vérification ownership obligatoire
if (user.role === 'COACH') {
  const hasAssignment = await prisma.coachStudentAssignment.findFirst({
    where: {
      coachId: user.coachProfile.id,
      studentId: requestedStudentId,
      status: 'ACTIVE'
    }
  });
  if (!hasAssignment) {
    throw new ForbiddenException("Vous n'êtes pas assigné à cet élève");
  }
}

// 2. Audit trail sur modifications sensibles
await prisma.auditLog.create({
  data: {
    action: 'ASSIGN_COACH',
    userId: assistant.id,
    targetId: student.id,
    metadata: { coachId: coach.id, assignmentId: newAssignment.id },
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']
  }
});

// 3. Soft delete sur assignations (pas de hard delete)
// Utiliser status: 'ENDED' au lieu de delete()
```

---

## 14. Questions à Arbitrer

### 14.1 Questions Techniques

1. **Multi-coach par élève ?**
   - Option A : Un seul coach principal (simplifié)
   - Option B : Coach principal + coachs secondaires par matière (complexe mais réaliste)
   - **Recommandation** : Option B via `AssignmentType` et `subjects[]`

2. **Historique des assignations ?**
   - Option A : Soft delete (status ENDED)
   - Option B : Table d'historique séparée
   - **Recommandation** : Option A (suffisant)

3. **Groupes d'élèves ?**
   - Option A : Implémenter maintenant (StudentGroup)
   - Option B : Différer (utiliser assignations individuelles)
   - **Recommandation** : Option B pour Phase 1, Option A pour Phase D

### 14.2 Questions Métier

4. **Coach peut-il refuser un élève assigné ?**
   - Si oui : besoin workflow validation coach
   - **Hypothèse** : Non, l'assignation est faite par l'assistante

5. **Parent peut-il voir les documents coach ?**
   - **Recommandation** : Oui, par défaut (visibilité COACH = élève + coach)
   - Option : checkbox "Visible par le parent" lors du dépôt

6. **Documents expirables ?**
   - **Recommandation** : Oui, champ `expiresAt` optionnel
   - Usage : corrections d'examen à durée limitée, etc.

---

## 15. Conclusion

### 15.1 Synthèse

L'audit révèle une architecture de base solide mais **incomplète pour la gestion opérationnelle** :

- ✅ **Base technique solide** : Next.js, Prisma, RBAC, Dashboards existants
- ✅ **PR #24 réussi** : Filières EDS/STMG fonctionnelles
- 🔴 **Gap critique** : Association Coach-Élève manquante
- 🟡 **Gaps importants** : Gestion documents, Groupes, Dashboards Coach/Assistante

### 15.2 Recommandation Immédiate

**Lancer la Phase A dès que possible** : création du modèle `CoachStudentAssignment`.

Ce modèle est **fondamental** et bloquant pour toute la suite. Sans lui :
- Le coach n'a pas de "portefeuille élèves"
- L'assistante ne peut pas gérer les associations
- Les documents ne peuvent pas être assignés proprement
- Les permissions restent floues

### 15.3 Estimation Charge

| Phase | Durée Estimée | Complexité |
|-------|---------------|------------|
| A — Fondations | 3-4 jours | Moyenne |
| B — API Core | 4-5 jours | Moyenne |
| C — Dashboards | 5-7 jours | Haute |
| D — Documents | 4-5 jours | Moyenne |
| E — Tests | 3-4 jours | Moyenne |
| **Total** | **3-4 semaines** | **Élevée** |

**Ressources nécessaires** :
- 1 développeur backend (Phases A, B, E)
- 1 développeur frontend (Phases C, D)
- 1 QA/Tests (Phase E)

### 15.4 Prochaines Étapes

1. **Validation** de ce rapport par l'équipe métier
2. **Arbitrage** des questions section 14
3. **Création** des tickets/issues pour chaque tâche
4. **Planification** des sprints
5. **Démarrage** Phase A (modèle CoachStudentAssignment)

---

## Annexes

### A.1 Détail des Tables DB Actuelles (49 tables)

Tables identifiées :
- `users` (169 lignes)
- `students` (102 lignes)
- `coach_profiles` (13 lignes)
- `parent_profiles` (52 lignes)
- `user_documents` (13 lignes)
- `maths_progress` (lignes non comptées)
- `survival_progress` (lignes non comptées)
- `assessments`, `bilans`, `sessions`, `subscriptions`, etc.
- Tables Stages : `stages`, `stage_sessions`, `stage_coaches`, `stage_reservations`, `stage_bilans`, `stage_documents`

### A.2 Ressources Consultées

- `prisma/schema.prisma` (intégralité)
- `lib/rbac.ts` (permissions)
- `lib/rbac/coach-student-access.ts` (existe, non audité en profondeur)
- Structure `/app/dashboard/*` (inventaire)
- Routes `/app/api/student/*` (inventaire)
- Tables PostgreSQL (49 tables listées)

### A.3 Limites de l'Audit

- Pas de revue de code détaillée des composants React
- Pas de test manuel des interfaces
- Pas d'analyse des performances requêtes
- Pas de revue sécurité approfondie (seulement identification des gaps)
- Services EAF/Korrigo hors scope

---

**Fin du Rapport**

*Document généré le 2026-04-25 suite à audit en lecture seule de la production nexusreussite.academy*
