# HANDOFF — Reprise de release & go-live Nexus Réussite
### Destinataire : Claude CLI · Date cible : go-live ce soir · Rôle attendu : lead release/production

> Ce document est ta source de vérité pour cette session. Tu reprends le travail d'un agent précédent (codex) qui a clôturé un lot « S5 » **en local uniquement**, sans push ni déploiement, parce que plusieurs gates critiques sont rouges. Ta mission n'est **pas** de forcer un go-live complet — c'est de livrer en production **ce qui est réellement vert**, en isolant proprement ce qui ne l'est pas, avec une traçabilité irréprochable et un rollback prêt.

---

## 0. Contexte projet (tu ne le connais pas — lis ceci d'abord)

**Nexus Réussite** est une plateforme SaaS éducative (académie de soutien scolaire, système français, Tunis). Entité : STE M&M ACADEMY SUARL. Plateforme : nexusreussite.academy.

- **Stack** : Next.js 15.5.21 (App Router), React 18.3, TypeScript strict, Tailwind v4, Radix UI, NextAuth v5, Prisma 6.13 / PostgreSQL 15/16 + pgvector.
- **Déploiement** : build standalone Next.js, PM2 sur serveur Hetzner `<PROD_HOST>`, Nginx + TLS.
- **Discipline établie sur ce projet** (à respecter) : source tarifaire canonique unique (`data/pricing.canonical.json` + `lib/pricing.ts` + suite de validateurs), **feature flags plutôt que suppression** (pattern existant : `ONLINE_OFFERS_ENABLED = false`), décisions structurantes **formellement documentées**.

**⚠️ Vérifie d'abord le worktree réel.** La mémoire projet référence le dépôt `cyranoaladin/nexus-project_v0`, mais les rapports codex travaillent dans `/home/alaeddine/Bureau/nexus-bilans-p0d-release-quality/`. **Ne présume rien** : confirme avec l'utilisateur quel worktree/branche fait foi avant toute action, et confirme le remote de déploiement.

---

## 1. État exact laissé par codex (à ne pas refaire, à valider)

Lot **S5** = 5 commits locaux, propres, **non poussés**. Tête S5 locale et absente des distants.

- `b251cba…` fix(prisma): reconcile production schema drift
- `821325…` fix(security): close release dependency findings
- `a2dbe0…` refactor(quality): remove lint and dead-code debt
- `7ff8a9…` test(pdf): make campaign coverage hermetic
- `91b296…` fix(auth): reconcile pending family links without weakening purge guards

Ce qui est **VERT** (vérifié par codex en local) :
- Jest : 701 suites / 7 832 tests · Build Next.js : PASS · Typecheck : PASS · Lint : 0 erreur / 0 warning.
- `npm audit` (prod et full) : 0 vulnérabilité · `security:repo` : PASS.
- Migration Prisma additive `20260804210000_reconcile_schema_drift` : ajoute `CLICTOPAY`, crée l'index unique `copy_submissions_aiJobId_key`, **refuse** les doublons `aiJobId`, aucune suppression/réécriture. Testée PG15 et PG16 : 59→60 migrations, second `migrate deploy` idempotent, drift nul.
- 3 suites PDF réactivées (16 tests), génération hermétique, PDF initiaux restaurés byte-for-byte.
- Flux comptes : `PARENT_REGISTRATION_E2E=PASS`, `PARENT_ACTIVATION_SMTP_REAL=PASS`, `CHILD_CREATION_E2E=PASS`, `STUDENT_ACTIVATION_E2E=PASS`, `PARENT_REPORT_ACCESS_E2E=PASS`.

Ce qui est **ROUGE** (bloquant, non résolu) :
- `PLAYWRIGHT=FAIL` — gate navigateur global rouge : 58 tests fonctionnels skip, 59 quarantaines (dont 18 actifs/non résolus, 7 sélecteurs obsolètes, 5 fixtures manquantes), 63/76 specs authentifiées exclues par config.
- Chaîne pédagogique **entièrement rouge en E2E** : `ASSESSMENT_PASSATION_E2E=FAIL`, `SCORING_E2E=FAIL`, `REPORT_GENERATION_E2E=FAIL`, `STUDENT_REPORT_ACCESS_E2E=FAIL`.
- `REAL_LLM_GENERATION=FAIL`, `REVIEW_PUBLICATION=FAIL`, `E2E_PACKS_PASS=0/17`.
- Packs pédagogiques : 17 techniquement valides (306 items) mais **1 seul signé**, **16 en DRAFT**. La cérémonie de signature est **humaine** — `SIGNED_PACKS=1/17`.
- Infra prod **non préflightée** : `REDIS_PRODUCTION=FAIL`, `SMTP_WORKER_PRODUCTION=FAIL`.
- Comptes coach : audit dédié conclut `SAFE_TO_CREATE_COACHES=NO`. Les 3 comptes (Baligh, Narjes, Lamia) sont ABSENT en prod ; le chemin de création actuel n'a **ni invitation, ni activation, ni outbox SMTP, ni token hashé** → non conforme « production-safe ».
- État global : `GO_LIVE_PRODUCTION=NO`, `DEPLOYED_SHA=NON_DEPLOYE`, `PRODUCTION_RELEASE=INCHANGEE`.

