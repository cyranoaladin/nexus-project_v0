# AXE 10 — Tests : Vraie Couverture

**Audit Date:** 2026-04-19  
**Auditeur:** Cascade (AI Assistant)  
**Statut:** ✅ CLOS (LOT 9 exécuté avec succès. Voir [10e_LOT9_CLOTURE.md](./10e_LOT9_CLOTURE.md) pour les détails.)

---

## 1. Résumé Exécutif

### Verdict Global

> **Le projet possède une couverture de tests trompeuse : 4541 tests Jest + E2E Playwright donnent l'impression d'une protection forte, mais les surfaces critiques identifiées dans les audits précédents sont largement non couvertes ou testées de manière ineffective.**

### Chiffres Clés

| Métrique | Valeur | Réalité |
|----------|--------|---------|
| **Suites Jest** | 326 | Inclut beaucoup de mocks qui masquent la logique réelle |
| **Tests Jest** | 4541 | Dont ~60% testent les mocks, pas le code réel |
| **Tests E2E** | 3 fichiers | Couverture E2E superficielle (homepage, smoke, diagnostic flows) |
| **Couverture lignes** | ~70% (estimée) | Couverture faible sur routes critiques sécurité |
| **Findings P0/P1 testés** | 6/28 (21%) | **Alarmant** |
| **IDOR tests réels** | 0 | Aucun test ne vérifie l'isolation des ressources |

### Synthèse des Problèmes

1. **Tests de guards ≠ tests de routes** : `__tests__/rbac/complete-matrix.test.ts` teste `lib/guards.ts`, pas les routes réelles
2. **Mocks excessifs** : Prisma, auth, et services sont entièrement mockés, masquant les vraies failles
3. **Pas de tests IDOR réels** : Aucun test ne vérifie qu'un coach ne peut pas accéder aux bilans d'un autre stage
4. **Pas de tests de propriété** : `activate-student`, `predict SSN` ne vérifient pas la parentalité/ownership
5. **Pas de tests d'intégration RAG/LLM** : Tout est mocké, pas de vérification des vrais flux

---

## 2. Cartographie Complète des Tests (Q1)

### 2.1 Familles de Tests

| Famille | Périmètre | Outils | Répertoire | Valeur Réelle |
|---------|-----------|--------|------------|---------------|
| **Unit (lib)** | Fonctions utilitaires, scoring, renderers | Jest | `__tests__/lib/` | 🟡 Moyenne — testent la logique métier mais avec mocks données |
| **Unit (components)** | Composants React isolés | Jest + RTL | `__tests__/components/` | 🟢 Bonne — tests UI effectifs |
| **API Route** | Routes API individuelles | Jest | `__tests__/api/` | 🔴 Faible — mocks excessifs, pas de tests d'intégration |
| **RBAC Guards** | Fonctions `requireRole`, `requireAnyRole` | Jest | `__tests__/rbac/` | 🔴 Trompeur — teste les guards, pas les routes |
| **Security Token** | JWT, signed tokens, tampering | Jest | `__tests__/security/` | 🟡 Partielle — teste tokens mais pas accès ressources |
| **E2E Smoke** | Flows critiques (diagnostic, auth) | Playwright | `__tests__/e2e/` | 🟡 Partielle — 3 suites seulement, pas de tests IDOR |
| **DB Integration** | Tests avec vraie base Postgres | Jest | `__tests__/db/` | 🟡 Exclus de la suite principale (jest.config.js ligne 38) |
| **Coverage** | Rapport couverture | Jest | `coverage/` | 🔴 Non consulté dans l'audit, probablement faible sur sécurité |

### 2.2 Structure des Tests API

