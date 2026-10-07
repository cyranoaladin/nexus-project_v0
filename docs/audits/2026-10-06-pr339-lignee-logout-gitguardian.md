# PR #339 — preuve de lignée, déconnexion déterministe, analyse GitGuardian

## Date

2026-10-06

## Contexte

La PR #339 réintègre dans `main` la lignée de l'Espace pédagogique servie en production
(`e8a81cba0`). Le contre-ordre du 06/10 exige, **avant** toute fusion : la preuve de lignée et de
concordance des migrations, la correction du test de déconnexion instable, l'analyse individuelle
des six incidents GitGuardian et le registre des specs manuelles.

## Preuve de lignée (HEAD `443102c9350fdc9cc8d862c489e51022c9c3bede`, avant ce correctif)

```text
PRODUCTION_SHA=e8a81cba0e693c48c20c6edfa10ef2911ff48c18   (RELEASE_SOURCE_SHA lu en production, lecture seule)
PRODUCTION_SHA_IS_ANCESTOR_OF_PR339_HEAD=YES
PRODUCTION_TAG_TARGET_MATCH=YES   espace-recursivite-production-20261004 (objet 46d41bf14) -> e8a81cba0, local = distant
MERGE_BASE(main, HEAD)=5ffd4dd8e1fb91b0eea42398670a260402660699 (= origin/main)
```

Graphe simplifié :

```text
724f8982d (release sécurité, base commune)
 ├─ … main … 5ffd4dd8e ─────────────────────────────┐
 └─ cf35f3853 ─ cabf20ce1 ─ 30fc45aad ─ e8a81cba0 (servi, tag)
                                          └─ bd2023e94 ─ 196a014fd ─ 2107e850c (tête release/espace-recursivite-2026-10-04)
                                                                       └─ 3ded5bd18 (fusion dans #339) ─ … ─ HEAD #339
```

- Commits de la lignée absents de `main`, réintégrés : `cf35f3853`, `cabf20ce1`, `30fc45aad`,
  `e8a81cba0`, plus les trois commits postérieurs `bd2023e94`, `196a014fd`, `2107e850c` (aucun
  changement de code applicatif ; retrait d'une fixture égale à un vrai mot de passe, scanner de
  secrets renforcé, documentation).
- Commits de la branche de release non réintégrés : **aucun** (`git rev-list HEAD..origin/release/espace-recursivite-2026-10-04` = 0).
- Fichiers : les 198 fichiers Espace ajoutés ou modifiés par la lignée sont tous présents au HEAD.
  12 diffèrent du code servi, uniquement des tests, de la documentation, les 4 specs `e2e/prod`
  (lecture différée des identifiants) et `scripts/espace/switch-release.sh` (topologie paramétrée).
  Aucun fichier de `app/`, `lib/`, `components/` ou `prisma/` ne diffère.
- `lib/auth/espace-authorize.ts` : identique à la production, importé par `auth.ts:5` et appelé par le
  fournisseur `espace` (`auth.ts:74`).
- Build CI de `443102c93` (run 37453156380, job Production Build) : 41 routes Espace (`/espace/**`,
  `/api/espace/**`).

## Migrations (journal de production lu en `default_transaction_read_only`)

| Migration | sha256 HEAD #339 | `_prisma_migrations` prod | État | Appliquée | Historique du fichier |
|---|---|---|---|---|---|
| `20261002210000_add_espace_pedagogique` | `2cd3a9745f727a52…` | identique | terminée, non annulée, 1 étape | 2026-10-03 05:07 | un seul commit (`cf35f3853`) |
| `20261003100000_add_espace_credential_security` | `be3dd289f1bec5f9…` | identique | terminée, non annulée, 1 étape | 2026-10-03 07:03 | un seul commit (`cf35f3853`) |

Les 13 tables créées par ces deux migrations existent en production.

```text
MIGRATION_20261002210000_CHECKSUM_MATCH=YES
MIGRATION_20261003100000_CHECKSUM_MATCH=YES
PRODUCTION_MIGRATION_HISTORY_SUBSET_OF_PR339_TREE=YES par nom (107/107 migrations appliquées présentes ; 126 dans l'arbre)
                                                   106/107 par checksum
```

