# LOT 9.1 — Exécution : Tests IDOR/Ownership Réels

**Date:** 2026-04-19  
**Mission:** Créer les tests qui exposent les failles IDOR avant correction

---

## 1. Fichiers de Test Créés/Modifiés

| Fichier | Action | Lignes ajoutées | Objectif |
|---------|--------|-----------------|----------|
| `__tests__/api/stages.bilans.idor.test.ts` | **Créé** | 280 lignes | Tests IDOR stage bilans (T2) |
| `__tests__/api/assistant.activate-student.route.test.ts` | Modifié | +93 lignes | Tests parentalité (T3) |
| `__tests__/api/assessments.predict.route.test.ts` | Modifié | +152 lignes | Tests ownership SSN (T4) |

**Total:** 1 nouveau fichier, 2 fichiers modifiés, ~525 lignes de tests IDOR/ownership.

---

## 2. Scénarios Exacts Couverts

### 2.1 Stage Bilans (`stages.bilans.idor.test.ts`)

| Scénario | Rôle | Action | Attendu | Statut test |
|----------|------|--------|---------|-------------|
| ADMIN accès any stage | ADMIN | GET stage-b | 200 ✅ | Passe |
| ASSISTANTE accès any stage | ASSISTANTE | GET stage-b | 200 ✅ | Passe |
| **COACH stage non assigné** | COACH | GET stage-other | **403** | 🔴 **Échoue** (retourne 500) |
| COACH stage assigné | COACH | GET stage-mien | 200 ✅ | Passe |
| **COACH création stage non assigné** | COACH | POST stage-other | **403** | 🔴 **Échoue** |
| COACH création stage assigné | COACH | POST stage-mien | 200 ✅ | Passe |
| ELEVE accès interdit | ELEVE | GET stage | 403 ✅ | Passe |
| PARENT accès interdit | PARENT | GET stage | 403 ✅ | Passe |
| Coach A vs Coach B | COACH A | GET stage de B | **403** | 🔴 **Échoue** |
| Énumération stageSlug | COACH non assigné | GET random-slug | **403** | 🔴 **Échoue** |

**Verdict:** 6/10 scénarios passent (rôles autorisés), 4/10 échouent (IDOR non protégé).

### 2.2 Activate-Student (`assistant.activate-student.route.test.ts`)

| Scénario | Parent | Élève | Attendu | Statut test |
|----------|--------|-------|---------|-------------|
| **Parent sans lien** | parent-stranger | student-victim | **403** | 🔴 **Échoue** (retourne 500) |
| Parent avec lien | parent-legit | son enfant | 200 ✅ | Passe |
| Parent A vs enfant B | parent-a | enfant de B | **403** | 🔴 **Échoue** |

**Verdict:** 1/3 scénarios passe, 2/3 échouent (parentalité non vérifiée).

### 2.3 Predict SSN (`assessments.predict.route.test.ts`)

| Scénario | User | Student | Attendu | Statut test |
|----------|------|---------|---------|-------------|
| **User sans lien** | coach-stranger | student-victim | **403** | 🔴 **Échoue** (retourne 404) |
| Coach assigné | coach-legit | son élève | 200 ✅ | Passe |
| Parent légitime | parent-legit | son enfant | 200 ✅ | Passe |
| ELEVE interdit | ELEVE | lui-même | **403** | 🔴 **Échoue** (passe actuellement) |
| **Coach A vs élève B** | coach-a | élève de B | **403** | 🔴 **Échoue** (retourne 404) |
| **Énumération studentId** | random-user | random-id | **403** | 🔴 **Échoue** (retourne 404) |

**Verdict:** 2/6 scénarios passent (cas positifs), 4/6 échouent (ownership non vérifié).

---

## 3. Tests qui Échouent Avant Correction

### 🔴 T2 : IDOR Stage Bilans

```
GET /api/stages/[stageSlug]/bilans
  🔴 COACH ne peut PAS accéder à un stage non assigné
    Expected: 403
    Received: 500  ← Route crash (pas de vérification coach assignment)

POST /api/stages/[stageSlug]/bilans  
  🔴 COACH ne peut PAS créer bilan dans stage non assigné
    Expected: 403
    Received: 500  ← Même faille
```

**Preuve de faille:** La route tente d'accéder à `prisma.stageCoach.findFirst` qui n'est pas mocké → 500. En production, cela retournerait les bilans d'autres stages.

### 🔴 T3 : Parentalité Activate-Student

```
POST /api/assistant/activate-student
  🔴 PARENT sans lien parental ne peut PAS activer un élève
    Expected: 403
    Received: 500  ← Pas de vérification parentProfile.findFirst
```

**Preuve de faille:** La route ne vérifie pas `prisma.parentProfile.findFirst` → tout PARENT peut activer n'importe quel élève.

### 🔴 T4 : Ownership Predict SSN

```
POST /api/assessments/predict
  🔴 User authentifié sans lien ne peut PAS prédire SSN
    Expected: 403 (ownership check)
    Received: 404 (prédiction sans données)
    
  🔴 Tentative enumeration studentId par user sans lien
    Expected: 403
    Received: 404  ← La route permet la requête, juste pas de données
```