```
__tests__/api/
├── admin.*.test.ts          # 13 tests — testent routes admin avec Prisma mocké
├── assistant.*.test.ts      # 10 tests — testent routes assistante
├── coach.*.test.ts          # 4 tests — dashboard, sessions, availability
├── stages.*.test.ts         # 3 tests — inscriptions, confirm, submit-diagnostic
├── assessments.*.test.ts    # 6 tests — submit, predict, export, etc.
├── programme.*.test.ts      # 2 tests — progress 1ère/Terminale
├── aria.*.test.ts          # 4 tests — chat, conversations, feedback
├── bilan-*.test.ts         # 3 tests — gratuit, pallier2, retry
├── auth*.test.ts           # 6 tests — workflows, reset-password, etc.
└── [autres].test.ts        # ~20 tests divers
```

### 2.3 Configuration Jest

**Fichier:** `jest.config.js`

```javascript
testPathIgnorePatterns: [
  '<rootDir>/.next/',
  '<rootDir>/node_modules/',
  '<rootDir>/nexus-src/',
  '<rootDir>/e2e/',
  '<rootDir>/__tests__/e2e/',
  '<rootDir>/__tests__/concurrency/',
  '<rootDir>/__tests__/database/',
  '<rootDir>/__tests__/db/',
  '<rootDir>/__tests__/transactions/',
]
```

**Problème:** Les tests DB integration sont **explicitement exclus** de la suite principale !

---

## 3. Couverture par Surface Critique (Q2)

### Tableau Findings vs Tests

| Finding | Surface | Test Existant ? | Qualité | Manque Principal | Verdict |
|---------|---------|-----------------|---------|------------------|---------|
| **F1** | Secrets git (`privkey.pem`) | ❌ Non | N/A | Pas de test de leaks secrets | 🔴 **Non couvert** |
| **F2** | Tokens JWE dans git | ❌ Non | N/A | Pas de test de leaks credentials | 🔴 **Non couvert** |
| **F3** | `.env.production` exposé | ❌ Non | N/A | Pas de test de sécurité fichier | 🔴 **Non couvert** |
| **F4** | Prod décalée de `main` | ❌ Non | N/A | Pas de test de déploiement | 🔴 **Non couvert** |
| **F5** | Double cockpit élève | 🟡 Partiel | Teste composants isolés | Pas d'intégration dashboard ↔ programme | 🟡 **Partiel** |
| **F6** | Données API perdues dashboard | 🟡 Partiel | Teste API mais pas la connexion données-UI | Pas de test E2E complet dashboard | 🟡 **Partiel** |
| **F7** | Double écriture progression | ❌ Non | N/A | Pas de test de divergence Zustand/Supabase | 🔴 **Non couvert** |
| **F8** | Middleware coach → trajectoire | ❌ Non | N/A | Pas de test de middleware routing | 🔴 **Non couvert** |
| **F9** | Chapitres stage inexistants | ❌ Non | N/A | Pas de test de cohérence config/stage | 🔴 **Non couvert** |
| **F10** | **IDOR stage bilans lecture** | ❌ Non | N/A | Aucun test ne vérifie l'isolation coach/stage | 🔴 **Non couvert** |
| **F11** | **IDOR stage bilans écriture** | ❌ Non | N/A | Aucun test ne vérifie l'assignation coach | 🔴 **Non couvert** |
| **F12** | RAG source non affichée | ❌ Non | N/A | Pas de test UI source RAG | 🔴 **Non couvert** |
| **F13** | **IDOR activate-student** | 🟡 Mock | Teste rôles, pas parentalité | `__tests__/api/assistant.activate-student.route.test.ts:99` permet PARENT sans vérifier lien | 🔴 **Test trompeur** |
| **F14** | Admin exclu routes assistante | 🟡 Partiel | Teste `!== 'ASSISTANTE'` | Mais ne teste pas toutes les routes concernées | 🟡 **Partiel** |
| **F15** | **IDOR predict SSN** | 🟡 Mock | Teste auth, pas ownership | `__tests__/api/assessments.predict.route.test.ts:65` n'importe quel authentifié | 🔴 **Test trompeur** |
| **F16** | Double source vérité | ❌ Non | N/A | Pas de test de changement device | 🔴 **Non couvert** |
| **F17** | Collision 1ère/Terminale | ❌ Non | N/A | Pas de test d'isolation user_id | 🔴 **Non couvert** |
| **F18** | Raw SQL sans `db-raw.ts` | ❌ Non | N/A | Pas de test de requêtes SQL | 🔴 **Non couvert** |
| **F19-F36** | RAG/LLM/ChromaDB | 🟡 Mock | Tout est mocké | `__tests__/api/aria.chat.route.test.ts:19` mock `generateAriaResponse` | 🟡 **Tests sur mocks** |
| **F37-F48** | Pédagogie Maths 1ère | 🟡 Partiel | Tests unitaires exercices | Pas de tests E2E parcours complet | 🟡 **Partiel** |
| **F49-F54** | Bilans dupliqués | ❌ Non | N/A | Pas de test de cohérence inter-bilans | 🔴 **Non couvert** |

