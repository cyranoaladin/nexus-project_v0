# Gouvernance GitHub — inventaire, duplication de protection, workflow mort

## Date

29 août 2026 (Africa/Tunis).

## Contexte

L'administration du dépôt GitHub (`cyranoaladin/nexus-project_v0`) était entièrement manuelle et non versionnée : réglages de dépôt, ruleset, protection classique de branche, CODEOWNERS, checks requis. Cet audit — mené en lecture seule avec un jeton admin (`gh auth status` : compte `cyranoaladin`, scopes incluant `repo`, `admin:repo_hook`) — établit l'état réel avant toute automatisation (`.github/governance/`, `scripts/github/`). Aucun réglage live n'a été modifié par ce travail ; seules des lectures et deux suppressions locales de fichiers versionnés (`.github/workflows/data-invariants.yml`, une référence obsolète dans `docs/DB_STRATEGY.md`) en résultent.

## 1. Double couche de protection sur `main`

### 1.1 Constat initial

```
$ gh api repos/cyranoaladin/nexus-project_v0/rulesets
[{"id":12801316,"name":"main-protection","target":"branch","enforcement":"active", ...}]

$ gh api repos/cyranoaladin/nexus-project_v0/branches/main/protection
{"message":"Branch protection has been disabled on this repository.","status":"404"}
```

La ruleset moderne existe. L'API REST classique affirme qu'aucune protection classique n'existe. Pourtant :

```
$ gh api graphql -f query='
query { repository(owner:"cyranoaladin",name:"nexus-project_v0"){
  branchProtectionRules(first:10){ nodes{
    id pattern requiredStatusCheckContexts isAdminEnforced
  }}
}}'
{"data":{"repository":{"branchProtectionRules":{"nodes":[
  {"id":"BPR_kwDOPXufyc4EGsZG","pattern":"main",
   "requiredStatusCheckContexts":[
     "E2E (Playwright) / Playwright E2E (chromium)",
     "E2E (Playwright) / Playwright E2E (firefox)",
     "E2E (Playwright) / Playwright E2E (webkit)"],
   "isAdminEnforced":true}
]}}}}
```

Une règle de protection classique existe bel et bien, visible uniquement via GraphQL — c'est précisément pourquoi elle était passée inaperçue : l'endpoint REST (`/branches/main/protection`) qu'un audit ordinaire consulterait répond 404.

### 1.2 Couverture prouvée

Trois signaux indépendants, tous en lecture seule, confirment que cette règle cible bien `refs/heads/main` :

```
$ gh api graphql -f query='
query { repository(owner:"cyranoaladin",name:"nexus-project_v0"){
  branchProtectionRules(first:10){ nodes{
    id pattern matchingRefs(first:20){ totalCount nodes{ name prefix } }
  }}
}}'
{"data":{"repository":{"branchProtectionRules":{"nodes":[
  {"id":"BPR_kwDOPXufyc4EGsZG","pattern":"main",
   "matchingRefs":{"totalCount":1,"nodes":[{"name":"main","prefix":"refs/heads/"}]}}
]}}}}

$ gh api graphql -f query='
query { repository(owner:"cyranoaladin",name:"nexus-project_v0"){
  ref(qualifiedName:"refs/heads/main"){
    branchProtectionRule{ id }
  }
}}'
{"data":{"repository":{"ref":{"branchProtectionRule":{"id":"BPR_kwDOPXufyc4EGsZG"}}}}}

$ gh api graphql -f query='
query { repository(owner:"cyranoaladin",name:"nexus-project_v0"){
  ref(qualifiedName:"refs/heads/main"){
    refUpdateRule{ requiredStatusCheckContexts requiredApprovingReviewCount requiresConversationResolution }
  }
}}'
{"data":{"repository":{"ref":{"refUpdateRule":{
  "requiredStatusCheckContexts":["E2E (Playwright) / Playwright E2E (chromium)","E2E (Playwright) / Playwright E2E (firefox)","E2E (Playwright) / Playwright E2E (webkit)"],
  "requiredApprovingReviewCount":1,
  "requiresConversationResolution":true}}}}}
```

`matchingRefs.totalCount = 1` sur `refs/heads/main`, `ref(main).branchProtectionRule` se résout vers cet identifiant, et `refUpdateRule` renvoie ses trois contextes. La **couverture** est donc prouvée sans ambiguïté.

### 1.3 Applicabilité — explicitement non prouvée

Confondre couverture et applicabilité serait une erreur. Le fichier qui produit les trois contextes requis par cette règle classique n'existe pas sur `main` :

