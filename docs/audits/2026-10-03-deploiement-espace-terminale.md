# Déploiement de l'espace pédagogique Terminale — rapport

## Date

2026-10-03

## Contexte

Mise en production de l'espace pédagogique (connexion identifiant + code, TP POO 1 et 2, Maths Suites et Fonctions/limites, espace enseignant) sur la release de production `724f8982d`, pour les séances du 3 octobre 2026. Plan et procédure : `docs/espace/DEPLOIEMENT.md` (§7 et §8).

## Problèmes observés

1. Garde de pointeur de release déjà en échec avant l'opération (`ALIAS_NOT_CHAINED`).
2. Les trois migrations historiques « annulées » possèdent en réalité une ligne appliquée ; la procédure de répétition ne s'appliquait pas. `20260906200000_core_family_academic_planning_expand` n'est pas appliquée en base (état antérieur, hors périmètre).
3. L'accueil enseignant s'ouvrait toujours sur le TP POO 1 et les onglets POO 1 / POO 2 portaient le même libellé (corrigé pendant la campagne de fumée, `19810d3fa`).
4. `GET /api/auth/providers` répond 500 à la sonde de supervision (288/288 la veille du déploiement) : préexistant, non traité.
5. 11 envois d'e-mails en échec final (`EMAIL_OUTBOX_ATTENTION_REQUIRED`) : préexistant, non traité.

## Décisions prises

Release de production + espace (delta minimal). Migration additive en une transaction avec enregistrement Prisma. Comptes : Alaeddine sur le compte COACH de son adresse ; Yassine sur le compte Terminale ; Sarra et Malek adoptés ; Ines et Rostom reçoivent identifiant et code sans consommer l'activation familiale. Comptes de validation techniques isolés (groupe `validation-technique`), désactivés après les tests.

## Fichiers modifiés

Branche `release/espace-terminale-2026-10-03` : espace (`lib/espace`, `app/espace`, `app/api/espace`, `components/espace`), contenus (`content/espace/**`), outillage (`scripts/espace/**`), tests, documentation. Garde de confidentialité des évaluations porté depuis `main`.

## Tests exécutés

| Contrôle | Résultat |
|---|---|
| typecheck | 0 erreur |
| lint | 0 alerte |
| unitaires (`jest.unit.config.js`, commit final de la branche) | 1 143 suites / 13 284 tests, 0 échec |
| intégration, vraie base (67 suites + parent-email avec Mailpit + 3 suites NPC par le harnais CI) | vert ; suites `espace-*` : 5 / 110 tests |
| E2E Chromium sur le build déployé (`espace-terminale` + `espace-lecons`) | 19 / 19 |
| secours hors ligne | 5 / 5 |
| garde de dette de test | 0 test sauté, 0 quarantaine |
| fumée de production (`playwright.prod-smoke.config.ts`) | 11 / 11 |

## Résultats

- Release servie : `19810d3fa-espace-terminale-20261003T0830Z`, `BUILD_ID` `8f7WPZDKuf0xmdgqFm74g`, Node 22.23.1 embarqué, cinq identités concordantes, garde vert.
- Migration `20261002210000_add_espace_pedagogique` : 12 tables, 4 colonnes `users`, 5 types ; effectifs d'utilisateurs inchangés avant provisioning (ADMIN 1, COACH 20, ELEVE 194), puis ELEVE 202.
- Provisioning : 8 créations, 6 adoptions, 13 codes dans un fichier 0600 hors dépôt ; les 13 élèves se connectent et voient les bonnes matières.
- Production : TP POO 2 (Python Pyodide réel : échec d'une ébauche vide, succès de la solution de référence, autosave, reprise, étape courante restaurée), Maths Fonctions/limites (formules, graphique, vérifications de g(x) = (2x+1)/(x−1), asymptotes x = 1 et y = 2, g'(0) = −3, tangente y = −3x − 1, retour ciblé sur une erreur, autosave, reprise), remise, parcours enseignant (suivi, relecture, commentaire, À reprendre), retour élève, isolation entre élèves (API et pages), corrigés refusés à l'élève (404) et servis à l'enseignant (PDF).
- Aucun travail créé pour un vrai élève pendant les tests.
- Legacy POO : empreinte SHA-256 de `traces.sqlite3` identique (`dd6c60e9…`), 0 dépôt, service actif, `/ateliers/poo/` 200.

## Risques restants

- Le compte réel `alaeddine` n'a pas été exercé avec son mot de passe (inconnu de l'opérateur) ; le même rôle l'a été avec un compte COACH technique.
- Les corrigés enseignant sont des PDF privés servis par l'application ; le dossier de secours garde une copie hors du dossier servi.
- Les comptes techniques `val.*` sont désactivés, non supprimés (traces conservées).
- Préexistants : sonde `/api/auth/providers` en 500, 11 e-mails en échec final, migration `core_family_academic_planning_expand` non appliquée.

## Rollback

Pointeur canonique `<APP_DIR>` vers `<RELEASES_DIR>/f50d531b6-espace-terminale-20261003T0720Z` (précédente) ou `<RELEASES_DIR>/724f8982d-security-2026-09-20260909T181734Z` (avant l'espace), garde, `pm2 restart <PM2_APP>`. Ne jamais supprimer les tables ni colonnes `espace_*`. Sauvegarde PostgreSQL : `/var/backups/nexus-espace-20261003/nexus_prod-AVANT-espace-20261002T232218Z.dump` (dernier recours).