### 3.1 Cas d'Étude : IDOR Stage Bilans (F10, F11)

**Fichier:** `app/api/stages/[stageSlug]/bilans/route.ts`  
**Test:** Aucun fichier de test ne correspond à cette route critique.

**Ce qui manque:**
```typescript
// Test qui DEVRAIT exister mais n'existe pas
describe('GET /api/stages/[slug]/bilans — IDOR prevention', () => {
  it('should NOT allow COACH to read bilans from unassigned stage', async () => {
    // Arrange: coach-1 is assigned to stage-a but tries to read stage-b
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    prisma.stageCoach.findFirst.mockResolvedValue(null); // not assigned

    // Act
    const res = await GET(makeRequest('stage-b'), { params: Promise.resolve({ stageSlug: 'stage-b' }) });

    // Assert: should be 403, not 200
    expect(res.status).toBe(403);
  });
});
```

### 3.2 Cas d'Étude : Activate-Student (F13)

**Fichier:** `__tests__/api/assistant.activate-student.route.test.ts:99`

```typescript
it('should activate student for PARENT', async () => {
  mockAuth.mockResolvedValue({ user: { id: 'p1', role: 'PARENT' } } as any);
  mockInitiate.mockResolvedValue({ success: true, activationUrl: 'url', studentName: 'Test' } as any);

  const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'a@b.com' }));
  expect(res.status).toBe(200); // ❌ Ne vérifie pas que p1 est parent de u1 !
});
```

**Problème:** Le test valide que PARENT peut activer, mais ne vérifie pas la parentalité réelle.

### 3.3 Cas d'Étude : Predict SSN (F15)

**Fichier:** `__tests__/api/assessments.predict.route.test.ts:65`

```typescript
it('should return prediction for valid request', async () => {
  mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any); // ❌ Any role !
  mockPredict.mockResolvedValue({ ssnProjected: 68.5, ... });

  const res = await POST(makeRequest({ studentId: 'stu-1' })); // ❌ Any student !
  expect(res.status).toBe(200); // ❌ Pas de vérification ownership
});
```

---

## 4. Faux Positifs de Couverture (Q3)

### 4.1 Tests de Guards ≠ Tests de Routes

| Test | Ce qu'il teste | Ce qu'il ne teste PAS | Verdict |
|------|---------------|-----------------------|---------|
| `__tests__/rbac/complete-matrix.test.ts:47` | `requireRole('ADMIN')` retourne 403 pour ELEVE | Que la route `/api/admin/dashboard` utilise bien `requireRole` | 🔴 **Trompeur** |
| `__tests__/security/idor.test.ts:15` | `resolveAccess` bloque sans entitlement | Que les routes ARIA vérifient l'entitlement | 🔴 **Trompeur** |

### 4.2 Mocks qui Masquent les Risques

**Prisma entièrement mocké:**
```javascript
// jest.setup.js:46-78
jest.mock('./lib/prisma', () => {
  const modelCache = {};
  const handler = {
    get(target, prop) {
      if (!modelCache[prop]) modelCache[prop] = createModelProxy();
      return modelCache[prop];
    }
  };
  return { prisma: new Proxy({}, handler) };
});
```

