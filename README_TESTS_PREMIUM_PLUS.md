<!-- markdownlint-disable MD013 MD012 MD036 MD041 MD040 -->

*Suite de tests « Qualité Premium+ » pour Nexus Réussite*

## 0) Objectif & Portée

Cette refonte unifie et renforce toute la stratégie de tests autour de **l’écosystème complet Nexus Réussite** : ARIA (SSE, RAG), PDF/LaTeX, prix dynamiques, crédits, réservations, paiements (Konnect TND, virement « bientôt disponible », espèces au centre), dashboards (admin/assistante), RBAC NextAuth, emailings, et observabilité. On vise une expérience **zéro surprise** entre le dev réaliste et la prod.&#x20;

---

## 1) Standards de Qualité & Garde-fous (obligatoires)

* **Couverture minimale** : 90 % lignes, 90 % branches, 95 % fichiers critiques (orchestrateur ARIA, RBAC, billing/quotas, RAG).
* **Tests idempotents, isolés, parallélisables**, sans flakiness (horloge simulée lorsque nécessaire).
* **RGPD/PII** : masquage des données sensibles dans logs/fixtures.
* **Accessibilité** : axe-core + snapshots ARIA roles/labels.
* **Sécurité** : prompt-injection LLM, XSS/HTML injection, rate limiting, RBAC, CSP.
* **Observabilité** : assertions sur traces/spans/metrics (si OTEL).
* **CI** : jobs unit/int/e2e/contract/load/smoke, merge bloqué si seuils non atteints.&#x20;

---

## 2) Environnements, Variables & Démarrage des tests

### 2.1 Sources & conventions E2E

* **E2E\_BASE\_URL** (par défaut) : `http://localhost:3001`
* Playwright lance `next dev` sur 3001 et prépare la DB ; `.env.e2e` centralise flags/secrets de test.&#x20;

### 2.2 Prérequis & commandes de base

* Node 20+, Postgres local (5433) ou `DATABASE_URL`.
* Lancer unit/int + couverture : `npm run test:coverage`
* Lancer E2E : `npm run test:e2e` (Chromium local, WebKit/Firefox testables en local).&#x20;

### 2.3 Dépannage rapide

* NextAuth : vérifier `NEXTAUTH_URL == E2E_BASE_URL`
* DB : vérifier `DATABASE_URL` (5433)
* Specs exclues par défaut : `*.prod.spec.ts` et paiements « réels ».&#x20;

---

## 3) Données de test « ultra-réalistes » (seed)

Étendre le seed pour couvrir **tous les rôles/états** :

* 1 **Admin**, 1 **Assistante**, 2 **Coach** (Maths/NSI et Français/Philo)
* 1 **Parent** avec 2 enfants :

  * **Marie** (Terminale, Premium Maths/Physique-Chimie, mastery faible en Probabilités, riche historique/mémoire)
  * **Lucas** (Première, **Freemium**, proche du quota)
* 1 **Candidat Libre** (Terminale, NSI Premium), statut `candidat_libre`
* Étendre : élèves désabonnés/suspendus, paiements en anomalie, i18n fr-FR/fr-CA (timezone Africa/Tunis), préférences accessibilité, documents RAG variés (md/pdf/docx), conversations longues, logs d’événements, clés externes manquantes en env test.&#x20;

**Commandes**

* `npx prisma generate && npx prisma migrate dev`
* `npm run db:seed` (seed idempotent et riche)

---

## 4) Taxonomie des tests & arborescence

### 4.1 Couches de tests

* **Unitaires** : logique pure (calculs, zod, builders, utils).
* **Intégration** : API Routes + Prisma (DB test), SSE serveur, emails, RBAC.
* **E2E** : parcours complets UI (auth, rôles, réservations, ARIA, PDF, paiements).
* **Contract/Pact** : front↔API, API↔services RAG/PDF.
* **Non-fonctionnels** : charge/perf/chaos.&#x20;

### 4.2 Arborescence recommandée

