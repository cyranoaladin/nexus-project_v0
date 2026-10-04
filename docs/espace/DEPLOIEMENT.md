# Espace pédagogique — plan de déploiement en production

> **Statut au 2026-10-03 : DÉPLOYÉ en production** (release `f50d531b6-espace-terminale-20261003T0720Z`). Le déroulé réel, avec les écarts par rapport au plan, est au §8.

## 1. État de la production (relevé en lecture seule, 2026-10-02)

| Élément | Constat |
|---|---|
| Release en service | `724f8982d` (correctif sécurité du 2026-09-09). `main` est à `30d63e140` : **653 commits, 1 186 fichiers, 18 migrations** d'écart |
| Mode d'authentification | `CORE_V2_AUTH_MODE` **absent** de l'environnement (cette release précède Core v2) |
| Base `nexus_prod` | dernière migration appliquée : `20260906130000_parent_email_activation_invalidation` ; aucune table `espace_*`, aucune des colonnes `username/pinHash/…` |
| Migrations « annulées » | 3 : `20260808130000_add_user_document_unavailable_reason`, `20260824090000_add_profil_candidat`, `20260830150000_add_lva_lvb_languages`. **Leurs effets existent déjà en base** (colonne, table + enums, valeurs d'enum) : elles ont été appliquées à la main |
| Comptes | 1 ADMIN (compte de seed), 20 COACH, 194 ELEVE |
| Stockage documents | `DOCUMENT_STORAGE_ROOT=/var/www/nexus-shared` (déjà en place) |
| Legacy POO | `nexus-poo.service` actif ; base `traces.sqlite3` : **0 dépôt** ; timer quotidien de purge à 90 jours |

## 2. Ce qui a été vérifié

| Vérification | Résultat |
|---|---|
| Typecheck (`tsc --noEmit`) | 0 erreur, sur `main`+espace **et** sur la release de prod + espace |
| Suite unitaire complète, `main`+espace | 1 283 suites / 14 415 tests, 0 échec (avec `-w 4` : en parallélisme maximal, la suite d'analyse statique `npc-storage-contract` reçoit parfois un `SIGTERM` de son worker sur cette machine ; elle passe seule et à 4 workers) |
| Suite unitaire complète, prod+espace | 1 130 / 1 133 suites ; les 3 en échec (`aria/context`, `session-booking`, `validate-npm-tree`) échouent **à l'identique sur la release de prod sans l'espace** |
| Intégration (vraie base Postgres) | 107 tests / 5 suites, sur `main` **et** sur la base de prod |
| E2E navigateur (Chromium, build de production) | **14 / 14** sur `main`+espace en `V1_ONLY` **et** en `HYBRID`, et **14 / 14** sur la release de prod + espace (base migrée avec les migrations de la prod + la mienne) |
| axe (accessibilité) | 0 violation sur connexion, tableaux de bord, TP, espace enseignant ; aucun débordement à 360 px |
| Build de production | OK sur `main`+espace et sur prod+espace ; `runner.py` embarqué dans le standalone |
| Migration | additive (0 suppression) ; vérifiée sur une base neuve **et** sur l'état simulé de la prod ; aucune dérive résiduelle sur les objets de l'espace |
| Legacy | archive indépendante vérifiée par empreinte ; source inchangée |

Non vérifié : un déploiement réel, l'exécution depuis un autre appareil que celui de test, `CORE_V2_AUTH_MODE=V2_ONLY` (déduit de la lecture du code : les identités de l'espace n'existent pas dans Core v2, leurs jetons seraient refusés).

## 3. Décisions à prendre avant toute action en production

### 3.1 Quelle base de code déployer ?

| | Option A (recommandée) | Option B |
|---|---|---|
| Contenu | release de prod `724f8982d` **+ l'espace** (branche locale `rehearsal/espace-on-724f8982d`, jamais poussée) | `main` + l'espace |
| Surface de changement en prod | uniquement l'espace | 653 commits, 18 migrations (dont des `RESTRICT` sur suppressions), couche Core v2 |
| Prérequis | aucun nouveau | `CORE_V2_AUTH_MODE` à définir et valider, migrations à appliquer manuellement (voir 4) |
| Coût de portage | 5 résolutions mécaniques de contexte + 1 commit d'adaptation (cale `lib/timezone.ts`, import du logger, déconnexion `next-auth`, schéma rebâti base + ajouts) | nul |

L'option A garde le rayon d'impact minimal. L'option B ne devrait être choisie que dans le cadre d'une décision de mise en production de `main`, indépendante de l'espace.

### 3.2 Comptes existants (relevé en lecture seule)

| Personne | Situation en prod | Proposition |
|---|---|---|
| Alaeddine BEN RHOUMA (enseignant) | **2 comptes COACH** : `…7tb195` (email = le tien, pseudonyme « Alaeddine Ben Rhouma », 9 affectations, créé le 2026-05-01) ; `…ne_001` (pseudonyme « Alaeddine », 18 séances comme coach, créé le 2026-03-03) | adopter `…7tb195` (`matchUserId` ou `matchEmail`) |
| Ines BERTIN | 1 compte, TERMINALE, **activation familiale en attente** | décision : adopter avec `activatePending: true` (le lien d'activation envoyé à la famille ne fonctionnera plus), ou créer un compte séparé |
| Rostom FOURNIER | 1 compte, TERMINALE, **activation familiale en attente** | idem |
| Malek SIMON | 1 compte, PREMIÈRE, activé | adopter (`--adopt`) |
| Sarra BERNARD | 1 compte, PREMIÈRE, activé | adopter (`--adopt`) |
| Yassine BELLON | **2 comptes** : `…up8cgk` (TERMINALE, en attente d'activation, 2026-08-14) ; `…afghb6` (PREMIÈRE, activé, 2 affectations coach, 2026-05-01) | choisir (`matchUserId`) ; `…up8cgk` correspond à l'année en cours mais est en attente d'activation |
| 8 autres élèves | aucun compte | créés |

L'outil **refuse** de choisir : sans ces décisions écrites dans la liste, `provision.ts apply` s'arrête sur un conflit et n'écrit rien.

### 3.3 Autres

- `CORE_V2_AUTH_MODE` : `V1_ONLY` ou `HYBRID` conviennent ; `V2_ONLY` ne convient pas à l'espace.
- Legacy : ne rien modifier. Recommandation facultative : `NEXUS_RETENTION_DAYS=0` pour neutraliser la purge à 90 jours si le service historique devait recevoir de vrais dépôts (modification du service legacy : accord explicite requis).

## 4. Procédure de migration en production (testée)

**Ne pas utiliser `prisma migrate deploy` en production.** Sur l'état réel de `_prisma_migrations`, il tenterait de rejouer les 3 migrations « annulées » et échouerait (`P3018 : column "unavailableReason" … already exists`) avant d'atteindre celle de l'espace — reproduit sur une base jetable à l'état identique.

À la place, en tant que `nexus_admin`, après sauvegarde :

```bash
# 1. Sauvegarde PostgreSQL (format custom), vérifiée
pg_dump -Fc -U nexus_admin nexus_prod > /var/backups/…/nexus_prod-AVANT-espace-$(date -u +%Y%m%dT%H%M%SZ).dump

# 2. SQL appliqué en UNE transaction, arrêt à la première erreur (rien ne persiste si l'une échoue)
psql -U nexus_admin -d nexus_prod -X -v ON_ERROR_STOP=1 -1 -f prisma/migrations/20261002210000_add_espace_pedagogique/migration.sql

# 3. Enregistrement officiel dans l'historique Prisma
npx prisma migrate resolve --applied 20261002210000_add_espace_pedagogique
```
La migration est additive : 12 tables, 5 types, 4 colonnes nullables sur `users`. Aucune ligne existante n'est lue ni modifiée.

## 5. Séquence de déploiement (si feu vert)

1. **Pré-vol** : espace disque (la machine de développement est à 96 %, la prod est à ≈ 60 %), empreinte du legacy relevée, sauvegarde PostgreSQL du §4.
2. **Construire la release** de l'option retenue : `rm -rf .next && npm run build` (jamais le `cp -r public` du README, qui crée `public/public/`).
3. **Migration** selon §4.
4. **Ressources de Maths** : `install-resources.ts --module suites` (empreintes vérifiées contre le manifeste d'origine).
5. **Comptes** : `provision.ts apply` en dry-run, revue du plan, puis `--execute --credentials-out` (fichier 0600 hors dépôt) ; transmettre les codes par un canal privé, détruire le fichier.
6. **Bascule de release** selon `/etc/nexus/runbooks/release-deployment.md` (release-dir, deux pointeurs, garde, `pm2 restart nexus-prod`, vérification des 5 identités).
7. **Tests de fumée** : `/api/health`, `/`, `/espace/connexion`, `/auth/signin`, connexion d'un élève et de l'enseignant, tableau de bord, un autosave réel, permissions (401 anonyme, 404 sur le travail d'autrui), ressources (sujet 200, corrigé 404 pour un élève), `/ateliers/poo/` (200), journaux applicatifs, **empreinte du legacy identique**.

## 6. Rollback

1. Rebasculer les deux pointeurs de release vers la release précédente, `pm2 restart nexus-prod`, vérification des 5 identités.
2. **Laisser les tables et colonnes en place.** Elles sont inertes sans le nouveau code et contiendront des travaux d'élèves : ne jamais les supprimer pour « revenir en arrière ».
3. Vérifier `/`, `/auth/signin`, `/ateliers/poo/`.
4. Les comptes créés restent (désactivables : `provision.ts disable --username … --execute`).
5. La sauvegarde `pg_dump` du §5.1 ne sert qu'en dernier recours et perdrait tout ce qui a été écrit depuis : ne pas l'utiliser pour un simple retour applicatif.

## 7. État de la release candidate (2026-10-03)

| Élément | Valeur |
|---|---|
| Branche | `release/espace-terminale-2026-10-03` (base `724f8982d` + espace + TP POO 2 + Maths limites) |
| Commit construit | `f50d531b6` (les commits suivants ne touchent que `e2e/`) |
| Build | clone propre hors `.worktrees`, `npm ci` + `npm run build`, `ARTIFACT VALID`, `BUILD_ID` `KIimK0kXwRPuo0Gx4koXx` |
| Tests | typecheck 0 erreur ; lint 0 ; unitaires 1 143 suites / 13 284 tests, 0 échec ; intégration vraie base : 67 suites + parent-email (Mailpit) + 3 suites NPC (harnais CI) ; E2E Chromium 19/19 (dont moteur Python réel) ; secours hors ligne 5/5 |
| Sauvegarde prod | `/var/backups/nexus-espace-20261003/nexus_prod-AVANT-espace-*.dump` (13 Mo, 0600, SHA-256 consigné, `pg_restore --list` : 1 018 entrées) |
| Migration | `20261002210000_add_espace_pedagogique` : 338 lignes, 0 instruction destructive, somme de contrôle = SHA-256 du fichier ; privilèges par défaut de `nexus_runtime` déjà en place |

### Défaut préexistant à réparer avant la bascule
Le garde de pointeur échoue **avant toute action** : `ALIAS_NOT_CHAINED` (le pointeur canonique `/var/www/nexus-project_v0` vise l'alias `/var/www/nexus-releases/current`, qui vise directement la release `724f8982d` ; le runbook exige l'inverse). Réparation sans changer la release servie : canonique → release courante, puis alias → canonique, puis garde.

### Comptes (décisions prises, liste privée hors dépôt)
Enseignant : compte COACH de l'adresse du propriétaire. Yassine : compte Terminale. Ines et Rostom : identifiant et code ajoutés **sans** consommer leur activation familiale (la session d'espace n'exige plus `activatedAt` pour un ÉLÈVE possédant un code personnel).

### Corrigés enseignant (PDF privés)
`scripts/espace/build-corriges.ts` puis `scripts/espace/install-resources.ts --module poo-structures|fonctions-limites` (dry-run par défaut).

## 8. Déroulé réel du 2026-10-03 (écarts par rapport au plan)

1. **Sauvegarde** `pg_dump -Fc` (13 Mo, 0600, SHA-256 revérifié avant migration, `pg_restore --list` : 1 018 entrées).
2. **Pointeur** : le garde échouait déjà (`ALIAS_NOT_CHAINED`, hérité du 2026-09-09). Réparation sans changer la release servie : canonique → release courante (`mv -T` atomique), puis alias → canonique ; même pid, même release, santé 200 avant/après. Le garde exige un chemin **absolu** pour `--expected-release`.
3. **Migrations historiques** : contrairement à la répétition, les trois migrations annulées (`20260808130000`, `20260824090000`, `20260830150000`) possèdent **déjà** une ligne appliquée à côté de la ligne annulée, et tous leurs effets existent en base. Rien n'a été marqué. 0 ligne « échouée ». Une migration du dépôt n'est pas en base, `20260906200000_core_family_academic_planning_expand` (déjà le cas avant ce déploiement, la release servie tourne sans) : **non appliquée, hors périmètre**, décision à prendre séparément.
4. **Migration de l'espace** : une transaction (`psql -1 -v ON_ERROR_STOP=1`) contenant le SQL versionné (somme de contrôle = SHA-256 du fichier) et l'`INSERT` dans `_prisma_migrations`. Résultat : 12 tables, 4 colonnes `users`, 5 types ; effectifs inchangés. Le CLI Prisma n'a pas pu s'authentifier en TCP (`P1000`) : l'enregistrement a donc été fait par SQL.
5. **Comptes** : tunnel SSH vers PostgreSQL, rôle d'exécution (`nexus_runtime`), `provision.ts apply --adopt --execute` : 8 créations, 6 adoptions, 13 codes dans un fichier 0600 hors dépôt. ELEVE 194 → 202.
6. **Ressources privées** : installées en préparation locale (empreintes vérifiées), copiées vers `/var/www/nexus-shared/espace/resources/` (`nexusapp:nexusapp`, 750/640), empreintes identiques.
7. **Release** : `rsync` du `standalone` construit dans un clone propre hors `.worktrees`, `.runtime` copié de la release précédente, `RELEASE_SOURCE_SHA` écrit. Bascule atomique, garde, `pm2 restart`, 5 identités concordantes ; retour arrière automatique prévu si la santé n'était pas confirmée (non déclenché).
8. **Comptes techniques de validation** `val.a`, `val.b`, `val.prof` (groupe `validation-technique`) : à désactiver après les séances (`provision.ts disable --username … --execute`).

Rollback disponible : pointeur canonique vers `/var/www/nexus-releases/724f8982d-security-2026-09-20260909T181734Z`, puis `pm2 restart nexus-prod`. Tables et colonnes de l'espace restent en place.

## 9. Déroulé du 2026-10-04 — parcours « Récursivité et programmation récursive »

Ajout d'un troisième parcours NSI (thème « Algorithmique et programmation »), sans migration de schéma.

1. **Pré-vol (lecture seule)** : pointeur canonique sur `d7f041c1c-espace-credentials-20261003T0900Z`, garde vert, aucune opération concurrente (`pm2`, `rsync`, pointeurs), disque 61 %.
2. **Build** : clone propre hors `.worktrees` du commit `a35be9fde` (`npm ci`, `npm run build`, `ARTIFACT VALID`, `BUILD_ID` `AyxLRAp0A4nhjMiwnYltB`).
3. **Release** : `/var/www/nexus-releases/a35be9fde-espace-recursivite-20261004T1512Z` (`rsync` du standalone, `.runtime` copié de la release précédente, `release-manifest.json`, `RELEASE_SOURCE_SHA`, `root:root` 755/644). `runner.py` du parcours présent dans le standalone.
4. **Corrigé privé** : `corrige.pdf` (sha256 `ecac3ad4…94d0`) installé dans `/var/www/nexus-shared/espace/resources/recursivite/` (`nexusapp`, 750/640).
5. **Miroir de catalogue** : une ligne `espace_activities` (`nsi-recursivite`, 9 étapes, `PYTHON_TP`), en une transaction (`ON CONFLICT DO NOTHING`). Les 4 lignes existantes sont inchangées. Équivalent de `provision.ts sync-activities --execute`. **Sans cette ligne, l'ouverture du parcours échoue** : à faire pour tout nouveau parcours.
6. **Bascule** : un seul pointeur (`mv -T`), garde avec `--expected-release`, `pm2 restart nexus-prod` ; retour arrière automatique prévu (non déclenché), santé 200, cinq identités concordantes (canonique, alias résolu, args PM2, cmdline, exécutable Node).
7. **Contrôles anonymes en production** : 8 pages publiques, `/espace/connexion`, `/ateliers/poo/`, `/api/health` en 200 ; `/espace/nsi/recursivite` redirige vers la connexion ; corrigé et aperçu enseignant en 401 ; `BUILD_ID` servi conforme ; journaux sans erreur ; empreinte du legacy POO inchangée (`dd6c60e9…`).
8. **Fumée authentifiée en production : NON exécutée** — la création de comptes techniques de validation en base de production a été refusée par le garde-fou de la session (voir le rapport d'audit). Spec prête : `e2e/prod/espace-prod-recursivite.spec.ts` (validée 5/5 sur la pile locale).

Rollback : pointeur canonique vers `/var/www/nexus-releases/d7f041c1c-espace-credentials-20261003T0900Z`, garde, `pm2 restart nexus-prod`. La ligne `espace_activities` et le PDF restent en place (inertes sans le code).

## 10. Clôture du parcours Récursivité — 2026-10-04 (soir)

Aucun compte réel recréé ni reprovisionné ; aucun travail réel modifié (empreintes SQL avant/après identiques : 12 travaux, 106 versions, 14 comptes réels).

- **Release finale** : `/var/www/nexus-releases/cabf20ce1-espace-recursivite-cloture-20261004T1718Z`, `BUILD_ID` `xn0iUwo3EQGN24uuPiQLq`, source = commit `cabf20ce1` (`RELEASE_SOURCE_SHA`). Précédente saine : `a35be9fde-espace-recursivite-20261004T1512Z` (`BUILD_ID` `AyxLRAp0A4nhjMiwnYltB`). Avant Récursivité : `d7f041c1c-espace-credentials-20261003T0900Z`. Les deux ont passé `switch-release.sh --check` ; aucun écart de schéma Prisma entre `d7f041c1c` et `cabf20ce1`.
- **Pourquoi une seconde release** : la première n'était pas alignée sur ce qui devait être servi — détection « récursive » durcie (appels imbriqués exigés), limite de 200 appels présentée comme limite du bac à sable Nexus (jamais comme propriété de Python), terminaison contrôlée à 60 (la récursion indirecte consomme deux cadres par niveau). Les commits `643acca16` (premier lot) ne contenaient que documentation et tests.
- **Bascule** : `switch-release.sh` — verrou `flock` sur `/var/lock/nexus-production-deploy.lock`, compare-and-swap (`--expected-current`), garde, santé 200, cinq identités concordantes. Les cas `CAS_MISMATCH` et `LOCK_BUSY` ont été exercés sans effet sur le pointeur.
- **Corrigé privé** remplacé (ancien conservé : `corrige.pdf.avant-20261004`, non servi).
- **Catalogue ↔ base** : 5 activités, aucun écart (équivalent SQL lecture seule de `audit-activities`). La ligne insérée à la main correspond donc à la source canonique ; plus aucun INSERT manuel : `provision.ts audit-activities` puis `sync-activities`.
- **Fumée authentifiée de production** (comptes techniques existants `val.b`, `val.d`, `val.p`, `val.prof`, réactivés puis refermés ; sessions révoquées, connexion refusée 4/4) : `e2e/prod/espace-prod-recursivite.spec.ts` 8/8 (Pyodide réel : programme erroné lisible, solution à boucle refusée, `RecursionError` du bac à sable, non-terminaison interrompue puis interface récupérée, solution validée ; autosave, rafraîchissement, remise ; correction, compétence, « À reprendre », retour élève ; RBAC croisé, anonyme, élève sur routes enseignant, corrigé PDF). Compte enseignant réel `alaeddine` (lecture seule) : `espace-prod-teacher.spec.ts` 2/2 (13 élèves, Récursivité et 4 corrigés dont `nsi-recursivite`). Élève réel NSI : connexion et tableau de bord seulement (thème « Algorithmique et programmation » visible), activité non ouverte.
- **Plan de secours hors ligne** : `~/Documents/Nexus_Conservation/espace-terminale-fallback/` (TP POO 2, Récursivité, Maths) ; l'ancien dossier `urgence-seances-2026-10-03/` est conservé tel quel.
- **Source** : la branche locale `feat/espace-recursivite` contient, dans son historique brut, des noms de famille d'élèves mineurs : elle n'est **pas** publiable. La branche `release/espace-recursivite-2026-10-04` est reconstruite sur l'instantané anonymisé `cf35f3853` (arbre identique au HEAD local, aucune occurrence de nom). Sa publication distante reste à faire par le propriétaire.

## 11. Clôture d'ingénierie — 2026-10-04 (nuit)

**Release servie** : `/var/www/nexus-releases/e8a81cba0-espace-validation-scope-20261004T1827Z`, `BUILD_ID` `Q83ltYG_UJ8P1SV6vt8qZ`, source `e8a81cba0e693c48c20c6edfa10ef2911ff48c18` (`RELEASE_SOURCE_SHA`, `release-manifest.json` et arbre git concordent). Précédente saine (rollback) : `cabf20ce1-espace-recursivite-cloture-20261004T1718Z` (`BUILD_ID` `xn0iUwo3EQGN24uuPiQLq`), puis `a35be9fde-…` et `d7f041c1c-…` ; aucun écart de schéma Prisma entre `cabf20ce1` et `e8a81cba0` (0 ligne). Pourquoi une nouvelle release : un correctif runtime réel (point suivant).

- **Comptes de validation exclus des vues d'ensemble d'un ADMIN** (`lib/espace/validation.ts`). Constat : un enseignant réel (COACH) ne les voyait déjà pas (périmètre = ses affectations ; vérifié en production : 13 élèves, aucune trace technique), mais un ADMIN (portée « tout ») voyait le groupe `validation-technique` dans les effectifs, la file « À corriger », l'activité récente et les séances. Mécanisme retenu : le **groupe** `validation-technique` (attribut de domaine existant), pas un préfixe d'identifiant, et sans migration (une colonne aurait exigé la procédure manuelle de migration en production, disproportionnée pour un drapeau). Option `includeValidation` pour l'audit ; accès par identifiant et export explicite inchangés. Test d'intégration rouge sur l'ancien code (5 échecs), vert sur le nouveau. Aucun CSV n'existe ; l'export JSON est ciblé (travail, élève, séance).
- **Preflight catalogue ↔ base intégré à la bascule** (`switch-release.sh`) : lecture seule, fail closed, `DEPLOYMENT_BLOCKED` (code 17) si activité absente, slug dupliqué, matière / type / module / titre / étapes / version incohérents ; **aucune mutation automatique** (correction explicite : `provision.ts sync-activities --execute`). Exécuté pour de bon avant cette bascule : `CATALOGUE_DB_SYNC=PASS (5 activités)`. Au premier essai réel, le script s'est arrêté en silence après le preflight : `docker exec -i` avalait la suite du script lu sur l'entrée standard (`ssh … bash -s`). Aucune bascule n'avait eu lieu. Corrigé (stdin fermé), mode `--preflight-only` ajouté, régression testée avec un faux `docker` qui lit stdin.
- **Voie de tests lourde déterministe** : `npc-storage-contract` construit un Program TypeScript complet (3,4 Go résidents, ≈ 50 s) ; sous le pool parallèle par défaut (jusqu'à 15 workers, cgroup mémoire déjà en OOM sur cette machine) son worker était tué par SIGTERM. Désormais `npm run test:unit:heavy` (un worker, assertions et délai inchangés), ignorée par `test:unit`, étape CI dédiée ; 3 tentatives groupées sans plantage + exécutions répétées de la voie lourde.
- **Delta 13 505 → 13 498** : aucun test supprimé. 13 505 = 13 482 (suites exécutées) + 23 (`npc-storage-contract` quand son worker survivait) ; 13 498 = 13 505 − 23 (worker tué) + 16 tests ajoutés (+6 harnais Python, +5 trace hors ligne, +4 plan de secours, +1 correction). Après les ajouts de la clôture (+20 tests du preflight) : voie parallèle 1 149 suites / 13 518 tests (deux exécutions identiques) + voie lourde 23 tests (cinq exécutions) = 13 541 tests, 0 échec, 0 sauté, 0 todo.
- **Fumée de production authentifiée (release finale)** : Récursivité 8/8 (paire d'élèves neuve) ; identifiants 5/5 — changement autonome du code d'un élève (ancien refusé, nouveau accepté), réinitialisation par l'enseignant (code temporaire, changement obligatoire), changement du mot de passe d'un enseignant technique, plus lecture seule de « Mon compte » du compte réel ; enseignant réel 3/3 (13 élèves exactement, aucun compte technique visible nulle part : liste, file « À corriger » alors que 2 travaux techniques y sont remis, accueil de chacune des 5 activités, effectifs de l'API, séances). Comptes techniques `val.*` : réactivés par SQL côté serveur (hashes calculés en local), tous refermés (0 actif, sessions révoquées, connexion refusée 6/6 pour les comptes dont le code est connu). Empreintes des données réelles identiques avant/après (12 travaux, 106 versions, 14 comptes).
- **Limiteur de connexion** : 5 essais / 15 min par identifiant, succès compris. Une campagne exige donc des comptes techniques frais (ou 15 min d'attente) ; deux échecs de fumée de cette soirée (en production comme en local) n'avaient pas d'autre cause.
- **Source** : branche publiable `release/espace-recursivite-2026-10-04` (historique anonymisé ; tête indiquée dans le rapport de session). `git push` refusé par le garde-fou de la session (« Data Exfiltration » puis refus sans motif) : à exécuter par le propriétaire. Aucun nom d'élève, secret, DOCX, `.env`, dump, ni fichier de `Nexus_Conservation` dans l'historique publié (contrôle sur l'arbre et sur les diffs). Tag annoté local : `espace-recursivite-production-20261004` (convention `<sujet>-production-<date>`), non publié.
