# ARIA Personal Learning OS — Matrice Canonique des Modèles de Données

> Document d'architecture versionné dans le dépôt (SSoT).
> Objectif : **ZERO_PARALLEL_DOMAIN_MODELS**.
> Réutilisation exhaustive des modèles existants (`Student`, `StudentAcademicEnrollment`, `CopySubmission`, `PedagogicalReport`, `EvidenceItem`, `RemediationRoadmap`).

---

## 1. Matrice des Concepts Métier & Décisions de Modélisation

| PRODUCT_CONCEPT | CURRENT_MODEL | DÉCISION | SSoT | WRITE_PATH | READ_PATH | MIGRATION | SECURITY_OWNER | RETENTION | EVIDENCE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Carte Scolaire & Inscriptions** | `Student` + `StudentAcademicEnrollment` | **EXTEND** | DB (`students`, `student_academic_enrollments`) | Onboarding scolaire, admin | `resolveStudentCourses()` (`lib/curriculum/enrollment.ts`) | Extension de l'enum `AcademicEnrollmentKind` avec `LANGUAGE_CHOICE` pour LVA/LVB | App / Admin | Durée de scolarité de l'élève | `verifiedBy`, `source` |
| **Profil ARIA & Préférences** | `AriaLearningProfile` | **EXTEND** | DB (`aria_learning_profiles`) | `PUT /api/aria/profile` | `GET /api/aria/profile`, `resolveAriaExecutionContext` | Ajout colonnes `goals`, `preferredStudyMode`, `difficultyPreference` | Élève authentifié | Durée du compte élève | `updatedAt` |
| **Parcours d'Apprentissage (Journey)** | Agrégation de services | **REUSE + SERVICE** | Projection dynamique SSoT | Événements d'apprentissage (chat, copies, exercices, devoirs) | `buildStudentLearningJourney()` | Aucune table dupliquée ; vue agrégée | Élève / Parent / Coach | Durée du compte élève | IDs des événements sources |
| **Objectifs Élève (Goals)** | *Nouveau sous-modèle ciblé* | **NEW_MODEL** | DB (`aria_learning_goals`) | Élève via cockpit ARIA | Cockpit élève, prompt envelope ARIA | Table dédiée liée à `studentId` et `courseKey` | Élève | Durée de l'année scolaire | `status`, `achievedAt` |
| **Plan de Travail (Work Items)** | `RoadmapTask` (`remediation_roadmaps`) | **REUSE / ALIGN** | DB (`roadmap_tasks`) | Moteur de remédiation, ARIA planner | Cockpit élève, cockpit parent | Projection unifiée des tâches | Coach / ARIA engine | Année scolaire | `isCompleted`, `completedAt` |
| **Ressources Existantes** | `STATIC_RESOURCES` (`lib/aria/resources.ts`) + `PedagogicalContent` | **UNIFY** | Code / Manifeste typé | Déploiement / pipeline RAG | `listResourcesForCourse()`, `resolveResourceFilePath()` | Migration progressive vers registre manifest | Système / Équipe Pédagogique | Permanent | Fichiers PDF sur disque, hashes SHA-256 |
| **Ressources Générées** | *Nouveau sous-modèle ciblé* | **NEW_MODEL** | DB (`aria_generated_resources`) | ARIA resource generator | Practice viewer, exercices cockpit | Table dédiée liée à `studentId`, `courseKey`, `skillId` | Élève / Système | Année scolaire | JSON structuré avec barème |
| **Entraînements & Pratique** | *Nouveau sous-modèle ciblé* | **NEW_MODEL** | DB (`aria_practice_attempts`) | Practice engine interactif | Cockpit progression, mastery engine | Table dédiée liée à la ressource générée | Élève | Année scolaire | Réponses élève, score, hints |
| **Dépôt Devoirs & Copies** | `CopySubmission` + `CopyPage` | **REUSE** | DB (`copy_submissions`, `copy_pages`) | `POST /api/submissions` | Cockpit élève, moteur de correction | Aucune duplication ; supporte upload, mimeType, SHA-256, OCR | Élève | 2 ans (cycle lycée) | Fichiers chiffrés, checksum |
| **Correction Pédagogique** | `PedagogicalReport` + `CompetenceMatrix` | **REUSE** | DB (`pedagogical_reports`) | ARIA correction engine | Rapport élève, cockpit parent | Réutilisation des matrices de compétences existantes | Système pédagogique | 2 ans (cycle lycée) | Rapport structuré, notation avec barème |
| **Preuves de Progression** | `EvidenceItem` + `SkillScore` | **REUSE** | DB (`canonical_evidence_items`, `skill_scores`) | Moteur de notation, validation d'exercices | Arbre de compétences, cockpit | SSoT existante des scores et compétences | Système d'évaluation | Durée du compte élève | `scoreSnapshot`, `evidenceType` |
| **Agents Spécialisés** | Registre en mémoire typé | **CODE_ARCHITECTURE** | Code (`lib/aria/agents/registry.ts`) | Déploiement | `resolveAriaAgent(courseKey, task)` | Pas de table DB superflue ; piloté par le Gateway | Système | Immuable | Registre de prompts et compétences |

