# ORDRE D'EXÉCUTION — Volet Bilan, go-live pré-rentrée
### Destinataire : Claude CLI · Priorité : go-live ce soir · Rôle : lead release

> Prérequis : lis d'abord `HANDOFF-claude-cli-go-live.md` (contexte projet, stack, état S5, backups, rollback). Ce document est l'ordre de mission spécifique du **volet bilan**. Tu exécutes les 4 phases dans l'ordre. À chaque **GATE** rouge : tu t'arrêtes et tu remontes, tu ne forces pas.

---

## Cadre projet rappelé
- Bilan = diagnostic généré/assemblé (items de packs) → passation élève → scoring → génération de rapport (LLM) → accès parent/élève. Il pilote les stages de pré-rentrée payants.
- Stack : Next.js 15.5.21, Prisma 6.13 / PostgreSQL 15/16 + pgvector, NextAuth v5, PM2 sur Hetzner `88.99.254.59`, Nginx+TLS.
- Discipline : source canonique unique, feature flags plutôt que suppression, décisions documentées. **Confirme le worktree/branche/remote réels avant d'agir** (cf. HANDOFF §0).

## Invariants NON NÉGOCIABLES (aucune pression de délai ne les lève)
1. **L'IA ne signe pas les packs à la place des validateurs.** Tu prépares tout ; le titulaire humain du compte appuie sur « signer ». Aucune signature fabriquée.
2. **Le bilan ne passe live que quand son E2E est vert.** On ne sert aucun diagnostic via une chaîne rouge. Un vrai défaut de scoring/rapport se corrige, ne se masque pas (pas de skip/quarantaine cosmétique).
3. **Clé OpenRouter dans les secrets prod uniquement**, posée par l'utilisateur — jamais commitée, jamais en dur dans le code, jamais transmise à l'IA en clair.
4. **Création des comptes par le chemin canonique sûr** (token fort hashé SHA-256, activation, outbox SMTP, audit). Pas de mot de passe partagé, pas de compte sans activation.
5. **Preflight Redis + worker SMTP prod réussi** avant d'allumer le pipeline bilan (il en dépend).
6. **Backup DB + release de rollback confirmés avant tout déploiement.** `SYNTHETIC_DATA_RESIDUALS` reste 0 en prod.
7. **Garde-fous de purge intacts** (`pending-account-policy.ts` v3, fail-closed). Aucun `any` global, aucun contournement ESLint.

---

## PHASE 1 — Comptes validateurs (création sûre)

Objectif : créer les comptes des validateurs et les rendre opérationnels, par un chemin conforme (l'audit conclut que le chemin actuel n'est **pas** production-safe).