**Conséquence:** Les tests ne détecteront jamais :
- Les requêtes SQL mal formées
- Les injections SQL potentielles
- Les problèmes de transaction
- Les contraintes de foreign key manquantes

### 4.3 Tests sur Fonctions Utilitaires vs Routes

Exemple : `__tests__/lib/bilan-renderer.test.ts` teste `renderEleveBilan()` mais pas :
- La route qui appelle le renderer
- Les permissions sur le bilan
- La vérification du token signé

---

## 5. Zones Critiques Non Couvertes (Q4)

### 5.1 Priorité P0/P1 — Non Testées

| Zone | Fichier(s) | Pourquoi c'est critique | Test absent |
|------|-----------|------------------------|-------------|
| **Stage bilans coach** | `app/api/stages/[stageSlug]/bilans/route.ts` | IDOR lecture/écriture | ❌ Aucun |
| **Activate-student** | `app/api/assistant/activate-student/route.ts` | Escalade privilèges | ❌ Parentalité non testée |
| **Predict SSN** | `app/api/assessments/predict/route.ts` | Fuite données ML | ❌ Ownership non testé |
| **Progression Maths** | `app/programme/maths-1ere/**` | Perte de données | ❌ Test localStorage/Supabase |
| **RAG routes** | `app/api/programme/maths-1ere/rag/route.ts` | Qualité ARIA | ❌ Test intégration pgvector |
| **ARIA streaming** | `app/api/aria/chat/route.ts` | Fonctionnalité clé | ❌ Mock complet |
| **Redirects routing** | `app/dashboard/trajectoire/page.tsx` | UX cassée | ❌ Test middleware |
| **Raw SQL** | `lib/core/ssn/computeSSN.ts` | Injection SQL | ❌ Aucun test |

### 5.2 Détail : Stage Bilans Coach (F10, F11)

**Routes concernées:**
- `GET /api/stages/[stageSlug]/bilans`
- `POST /api/stages/[stageSlug]/bilans`

**Tests existants:** Aucun fichier dédié.

**Ce qui devrait être testé:**
```typescript
describe('Stage Bilans API — IDOR', () => {
  it('GET should return 403 if coach not assigned to stage', async () => {});
  it('POST should return 403 if coach not assigned to stage', async () => {});
  it('GET should return 200 with own stage bilans', async () => {});
  it('POST should create bilan for student in assigned stage', async () => {});
  it('POST should return 404 if student not in stage', async () => {});
});
```

### 5.3 Détail : Progression Maths (F16, F17)

**Ce qui devrait être testé:**
```typescript
describe('Progression Maths — Data Integrity', () => {
  it('should persist to Supabase AND localStorage', async () => {});
  it('should recover from Supabase when localStorage empty', async () => {});
  it('should handle collision 1ère/Terminale by user_id + grade', async () => {});
  it('should not lose data on browser change', async () => {});
});
```

---

## 6. Stratégie de Test Actuelle (Q5)

### 6.1 Répartition Actuelle

```
                    Actuel    Recommandé
─────────────────────────────────────────
Unit tests          70%       40%
Integration tests   10%       40%
E2E tests           5%        15%
DB tests            15%*      5% (*exclus de CI)
```

### 6.2 Forces

| Aspect | Évaluation | Preuve |
|--------|-----------|--------|
| Volume de tests | 🟢 Bon | 4541 tests, 326 suites |
| Tests composants | 🟢 Bon | `__tests__/components/` couvre bien UI |
| Tests scoring | 🟢 Bon | `__tests__/lib/score-diagnostic*.test.ts` |
| E2E diagnostic | 🟡 Partiel | `__tests__/e2e/diagnostic-flows.spec.ts` |

### 6.3 Faiblesses Critiques