```
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

## 5) Périmètres fonctionnels à couvrir (exhaustifs)

### 5.1 ARIA — Chat en **SSE** (temps réel, sans mock)

**Objectifs** : flux `token`/`done`, **keepalive**/heartbeat, **timeout** + **retry**, **fallback** modèle, **abort** côté client, logs sanitizés, RBAC & quotas Freemium/Premium.

**Cas à tester (API & E2E)**

1. **Premium** : Marie pose une question sur ses faiblesses (Probabilités) → réponse personnalisée + plan d’action, puis demande une fiche PDF, téléchargement OK.
2. **Freemium** : Lucas envoie 6 questions rapides → `subscription-prompt` visible, le compteur persiste après reload.
3. **Timeout→Retry→Fallback** : premier modèle timeoute, retry sur fallback → succès (ou double échec → error).
4. **Abort** : annulation côté client ferme le flux, heartbeat stoppé.
5. **Prod vs dev-token** : dev-token ignoré en prod.
6. **Sécurité** : prompt-injection/XSS bloqués, PII non écho.&#x20;

### 5.2 RAG — Ingestion, Indexation, Recherche (réel)

* **Ingestion** : `.md/.pdf/.docx`, front-matter YAML validé, **idempotence par hash**, chunking/splitter, embeddings (mockables en unit), **langue** détectée.
* **Recherche** : pertinence par matière/niveau, alignement sur faiblesses (tags), **cold-start** gracieux.&#x20;

### 5.3 Bilans & PDF — Mustache → LaTeX → PDF

* Auto-correction (caractères spéciaux), compilation `latexmk` avec timeout, métadonnées PDF (titre/auteur), nettoyage des temporaires, images manquantes (placeholder), encodages (UTF-8/Latin-1).&#x20;

### 5.4 Tarifs dynamiques, Crédits & Réservations

* **Prix/Offres dynamiques** (modifiables par admin/assistante) → revalidation par tags, affichage live.
* **Crédits** : achat (pack), **wallet** élève, **décrément automatique** sur SOS/cours/ARIA, 402 si solde insuffisant.
* **Réservations** : conflits de créneaux, attribution coach, annulation avec règles métier.

> **Références existantes** : structure de tests, intégration `/api/sessions/book`, scénarios de coûts/annulation. &#x20;

### 5.5 Paiements (TND) & Emails (réels côté SMTP)

* **Konnect (CB TND)** : bouton **« Bientôt disponible »** + flux de réservation en attente (sans exécution).
* **Virement (TND)** : page lien **« Bientôt disponible »**.
* **Espèces (centre)** :

  * `POST /payments/cash/reserve` → création `PaymentRecord(pending)` + **email d’accusé** (template branding)
  * `POST /payments/cash/confirm` (admin/assistante) → `paid` + **créditation wallet** + **email confirmation**
  * `POST /payments/cash/cancel` → `cancelled` + **email d’annulation**
* **Listing admin** : filtre par provider/status, pagination, actions « Valider/Annuler », toasts UI.
* **Emails** : templates HTML (logo, couleurs), SMTP dev (Mailhog).

*(Les tests Stripe sont supprimés. Les paiements « réels » ne s’exécutent pas en CI ; on teste intégration UI/API et emails.)*

### 5.6 RBAC, NextAuth & Portails

* **RBAC** fin (admin/assistante/coach/parent/élève/candidat libre) sur toutes les routes sensibles (admin prices, créditage, confirmations cash, ingestion RAG).
* **Portail Parent** : multi-enfants, progression, réservations Studio Flex, pas de PII croisée.
* **Portail Coach** : planning, démarrage visioconf (stub si besoin), compte-rendu PDF.
* **Assistante** : tickets/gestion paiements & crédits.

### 5.7 Site & Marketing

* **Pages offres** (Cortex/Flex/Académies/Odyssée), **Constructeur de Parcours 2.0**, CTA « Bilan stratégique gratuit », blog/ressources, SEO (schemas), A/B tests, analytics d’événements. &#x20;

---

## 6) Plans de tests détaillés par couche

### 6.1 Unitaires (Jest/Vitest)

* **Builders & policy ARIA** : prompts par matière/niveau, intégration mastery/faiblesses, guardrails sécurité.
* **Quota/Rate Limit** : logique de plafonds Freemium/jour & burst.
* **RBAC** : autorisations par ressource (helpers).
* **Zod** : schémas stricts (refus champs en trop).
* **Crédits** : coût, disponibilité, débit/rabais/rollback idempotent.
* **Utils** : fuseau Africa/Tunis, formats FR (virgule/point), idempotency keys.

> Les modules et cibles unitaires sont déjà jalonnés dans les docs existants (credits, validations, etc.).&#x20;

### 6.2 Intégration (API)

* **/api/aria/chat** : gating Freemium/Premium, mémoire long-terme, prompts adaptés (candidat libre), RAG loop (ingest), sécurité (prompt-injection), rate limit IP+user.&#x20;
* **/api/bilans/** : pipeline IA→LaTeX→PDF, variantes (élève/parent/général), erreurs adapter/compilation.
* **/api/pricing/** : CRUD tarifs/offres (admin/assistante), revalidation.
* **/api/credits/** : wallet, debit/spend, refunds, insuffisant → 402.
* **/api/payments/cash** : reserve/confirm/cancel + emails.
* **/api/rag/** : ingest/query (front-matter, chunking, idempotence).

### 6.3 E2E (Playwright)

* **ARIA premium flow** (Marie) : personnalisation Probabilités, fiche PDF, mémoire post-refresh, a11y.
* **ARIA freemium flow** (Lucas) : dépassement quota → UI d’upsell, 403 matière premium.
* **Admin RAG upload** : analyse, méta pré-remplies, ajout à la base, gestion erreurs.
* **Parent portal** : 2 enfants, pas de PII croisée, réservations.
* **Coach session flow** : planifier séance, outils présents, CR PDF.
* **Assistante ticketing** : création/échanges.
* **Auth/RBAC guards** : redirections/403 propres.
* **i18n-a11y** : fr-FR/fr-CA, axe-core zéro violation.
* **Error resilience** : panne RAG, dégradation contrôlée, banner incident.
* **Mobile responsive** : iPhone/Android, focus management.&#x20;

---

## Annexe — E2E stub lanes: PDFs & SSE gates

- PDF fixtures (E2E only):
  - public/files/bilan-parent-stub.pdf (≥ 120KB, ≥ 3 pages)
  - public/files/bilan-eleve-stub.pdf (≥ 70KB, ≥ 2 pages)
  - Served by /api/bilan/pdf/[bilanId]?variant=parent|eleve when E2E=1 and NODE_ENV!='production'.
- SSE header gates (E2E only):
  - x-e2e-stub: 1 + stream=true → emit stub tokens/done (no upstream dependency) for happy-path tests.
  - x-prod-like: 1 + stream=true with dev-token → 401/403 (simulate prod ignoring dev-token).
  - Rate-limit bypass active in E2E to avoid 429’s; stub tokens are header-gated only.

---

## 7) Observabilité, Performance & Sécurité

* **Observabilité** : assertions sur logs sanitizés (pas de secrets), spans clés sur `/api/aria/chat`, ingest RAG, compilation PDF.
* **Perf/Charge** : objectif P95 < 800 ms sur `/api/aria/chat` (charge modérée), ingestion fichiers 5–20 MB, SSE soutenu.
* **Chaos** : latence réseau, pannes partielles `rag_service`, erreurs 500 sporadiques ; UI dégradée acceptable.

> Les critères d’acceptation CI/CD intègrent ces exigences (axe-core, Pact, P95, artifacts).&#x20;

---

## 8) Structure des répertoires & exemples existants

Un squelette de structure et de contenus de tests (unitaires/intégration/E2E) existe déjà ; on l’étend pour couvrir les nouveaux périmètres (paiements cash/konnect, emails, dashboards).&#x20;

---

## 9) CI/CD : pipelines & gating

* Jobs séparés : **lint/type-check**, **unit/int**, **E2E**, **contract (Pact)**, **smoke/load**.
* Chromium-only en CI (stabilité), WebKit/Firefox testables en local.
* Artefacts : coverage HTML, rapports Playwright (screenshots/vidéos/traces).
* **Merge bloqué** si couverture/axe-core/Pact/perf non conformes.&#x20;

---

## 10) Playbook d’exécution

### 10.1 Local

```bash
# Dépendances
npm ci

