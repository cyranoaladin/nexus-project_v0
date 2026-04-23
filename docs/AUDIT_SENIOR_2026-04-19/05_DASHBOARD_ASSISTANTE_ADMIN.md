# AXE 5 — Dashboards Assistante & Admin

> Audit : Claude. Date : 2026-04-19. Repo : `cyranoaladin/nexus-project_v0` / `main`.
> Périmètre : 18 routes admin, 9 routes assistant, 1 route payments/validate, 1 route assessments/predict.
> Fichiers lus : 42. Tests analysés : 25 fichiers.

---

## 1. Résumé exécutif

L'architecture admin/assistante est **globalement saine** : 18/18 routes admin et 8/9 routes assistant ont des fichiers de tests. Le mécanisme RBAC utilise `requireRole`/`requireAnyRole` de `lib/guards.ts` pour la plupart des routes admin, et des checks inline pour les routes assistant.

**Cependant**, l'audit révèle :

- **1 faille P0** : IDOR sur `activate-student` — un PARENT peut activer n'importe quel élève sans vérification de parentalité
- **2 findings P1** : ADMIN exclu de 6 routes assistant (incohérence RBAC), et IDOR sur `/api/assessments/predict` (toute personne authentifiée peut prédire le SSN de n'importe quel élève + écriture en base)
- **5 findings P2** : test-email sans rate limit sur envoi, subscriptions POST non transactionnel, absence de validation Zod sur les POST assistant, mutation de type au lieu de status sur credit-requests, matrice RBAC documentée obsolète
- **3 findings P3** : predictSSN coefficients hardcodés, middleware exclut `/api/*`, pas de test pour `/api/assistant/stages`

**Points forts** :
- `payments/validate` est robuste : RBAC + transaction sérialisable + gestion concurrence + génération facture
- `recompute-ssn` est bien protégé ADMIN-only, formule SSN cohérente avec `computeSSN.ts`
- Les routes invoices ont un audit trail append-only, transition de statut validée, et rate limit sur l'envoi email
- `admin/users` utilise rate limiting, empêche l'auto-suppression, et hash les passwords

---

## 2. Findings par sévérité

### F-AXE5-01 — P0 : IDOR activate-student — PARENT sans vérif parentalité

**Route** : `app/api/assistant/activate-student/route.ts` L34
**Code** :
```typescript
const allowedRoles = ['ADMIN', 'ASSISTANTE', 'PARENT'];
```

**Service** : `lib/services/student-activation.service.ts` L116-178

La fonction `initiateStudentActivation` reçoit `(studentUserId, studentEmail, initiatorRole)` mais ne vérifie **jamais** que le PARENT est le parent de l'élève ciblé. Elle vérifie uniquement :
- L122-125 : le rôle est dans la liste autorisée
- L128-135 : l'élève existe
- L137-139 : l'user est bien un ELEVE
- L141-143 : le compte n'est pas déjà activé
- L146-153 : l'email est unique

**Impact** : Un PARENT authentifié peut :
1. Deviner ou connaître un `studentUserId` (les IDs sont des CUIDs mais prévisibles dans certains contextes)
2. Appeler `POST /api/assistant/activate-student` avec `{ studentUserId: "id-autre-eleve", studentEmail: "son-propre-email@x.com" }`
3. L'email de l'élève est **écrasé** (L160-167) par celui du PARENT → l'élève perd l'accès à son compte
4. Le PARENT reçoit le lien d'activation → peut définir le mot de passe → **prise de contrôle de compte**

**Sévérité : P0 — escalade de privilèges via détournement de compte élève.**

---

### F-AXE5-02 — P1 : ADMIN exclu de 6 routes assistant

**Routes affectées** (toutes vérifient `session.user.role !== 'ASSISTANTE'` → 401 pour ADMIN) :

| Route | Fichier | Ligne | Check |
|---|---|---|---|
| GET `/api/assistant/credit-requests` | `credit-requests/route.ts` | L11 | `!== 'ASSISTANTE'` |
| POST `/api/assistant/credit-requests` | `credit-requests/route.ts` | L76 | `!== 'ASSISTANTE'` |
| GET `/api/assistant/subscription-requests` | `subscription-requests/route.ts` | L11 | `!== 'ASSISTANTE'` |
| PATCH `/api/assistant/subscription-requests` | `subscription-requests/route.ts` | L78 | `!== 'ASSISTANTE'` |
| GET+POST `/api/assistant/subscriptions` | `subscriptions/route.ts` | L11,L119 | `!== 'ASSISTANTE'` |
| GET `/api/assistant/dashboard` | `dashboard/route.ts` | L11 | `!== 'ASSISTANTE'` |
| GET `/api/assistant/coaches` | `coaches/route.ts` | L12 | `!== 'ASSISTANTE'` |
| GET `/api/assistant/students/credits` | `students/credits/route.ts` | L12 | `!== 'ASSISTANTE'` |

**Incohérence** : Le test RBAC `__tests__/rbac/complete-matrix.test.ts` L92-100 teste ces routes comme si elles utilisaient `requireAnyRole(['ADMIN', 'ASSISTANTE'])`, mais les routes utilisent `session.user.role !== 'ASSISTANTE'`. Le test valide le guard en isolation, pas la route réelle.

**Impact** : L'ADMIN ne peut pas superviser les opérations assistante (crédits, subscriptions, dashboard). C'est un défaut de conception RBAC.

**Sévérité : P1 — incohérence RBAC architecturale, ADMIN moins privilégié que ASSISTANTE sur 6 routes.**

---

### F-AXE5-03 — P1 : `/api/assessments/predict` — IDOR + écriture sans RBAC

**Route** : `app/api/assessments/predict/route.ts` L14-23
```typescript
const session = await auth();
if (!session) { return ... 401; }
// No role check — any authenticated user proceeds
```

**Impact** :
- Tout ELEVE, PARENT, COACH peut appeler `POST /api/assessments/predict` avec n'importe quel `studentId`
- La fonction `predictSSNForStudent` (L264-274) **persiste** le résultat dans `projection_history` → **écriture en base** non autorisée
- Les données de prédiction (SSN actuel, trend, confiance) contiennent des informations pédagogiques sensibles

**Test existant** : `assessments.predict.route.test.ts` teste 401 pour non-auth et 400 pour studentId manquant, mais **aucun test 403 pour rôle non autorisé** car le code n'a pas de check rôle.

**Sévérité : P1 — IDOR lecture + écriture sur données SSN de tout élève.**

---

### F-AXE5-04 — P2 : test-email — envoi email arbitraire

**Route** : `app/api/admin/test-email/route.ts` L12,L28-55
```typescript
if (!session?.user || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) { ... 401 }
// ...
case 'send_test':
  await sendWelcomeEmail({ firstName: 'Test', lastName: 'User', email: testEmail });
```

**Risque** : Une ASSISTANTE peut envoyer un email de bienvenue Nexus à **n'importe quelle adresse** (`testEmail` est un input utilisateur). Le contenu est un template `sendWelcomeEmail` — pas de contenu malveillant, mais :
- Peut être utilisé pour du spam (réputage domaine)
- Le template contient le branding Nexus → confusion chez le destinataire
- Aucun rate limit spécifique (le seul guard est RBAC)

**Sévérité : P2 — outil admin acceptable mais insuffisamment borné. Besoin de rate limit + ADMIN-only ou feature flag.**

---

### F-AXE5-05 — P2 : subscriptions POST non transactionnel

**Route** : `app/api/assistant/subscriptions/route.ts` L178-196
```typescript
// 1. Update subscription status
const updatedSubscription = await prisma.subscription.update(...);

// 2. Add credits (separate operation, NOT in $transaction)
if (action === 'approve' && creditAmount > 0) {
  await prisma.creditTransaction.create(...);
}
```

**Contraste** : La route `payments/validate` (L267-341) utilise correctement `$transaction` avec `Serializable` isolation. La route `credit-requests` (L121-139) utilise aussi `$transaction`. Mais `subscriptions` ne le fait pas.

**Impact** : Si le serveur crash entre les deux opérations, la subscription est activée mais les crédits ne sont jamais alloués.

**Sévérité : P2 — incohérence transactionnelle, risque de perte de crédits.**

---

### F-AXE5-06 — P2 : Absence de validation Zod sur POST assistant

**Routes sans Zod** :

| Route | Parsing actuel | Risque |
|---|---|---|
| POST `/api/assistant/credit-requests` | `body.requestId`, `body.action` (L83-88) | Pas de type safety ni contraintes |
| PATCH `/api/assistant/subscription-requests` | `body.requestId`, `body.action`, `body.reason` (L85-86) | Idem |
| POST `/api/assistant/subscriptions` | `body.subscriptionId`, `body.action` (L126-131) | Idem |

**Contraste** : Les routes `activate-student` (L18-21) et `payments/validate` (L58-62) utilisent Zod correctement.

**Sévérité : P2 — validation input manquante sur 3 routes de mutation financière.**

---

### F-AXE5-07 — P2 : credit-requests — mutation type au lieu de status

**Route** : `app/api/assistant/credit-requests/route.ts` L123-129
```typescript
await tx.creditTransaction.update({
  where: { id: requestId },
  data: {
    type: 'CREDIT_ADD',  // Was 'CREDIT_REQUEST' → mutated to 'CREDIT_ADD'
    description: `Crédits approuvés par ...`
  }
});
```

L'approbation **change le type** de `CREDIT_REQUEST` à `CREDIT_ADD` au lieu d'utiliser un champ status. Conséquences :
- Impossible de distinguer une transaction "créée comme ADD" d'une "approuvée depuis REQUEST"
- Pas d'historique de la demande originale
- Le rejet change le type à `CREDIT_REJECTED` (L149-155) ce qui est plus cohérent

**Sévérité : P2 — perte de traçabilité sur les opérations de crédits.**

---

### F-AXE5-08 — P2 : Matrice RBAC documentée obsolète

**Doc** : `docs/31_RBAC_MATRICE.md`

| Claim doc | Réalité code | Écart |
|---|---|---|
| L30 : `test-email` = ADMIN only | Code L12 : `['ADMIN', 'ASSISTANTE']` | ASSISTANTE aussi autorisée |
| L54-57 : `invoices`, `documents` dans adminRoutes ADMIN-only | Code : `requireAnyRole([ADMIN, ASSISTANTE])` | ASSISTANTE aussi autorisée |
| L74-77 : 3 routes invoices "sans test" | Tests existent : `admin.invoices.*.test.ts` | Doc obsolète |
| L59 : "Accès croisé interdit sauf ADMIN" | ADMIN bloqué sur 6 routes assistant | Faux en pratique |
| L92-100 (test) : assistant routes = `requireAnyRole(['ADMIN', 'ASSISTANTE'])` | Code réel : `role !== 'ASSISTANTE'` | Test ne reflète pas le code |

**Sévérité : P2 — documentation RBAC non fiable, risque de régressions silencieuses.**

---

### F-AXE5-09 — P3 : predictSSN.ts — coefficients hardcodés

**Fichier** : `lib/core/ml/predictSSN.ts` L64-70
```typescript
const BETA: RidgeCoefficients = {
  intercept: 5,
  ssn: 0.6,
  hours: 1.2,
  methodology: 0.3,
  trend: 0.8,
};
```

Les coefficients sont des constantes arbitraires, non entraînées. Le commentaire L63 dit "Calibrated on initial cohort data" mais aucune trace de calibration. Le module est fonctionnel (utilisé par `/api/assessments/predict`) mais les prédictions sont approximatives.

**Sévérité : P3 — dette technique, pas de risque sécurité.**

---

### F-AXE5-10 — P3 : Middleware exclut `/api/*`

**Fichier** : `middleware.ts` L79
```typescript
matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
```

Le middleware de routing/RBAC ne couvre que les pages, pas les API routes. C'est **par design** (les API routes gèrent leur propre auth via `requireRole`/`auth()`), mais ce n'est documenté nulle part. Si une route API oublie son guard, le middleware ne l'attrapera pas.

**Sévérité : P3 — documentation manquante.**

---

### F-AXE5-11 — P3 : `/api/assistant/stages` — pas de test

Le fichier `app/api/assistant/stages/route.ts` existe mais aucun fichier `__tests__/api/assistant.stages*.test.ts` n'a été trouvé.

**Sévérité : P3 — test manquant, route non critique (lecture seule, RBAC inline).**

---

## 3. Tableau route → rôle attendu → rôle réel → verdict

### Routes Admin (18 routes)

| Route | Méthode | Rôle attendu | Rôle réel (code) | Guard | Verdict |
|---|---|---|---|---|---|
| `/api/admin/dashboard` | GET | ADMIN | ADMIN | `requireRole(ADMIN)` | ✅ OK |
| `/api/admin/analytics` | GET | ADMIN | ADMIN | `requireRole(ADMIN)` | ✅ OK |
| `/api/admin/activities` | GET | ADMIN | ADMIN | `requireRole(ADMIN)` | ✅ OK |
| `/api/admin/users` | GET,POST,PATCH,DEL | ADMIN | ADMIN | `requireRole(ADMIN)` + rate limit | ✅ OK |
| `/api/admin/users/search` | GET | ADMIN+ASSISTANTE | ADMIN+ASSISTANTE | `requireAnyRole` | ✅ OK |
| `/api/admin/subscriptions` | GET | ADMIN | ADMIN | `requireRole(ADMIN)` | ✅ OK |
| `/api/admin/recompute-ssn` | POST | ADMIN | ADMIN | inline `!== 'ADMIN'` | ✅ OK |
| `/api/admin/directeur/stats` | GET | ADMIN | ADMIN | inline `!== 'ADMIN'` | ✅ OK |
| `/api/admin/invoices` | GET,POST | ADMIN+ASSISTANTE | ADMIN+ASSISTANTE | inline check | ✅ OK |
| `/api/admin/invoices/[id]` | PATCH | ADMIN+ASSISTANTE | ADMIN+ASSISTANTE | `canPerformStatusAction` | ✅ OK |
| `/api/admin/invoices/[id]/send` | POST | ADMIN+ASSISTANTE | ADMIN+ASSISTANTE | `canPerformStatusAction` | ✅ OK |
| `/api/admin/documents` | POST | ADMIN+ASSISTANTE | ADMIN+ASSISTANTE | `requireAnyRole` | ✅ OK |
| `/api/admin/test-email` | GET,POST | ADMIN | ADMIN+ASSISTANTE | inline check | ⚠️ P2 surexposition |
| `/api/admin/stages/*` | CRUD | ADMIN | ADMIN | `requireRole(ADMIN)` | ✅ OK |

### Routes Assistant (9 routes)

| Route | Méthode | Rôle attendu | Rôle réel (code) | Guard | Verdict |
|---|---|---|---|---|---|
| `/api/assistant/activate-student` | POST | ADMIN+ASSISTANTE+PARENT | ADMIN+ASSISTANTE+PARENT | inline L34 | ⛔ P0 IDOR parent |
| `/api/assistant/credit-requests` | GET,POST | ADMIN+ASSISTANTE | **ASSISTANTE seule** | `!== 'ASSISTANTE'` | ⚠️ P1 ADMIN exclu |
| `/api/assistant/subscription-requests` | GET,PATCH | ADMIN+ASSISTANTE | **ASSISTANTE seule** | `!== 'ASSISTANTE'` | ⚠️ P1 ADMIN exclu |
| `/api/assistant/subscriptions` | GET,POST | ADMIN+ASSISTANTE | **ASSISTANTE seule** | `!== 'ASSISTANTE'` | ⚠️ P1 ADMIN exclu |
| `/api/assistant/dashboard` | GET | ADMIN+ASSISTANTE | **ASSISTANTE seule** | `!== 'ASSISTANTE'` | ⚠️ P1 ADMIN exclu |
| `/api/assistant/coaches` | GET,POST | ADMIN+ASSISTANTE | **ASSISTANTE seule** | `!== 'ASSISTANTE'` | ⚠️ P1 ADMIN exclu |
| `/api/assistant/coaches/[id]` | PATCH,DEL | ADMIN+ASSISTANTE | **ASSISTANTE seule** | `!== 'ASSISTANTE'` | ⚠️ P1 ADMIN exclu |
| `/api/assistant/students/credits` | GET,POST | ADMIN+ASSISTANTE | **ASSISTANTE seule** | `!== 'ASSISTANTE'` | ⚠️ P1 ADMIN exclu |
| `/api/assistant/stages` | GET | ASSISTANTE | ASSISTANTE | inline | ✅ OK (mais pas de test) |

### Autres routes sensibles

| Route | Méthode | Rôle réel | Guard | Verdict |
|---|---|---|---|---|
| `/api/payments/validate` | POST | ADMIN+ASSISTANTE | inline + Zod + `$transaction(Serializable)` | ✅ OK — **exemplaire** |
| `/api/assessments/predict` | POST | **tout authentifié** | `if (!session)` only | ⛔ P1 IDOR |

---

## 4. Diff RBAC documenté vs réel

| Source documentée | Claim | Réalité | Écart |
|---|---|---|---|
| `31_RBAC_MATRICE.md` L30 | test-email = ADMIN | ADMIN+ASSISTANTE | **ASSISTANTE aussi** |
| `31_RBAC_MATRICE.md` L54 | admin routes = ADMIN only | 4 routes (invoices, documents, test-email, users/search) = ADMIN+ASSISTANTE | **4 exceptions** |
| `31_RBAC_MATRICE.md` L59 | "Accès croisé interdit sauf ADMIN" | ADMIN bloqué sur 6 routes assistant | **Faux** |
| `31_RBAC_MATRICE.md` L74-77 | 3 routes invoices sans test | Tests existent (`admin.invoices.*.test.ts`) | **Obsolète** |
| `complete-matrix.test.ts` L50-60 | adminRoutes includes invoices, documents | Ces routes autorisent ASSISTANTE | **Test ne couvre pas la vraie policy** |
| `complete-matrix.test.ts` L92-100 | assistant routes = `requireAnyRole(['ADMIN','ASSISTANTE'])` | Routes utilisent `!== 'ASSISTANTE'` | **Test teste le guard, pas la route** |
| `21_GUIDE_DASHBOARDS.md` | N/A | Pas de section assistante/admin détaillée | **Lacune** |

---

## 5. Diff couverture tests vs routes

### Routes admin : 18/18 couvertes ✅

| Route | Test | Cas 401 | Cas 403 | Cas 200 |
|---|---|---|---|---|
| `/api/admin/dashboard` | `admin.dashboard.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/analytics` | `admin.analytics.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/activities` | `admin.activities.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/users` | `admin-users.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/users/search` | `admin.users.search.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/subscriptions` | `admin.subscriptions.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/recompute-ssn` | `admin.recompute-ssn.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/directeur/stats` | `admin.directeur.stats.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/invoices` | `admin.invoices.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/invoices/[id]` | `admin.invoices.id.route.test.ts` | ✅ | — | ✅ |
| `/api/admin/invoices/[id]/send` | `admin.invoices.send.route.test.ts` | ✅ | — | ✅ |
| `/api/admin/documents` | `admin.documents.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/admin/test-email` | `admin.test-email.route.test.ts` | ✅ | — | ✅ |
| `/api/admin/stages/*` (5 routes) | `admin.stages.route.test.ts` | ✅ | ✅ | ✅ |

### Routes assistant : 8/9 couvertes (1 manquante)

| Route | Test | Cas 401 | Cas 403 | Cas 200 |
|---|---|---|---|---|
| `/api/assistant/activate-student` | `assistant.activate-student.route.test.ts` | ✅ | ✅ | ✅ |
| `/api/assistant/credit-requests` | `assistant.credit-requests.route.test.ts` | ✅ | — | ✅ |
| `/api/assistant/subscription-requests` | `assistant.subscription-requests.route.test.ts` | ✅ | — | ✅ |
| `/api/assistant/subscriptions` | `assistant.subscriptions.route.test.ts` | ✅ | — | ✅ |
| `/api/assistant/dashboard` | `assistant.dashboard.route.test.ts` | ✅ | — | ✅ |
| `/api/assistant/coaches` | `assistant.coaches.route.test.ts` | ✅ | — | ✅ |
| `/api/assistant/coaches/[id]` | `assistant.coaches.id.route.test.ts` | ✅ | — | ✅ |
| `/api/assistant/students/credits` | `assistant.students.credits.route.test.ts` | ✅ | — | ✅ |
| **`/api/assistant/stages`** | **∅ aucun test** | — | — | — |

### Tests manquants critiques

| Priorité | Scénario | Route |
|---|---|---|
| **P0** | PARENT active un élève qui n'est pas son enfant → 403 | `/api/assistant/activate-student` |
| **P1** | ADMIN appelle routes assistant → devrait être 200, pas 401 | 6 routes assistant |
| **P1** | ELEVE/PARENT appelle predict pour un autre étudiant → 403 | `/api/assessments/predict` |
| **P2** | ASSISTANTE envoie 100 emails test → rate limited | `/api/admin/test-email` |
| **P3** | Tests basiques (401, 200) pour assistant/stages | `/api/assistant/stages` |

---

## 6. Questions obligatoires — réponses

### Q1 — Assistante

**Les routes assistante sont-elles toutes correctement protégées par rôle ?**
OUI pour le rôle ASSISTANTE. NON pour ADMIN — 6 routes excluent ADMIN de façon incohérente.

**Certaines actions devraient-elles être ADMIN only ?**
- `test-email` send_test : OUI → risque de spam. ADMIN only ou rate limit strict.
- `credit-requests` approve : NON → action opérationnelle cohérente pour ASSISTANTE.
- `payments/validate` : NON → correctement ADMIN+ASSISTANTE.

**Le flux activate-student peut-il être abusé ?**
OUI — P0. Un PARENT peut activer n'importe quel élève car aucune vérification de parentalité n'existe dans le service `initiateStudentActivation`.

**payments/validate est-il trop permissif ?**
NON — c'est la route la mieux protégée du projet : RBAC + Zod + transaction sérialisable + gestion P2034 + idempotence + audit trail + facturation.

### Q2 — Admin

**recompute-ssn applique-t-il la logique métier attendue ?**
OUI. La route (L51) appelle `recomputeSSNBatch(type)` qui utilise la même formule que `computeSSNForAssessment` :
`SSN = 0.6 × disciplinary + 0.2 × methodology + 0.2 × rigor` puis normalisation z-score. Le batch recompute les stats de cohorte d'abord, puis met à jour chaque assessment. Cohérent.

**predictSSN.ts a-t-il une vraie utilité runtime ?**
OUI mais limitée. Il est raccordé via `/api/assessments/predict` (1 consommateur). Les coefficients sont hardcodés (pas entraînés). Le module est fonctionnel mais les prédictions sont approximatives. Pas de code orphelin — il persiste dans `projection_history`.

**Les pages admin affichent-elles des données réelles ?**
OUI. `admin/page.tsx` consomme `/api/admin/dashboard` qui exécute 17 requêtes Prisma en parallèle. `admin/analytics` consomme `/api/admin/analytics` avec groupBy sur payments, users, sessions, subscriptions. `admin/tests` consomme `/api/admin/test-email` GET pour le statut SMTP. Les données sont réelles.

**test-email est-il acceptable en prod ?**
PARTIELLEMENT. Le GET (statut config SMTP) est acceptable. Le POST send_test devrait être :
1. ADMIN-only (pas ASSISTANTE)
2. Rate limité (max 5/heure)
3. Idéalement derrière un feature flag en prod

### Q3 — Tests / RBAC

**complete-matrix.test.ts couvre-t-il toutes les routes ?**
NON. Il teste les **fonctions guard** (`requireRole`, `requireAnyRole`) en isolation, pas les routes réelles. Les 6 routes assistant qui utilisent des checks inline (`session.user.role !== 'ASSISTANTE'`) ne sont pas couvertes par ce test. De plus, les routes admin qui autorisent ASSISTANTE (invoices, documents, test-email) sont incorrectement listées comme ADMIN-only dans le test.

**Quelles routes manquent de couverture ?**
- `/api/assistant/stages` : 0 test
- `/api/assessments/predict` : test existe mais **pas de test IDOR** (403 pour accès cross-student)
- Aucune route assistant n'a de test vérifiant que ADMIN y a accès (car ADMIN n'y a pas accès — c'est le bug)

**Quelles routes devraient avoir 401/403/200 ?**
Toutes les routes de mutation (POST, PATCH, DELETE) sur les 27 routes auditées. Actuellement 26/27 ont au moins un test d'authentification.

---

## 7. Recommandations de remédiation

| # | Sévérité | Action | Effort |
|---|---|---|---|
| R1 | P0 | Ajouter vérif parentalité dans `activate-student` | 1h |
| R2 | P1 | Remplacer `!== 'ASSISTANTE'` par `requireAnyRole(['ADMIN', 'ASSISTANTE'])` sur 6 routes | 30min |
| R3 | P1 | Ajouter RBAC rôle + ownership check sur `/api/assessments/predict` | 1h |
| R4 | P2 | Restreindre `test-email` send_test à ADMIN only + rate limit | 30min |
| R5 | P2 | Wrapper `subscriptions` approve dans `$transaction` | 15min |
| R6 | P2 | Ajouter Zod schemas aux 3 routes POST assistant | 1h |
| R7 | P2 | Refactor credit-requests approve : ajouter champ status au lieu de muter type | 2h |
| R8 | P2 | Mettre à jour `31_RBAC_MATRICE.md` + `complete-matrix.test.ts` | 1h |
| R9 | P3 | Documenter exclusion `/api/*` du middleware | 15min |
| R10 | P3 | Écrire tests pour `/api/assistant/stages` | 30min |
| R11 | P3 | Documenter les coefficients predictSSN comme estimations initiales | 15min |

---

## 8. Prompt Windsurf LOT 4

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 4 Assistante/Admin RBAC.
Voir docs/AUDIT_SENIOR_2026-04-19/05_DASHBOARD_ASSISTANTE_ADMIN.md.

═══ SOUS-LOT 4a — P0 : Fix IDOR activate-student ═══

Fichier : `app/api/assistant/activate-student/route.ts`

Changements requis :
1. Après L40 (403 check), si le rôle est PARENT :
   a. Récupérer le parentProfile : 
      `prisma.parentProfile.findUnique({ where: { userId: session.user.id }, include: { children: true } })`
   b. Vérifier que `parsed.data.studentUserId` est dans `parentProfile.children.map(c => c.userId)` 
      → si non : retourner 403 "Vous ne pouvez activer que vos propres enfants"
2. ADMIN et ASSISTANTE : bypass cette vérification (comportement actuel)

Fichier : `lib/services/student-activation.service.ts`
- Optionnel : ajouter un paramètre `initiatorUserId` et valider la relation parent→student
  dans le service lui-même (défense en profondeur)

Test : ajouter dans `__tests__/api/assistant.activate-student.route.test.ts` :
- PARENT active son propre enfant → 200
- PARENT active un élève qui n'est pas son enfant → 403
- ADMIN active n'importe quel élève → 200

═══ SOUS-LOT 4b — P1 : ADMIN accès routes assistant ═══

Fichiers : 6 routes assistant.

Pour chaque fichier, remplacer le pattern :
```typescript
if (!session || session.user.role !== 'ASSISTANTE') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```
par :
```typescript
if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Routes concernées :
1. `app/api/assistant/credit-requests/route.ts` (GET L11, POST L76)
2. `app/api/assistant/subscription-requests/route.ts` (GET L11, PATCH L78)
3. `app/api/assistant/subscriptions/route.ts` (GET L11, POST L119)
4. `app/api/assistant/dashboard/route.ts` (GET L11)
5. `app/api/assistant/coaches/route.ts` (GET L12)
6. `app/api/assistant/students/credits/route.ts` (GET L12)

Tests : dans chaque test file assistant.*.route.test.ts, ajouter :
- ADMIN accède → 200

═══ SOUS-LOT 4c — P1 : RBAC sur /api/assessments/predict ═══

Fichier : `app/api/assessments/predict/route.ts`

Changements requis :
1. Après L22 (auth check), ajouter un role check :
   ```typescript
   const allowedRoles = ['ADMIN', 'ASSISTANTE', 'COACH'];
   if (!allowedRoles.includes(session.user.role)) {
     // ELEVE and PARENT can only predict for themselves / their children
     if (session.user.role === 'ELEVE') {
       const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
       if (!student || student.id !== body.studentId) {
         return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
       }
     } else if (session.user.role === 'PARENT') {
       const parent = await prisma.parentProfile.findUnique({
         where: { userId: session.user.id },
         include: { children: true }
       });
       const childIds = parent?.children.map(c => c.id) ?? [];
       if (!childIds.includes(body.studentId)) {
         return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
       }
     } else {
       return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
     }
   }
   ```

Tests : ajouter dans `assessments.predict.route.test.ts` :
- ELEVE prédit pour lui-même → 200
- ELEVE prédit pour un autre élève → 403
- PARENT prédit pour son enfant → 200
- PARENT prédit pour un autre élève → 403
- ADMIN prédit pour n'importe qui → 200

═══ SOUS-LOT 4d — P2 : Fixes mineurs ═══

1. `app/api/admin/test-email/route.ts` :
   - POST handler : changer L12 de `['ADMIN', 'ASSISTANTE']` à `['ADMIN']` pour send_test
   - OU : ajouter rate limit `RateLimitPresets.expensive` avant l'envoi

2. `app/api/assistant/subscriptions/route.ts` L178-196 :
   - Wrapper dans `prisma.$transaction(async (tx) => { ... })`

3. Créer schemas Zod dans `lib/validation/assistant.ts` :
   ```typescript
   export const creditRequestActionSchema = z.object({
     requestId: z.string().min(1),
     action: z.enum(['approve', 'reject']),
     reason: z.string().optional(),
   });
   
   export const subscriptionActionSchema = z.object({
     subscriptionId: z.string().min(1),
     action: z.enum(['approve', 'reject']),
     reason: z.string().optional(),
   });
   
   export const subscriptionRequestActionSchema = z.object({
     requestId: z.string().min(1),
     action: z.enum(['APPROVED', 'REJECTED']),
     reason: z.string().optional(),
   });
   ```
   Puis les utiliser dans les 3 routes avec `.safeParse(body)`.

═══ SOUS-LOT 4e — Documentation ═══

1. `docs/31_RBAC_MATRICE.md` :
   - Corriger la matrice endpoints (test-email = ADMIN+ASSISTANTE, invoices = ADMIN+ASSISTANTE)
   - Supprimer la section "sans preuve de test" (3 tests invoice existent)
   - Ajouter la distinction "routes assistant : ASSISTANTE + ADMIN"
   - Documenter que middleware exclut `/api/*`

2. `__tests__/rbac/complete-matrix.test.ts` :
   - Corriger les adminRoutes pour exclure invoices, documents, test-email, users/search (ces routes autorisent ASSISTANTE)
   - Ajouter une section "ADMIN+ASSISTANTE shared routes"
   - Corriger les tests assistant pour tester les routes réelles (pas juste les guards)

3. `docs/21_GUIDE_DASHBOARDS.md` :
   - Ajouter section "### Assistante — Opérations" documentant les flux crédits, subscriptions, paiements
   - Ajouter section "### Admin — Analytics & Config" documentant les pages admin

Contraintes :
- Ne pas modifier la prod
- `npm test -- --runInBand __tests__/api/assistant.activate-student.route.test.ts` → tous pass
- `npm test -- --runInBand __tests__/rbac/complete-matrix.test.ts` → tous pass
- `npm run build` → 0 erreurs
- Chaque sous-lot = 1 commit séparé avec message conventionnel
```

---

## 9. Réponses aux questions spécifiques

### `recompute-ssn` vs `computeSSN.ts`

La route `recompute-ssn` (L51) appelle directement `recomputeSSNBatch(type)` qui est défini dans `computeSSN.ts` (L228-281). La formule composite est identique :
```
rawComposite = 0.6 × disciplinary + 0.2 × methodology + 0.2 × rigor
```
La normalisation utilise `normalizeScore(rawComposite, cohort.mean, cohort.std)` dans les deux cas. Le batch recompute les stats de cohorte en premier (`computeCohortStats`), puis applique la normalisation à chaque assessment. **Cohérent et correct.**

### `predictSSN.ts` — raccordé ou dormant ?

**Raccordé** mais avec un seul consommateur : `/api/assessments/predict`. Le module :
- Lit `progression_history` via raw SQL
- Calcule une prédiction Ridge regression avec coefficients hardcodés
- Persiste dans `projection_history` via raw SQL
- N'est PAS utilisé par les dashboards admin ou assistante

Les tables `progression_history` et `projection_history` existent via raw SQL (pas dans le Prisma client généré). Le code est **actif mais sous-exploité**.

### Pages admin — décoratives ou réelles ?

**Réelles.** Toutes les pages admin consomment des APIs qui exécutent de vraies requêtes Prisma :
- `admin/page.tsx` → `/api/admin/dashboard` → 17 requêtes parallèles (users, revenue, sessions, subscriptions, growth)
- `admin/analytics` → `/api/admin/analytics` → 6 groupBy + jointures
- `admin/tests` → `/api/admin/test-email` GET → status SMTP réel
- `admin/facturation` → `/api/admin/invoices` → liste paginée réelle

### `test-email` en prod

**Acceptable avec restrictions.** Le GET est inoffensif (booléens de config). Le POST `send_test` est un risque car il envoie des emails à des adresses arbitraires. Recommandation : ADMIN-only + rate limit strict.