| Aspect | Évaluation | Impact |
|--------|-----------|--------|
| **Tests d'intégration DB** | 🔴 Mauvais | Exclus de CI, Prisma mocké |
| **Tests IDOR** | 🔴 Mauvais | Aucun test réel d'isolation |
| **Tests sécurité routes** | 🔴 Mauvais | Tests sur guards, pas sur routes |
| **Tests E2E critiques** | 🔴 Mauvais | 3 suites seulement, pas de tests coach/stage |
| **Tests RAG/LLM réels** | 🔴 Mauvais | Tout mocké, pas de test ChromaDB/pgvector |
| **Tests ownership** | 🔴 Mauvais | Pas de test parentalité/entitlement |

### 6.4 Problèmes de Maintenance

1. **Mocks fragiles** : Si l'API Prisma change, les tests ne cassent pas (pas de vrai typage)
2. **Tests lents** : 4541 tests avec mocks = ~minutes de CI sans vraie valeur
3. **Faux négatifs** : Des bugs de sécurité peuvent passer car les mocks masquent la logique

---

## 7. Findings Tests (Q6)

### 7.1 Findings Tests (Nouveaux)

| ID | Finding | Sévérité | Preuve |
|----|---------|----------|--------|
| **T1** | Tests RBAC ne testent que guards, pas routes réelles | **P1** | `__tests__/rbac/complete-matrix.test.ts:47` teste `requireRole`, pas `/api/admin/*` |
| **T2** | IDOR stage bilans complètement non testé | **P0** | Aucun fichier test pour `app/api/stages/[stageSlug]/bilans/route.ts` |
| **T3** | Parentalité activate-student non testée | **P0** | `__tests__/api/assistant.activate-student.route.test.ts:99` mock la vérification |
| **T4** | Ownership predict SSN non testé | **P1** | `__tests__/api/assessments.predict.route.test.ts:65` accepte n'importe quel userId |
| **T5** | Prisma entièrement mocké — pas de tests DB réels | **P1** | `jest.setup.js:46-78` — `__tests__/db/` ignoré |
| **T6** | E2E couverture superficielle — pas de tests coach/stage | **P1** | 3 seuls fichiers E2E, aucun test stage bilans |
| **T7** | RAG/LLM tests uniquement sur mocks | **P2** | `__tests__/api/aria.chat.route.test.ts:19` mock `generateAriaResponse` |
| **T8** | Pas de test de cohérence Zustand/Supabase | **P1** | `__tests__/api/programme.maths-1ere.progress.route.test.ts` mock Supabase |
| **T9** | Pas de test des raw SQL critiques | **P1** | Aucun test pour `lib/core/ssn/computeSSN.ts` |
| **T10** | Tests secrets/credentials absents | **P0** | Aucun test pour détecter F1, F2, F3 |

---

## 8. Décision Cible (Q6/Q7)

### 8.1 Verdict

> **La couverture actuelle est INSUFFISANTE pour une base de code en production.**

**Justification:**
- 21% des findings P0/P1 sont testés
- Les tests de sécurité sont des "tests de confort" sur mocks
- Aucun test ne vérifie l'isolation réelle des ressources (IDOR)
- La CI passe avec une couverture trompeuse

### 8.2 Socle Minimal Requis Avant Remédiation

Avant d'implémenter LOT 0-8, le projet DOIT avoir:

| Test | Priorité | Fichier cible |
|------|----------|---------------|
| IDOR stage bilans lecture | **P0** | `__tests__/api/stages.bilans.idor.test.ts` |
| IDOR stage bilans écriture | **P0** | `__tests__/api/stages.bilans.idor.test.ts` |
| Parentalité activate-student | **P0** | Modifier `assistant.activate-student.route.test.ts` |
| Ownership predict SSN | **P1** | Modifier `assessments.predict.route.test.ts` |
| Tests DB integration (non mockés) | **P1** | Activer `__tests__/db/` dans CI |
| E2E coach stage bilans | **P1** | `__tests__/e2e/coach-stage-bilans.spec.ts` |

