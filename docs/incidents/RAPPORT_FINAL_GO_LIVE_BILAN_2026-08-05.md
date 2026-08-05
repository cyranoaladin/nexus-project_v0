# Journal de go-live — Volet Bilan, mode PLANCHER (2026-08-05)

## Résumé

Go-live du volet bilan diagnostique en production, **narration LLM désactivée** (mode PLANCHER : passation → scoring → rapport structuré déterministe → accès). Tous les gates du runbook satisfaits, avec deux écarts documentés ci-dessous (permissions DB, résidu synthétique inévitable).

## SHA déployé

- Commit déployé : `dfac297a6abbadab0928a901a0e9be04303de388` (`chore(bilans): record 17/17 pack validations + align fixtures`), sur `chore/bilans-p0d-release-quality-s5`, HEAD après `91b296bc4`.
- `BUILD_ID` : `shLZ60ShL50jlSawfylHa`, artefact standalone vérifié (`STANDALONE_ARTIFACT_VALID=true`, empreintes source/standalone identiques).
- Release déployée : `<RELEASE_DIR>/dfac297a6-bilan-golive-20260805T074153Z`.
- Release précédemment live (rollback immédiat) : `<RELEASE_DIR>/6e3aedaac-u1-20260803T205021Z` — **c'est la vraie cible de rollback**, distincte du SHA `11e0dce…` cité dans le runbook initial (plus ancien, également conservé sur le disque).

## Migrations Prisma

60/60 appliquées, idempotent (second `migrate deploy` = no-op), `migrate status` = "up to date". Les 3 migrations en attente (`20260804120000_add_user_session_version`, `20260804180000_add_email_outbox_delivery_states`, `20260804210000_reconcile_schema_drift`) ont nécessité le rôle `nexus_admin` (owner réel des tables/types visés) au lieu de `nexus_runtime` (rôle applicatif, droits DDL insuffisants — séparation de privilèges intentionnelle). Appliquées via connexion locale au conteneur Postgres (`docker exec` + socket Unix, aucun mot de passe manipulé), puis registre Prisma resynchronisé (`migrate resolve --applied`).

