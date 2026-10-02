# Espace pédagogique — plan de déploiement en production

> **Statut : non déployé.** Rien n'a été modifié en production par cette mission, hormis la création d'une archive de sauvegarde du legacy POO (répertoire nouveau, voir `docs/legacy-poo/LEGACY_POO_INVENTORY.md`). Ce document décrit ce qui a été vérifié, ce qui reste à décider, et la séquence à suivre si tu donnes le feu vert.

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
| Ines BEN YAHIA | 1 compte, TERMINALE, **activation familiale en attente** | décision : adopter avec `activatePending: true` (le lien d'activation envoyé à la famille ne fonctionnera plus), ou créer un compte séparé |
| Rostom FEKIH | 1 compte, TERMINALE, **activation familiale en attente** | idem |
| Malek SMIDA | 1 compte, PREMIÈRE, activé | adopter (`--adopt`) |
| Sarra BSIRI | 1 compte, PREMIÈRE, activé | adopter (`--adopt`) |
| Yassine BEN HASSINE | **2 comptes** : `…up8cgk` (TERMINALE, en attente d'activation, 2026-08-14) ; `…afghb6` (PREMIÈRE, activé, 2 affectations coach, 2026-05-01) | choisir (`matchUserId`) ; `…up8cgk` correspond à l'année en cours mais est en attente d'activation |
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