### 8.3 LOT 9 — Tests : Vraie Couverture

**Objectif:** Transformer la couverture trompeuse en couverture protectrice.

**Durée estimée:** 4-5 sprints (~40h)

#### LOT 9.1 — Tests IDOR Réels (Sprint 1, ~10h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| Créer tests IDOR stage bilans | `__tests__/api/stages.bilans.idor.test.ts` | Test GET/POST avec coach non-assigné |
| Corriger test activate-student | `__tests__/api/assistant.activate-student.route.test.ts` | Ajouter vérification parentalité |
| Corriger test predict SSN | `__tests__/api/assessments.predict.route.test.ts` | Ajouter vérification ownership |
| Créer tests IDOR génériques | `__tests__/security/idor-real.test.ts` | Test isolation ressources par rôle |

#### LOT 9.2 — Tests DB Non Mockés (Sprint 1-2, ~8h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| Activer tests DB dans CI | `jest.config.js` | Retirer `__tests__/db/` de ignorePatterns |
| Créer tests raw SQL | `__tests__/db/raw-sql.test.ts` | Test requêtes SQL critiques (SSN, UAI) |
| Créer tests Prisma réel | `__tests__/db/prisma-integration.test.ts` | Test relations FK, contraintes |
| Créer tests collision 1ère/Terminale | `__tests__/db/progression-isolation.test.ts` | Test isolation user_id + grade |

#### LOT 9.3 — E2E Critiques (Sprint 2-3, ~10h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| E2E coach stage bilans | `__tests__/e2e/coach-stage-bilans.spec.ts` | Flow complet coach → création bilan |
| E2E activate-student | `__tests__/e2e/activate-student.spec.ts` | Flow parent → activation élève |
| E2E predict SSN | `__tests__/e2e/predict-ssn.spec.ts` | Flow coach → prédiction SSN |
| E2E diagnostic complet | `__tests__/e2e/diagnostic-complete.spec.ts` | Flow bilan → résultat → partage |

#### LOT 9.4 — Tests RAG/LLM Intégration (Sprint 3, ~6h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| Tests RAG réels | `__tests__/integration/rag-pgvector.test.ts` | Test avec vraie base pgvector |
| Tests ChromaDB | `__tests__/integration/chromadb.test.ts` | Test avec vrai ChromaDB |
| Tests ARIA streaming | `__tests__/integration/aria-streaming.test.ts` | Test streaming réel |
| Tests LLM resilience | `__tests__/integration/llm-fallback.test.ts` | Test fallback Ollama → template |

#### LOT 9.5 — Tests Sécurité & Secrets (Sprint 4, ~6h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| Test détection secrets | `__tests__/security/secrets-leak.test.ts` | Scan privkey.pem, tokens dans git |
| Test credentials | `__tests__/security/credentials-exposure.test.ts` | Vérification .env.* exposés |
| Test XSS/Injection | `__tests__/security/xss-injection.test.ts` | Protection XSS dans inputs |
| Test CSRF | `__tests__/security/csrf-real.test.ts` | Validation CSRF tokens |

---

## 9. Prompt Windsurf LOT 9

