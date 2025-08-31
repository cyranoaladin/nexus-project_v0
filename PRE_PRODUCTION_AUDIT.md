# PRE_PRODUCTION_AUDIT

### 1) Cohérence et Qualité du Code

- Anti‑patterns relevés
  - ARIA (lib/aria.ts): modèle OpenAI hardcodé `gpt-3.5-turbo`. Recommandation: lire `process.env.OPENAI_MODEL` avec fallback documenté (ex: `gpt-4o-mini`). Valeur ajoutée: alignement prod, A/B tests, sécurité des coûts.
  - Fonctions incomplètes/placeholder: `lib/session-booking.ts` (createStatusChangeNotifications/sendReminder non implémentées), risquent d’introduire de la dette si appelées plus tard. Reco: lever `NotImplementedError` ou tracer clairement via logs structurés.
  - Styles d’emails embarqués (lib/email-service.ts) sans extraction de templates. OK pour MVP; reco: externaliser gabarits + tests snapshot.
- Code potentiellement mort / peu référencé
  - `lib/session-booking.ts` expose des méthodes avancées (notifications/reminders) non utilisées par les routes actuelles → vérifier usage et supprimer/implémenter.
  - Composants UI spécialisés (ex: `components/ui/badge-widget.tsx`, `components/ui/notification-bell.tsx`) — vérifier leur présence dans l’app router pour éviter du code inactif.
- Importations et conventions
  - `tsconfig.json` défini avec `baseUrl` → alias `@/` résolus OK. Reco: uniformiser les imports absolus `@/…` dans `__tests__` et API pour éviter les chemins relatifs.
  - Conventions de nommage: globalement cohérentes (camelCase pour fonctions, PascalCase pour composants). Reco: valider via ESLint rules (react/function‑component‑definition).

### 2) Couverture des Tests et Robustesse

- Cibles critiques à renforcer (priorité)
  1. `lib/aria.ts` (orchestration LLM/RAG)
     - Cas à ajouter:
       - "retour vide RAG" → vérifie que la réponse reste structurée sans contexte.
       - "erreur OpenAI 403" → relance l’erreur (chemin d’exception spécifique) puis message utilisateur de fallback pour autres erreurs.
       - "messages history tronqués" → vérifie formatage correct des messages envoyés à OpenAI.
  2. `app/api/payments/konnect/route.ts`
     - Cas à ajouter:
       - Content‑Type invalide (415) et JSON mal formé (400).
       - Idempotency‑Key: conflit (409) sur incohérence d’utilisateur/montant/méthode.
       - Article inconnu/inactif/non tarifé (400).
  3. `lib/email-service.ts`
     - Cas à ajouter:
       - Construction d’email: vérifie présence des liens `NEXTAUTH_URL` et adresses `from` selon env.
       - Erreur transporteur (transporter.verify/sendMail rejette) → surface un message d’erreur clair et traçable.

### 3) Sécurité et Dépendances

- Dépendances clés (extrait `package.json`)
  - Runtime: `next@14.2.3`, `next-auth@4.24.11`, `openai@^4.104.0`, `jsonwebtoken@^9.0.2`, `bcryptjs@^3.0.2`.
  - Dev: `@playwright/test@^1.54.2`, `jest@^29.7.0`, `eslint@^8.57.0`.
- Recommandations (simule npm audit)
  - Lancer `npm audit --production` et `npx playwright --version` dans la CI et créer un ticket si vulnérabilités élevées.
  - Verrouiller `openai` sur une version validée (tag interne) pour éviter les changements de surface API.
- Secrets
  - Aucun secret hardcodé détecté côté front. Les secrets sont lus via `process.env`. Reco: valider en CI qu’aucun `sk-` (OpenAI) n’est commit (pré‑commit hook simple).

### 4) Configuration et Variables d’Environnement

- Synthèse des variables (prod)

  | Variable | Rôle | Source/Remarques |
  | --- | --- | --- |
  | DATABASE_URL | Connexion Postgres | `env.example`, CI service 5433 en tests |
  | NEXTAUTH_URL | URL publique NextAuth | `env.example`; cohérent avec domaine prod |
  | NEXTAUTH_SECRET | Secret NextAuth | `.env` prod uniquement |
  | SMTP_HOST/PORT/SECURE/USER/PASSWORD | SMTP envoi mails | `env.example`; ne pas exposer côté client |
  | SMTP_FROM / EMAIL_FROM | Adresse expéditeur | pris en compte dans `lib/email-service.ts` |
  | OPENAI_API_KEY | Clé OpenAI (ARIA) | `env.example`; ne jamais exposer au client |
  | OPENAI_MODEL | Modèle OpenAI | `env.example` (reco: lu dans `lib/aria.ts`) |
  | LLM_SERVICE_URL | Service LLM interne | `env.local.template:8003`, `env.example:8000` → Incohérence: standardiser `8003` |
  | PDF_GENERATOR_SERVICE_URL | Service PDF | `env.local.template:8002` OK |
  | RAG_SERVICE_URL | Service RAG | `env.local.template:8001` OK |
  | E2E_BASE_URL | Base URL Playwright | `3001` (SSoT), CI et local alignés |
  | E2E_RUN / NEXT_PUBLIC_E2E | Flags tests | Doivent être à `0` en prod; activés seulement en E2E |
  | KONNECT_API_KEY/WALLET_ID/WEBHOOK_SECRET | Paiements Konnect | `env.example` |
  | NEXT_PUBLIC_WISE_* | Coordonnées bancaires affichage | Public côté front, contenus fournis |
  | NEXT_PUBLIC_JITSI_SERVER_URL | Visio | Utilisé, manque dans certains templates (ajouter) |
  | RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX | Anti‑spam | Présents dans template local |
  | NODE_ENV / NEXT_PUBLIC_APP_URL | Environnements | `env.example` |

- Incohérences/écarts
  - LLM_SERVICE_URL: `env.local.template` → 8003, `env.example` → 8000. Reco: standardiser à 8003 et vérifier `app/api/status/route.ts` (fallback 8003).
  - E2E flags: veiller à ne pas activer en prod (middleware bypass). CI les définit explicitement, OK.

### 5) Optimisations (Performance & IA)

- Composants à optimiser
  - `components/ui/video-conference.tsx`: élevé en interactions et dépend de WebRTC/Jitsi. Reco: `React.memo`, `useCallback` pour handlers, et découpage en sous‑composants (liste participants / contrôles).
  - `components/eleve/RessourcesPageClient.tsx`: grilles de cartes; reco: `React.memo` des cartes, pagination/virtualisation si > 50 éléments.
- ARIA/OpenAI – Traçabilité
  - `lib/aria.ts`: `generateAriaResponse(studentId, …)` ne propage pas l’identifiant dans l’appel OpenAI. Reco: ajouter `user` (ou `metadata`) dans la requête au SDK OpenAI avec `studentId`/conversationId pour l’audit/limitation d’usage.

---
Revue finale: la base E2E/CI est cohérente (Chromium-only en CI, retries, SSoT E2E_BASE_URL=3001), pas de secrets exposés côté front, et une couverture E2E utile (smoke + flows critiques). Actions proposées ci‑dessus pour verrouiller la prod.