```
$ git ls-tree -r --name-only origin/main -- .github/workflows/
.github/workflows/ci.yml
.github/workflows/data-invariants.yml
.github/workflows/pre-rentree-documents.yml

$ git log --all --oneline -5 -- .github/workflows/e2e.yml
044221207 chore: configure playwright reporters in ci
9618c759c chore: configure playwright reporters in ci
8e16f4a0d test: stabilise webkit e2e
442a5a24a test: stabilise webkit e2e
fb5540f0c chore(ci+fonts): fix workflows and normalize payment contracts
```

`.github/workflows/e2e.yml` n'existe que sur quatre branches obsolètes ; sa dernière exécution date du 20 avril 2026. Ses trois contextes ne peuvent donc jamais être rapportés sur une PR vers `main`. Or 60 PR ont été fusionnées dans `main` depuis, la plus récente (#180) le 29 août 2026 à 01h01 UTC, avec `isAdminEnforced:true` sur la règle classique — ce qui aurait dû bloquer ces fusions si la règle gouvernait effectivement les merges.

**Verdict retenu : `STALE_OR_LATENT_CLASSIC_BPR`, et non `ACTIVE_DUPLICATED_PROTECTION`.** La documentation GitHub affirme que ruleset et protection classique « travaillent ensemble, toutes les règles applicables sont appliquées », version la plus restrictive prévalant — c'est justement pourquoi une règle latente couvrant `main` mérite d'être retirée. Mais « agrégation documentée » n'est pas « preuve d'application sur ce dépôt aujourd'hui », et l'historique de fusion plaide pour la seconde lecture. Trancher définitivement demanderait une sonde empirique (une PR jetable vers `main`, en observant si les trois contextes apparaissent comme *Expected*) — hors périmètre de ce travail, qui **ne supprime aucune protection live**. La suppression est codifiée et préparée (`scripts/github/apply-governance.mjs --delete-classic-protection`, exige un identifiant de nœud exact en plus du flag), jamais exécutée automatiquement.

## 2. `data-invariants.yml` — audit de vivacité avant suppression

Le workflow « Data Invariants » ne pouvait déjà rien garantir structurellement : ses deux seules assertions sont `continue-on-error: true`, et il n'a aucun déclencheur `pull_request`. La règle de l'opérateur était explicite : ne pas transformer un zombie « Invariant » en zombie « Diagnostic » — auditer d'abord si `credit_wallets` / `credit_tx` appartiennent encore à un domaine actif.

```
$ git show origin/main:prisma/schema.prisma | grep -niE 'credit_wallets|credit_tx'
(aucune occurrence)

$ git show origin/main:prisma/schema.prisma | sed -n '454,477p'
model CreditTransaction {
  id        String  @id @default(cuid())
  studentId String
  ...
  type        String // MONTHLY_ALLOCATION, PURCHASE, USAGE, REFUND, EXPIRATION
  amount      Float
  description String
  sessionId String?
  expiresAt DateTime?
  createdAt DateTime @default(now())
  @@map("credit_transactions")
}
```

Le seul modèle de crédits présent sur `main` est `CreditTransaction` → table `credit_transactions`. Aucune colonne `balance`, `delta`, `walletId`, `provider` ni `externalId` — exactement celles que le workflow interroge.

```
$ git grep -c 'credit_wallets' origin/main -- prisma/migrations
(0 correspondance sur 79 fichiers de migration)

$ git log --all --oneline -S'credit_wallets' -- prisma/
ecaf35479 ci(ops): add operational stack check; ...

$ git merge-base --is-ancestor ecaf35479 origin/main; echo $?
1
```

`credit_wallets` et `credit_tx` proviennent d'une unique migration (`20250830094650_fix_credit_tx_table`, commit `ecaf35479`, 4 septembre 2025) qui **n'a jamais été fusionnée dans `main`** (`git merge-base --is-ancestor` renvoie un code de sortie 1 — non-ancêtre). Conséquence en exécution : `to_regclass('public.credit_wallets')` renvoie toujours `NULL` sur `main`, le job prend systématiquement la branche « Skip note » et n'affirme jamais rien.

**Verdict : le workflow garde un schéma qui n'a jamais été fusionné.** Il n'est référencé ni par le ruleset ni par la règle de protection classique — sa suppression ne retire donc aucune application effective. `.github/workflows/data-invariants.yml` est supprimé, sans workflow diagnostic de remplacement.

L'éventuelle obligation d'intégrité sur `credit_transactions` (le vrai modèle) reste une question ouverte, dépendante de l'arbitrage produit encore en cours sur le domaine crédits (voir mémoire projet). Si elle est reprise plus tard, ce sera dans une PR séparée : base migrée, déclencheur `pull_request`, étapes fail-closed, zéro `continue-on-error`, fixtures représentatives, et statut de check requis seulement après stabilité prouvée.