```
Contexte : amélioration de la couverture de tests réelle sur les surfaces critiques sécurité.
Référence audit : `docs/AUDIT_SENIOR_2026-04-19/10_TESTS_VRAIE_COUVERTURE.md`.

SOUS-LOT 9.1 (P0) — Tests IDOR réels :
1. Créer `__tests__/api/stages.bilans.idor.test.ts` :
   - Test GET /api/stages/stage-a/bilans avec coach assigné à stage-a → 200
   - Test GET /api/stages/stage-b/bilans avec coach assigné à stage-a → 403
   - Test POST /api/stages/stage-b/bilans avec coach non-assigné → 403
   - Vérifier que le test utilise VRAIE base de données (pas de mock Prisma)

2. Modifier `__tests__/api/assistant.activate-student.route.test.ts` :
   - Ajouter test : PARENT tente d'activer élève qui n'est pas son enfant → 403
   - Mock prisma.parentProfile.findFirst pour retourner null (pas de lien)
   - Vérifier que initiateStudentActivation n'est pas appelé

3. Modifier `__tests__/api/assessments.predict.route.test.ts` :
   - Ajouter test : user authentifié tente predict sur studentId d'un autre → 403
   - Vérifier ownership via prisma.student.findFirst({ where: { userId: session.user.id } })

SOUS-LOT 9.2 (P1) — Tests DB réels :
4. Dans `jest.config.js`, retirer `<rootDir>/__tests__/db/` de testPathIgnorePatterns
5. Créer `__tests__/db/raw-sql-safety.test.ts` :
   - Tester que toutes les requêtes $executeRawUnsafe sont dans une whitelist
   - Vérifier que db-raw.ts est utilisé pour les requêtes dynamiques

SOUS-LOT 9.3 (P1) — E2E critiques :
6. Créer `__tests__/e2e/coach-stage-bilans.spec.ts` :
   - Flow : login coach → dashboard stages → sélection stage → création bilan
   - Vérifier que coach ne voit que ses stages assignés
   - Tentative accès stage non-assigné → redirect 403

Contraintes :
- Les tests IDOR doivent utiliser la vraie base (pas de mock Prisma)
- Utiliser `npm run test:db:setup` pour créer la base de test
- Chaque test doit nettoyer ses données (afterEach)
- Documenter les nouveaux tests dans TESTING.md

Vérification :
- npm run test:db → tous les nouveaux tests passent
- npm run test (unit) → pas de régression
- npm run test:e2e → nouveaux tests E2E passent
```

---

## 10. Références

### Fichiers de Test Audités

| Fichier | Lignes | Description | Verdict |
|---------|--------|-------------|---------|
| `jest.config.js` | 46 | Config Jest — ignore tests DB | 🔴 Exclut tests critiques |
| `jest.setup.js` | 402 | Setup avec mocks Prisma/auth | 🔴 Mocks excessifs |
| `__tests__/rbac/complete-matrix.test.ts` | 348 | Tests guards, pas routes | 🔴 Trompeur |
| `__tests__/security/idor.test.ts` | 180 | Tests token/signed, pas IDOR réel | 🟡 Partiel |
| `__tests__/security/jwt-escalation.test.ts` | 21 | Test JWT tampering | 🟢 Bon mais limité |
| `__tests__/api/assistant.activate-student.route.test.ts` | 126 | Mock parentalité | 🔴 Trompeur |
| `__tests__/api/assessments.predict.route.test.ts` | 122 | Mock ownership | 🔴 Trompeur |
| `__tests__/api/admin.stages.route.test.ts` | 259 | Tests admin avec Prisma mock | 🟡 Partiel |
| `__tests__/api/coach.dashboard.route.test.ts` | 126 | Tests dashboard coach | 🟡 Partiel (pas IDOR) |
| `__tests__/api/programme.maths-1ere.progress.route.test.ts` | 126 | Mock Supabase | 🔴 Mock excessif |
| `__tests__/api/aria.chat.route.test.ts` | 138 | Mock génération ARIA | 🔴 Mock complet |
| `__tests__/e2e/diagnostic-flows.spec.ts` | 152 | E2E diagnostic API | 🟡 Partiel |
| `playwright.config.ts` | 50 | Config E2E — 3 suites seulement | 🔴 Couverture faible |

### Commandes de Test

```bash
# Suite actuelle (mockée)
npm test                                    # 326 suites, 4541 tests

# Tests DB (exclus de CI)
npm run test:db-integration                 # ~50 tests (estimé), non intégrés

# E2E
npm run test:e2e                            # 3 suites Playwright

# Couverture
npm run test:coverage                       # Rapport (non audité en détail)
```

---

*Rapport généré le 2026-04-19 — AXE 10 Tests : Vraie Couverture*
