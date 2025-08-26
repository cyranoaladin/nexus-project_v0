### **Mission de Finalisation de la Suite de Tests "Qualité Premium+"**

Bonjour Cursor. Notre objectif est de doter le projet **Nexus Réussite** d’une suite de tests automatisés exhaustive garantissant un fonctionnement **“zéro bug”** en production, la **robustesse** des microservices, et la **fiabilité** de l’intelligence d’**ARIA** (personnalisation, mémoire, sécurité).

Tu agis en **Lead QA Engineer** et tu mets en œuvre une stratégie **premium** conforme aux meilleures pratiques d’ingénierie (TDD/BDD, pyramid of tests, CI/CD gating, SLOs).

**Documents de Référence Absolue :**

- `@_SPECS_ARIA/00_CAHIER_DES_CHARGES_FINAL_V4`
- `@_SPECS_ARIA/Orchestration & Logique métier d’ARIA`
- `@_SPECS_ARIA/Base de données & Modèle élève`
- `@_SPECS_ARIA/RAPPORT_TESTS_IMPLEMENTATION.md` (pour l’existant)

**Standards & Garde‑fous globaux (à respecter dans tout le repo)**

- Couverture minimale : **90% lignes**, **90% branches**, **95% fichiers critiques** (orchestrateur ARIA, contrôle d’accès, billing/quotas, RAG).
- Lint & type-check obligatoires (TS strict, mypy si Python).
- Tests **idempotents**, parallélisables, isolés (fixtures/transactions).
- **No flakiness** : réessais contrôlés là où nécessaire, horloge simulée.
- **PII** masquées dans les logs/fixtures (RGPD).
- **Data-testid** stables dans l’UI (préfixe `data-testid="nexus-*"`).
- Matrice navigateurs : Chromium, WebKit, Firefox (desktop + mobile viewport).
- Accessibilité : axe-core + snapshots ARIA roles/labels.
- Sécurité : tests d’**injection**, prompt‑injection LLM, **rate limiting**, **RBAC**.
- Observabilité : assertions sur **traces/spans/metrics** clés (OpenTelemetry si activé).
- CI : jobs **unit**, **integration**, **e2e**, **contract** (Pact), **load/smoke**; blocage de merge si seuils non atteints.

---

## Tâche 1 : Base de Données de Test **ultra-exhaustive**

**Objectif :** Couvrir _tous_ les profils et états possibles.

**Action :** Étendre `scripts/seed-test-users.ts` (reset DB avant seed) pour créer :

- **1 Admin** : `admin@nexus.com`
- **1 Assistante** : `assistante@nexus.com`
- **2 Coachs** :
  - `helios@nexus.com` (Maths, NSI)
  - `zenon@nexus.com` (Français, Philosophie)

- **1 Parent** : `parent.dupont@nexus.com` avec **2 enfants** :
  - **Marie (Premium)** `marie.dupont@nexus.com`
    - Terminale
    - Abos **ACTIVE** : Mathématiques, Physique‑Chimie
    - Historique riche : conversations/notes/documents (Maths) ; **Mastery** bas en _Probabilités_, haut en _Analyse_ ; **assessments** mixtes; plusieurs **sessions** avec périodes d’inactivité (pour tests mémoire).

  - **Lucas (Freemium)** `lucas.dupont@nexus.com`
    - Première
    - **Pas d’abonnement** ; compteur d’usage proche du quota.

- **1 Candidat Libre (Premium NSI)** `candidat.libre@nexus.com`
  - Terminale, abo **ACTIVE** : **NSI** ; `status=candidat_libre`.

**Étendre la population** :

- Élèves **désabonnés**, **suspendus**, **paiement en anomalie**, **motifs RGPD (droit à l’oubli en attente)**.
- Élèves avec **i18n** différent (fr-FR, fr-CA) pour formats **date/heure** (timezone **Africa/Tunis**), **virgule vs point** décimal.
- Élèves avec **handicap** (préférences accessibilité activées).
- **Docs RAG** variés : `.md` avec front‑matter YAML correct/incorrect, `.pdf`, `.docx`, **encodages** mixtes, images intégrées.
- **Mastery** couvrant bords : domaines vides, valeurs extrêmes, incohérentes (à corriger par validation).
- **Conversations** longues (>100 tours), très courtes (1 tour), multi‑matières.
- **Logs d’événements** pour relecture (test de traçabilité).
- **Clés API** de services externes manquantes/invalides dans env **test** (pour tests de dégradation).