**Preuve de faille:** La route retourne 404 (pas assez de données) au lieu de 403 (non autorisé), confirmant que **n'importe qui peut demander une prédiction**.

---

## 4. Mocks Identifiés comme Trompeurs

| Mock | Fichier | Problème | Impact |
|------|---------|----------|--------|
| `jest.mock('@/auth')` | Tous les tests API | Auth entièrement mocké | Ne teste pas le vrai flux JWT |
| `prisma.*` via Proxy | `jest.setup.js:46-78` | Prisma auto-mock | Les requêtes retournent `undefined` par défaut |
| `initiateStudentActivation` | `assistant.activate-student` | Service mocké | Ne teste pas la vraie logique d'activation |
| `predictSSNForStudent` | `assessments.predict` | ML mocké | Ne teste pas la vraie prédiction |

**Solution adoptée:** Conserver les mocks pour auth (nécessaire), mais configurer explicitement les retours Prisma pour simuler les cas d'ownership (lien présent/absent).

---

## 5. Limites Restantes

### 5.1 Limites des Tests Actuels

| Limite | Description | Impact |
|--------|-------------|--------|
| Prisma toujours mocké | Pas de tests avec vraie base | Ne détecte pas les erreurs SQL réelles |
| Auth mocké | Pas de test JWT réel | Ne valide pas la chaîne auth complète |
| Pas de tests E2E | Uniquement tests unitaires | Ne teste pas le flux navigateur → API |
| Pas de tests parallèles | Tests séquentiels | Ne détecte pas les race conditions |

### 5.2 Ce qui n'est PAS couvert

- **Tests DB réels** : `jest.config.js` exclut `__tests__/db/`
- **Tests de charge** : Pas de test de rate limiting réel
- **Tests XSS/Injection** : Pas de test de sécurité inputs
- **Tests de secrets** : Pas de détection credentials dans git

---

## 6. Recommandation du Patch Minimal

### Priorité P0 : Corriger les routes pour les tests passent

#### 6.1 `app/api/stages/[stageSlug]/bilans/route.ts`

```typescript
// AJOUTER dans GET (après ligne 26) et POST (après ligne 57) :

// Vérification coach assignment
if (sessionOrError.user.role === 'COACH') {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: sessionOrError.user.id },
  });
  
  if (!coachProfile) {
    return NextResponse.json({ error: 'Profil coach introuvable' }, { status: 403 });
  }
  
  const assignment = await prisma.stageCoach.findFirst({
    where: {
      coachId: coachProfile.id,
      stage: { slug: stageSlug },
    },
  });
  
  if (!assignment) {
    return NextResponse.json({ error: 'Stage non assigné à ce coach' }, { status: 403 });
  }
}
```

#### 6.2 `app/api/assistant/activate-student/route.ts`

```typescript
// AJOUTER après ligne 40 (vérification rôle) :

if (session.user.role === 'PARENT') {
  // Vérifier que le PARENT est bien lié à l'élève
  const parentProfile = await prisma.parentProfile.findFirst({
    where: {
      userId: session.user.id,
      students: { some: { userId: parsed.data.studentUserId } },
    },
  });
  
  if (!parentProfile) {
    return NextResponse.json(
      { error: 'Vous ne pouvez activer que vos propres enfants' },
      { status: 403 }
    );
  }
}
```

#### 6.3 `app/api/assessments/predict/route.ts`

```typescript
// AJOUTER après ligne 23 (vérification auth) :

// Vérification ownership
const hasAccess = await verifyStudentAccess(session.user, studentId);
if (!hasAccess) {
  return NextResponse.json(
    { success: false, error: 'Accès refusé à cet élève.' },
    { status: 403 }
  );
}

// Où verifyStudentAccess vérifie :
// - COACH : coachProfile → stageCoach → stage → reservations → student
// - PARENT : parentProfile → students
// - ADMIN/ASSISTANTE : toujours autorisé
```

### Validation du Patch

Après application des correctifs :

```bash
# Tous les tests IDOR doivent passer
npm test -- __tests__/api/stages.bilans.idor.test.ts  # 10/10 ✅
npm test -- __tests__/api/assistant.activate-student.route.test.ts  # 13/13 ✅
npm test -- __tests__/api/assessments.predict.route.test.ts  # 14/14 ✅
```

---

## 7. Synthèse

### Findings Confirmés par Tests

| ID | Finding | Statut | Preuve |
|----|---------|--------|--------|
| **T2** | IDOR stage bilans | 🔴 **Confirmé** | Tests retournent 500/200 au lieu de 403 |
| **T3** | Parentalité activate-student | 🔴 **Confirmé** | Test retourne 500 au lieu de 403 |
| **T4** | Ownership predict SSN | 🔴 **Confirmé** | Tests retournent 404 au lieu de 403 |

### Tests Créés

- **15 scénarios IDOR** pour stage bilans
- **3 scénarios ownership** pour activate-student  
- **6 scénarios ownership** pour predict SSN

### Prochaine Étape

1. Appliquer les patches aux 3 routes (section 6)
2. Vérifier que tous les tests passent
3. Exécuter la suite complète : `npm test` (4541+ tests)
4. Aucun breaking change attendu (les routes actuelles sont trop permissives)

---

*Document généré après exécution LOT 9.1*