L'exception est **préexistante et déjà documentée** : `20260425113000_add_maths_progress_track`
(appliquée le 25/04 dans sa version `ddf0d7111`, rendue idempotente le même jour par `768d49dac`).
Le fichier est identique sur `main`, `e8a81cba0` et `724f8982d`, et les objets attendus (colonne
`track`, deux index) sont présents en production. Voir
`docs/audits/2026-09-11-prod-migration-checksum-provenance.md` (gate final de production, sans effet
sur `migrate deploy`). #339 ne l'introduit pas et ne la modifie pas. Aucun `migrate resolve` exécuté.

## Déconnexion instable : diagnostic

- Test : `e2e/auth/parent-email-onboarding.spec.ts:173` « P0-D Parent onboarding … registers,
  receives SMTP activation, authenticates Parent and preserves P0-A/B/C », Chromium, étape
  `signOutAndVerifyCookieDeletion` (`waitForURL` après le `POST /api/auth/signout`), message
  `page.waitForURL: Test timeout of 60000ms exceeded`.
- Fréquence : 5 échecs sur 24 campagnes récentes, sur plusieurs branches, dont une sans rapport avec
  l'Espace.
- Capture CI : écran « La vérification de votre session est momentanément indisponible », bouton de
  déconnexion désactivé, « Utilisateur connecté ». Le `POST signout` avait répondu 200 et effacé le
  cookie.

**Cause racine (prouvée).** Stratégie JWT : chaque `GET /api/auth/session` authentifié réémet le
cookie de session. Une lecture de session partie **avant** le clic, dont la réponse arrive **après**
le `POST signout`, réécrit le cookie. La vérification qui suit la déconnexion
(`SessionRecoveryController.runLogout`) voit une session vivante, d'où `LOGOUT_NOT_CONFIRMED`, puis
l'écran `UNAVAILABLE`. Mesure sans correctif : cookie présent et `GET /api/auth/session` renvoyant
une session à t+0, 0,5, 2 et 5 s après la déconnexion. L'utilisateur croit s'être déconnecté et
reste connecté.

Classement : **PRODUCT_BUG** (résurrection de cookie). Le test l'a révélé ; il n'était pas en cause.