# Prisma & migrations
npx prisma generate
npx prisma migrate dev

# Seed riche
npm run db:seed

# Unit + int + couverture
npm run test:coverage

# E2E (Chromium)
npm run test:e2e
```

### 10.2 Dépannage (rappels)

* **NextAuth** : `NEXTAUTH_URL == E2E_BASE_URL`
* **DB** : port 5433 / `DATABASE_URL`
* **Exclusions** : désactiver specs prod/paiements non supportés en CI.&#x20;

---

## 11) Matrice de scénarios (extraits)

| Domaine           | Cas « happy »                        | Cas bords/erreurs                                | Attendus clés                                           |
| ----------------- | ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------- |
| ARIA (SSE)        | Premium personnalisé + fiche PDF     | Timeout→retry→fallback, abort, prompt-injection  | `token`/`done` ordonnés, logs sanitizés, RBAC/quotas OK |
| RAG               | Ingest md/pdf/docx (front-matter OK) | YAML invalide, hash dupliqué, index vide         | Idempotence, message de grâce, tags pertinents          |
| PDF/LaTeX         | Compile OK (métadonnées)             | Caractères spéciaux, images manquantes, encodage | Timeout géré, cleanup, PDF binaire                      |
| Tarifs dynamiques | MAJ prix live (revalidate tag)       | Valeurs hors borne, conflits                     | UI/DB synchronisées, validation Zod                     |
| Crédits           | Débit SOS/cours/ARIA                 | Solde < coût → 402                               | Transaction atomique, idempotency key                   |
| Paiements         | Cash reserve→confirm→emails          | Cancel→email annulation, records filtrés         | Wallet crédité, templates HTML ok                       |
| RBAC              | Accès rôle conforme                  | Accès interdit                                   | 403/redirect propres, pas de fuite PII                  |
| A11y/i18n         | axe-core 0 violation                 | Locale fr-CA (formats)                           | Roles/labels corrects, contraste OK                     |
| Perf/Chaos        | P95 < 800 ms chat                    | Pannes RAG/PDF                                   | Mode dégradé + bannière                                 |

---

## 12) Critères d’acceptation

* ✅ Tous les tests **verts** local/CI
* ✅ Couverture ≥ 90/90/95
* ✅ **axe-core** : 0 violation bloquante
* ✅ **Pact** OK, rupture ⇒ build fail
* ✅ **P95** conforme
* ✅ Lint/type-check OK
* ✅ Zéro secret/PII en clair (tests & logs)
* ✅ Rapports coverage + Playwright (traces/vidéos) publiés en artifacts CI&#x20;

---

## 13) Annexes — Références (existant)

* **Guide général des tests & exécution** : commandes, env, structure, conventions E2E. &#x20;
* **Structure & tests déjà implémentés** (credits, validations, /api/sessions/book, flows E2E initiaux). &#x20;
* **Plans E2E complémentaires et unités Python services RAG/PDF** (à étendre). &#x20;

---

### Conclusion

Ce document **remplace et étend** le README\_TESTS initial pour embrasser **toute l’envergure** actuelle du projet : **ARIA SSE réelle, RAG réel, PDF/LaTeX, prix & crédits dynamiques, paiements (Konnect/virement/espèces), emails, dashboards, RBAC, a11y/SEO, perf/chaos**. Implémentez les seeds et les specs détaillées ci-dessus ; la CI fera foi via les **gates** et les **artifacts** fournis. 🚀