Sauvegardes et rollback déjà en place :
- Backup S5 hors dépôt : `/home/alaeddine/Bureau/.nexus-s5-backup-20260804` (manifeste SHA-256 fourni dans le rapport).
- Release de rollback prod : `<RELEASE_DIR>/11e0dce93e9f1d4c79824f9cccd0a467dde4f11b`.

---

## 2. La vérité à dire à l'utilisateur (et à toi-même)

Un **go-live complet « indiscutable » ce soir est impossible, et le prétendre serait malhonnête** : la chaîne pédagogique cœur de produit (passation → scoring → génération de rapport → accès élève) est **rouge en E2E**, la génération LLM échoue, 16 packs sur 17 ne sont **pas signés**, et Redis + worker SMTP ne sont **pas préflightés** en prod. Déployer ça activé, ce soir, exposerait de vrais élèves et parents à un produit cassé et contournerait exactement les garde-fous conçus pour l'empêcher.

**Ce qui EST défendable et indiscutable ce soir**, c'est un **go-live scopé** : mettre en production ce qui est prouvé vert (site, tarifs, inscription/activation comptes, réservation), avec la chaîne pédagogique / ARIA / packs **proprement désactivée derrière feature flag** (exactement le pattern `ONLINE_OFFERS_ENABLED` déjà en place), plus un plan daté pour lever le flag une fois les E2E verts et les packs signés.

C'est ça, un go-live indiscutable : **tout ce qui est allumé est vert.** Traite ce cadrage comme la définition de « done » de cette session.

---

## 3. Invariants de sécurité — NON NÉGOCIABLES

Tu ne les enfreins sous aucune pression de délai. En cas de doute, tu t'arrêtes et tu remontes à l'utilisateur.

1. **Ne jamais contourner le gate Playwright** pour activer la chaîne pédagogique. Passation/scoring/report/LLM sont FAIL → ils partent **flag OFF**, point.
2. **Ne jamais fabriquer de signature de pack.** Un pack DRAFT ne s'active pas. Seule la signature humaine (1/17 actuel) autorise l'activation.
3. **Ne pas créer les 3 comptes coach** par le chemin actuel (`SAFE_TO_CREATE_COACHES=NO`). C'est un chantier (service d'invitation transactionnel + token fort hashé SHA-256 + outbox SMTP + endpoint d'activation), pas une action de ce soir. Différer et remonter.
4. **Ne rien allumer qui dépende de Redis ou du worker SMTP** sans preflight prod **réussi** d'abord.
5. **Ne pas affaiblir les garde-fous de purge** (`pending-account-policy.ts` v3, fail-closed) ni introduire de `any` global ou de contournement ESLint.
6. **Backup + SHA de rollback confirmés AVANT tout déploiement.** Aucun déploiement sans chemin de retour vérifié.
7. **Aucune donnée synthétique en prod** (`SYNTHETIC_DATA_RESIDUALS` doit rester 0).
8. **Ne pas re-refactorer S5.** Les commits sont propres et audités. Tu valides et déploies, tu ne réécris pas.

---

## 4. Découpage go-live

### Track A — PEUT partir ce soir (vert, à déployer)
- Site vitrine, pages tarifs (Grille C), offres candidat libre, module de devis.
- Inscription parent + activation parent (SMTP réel PASS) — **sous réserve preflight SMTP prod OK**.
- Création enfant + activation étudiant.
- Réservation (frais fixes 250 TND), Carte Nexus (390 TND, bénéfices en nature), parrainage (mois ARIA offert, aucun flux monétaire à risque).
- Accès parent au rapport (`PARENT_REPORT_ACCESS_E2E=PASS`) **uniquement en tant que coquille** — voir note ci-dessous.

### Track B — NE DOIT PAS être forcé ce soir (flag OFF)
- ARIA / bilans diagnostiques : passation, scoring, génération de rapport, accès rapport étudiant.
- Génération LLM réelle, publication de review.
- Activation des 16 packs DRAFT.
- Création des comptes coach.

> **Note cohérence Track A/B** : si un flux Track A (ex. accès rapport parent) dépend en réalité d'un artefact Track B (un rapport généré par la chaîne rouge), alors ce sous-flux **bascule en Track B** tant qu'il n'y a pas de rapport valide à servir. Vérifie les dépendances réelles avant de considérer un flux « vert ». Ne sers pas une coquille qui appellera du code rouge.