---

## Tâche 2 : Renforcement des **Tests d’Intégration** ARIA (API)

Crée `__tests__/api/aria-chat.integration.test.ts` et couvre :

### A. Gating Freemium & Premium (étendu)

- **Freemium** : dépasse quota ⇒ **429** ; juste avant quota ⇒ **200** ; _burst_ rapide ⇒ **429** (rate limit).
- **Premium hors périmètre** (Marie → NSI) ⇒ **403**.
- **Premium en panne de facturation** ⇒ **402/403** selon policy.
- **Parents** tentant d’appeler ARIA ⇒ **403** (RBAC).
- **Coach/Admin** ⇒ accès autorisé aux endpoints **support** (si spécifié), sinon **403**.

### B. Mémoire Long Terme (prisma mock)

- Vérifie appels : `student.findUnique`, `ariaMessage.findMany`, `assessment.findMany`, `mastery.findMany`, **`subscription.findMany`**, **`document.findMany`**.
- Cas **conversation longue** : pagination/limite de contexte respectées.
- Cas **aucun historique** : comportement par défaut (onboarding prompt).
- Cas **réactivation** après inactivité longue : récupération des **anchors** (résumés).

### C. Personnalité Coach & Système de Prompt

- Mock `llm_service`. Vérifie que `system_prompt` :
  - S’adapte aux **faiblesses Mastery** (Probabilités ↑ guidance).
  - S’adapte au **statut candidat_libre** (référentiel différent, méthodo concours).
  - Intègre **règles de sécurité** (anti‑prompt‑injection, refus hors‑périmètre).
  - Respecte **ton Nexus Premium** (style, structure attendue).
  - Varie selon **matière** (Maths vs NSI) et **niveau** (Première/Terminale).

- Vérifie **pinned tools** / fonctions autorisées (ex : `generate_revision_sheet`).

### D. Boucle d’Auto‑Amélioration **RAG**

- Mock `llm_service` retour >150 mots, avec titres/étapes.
- Mock `global.fetch` ; assert appel `rag_service/ingest` avec :
  - `content_md`, `metadata` (matière, niveau, tags `faiblesse: probabilites`, source: `ARIA`).
  - **Idempotency-Key** (header).

- Tests d’erreurs : `rag_service` timeout ⇒ retry + log + event.

### E. Sécurité & Conformité (API)

- **Prompt‑injection** dans entrée élève ⇒ `llm_service` reçoit **guardrails** (système prompt prioritaire).
- **XSS/HTML injection** dans messages ⇒ sortie **échappée**.
- **PII** : pas d’écho des emails/tel dans réponses ARIA.
- **GDPR** : droit à l’oubli ⇒ suppression/anon de l’historique ; vérifie qu’une requête ARIA post‑suppression **n’expose** pas d’anciens contenus.
- **Rate limit par IP** + par **user** (double seau).
- **RBAC** complet : Admin/Assistante/Coach/Parent/Élève/Candidat Libre.

---

## Tâche 3 : Tests d’Intégration **Services Python**

Dans chaque `services/*/test_main.py`, compléter :

### `services/pdf_generator_service/test_main.py` (Critique)

- **Zéro Erreur (auto‑corr)** : Envoi LaTeX avec `_` non échappé.
  - Mock `subprocess.run`: 1er run **échec** (log d’erreur latex), 2e run **succès** après **sanitization**.
  - Assertions :
    - Transformation appliquée (diff avant/après).
    - PDF binaire **généré** ; métadonnées (titre/auteur) présentes.
    - **Temps max** de compilation respecté (timeout managé).
    - Fichiers temporaires **nettoyés** même en cas d’échec.

- **Cas supplémentaires** :
  - **Boucle d’erreurs** (2 échecs) ⇒ statut d’erreur contrôlé + log clair.
  - **Images manquantes** ⇒ fallback/placeholder.
  - **Encodage** UTF‑8 vs Latin‑1 ⇒ normalisation réussie.

### `services/rag_service/test_main.py`

- **Ingestion** `POST /ingest` :
  - Appel `ajouter_document(DocumentPedagogique)` avec champs normalisés (matière, niveau, tags).
  - Rejet si **front‑matter YAML invalide** ; message d’erreur structuré.
  - Deduplication (même hash contenu) ⇒ **idempotent**.
  - **Taille** maximale (chunks) ; vérifie **splitter** + **embeddings** (mock).
  - **Langue** détectée correctement (fr) ; fallback si inconnu.

