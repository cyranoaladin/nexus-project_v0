# Clôture de préparation de release — lot go-live 2026-10 (PR #337)

Date : 2026-10-05. Base de mesure : `4a0dfb6e6…` (+ commits de clôture). Statut : NOT_READY, PR Draft.
Nomenclature des lots : A frontière Core-v2 · B E2E Auth/dialogue · C dépendances/OSV · D confidentialité des logs.

## Répétition des migrations — MIGRATION_REHEARSAL_SYNTHETIC=PASS

Protocole : bases jetables marquées (`NEXUS_DISPOSABLE_REHEARSAL`), ancien schéma = migrations de `main`
(124 legacy + 22 Core v2), données synthétiques sans aucune PII, garde port/nom/marqueur refusant tout
PostgreSQL hors banc (5432 inclus). Rejoué sur PostgreSQL 13, 15 et 16.

- `prisma migrate deploy` : vert, seconde exécution idempotente (« No pending migrations »).
- Comptages des tables préexistantes strictement identiques avant/après ; 0 contrainte supprimée
  (les `DROP CONSTRAINT` des migrations factures/outbox sont des remplacements de CHECK recréés dans la
  même transaction) ; 0 contrainte non validée en sortie.
- Dérive `migrate diff` identique avant/après le lot (les 45 lignes de dérive préexistent sur `main`) ;
  côté Core v2 : migration vide.
- Durées : ≤ 45 ms par migration à petite échelle ; à 250× (10 000 users / 7 500 factures /
  10 000 stage_sessions) : 763 ms max (index d'exclusion gist). Écrivain concurrent pendant le lot :
  0 erreur, p99 4,9 ms, pic 752 ms ; les migrations récentes posent `lock_timeout='5s'`.
- Interruption dure (backend tué en plein `CREATE TABLE`) : rollback atomique, reprise par
  `migrate resolve --rolled-back` ; échec sous verrou concurrent : fail-fast ~6 s, même reprise.
- Hazard de production reproduit (3 migrations marquées rolled back avec effets déjà présents) :
  `deploy` échoue P3018 avant toute nouvelle migration ; sortie sûre `resolve --applied` ×3 —
  procédure détaillée : `docs/runbooks/migrate-resolve-applied-2026-10.md`.
- Compatibilité fenêtre de bascule : les écritures aux formes de l'ancienne application passent sur le
  schéma migré ; nouvelles colonnes NULL (`invoices.payerUserId`, `subscription_requests.requestedByUserId`),
  `household_parents` restent `PENDING` (fail-closed voulu).
- Pré-vol lecture seule versionné : `scripts/db/preflight-2026-10-go-live.sh` (PASS sur état conforme,
  FAIL sur violations synthétiques, écriture refusée par `default_transaction_read_only`).

**Limites** : `PRODUCTION_COMPATIBILITY=UNPROVEN` tant que la version PostgreSQL réelle de production
n'est pas prouvée. Constat annexe : sur PostgreSQL 17, une migration de `main` d'août 2026
(`20260813100000_add_household_name_key_index`) échoue sur base vide (`nexus_normalize_name_part`
absente au moment de l'index) — sans effet sur une production en PG ≤ 16, bloquant pour un futur saut PG17.

## Sauvegarde / restauration

Drill local : dump custom → chiffrement GPG AES256 (artefact opaque, mauvaise passphrase refusée,
round-trip identique bit à bit) → restauration dans des bases isolées neuves : 126/126 tables aux
comptages identiques, contraintes/triggers identiques, trigger append-only actif, FK saines,
`prisma migrate status` propre. Preuve d'outillage uniquement : la **restauration d'une sauvegarde
réelle reste un gate ouvert**, et la chaîne historique vers la StorageBox transfère des dumps **non
chiffrés avant dépôt** (bloqueur opérationnel ; cible : dump → chiffrement local → transfert →
vérification distante → rétention, clé hors dépôt/logs/ligne de commande).

## Sécurité

- CodeQL : 0 alerte ouverte sur la PR ; les 21 alertes ouvertes de `main` sont toutes `fixed` sur le
  head de la PR (vérifié instance par instance, code relu pour les alertes de production). La dismissal
  historique de l'alerte #114 (« used in tests » sur `lib/email/outbox.ts`) est mal motivée mais
  l'instance est corrigée ; à faire attester en revue.
- GitGuardian : conclusion `neutral` — « Pull request too large to scan ». **Pas un succès.**
  Compensations exécutées : gitleaks sur les 216 commits (0 fuite), TruffleHog (2 résultats, faux
  positifs examinés : fixture CSRF à userinfo factice ; empreinte sha256 de provenance). Fermeture :
  relance native après ajustement contrôlé de la limite, ou dérogation humaine explicite limitée à
  cette PR et ce SHA.
- Dépendances : audit production 0 ; audit complet 5 HIGH, cause unique GHSA-vfj7-8cjw-p6xm (`braces`,
  dev-only, aucun correctif amont) sous exception approuvée (PR #336) expirant le **2026-10-10**.
  Correctif candidat prêt sur branche `security/braces-eslint-chain-removal-20261005` (PR empilée) :
  audit complet à zéro toutes sévérités, 0 paquet de production changé — intégration après revue.
- Secrets : scans verts sur l'intégralité de la plage de la PR.

## Capacité « sites et salles » (matrice n° 13) — non implémentée

Seul `stage_sessions.location` (texte libre) existe ; aucun modèle site/salle/capacité, aucun conflit
de salle. Deux options :

1. **Intégrer avant go-live complet** : modèles Site/Salle + capacité + statut + archivage, affectation
   aux séances, conflits salle/coach/groupe sous contrôle transactionnel (index d'exclusion, comme le
   lot coach), RBAC, audit, UI responsive, tests positifs/négatifs/concurrents. Estimation : 3 à 5 jours
   de travail équivalent aux lots récents, nouvelle surface de revue significative, nouvelles migrations
   (additives). Risque : retarde la fermeture de #337 déjà volumineuse.
2. **Pilote limité (`LIMITED_PILOT_READY`)** : module explicitement absent/désactivé, planification sur
   le champ `location` actuel, capacité portée dans une PR dédiée post-fusion (étape B du programme).
   Risque résiduel : gestion logistique manuelle pendant le pilote. Nécessite un accord humain explicite
   et ne peut pas être présenté comme un go-live complet.

## Critères go/no-go (rappel des gates ouverts)

CI complète verte sur le SHA final · GitGuardian fermé (PASS ou dérogation humaine) · revue humaine
indépendante du SHA exact · version PostgreSQL de production prouvée + préflight PASS sur la vraie base ·
restauration d'une sauvegarde réelle exercée · chaîne de sauvegarde chiffrée · rollback applicatif exercé
en préproduction · rotation/révocation TLS historique · rétention/effacement validés · arbitrage des
droits financiers familiaux · paiements et notifications qualifiés en sandbox · décision sites/salles ·
exception `braces` non expirée ou remplacée.