---

## 5. Runbook Track A — ordonné, avec gates d'arrêt

Exécute dans l'ordre. **À chaque gate rouge : STOP, ne force pas, remonte à l'utilisateur avec le détail.**

**Étape 0 — Cadrage & sécurité**
- Confirme worktree/branche/remote réels (cf. §0).
- Vérifie worktree propre, confirme l'existence du backup S5 et du SHA de rollback prod.
- Relis (sans modifier) les 5 commits S5 pour comprendre le périmètre.

**Étape 1 — Reverif locale complète**
- `npm ci` physique, puis lint + typecheck + `jest` + build standalone.
- **Gate** : tout doit être vert (codex l'affirme ; re-prouve-le). Rouge → STOP.

**Étape 2 — Feature flags de scope**
- Implémente/vérifie les flags qui coupent **tout le Track B** (réutilise le pattern `ONLINE_OFFERS_ENABLED` / filtre d'IDs).
- Ajoute un test qui **prouve** que passation/scoring/report/LLM/packs DRAFT/création coach sont injoignables et masqués côté UI et API quand le flag est OFF.
- **Gate** : Track B prouvé inaccessible. Sinon → STOP.

**Étape 3 — Preflight infra prod** (`ssh root@<PROD_HOST>`, lecture d'abord)
- PostgreSQL : état migrations, drift nul attendu après migration §4.
- Redis : joignable + healthcheck.
- Worker SMTP : joignable + envoi test réel vers une adresse contrôlée.
- **Gate** : si un flux Track A dépend d'une infra en échec (ex. activation parent ↔ SMTP), soit tu répares le preflight, soit tu **retires ce flux du Track A** ce soir. Pas de flux allumé sans son infra verte.

**Étape 4 — Migration Prisma en prod**
- **Backup DB prod d'abord.**
- Applique la migration additive `20260804210000_reconcile_schema_drift` (`migrate deploy`).
- **Gate** : 60/60 migrations, second deploy idempotent, drift nul, aucun doublon `aiJobId` forcé. Anomalie → STOP + restaure.

**Étape 5 — Déploiement**
- Build standalone du SHA S5 retenu, déploiement PM2, **release précédente conservée** (`11e0dce…`) pour rollback immédiat.
- Vérifie `BUILD_ID` / empreinte standalone cohérents avec le build vérifié.

**Étape 6 — Smoke test prod ciblé (Track A uniquement)**
- Page tarifs rendue correctement (Grille C, prix mensuel en or, total annuel dessous).
- Parcours inscription parent → **email d'activation réel reçu** → activation → création enfant → activation étudiant.
- Réservation 250 TND jusqu'à confirmation (sans déclencher d'action financière irréversible non prévue).
- **Vérifie que Track B est bien OFF en prod** : aucune passation, aucun scoring, aucun rapport élève, aucun appel LLM, aucun pack DRAFT activable, aucun chemin de création coach exposé.
- **Gate** : smoke complet vert. Sinon → **rollback vers `11e0dce…`**.

**Étape 7 — Journal de go-live (documentation obligatoire)**
Produis un compte-rendu : SHA déployé, migrations appliquées, flags actifs (liste Track B OFF), résultats preflight infra, résultats smoke test, release de rollback disponible, et **plan daté de levée du flag Track B** (prérequis : E2E 17/17 verts, Playwright sans quarantaine, packs signés humainement, Redis + worker SMTP préflightés). Reprends la recommandation codex : lot dédié « restauration Playwright » avant toute phase pédagogique.

---

## 6. À remonter à l'utilisateur — décisions humaines, pas les tiennes

- **Signature des 16 packs DRAFT** : cérémonie humaine, hors de ton périmètre.
- **Décision d'allumer Track B** (ARIA/bilans) : non ce soir tant que E2E rouge. Fournis les prérequis, pas une activation.
- **Création des 3 coachs** : nécessite d'abord le service canonique d'invitation/activation (cf. audit). Propose le plan, ne crée pas les comptes.
- **Choix de worktree/remote** si ambigu (§0).

---

## 7. Definition of done de cette session

✅ Track A en production, vérifié par smoke test, sur un SHA tracé.
✅ Track B intégralement désactivé par flag, **prouvé** inaccessible.
✅ Infra Track A préflightée verte (ou flux concerné retiré).
✅ Rollback prêt et documenté.
✅ Journal de go-live + plan daté de levée Track B remis à l'utilisateur.

❌ N'est PAS un critère de done, et ne doit PAS être forcé : activer la chaîne pédagogique rouge, signer des packs à la place d'un humain, créer les coachs par le chemin non sûr, déployer sans preflight/rollback.

Un go-live où **tout ce qui est allumé est vert** est le seul go-live réellement indiscutable. C'est celui-là que tu livres.