1. Implémente/confirme un **service canonique d'invitation-création coach**, transactionnel et idempotent :
   - création `User` (role `COACH`) + `CoachProfile` complet en une transaction unique ;
   - **token d'activation fort → stocké en empreinte SHA-256** (jamais en clair) ;
   - **envoi via outbox SMTP canonique** (pas d'INSERT direct sans invitation) ;
   - endpoint d'activation ;
   - unicité email **insensible à la casse** (index dédié) ;
   - ré-exécution = no-op confirmé, pas un conflit.
2. Ajoute les champs métier d'autorisation : `CoachProfile.canValidatePacks` (bool, défaut `false`) et `qualification` structurée. Mets `canValidatePacks=true` pour les validateurs.
3. Crée les 3 comptes : **Baligh Touati, Narjes Ben Zid, Lamia Labassi** (rôles COACH, profils complets, qualification renseignée par matière) + confirme le validateur existant. Déclenche les invitations d'activation.
4. Trace un **log d'audit métier « création coach »** (au-delà des timestamps).

**GATE 1** : les comptes existent, sont activables par email réel, `canValidatePacks=true`, audit présent, aucune écriture en double sur ré-exécution. Rouge → STOP + rapport.

---

## PHASE 2 — Raccordement LLM OpenRouter

Objectif : faire passer `REAL_LLM_GENERATION` de FAIL à PASS, proprement.

1. **Secret** : l'utilisateur pose `OPENROUTER_API_KEY` dans les secrets/env prod (et env de test). Tu ne la vois pas, tu ne la commits pas, tu ne la mets pas en dur. Vérifie qu'aucune clé n'est présente dans le repo/historique.
2. Câble le client de génération : modèle(s) OpenRouter cible(s), timeouts, retries bornés, gestion d'erreur explicite, **garde-fous de coût** (limite de tokens/requête, budget), et **fallback** en cas d'indisponibilité (ne jamais rendre un rapport vide/hallucinant sans marqueur d'échec).
3. Prouve une génération réelle **en environnement contrôlé** (fixtures, pas d'élèves prod) : sortie conforme au schéma attendu, parsing robuste, pas de fuite de secret dans les logs.

**GATE 2** : `REAL_LLM_GENERATION=PASS` sur fixture, sortie validée contre le schéma, erreurs et coûts maîtrisés, zéro secret en clair. Rouge → STOP + rapport.

---

## PHASE 3 — Volet bilan : E2E rouge → vert (triage d'abord)

Objectif : `ASSESSMENT_PASSATION_E2E`, `SCORING_E2E`, `REPORT_GENERATION_E2E`, `STUDENT_REPORT_ACCESS_E2E` au vert, sans quarantaine sur le chemin bilan.

1. **Triage** chaque échec E2E et chaque quarantaine Playwright du chemin bilan. Classe chacun :
   - (a) **dette de harnais** (sélecteur obsolète, fixture manquante, env conditionnel, interface renommée) → à réparer pour dé-quarantiner ;
   - (b) **vrai défaut produit** (scoring faux, rapport incorrect, accès cassé) → à **corriger dans le produit**, pas dans le test.
   - Produis la table de triage (test → catégorie → action).
2. Répare (a) : sélecteurs, fixtures, harnais. Dé-quarantine au fur et à mesure.
3. Corrige (b) proprement. **Vérifie le scoring sur des cas connus** (jeux d'entrée → score attendu) : le scoring d'un diagnostic doit être exact, c'est le cœur de la valeur. Idem pour la génération de rapport (cohérence, pas d'hallucination non marquée).
4. **Preflight infra prod** dont dépend le pipeline : PostgreSQL (migration 60/60, drift nul), **Redis** (healthcheck), **worker SMTP** (envoi test réel). Répare `REDIS_PRODUCTION` et `SMTP_WORKER_PRODUCTION`.

**GATE 3** : chaîne bilan E2E verte (passation → scoring → rapport → accès), scoring exact sur fixtures, aucune quarantaine sur le chemin bilan, infra préflightée verte. **Si un vrai défaut de scoring/rapport ne peut être corrigé proprement ce soir → STOP et remonte : on ne shippe pas de diagnostic faux.**

---

## PHASE 4 — Validation humaine + go-live

Objectif : packs signés par les humains, bilan déployé et vérifié en prod.

1. **UI de revue** : affiche les 17 packs (306 items) aux validateurs autorisés, avec le contenu à relire et un bouton **« signer »** réservé au titulaire du compte. Fais générer par OpenRouter ce qui doit l'être, pour que les validateurs relisent du contenu réel.
2. **Signature humaine** : Baligh / Narjes / Lamia (ou toi, utilisateur, si tu es le validateur habilité) signent les packs de leur périmètre. **L'IA ne clique pas à leur place.** Un pack non signé reste DRAFT et n'est pas servi.
3. **Déploiement derrière flag** : déploie le SHA (build standalone, PM2), release précédente conservée pour rollback. Le volet bilan reste **flag OFF** jusqu'au smoke vert.
4. **Smoke test prod** sur un compte **synthétique** (jamais un vrai élève) : parcours complet parent → enfant → passation → scoring → génération rapport (OpenRouter réel) → accès parent/élève. Vérifie le rapport de bout en bout.
5. **Flip live** du volet bilan **seulement si** : E2E vert (Phase 3) **et** packs signés humainement (Phase 4.2) **et** infra préflightée **et** smoke prod vert **et** rollback prêt. Sinon → rollback vers la release précédente.
6. **Journal de go-live** : SHA déployé, migrations, flags, packs signés (par qui), résultats preflight/smoke, rollback disponible. Nettoie tout résidu synthétique.

**GATE 4 (definition of done)** :
- ✅ Comptes validateurs créés et activés par chemin sûr.
- ✅ OpenRouter raccordé, `REAL_LLM_GENERATION=PASS`.
- ✅ Bilan E2E vert, scoring exact, infra préflightée.
- ✅ Packs signés **par des humains**, pas par l'IA.
- ✅ Bilan live en prod, smoke vert, rollback prêt, journal remis.

---

## À remonter à l'utilisateur (décisions/actions humaines)
- Poser `OPENROUTER_API_KEY` dans les secrets prod (l'IA ne la manipule pas).
- **Signer** les packs (bouton, par les validateurs habilités).
- Trancher si un vrai défaut de scoring/rapport ne peut être corrigé proprement ce soir (reporter le flip live plutôt que servir un diagnostic faux).
- Confirmer worktree/remote si ambigu.

> Rappel du standard : un go-live « indiscutable » du bilan = chaîne verte de bout en bout **et** packs certifiés par de vrais validateurs. C'est celui-là qu'on livre — pas un tampon automatique.