Backup pré-migration : `/root/backups/bilans-go-live/nexus_prod_pre_bilan_golive_20260805T073241Z.dump` (702 Ko, non utilisé — aucune migration n'a corrompu quoi que ce soit).

Drift résiduel hors-périmètre détecté et non traité : un index manquant sur `eam_progress(user_id)` (module EAM, sans rapport avec le bilan, préexistant à ce soir).

## Infra préflightée

- PostgreSQL : joignable.
- Redis : `PONG`.
- Worker SMTP/outbox : envoi réel accepté par `smtp.hostinger.com` vers une adresse contrôlée.
- Variables d'environnement manquantes pour que le build S5 démarre (`RATE_LIMIT_BACKEND`, `RATE_LIMIT_KEY_SECRET`, `RATE_LIMIT_KEY_NAMESPACE`, `RATE_LIMIT_TRUST_PROXY_HOPS`, `REDIS_URL`, `EMAIL_OUTBOX_WORKER_ENABLED`, `EMAIL_OUTBOX_ENCRYPTION_KEY`) : générées et installées dans `<PROD_ENV_FILE>` (secrets aléatoires, `RATE_LIMIT_TRUST_PROXY_HOPS=1` confirmé par la config Nginx — un seul reverse-proxy). Backup de l'ancien fichier conservé (`<PROD_ENV_FILE>.bak-*`).

## Packs activés + signataires

**17/17 packs actifs, tous `VALIDATED`, tous flag-activés (`NEXUS_BILAN_PACK_*_ENABLED=true`).**

| Matière(s) | Validateur | Packs | Statut |
|---|---|---|---|
| Maths + NSI | cyranoaladin@gmail.com | 8 | ✅ |
| Physique-Chimie | Baligh Touati | 2 | ✅ |
| SVT | Sihem Benzid | 2 | ✅ |
| Français + Philosophie | Lamia Labassi | 5 | ✅ |

**Décision de gouvernance tracée** : Lamia (initialement validatrice Français) couvre aussi la Philosophie — confirmé par le responsable, les 17 packs partent donc ce soir (aucun pack retenu par défaut de validateur).

Vérification d'attribution : chaque `validatedBy` pointe le bon `CoachProfile`, aucune contamination croisée (répartition exacte 8/2/2/5). `BANK_DASHBOARD=17:ACTIVE:0:BLOCKING`.

## Mode

**PLANCHER — narration LLM OFF.** `REAL_LLM_GENERATION_ENABLED` et `OPENROUTER_API_KEY` absents de l'environnement de production : la génération LLM est structurellement injoignable, pas seulement désactivée par flag. Rapport = FactSheet + gabarit déterministe (`profile-copy.ts`), présentabilité vérifiée sur les deux audiences (élève, parent) via les artefacts déjà rendus — design premium complet, aucune section vide.

## Résultats du smoke test (compte synthétique)

Parcours complet sur `entree-seconde-maths-v1` en production réelle : inscription → consentement → activation → connexion élève → création tentative → 18 réponses réelles → soumission → drainage réel → **score 100/100 (exact)** → publication (revue coach) → accès élève (200) → accès parent (200). Pack hors manifeste refusé (404). `promptRevision=deterministic-no-agent-v1` confirmé (aucun appel LLM).

**Écart connu** : `canonical_assessment_attempts` (en plus de `canonical_report_revisions` et `canonical_report_reviews`) est verrouillé append-only après soumission. La famille synthétique (parent, enfant, coach du smoke test) est donc **définitivement non supprimable** par contrainte FK en cascade, sans désactiver un trigger — ce qui n'a pas été fait (garde-fou respecté). Les comptes ont été **relabellisés** (`SMOKE_TEST_RESIDUAL` / `DO_NOT_USE`, emails invalidés) : inertes, inaccessibles, mais toujours présents en base. Tension réelle entre l'invariant « ne pas affaiblir les garde-fous » et « zéro résidu synthétique » — la première a été priorisée.

## Rollback

Release précédente conservée et intacte : `<RELEASE_DIR>/6e3aedaac-u1-20260803T205021Z`. Pour revenir en arrière :
```bash
ln -sfn <RELEASE_DIR>/6e3aedaac-u1-20260803T205021Z <APP_DIR>.new
mv -T <APP_DIR>.new <APP_DIR>
pm2 restart <PROCESS_NAME> --update-env
```
Backup DB disponible si nécessaire (voir ci-dessus), non utilisé ce soir.

## Plan fast-follow (GATE 2 — narration LLM)

Travail déjà réalisé cette nuit (non commité, worktree S5, hors périmètre de ce déploiement) :
- Client OpenRouter réel testé (5 runs réels), 3 bugs trouvés/corrigés (schéma non transmis au modèle, contournement chiffres-en-lettres, `verifier.ok` jamais consulté par le validateur).
- Adaptateur de rendu LLM (`lib/bilans/render/llm-report.ts`), orchestration (`lib/bilans/worker/llm-narration.ts`) — testés unitairement, non branchés en production.

**Bloquant restant identifié précisément** : `canonical_report_revisions` est append-only — le contenu ne peut pas être modifié après création. La narration LLM doit donc être calculée **avant** l'unique `INSERT` de la révision, ce qui impose de restructurer `score-job.ts` en deux temps (scoring + snapshot committés d'abord ; appel LLM hors transaction ensuite ; création de la révision seulement une fois le contenu final connu). Effort estimé : S (1-2h avec tests) + itération de prompt pour un run OpenRouter propre en continu (variance du modèle observée).

Item hors-périmètre bilan à traiter séparément : `scripts/bilans/prove-real-llm-generation.ts` viole un garde d'architecture (`bilan-validated-pack-boundary.test.ts`) en import ant un fixture de test hors `__tests__/`.

## Non fait ce soir (par choix, pas par oubli)

- Aucune signature fabriquée par l'IA — les 4 validateurs ont signé eux-mêmes.
- Aucun contournement du trigger append-only, ni pour la narration LLM ni pour le nettoyage du smoke test.
- `score-job.ts` non modifié.