- **Recherche** `POST /query` :
  - Pertinence : retourne passages alignés aux **faiblesses Mastery** si taggés.
  - Filtrage par matière/niveau ; **cold‑start** (index vide) ⇒ message de grâce + log.

---

## Tâche 4 : **E2E** Playwright — Parcours Critiques & Bords

Dans `e2e/`, créer/compléter :

### `aria-premium-flow.spec.ts` (Succès Premium)

1. Login `marie.dupont@nexus.com`.
2. Aller `/aria`, choisir **Mathématiques**.
3. Poser question sur **Probabilités** (point faible connu).
4. **Assert** : réponse **personnalisée** mentionnant la faiblesse, avec plan guidé.
5. Demander **fiche de révision** PDF.
6. **Assert** : toast succès, lien/téléchargement visible.
7. Rafraîchir ; poser question faisant référence au contexte précédent.
8. **Assert** : **mémoire** conservée (référence conversation antérieure).
9. **Accessibilité** : `nexus-aria-input` a `aria-label`, contraste suffisant.
10. **Traçabilité** : vérifier apparition d’un **event** `aria_response_generated` (si UI l’expose).

### `aria-freemium-flow.spec.ts` (Limitation Freemium)

1. Login `lucas.dupont@nexus.com`.
2. Envoyer **6** questions rapides.
3. **Assert** : `data-testid="subscription-prompt"` visible.
4. Recharger la page ⇒ compteur persiste (stockage serveur).
5. Tenter matière premium ⇒ **403** UI bien gérée (message non technique).

### `admin-rag-upload.spec.ts` (Alimentation RAG)

1. Login `admin@nexus.com`.
2. `/dashboard/admin/rag-management`.
3. Upload `.md` avec YAML.
4. Cliquer **Analyser**.
5. **Assert** : champs pré‑remplis (titre, matière, niveau, tags).
6. Cliquer **Ajouter à la Base de Connaissances**.
7. **Assert** : succès + entrée visible dans la liste (id, date, tags).
8. Upload fichier **corrompu** ⇒ erreur UI claire ; pas d’entrée créée.

### **Nouveaux E2E complémentaires**

- `parent-portal.spec.ts`
  - Login **Parent** ; voir **deux enfants** ; consulter progression (Mastery, historiques) ; **Assert** : pas de PII croisée ; liens vers réservations Studio Flex.

- `coach-session-flow.spec.ts`
  - Login **Helios** ; planifier séance avec **Marie** ; démarrer visioconf simulée ; **Assert** : présence des outils (annotations, partage doc), génération compte‑rendu PDF.

- `assistante-ticketing.spec.ts`
  - Login **Assistante** ; créer ticket support ; **Assert** : escalade possible vers Coach/Admin ; pièces jointes.

- `auth-rbac-guards.spec.ts`
  - Tentatives d’accès croisés (Parent → `/aria`, Élève → `/admin`) ⇒ redirections/403 UI propres.

- `i18n-a11y.spec.ts`
  - Basculer locale fr-FR/fr-CA ; **Assert** : formats date/numérique ; audit axe-core **sans violation**.

- `error-resilience.spec.ts`
  - Simuler panne `rag_service` via flag ; **Assert** : ARIA répond dégradé + banner incident ; logs non verbeux de secrets.

- `mobile-responsive.spec.ts`
  - Viewport iPhone/Android ; **Assert** : layouts non cassés, focus management OK.

> **Data‑testids recommandés** (à ajouter si manquants) :
> `nexus-aria-input`, `nexus-aria-send`, `nexus-aria-message`, `nexus-toast-success`, `nexus-subscription-prompt`, `nexus-upload-input`, `nexus-ingest-analyze`, `nexus-ingest-submit`, `nexus-admin-table-row`, `nexus-login-email`, `nexus-login-submit`.

---

## Tâche 5 : **Unit Tests** (JS/TS + Python) — Couverture Fine

### Front (React/Next)

- **Composants** : `ChatMessage`, `SubscriptionPrompt`, `RevisionSheetModal`, `RagUploadForm`, `RoleGuard`, `Navbar`.
  - Assertions : rendu conditionnel par **role**, **état réseau**, **erreurs** ; **a11y** props.