**Correctif.** `lib/auth/session-cookie-renewal.ts`, appliqué au handler `GET` de l'API
d'authentification (le `POST`, qui porte la connexion et la mise à jour de session, n'est pas
modifié) : le `Set-Cookie` qui réécrit un jeton de session non vide est retiré, mais les
suppressions (révocation, retrait normal) passent. Toutes les connexions sont des `POST`
(fournisseurs d'identifiants uniquement, verrouillé par un test sur `auth.ts`). C'est la même règle que `middleware.ts` applique déjà aux
routes de pages. Conséquence assumée : la session dure le `maxAge` d'Auth.js (30 jours) à partir de la
connexion, au lieu de glisser à chaque lecture. Aucun retry, délai, skip ni assertion affaiblie.

**RED / GREEN.**
- Unitaire, vrai handler Auth.js (`__tests__/auth/session-handler-protocol.test.ts`, « a valid
  session read never re-issues the session cookie ») : RED sans correctif, GREEN avec.
- E2E déterministe (`e2e/auth/logout-session-resurrection.spec.ts`, la réponse d'une lecture de
  session émise avant le clic est retenue puis livrée après le `POST signout`) : build sans correctif
  → échec avec la signature exacte de la CI ; build avec correctif → succès. Seul
  `app/api/auth/[...nextauth]/route.ts` diffère entre les deux builds.
- Le test vérifie aussi le retour arrière (aucun contenu privé restauré), la ré-entrée directe
  refusée et la session serveur absente. Il est ajouté aux projets Firefox, WebKit et mobile.

## GitGuardian : analyse individuelle (valeurs non reproduites)

Détecteur : « Generic Password » pour les six incidents. Ce détecteur n'a pas de vérification de
validité. Les formes sont données en longueur et classes de caractères (A majuscule, a minuscule,
9 chiffre, # autre) ; aucune empreinte de hachage n'est publiée.

| Incident | Commit | Fichier : ligne | Usage | Forme | Réel / fictif | Vérification | Décision |
|---|---|---|---|---|---|---|---|
| 37864127 | `cf35f3853` | `credential-rules.test.ts:50` | Exemple de mot de passe enseignant accepté | 27 [Aa9#] | **RÉEL** : égal au mot de passe enseignant de l'époque | Retiré du HEAD par `196a014fd` ; mot de passe changé, ancien refusé en production (`OLD_PASSWORD_CURRENTLY_VALID=NO`, bloc de clôture dans `docs/audits/2026-10-04-parcours-recursivite.md`, contexte dans `docs/espace/DEPLOIEMENT.md` §12) ; reste dans l'historique publié (réécriture exclue) | **Vrai positif révoqué**, jamais « identifiant de test » |
| 37864126 | `cf35f3853` | `credential-rules.test.ts:60` | Mot de passe à refuser | 9 [Aa9] | Fictif | Présent au HEAD ; uniquement en tests | Identifiant de test |
| 37864129 | `cf35f3853` | `credential-rules.test.ts:65` | Mot de passe à refuser (contient une information publique) | 19 [a#] | Fictif | Idem | Identifiant de test |
| 37864128 | `3ded5bd18` | `espace-credentials.real.test.ts:122` | Liste de mots de passe faibles (`it.each`) et titre du test | 6 [9], 8 [a], 4 [a9], 3 [a], 3 [#], 28 [a#] | Fictif ; deux valeurs sont des mots de passe universellement connus | Base jetable uniquement | Identifiant de test |
| 37864130 | `3ded5bd18` | `espace-credentials.real.test.ts:262` | Valeurs qui ne doivent jamais apparaître dans les journaux | 11 [Aa9], 9 [a9#] | Fictif | Base jetable uniquement | Identifiant de test |
| 37864373 | `2107e850c` | `versioned-credential-scan.test.ts:140` | Fixture du test du scanner de secrets (= valeur de remplacement synthétique de l'incident) | 25 [Aa9#] | Fictif | Présent au HEAD ; uniquement en tests | Identifiant de test |

Contrôles effectués pour les cinq fictifs (`git grep` sur tout l'arbre) : les deux valeurs
universellement connues apparaissent partout comme mots courants (messages, validations, workflows) ;
les autres n'existent que dans `__tests__/` et, pour une seule d'entre elles, dans
`e2e/auth/espace-credentials.spec.ts` (pile jetable). Aucune dans `e2e/prod/`, les runbooks, les
scripts de seed ou de bascule.

Non vérifiable par l'agent : la comparaison avec les secrets réels hors dépôt. Commande à exécuter
par le propriétaire :
`NEXUS_PRIVATE_SECRETS_FILES=<fichiers> node scripts/security/check-versioned-credentials.mjs`.

Fixtures : les valeurs sont nécessaires aux tests de robustesse des mots de passe et ne sont pas
dégradées. Le check GitGuardian scanne chaque commit de la PR : modifier le HEAD ne le rendrait pas
vert. Le classement se fait incident par incident dans le tableau de bord, par le propriétaire.

## Specs manuelles

Registre : `docs/qa/manual-e2e-registry.md` (5 specs, propriétaires, fréquence, preuves, écarts).

## Fichiers modifiés

- `lib/auth/session-cookie-renewal.ts` (nouveau), `app/api/auth/[...nextauth]/route.ts`
- `__tests__/lib/auth/session-cookie-renewal.test.ts` (nouveau), `__tests__/auth/session-handler-protocol.test.ts`
- `e2e/auth/logout-session-resurrection.spec.ts` (nouveau), `playwright.auth.config.ts` (projets Firefox, WebKit et mobile)
- `docs/qa/manual-e2e-registry.md` (nouveau), `scripts/testing/e2e-ownership.mjs` (renvoi au registre)
- ce document

## Tests exécutés

Voir le rapport de la PR (répétitions, suites unitaires, campagne CI du nouveau SHA).

## Risques restants

- Sessions non glissantes : expiration 30 jours après la connexion.
- Un jeton copié avant la déconnexion reste valide jusqu'à son expiration (propriété de la stratégie
  JWT sans liste de révocation, préexistante). La révocation à la déconnexion (incrément de
  `sessionVersion`) fermerait ce point, mais déconnecterait tous les appareils de l'utilisateur :
  c'est une décision produit.
- Fumées de production en écriture sur des comptes techniques (voir le registre).

## Rollback

Retirer `withoutSessionCookieRenewal` de `app/api/auth/[...nextauth]/route.ts` rétablit le
comportement antérieur, sans migration ni donnée à reprendre.