---

## 2. Analyse de Couverture de la Carte Scolaire (GradeLevel × AcademicTrack)

### Problème Identifié : Représentation de LVA et LVB
Actuellement, `tc-lva-terminale` et `tc-lvb-terminale` désignent le cours du tronc commun.
Cependant, l'enum `AcademicEnrollmentKind` ne comprend aujourd'hui que :
- `SPECIALTY`
- `OPTION`

Pour représenter sans ambiguïté les choix obligatoires de langues :
- LVA : Anglais, Espagnol, Allemand, etc.
- LVB : Espagnol, Allemand, Italien, etc.

**Solution retenue (Lot ARIA-D)** :
Étendre `AcademicEnrollmentKind` avec la valeur sémantique `LANGUAGE_CHOICE` (ou `TRONC_COMMUN_CHOICE`).
Ainsi, un élève peut être inscrit avec :
- `courseKey: 'tc-lva-terminale'`, `kind: 'LANGUAGE_CHOICE'`, `metadata: { language: 'ANGLAIS' }`
- `courseKey: 'tc-lvb-terminale'`, `kind: 'LANGUAGE_CHOICE'`, `metadata: { language: 'ESPAGNOL' }`
Zéro détournement de l'enum `OPTION`.

### Matrice de Couverture Machine-Readable

| Profil | GradeLevel | AcademicTrack | Voie / Spécialités | Représentabilité Actuelle | Statut Lot ARIA-D |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Terminale Générale** | `TERMINALE` | `EDS_GENERALE` | 2 EDS parmi 3 de Première | ✅ 100% via `StudentAcademicEnrollment` | Validé |
| **Première Générale** | `PREMIERE` | `EDS_GENERALE` | 3 EDS au choix | ✅ 100% via `StudentAcademicEnrollment` | Validé |
| **Terminale STMG** | `TERMINALE` | `STMG` | SGN / Mercatique / GF / RHC | ✅ 100% via `Student.stmgPathway` | Validé |
| **Première STMG** | `PREMIERE` | `STMG` | Tronc technologique | ✅ 100% via `AcademicTrack.STMG` | Validé |
| **Seconde Tronc Commun** | `SECONDE` | `SECONDE` | Tronc commun obligatoire | ✅ 100% dérivé par `resolveStudentCourses` | Validé |
| **Troisième Collège** | `TROISIEME` | `COLLEGE` | Tronc commun Brevet | ✅ 100% dérivé par `resolveStudentCourses` | Validé |
| **Candidat Libre** | Variable | Variable | Inscriptions individuelles | ✅ 100% via `StudentAcademicEnrollment` | Validé |
| **LVA / LVB Choix** | `PREMIERE` / `TERMINALE` | Toutes | Anglais / Espagnol / Allemand | ⚠️ Requiert `LANGUAGE_CHOICE` dans schema Prisma | Prévu Lot ARIA-D |

---

## 3. Invariants Respectés

- `ZERO_PARALLEL_DOMAIN_MODELS = PASS`
- `FALSE_RESOURCE_PROVENANCE = 0`
- `ACADEMIC_MAP_UNREPRESENTABLE_DIMENSIONS = 1 (LVA/LVB explicite planifiée Lot D)`