- **Hooks** : `useQuota`, `useAriaMemory`, `useRagIngest`, `useAuth`.
  - Simuler cache, retry/backoff, abort controller.

- **Utils** : formatage **dates (Africa/Tunis)**, nombres, **idempotency keys**.
- **Store** (zustand/redux) : actions **pures**, sérialisation, hydration SSR.

### Back (Node/TS)

- **Services** : `AriaOrchestrator`, `QuotaService`, `RbacService`, `PromptBuilder`, `RagClient`.
  - Cas bords : **timeouts**, **circuit breaker**, **feature flags**, **fallbacks**.

- **Validation** (zod/yup) : schémas stricts pour entrées API (refus champs en trop).
- **Serializers** : nettoyage d’HTML/markdown, **escape XSS**.

### Python

- **PDF** helpers : sanitization, timeouts, clean‑up.
- **RAG** : normalisation metadata, langue, chunking.

---

## Tâche 6 : **Contract Tests & Non‑fonctionnels**

- **Contract tests (Pact)** entre front et API ; entre API et `rag_service`/`pdf_generator_service`.
- **Smoke tests** post‑deploy : endpoints clés (health, chat, ingest, pdf).
- **Performance/Charge** (k6/Locust) :
  - P95 **< 800ms** pour `/api/aria/chat` sous charge modérée.
  - **Saturation** quotas & RAG ingestion (files 5–20MB).

- **Chaos/Résilience** :
  - Coupure `rag_service`, **latence 2s**, erreurs 500 sporadiques ⇒ système **dégradé** acceptable.

- **Sécurité** :
  - **CSP** headers présents ; CORS restrictif ; **JWT** expiré/altéré ; **Brute force** login ⇒ lockout temp.
  - Tests **prompt‑injection** ciblés (ex : “ignore prior instructions…”) ⇒ **bloqués** par guardrails.

- **Backup/Restore** (si dispo) : fixture de restauration ; cohérence masteries/conversations après restore.

---

## Arborescence & Fichiers à créer/étendre (extraits)

```
scripts/
  seed-test-users.ts          # étendu (states + data riches)
__tests__/
  api/
    aria-chat.integration.test.ts
  unit/
    prompt-builder.test.ts
    quota-service.test.ts
    rbac-service.test.ts
    serializers.test.ts
e2e/
  aria-premium-flow.spec.ts
  aria-freemium-flow.spec.ts
  admin-rag-upload.spec.ts
  parent-portal.spec.ts
  coach-session-flow.spec.ts
  assistante-ticketing.spec.ts
  auth-rbac-guards.spec.ts
  i18n-a11y.spec.ts
  error-resilience.spec.ts
  mobile-responsive.spec.ts
services/
  pdf_generator_service/test_main.py
  rag_service/test_main.py
contracts/
  pact-front-api.spec.ts
  pact-api-rag.spec.ts
```

---

## Critères d’acceptation (CI/CD)

- ✅ Tous les **tests passent** localement et en CI.
- ✅ Couverture ≥ **90/90/95** (lignes/branches/fichiers critiques).
- ✅ **axe-core** : 0 violation **bloquante**.
- ✅ **Pact** : contrats validés ; rupture ⇒ **build fail**.
- ✅ **k6/Locust** : P95 respecté sur `/api/aria/chat`.
- ✅ Lint/type‑check : **OK**.
- ✅ Aucun secret/PII en clair dans logs de test.
- ✅ Artifacts : **coverage report**, **traces** (si OTEL), **screenshots/vidéos** E2E.

---

## Consignes d’implémentation rapides

- Préférer **factory/faker** pour données (`tests/factories/*`).
- Utiliser **test IDs** fournis ; sinon, les ajouter.
- **Clock mocking** pour scénarios temps (sessions, quotas journaliers).
- **Network mocking** déterministe (Playwright routes, MSW pour unit/integration).
- **Retries** limités uniquement pour tests sensibles au timing (E2E).
- **Snapshots** UI sobres (text + rôles) pour stabilité.

---

**Action finale attendue :**
Implémente cette stratégie de test complète. **Confirme‑nous** une fois terminée que **tous les nouveaux tests passent** en local et en CI, avec les métriques de couverture et les rapports (coverage, axe‑core, Pact, k6) attachés au job CI de la MR/PR.