## 3. Registre des checks requis — modèle de producteur discriminé

Le ruleset `main-protection` (id `12801316`) requiert 11 contextes. La reconciliation avec un rollup de PR réel confirme qu'aucun de ces 11 n'est zombie :

```
$ gh api graphql -f query='... statusCheckRollup sur PR #189 ...' | jq -r '...'
check   SUCCESS  Analyze (actions)                [GitHub Actions]
check   SUCCESS  Analyze (javascript-typescript)  [GitHub Actions]
check   SUCCESS  Analyze (python)                 [GitHub Actions]
check   SUCCESS  Bilan Runtime Real-DB Tests      [GitHub Actions]
check   FAILURE  CI Success                       [GitHub Actions]
check   SUCCESS  CodeQL                           [GitHub Advanced Security]
check   SUCCESS  Dependency Integrity             [GitHub Actions]
check   SUCCESS  Documents                        [GitHub Actions]
check   SUCCESS  E2E Parcours Authentifiés        [GitHub Actions]
check   SUCCESS  E2E Tests                        [GitHub Actions]
check   SUCCESS  GitGuardian Security Checks      [GitGuardian]
check   SUCCESS  Integration Tests                [GitHub Actions]
check   FAILURE  Lint                             [GitHub Actions]
check   SUCCESS  Production Build                 [GitHub Actions]
check   SUCCESS  Real DB Integration               [GitHub Actions]
check   SUCCESS  Security Scan                    [GitHub Actions]
check   SUCCESS  TypeScript Type Check            [GitHub Actions]
check   FAILURE  Unit Tests                       [GitHub Actions]
```

Trois producteurs distincts apparaissent : des jobs de `.github/workflows/ci.yml` (10 des 11 contextes requis), une app externe GitGuardian (`integration_id 46505`, 1 contexte requis), et le default setup CodeQL de GHAS (4 contextes observés, non requis, sans fichier workflow). Un modèle « chaque check → fichier workflow + clé de job » ne peut représenter les deux derniers sans fabriquer un `workflowPath` mensonger. `.github/governance/checks-registry.json` porte donc un `producer.kind` discriminé (`GITHUB_ACTIONS_WORKFLOW` / `EXTERNAL_APP` / `GITHUB_DEFAULT_SETUP`) : l'audit hors-ligne ne prouve que les producteurs locaux contre le YAML réel, jamais l'état live d'un producteur externe.

## 4. Décisions codifiées, non appliquées

| Sujet | Décision | Appliqué en live ici ? |
|---|---|---|
| Protection classique | Suppression préparée et gardée (flag + node id exact), snapshot avant/payload de restauration validé structurellement — jamais `RESTORE_PROVEN` | Non |
| Méthode de fusion | `MERGE_COMMIT_ONLY` (57/60 merge commits, 3 squash, 0 rebase sur les 60 dernières PR fusionnées) | Non — état désiré seulement |
| Auto-merge | `allow_auto_merge=true`, `allow_update_branch=true`, `delete_branch_on_merge` reste `false` (15 PR ouvertes dont 3 chaînes empilées, ~25 worktrees actifs) | Non |
| CODEOWNERS | `* @abenrhouma @adammeg`, `require_code_owner_review=false`, `cyranoaladin` volontairement exclu (auteur de la quasi-totalité des PR) | Fichier ajouté ; le réglage `require_code_owner_review` reste inchangé en live |

## Fichiers ajoutés ou modifiés

- `.github/governance/` : état désiré versionné (réglages, ruleset, politique de revue, registre des checks) + schémas JSON Schema draft 2020-12.
- `scripts/github/` : `snapshot-governance.mjs`, `audit-governance.mjs` (`--offline`/`--live`), `apply-governance.mjs` (dry-run par défaut, `--apply` requis, snapshot pré/post-état, tentative de rollback si la vérification post-écriture échoue), `arm-auto-merge.mjs`, `doctor.mjs`.
- `__tests__/governance/` : suite offline (aucun appel réseau réel), `npm run test:governance`.
- `.github/CODEOWNERS`.
- `.github/workflows/ci.yml` : une étape d'audit hors-ligne ajoutée au job `lint` existant (aucun nouveau job, aucune permission de token supplémentaire).
- `.github/workflows/data-invariants.yml` : supprimé.
- `docs/DB_STRATEGY.md` : référence obsolète à `.github/workflows/tests.yml` (absent de `main`) corrigée vers `.github/workflows/ci.yml`.

Aucun réglage GitHub live n'a été modifié par ce travail.
