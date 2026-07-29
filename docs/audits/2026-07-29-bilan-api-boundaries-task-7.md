# Frontières API sécurisées du bilan — tâche 7

## Date

29 juillet 2026

## Contexte

La tâche 7 expose la première frontière API canonique du bilan gratuit. Elle
doit permettre une admission publique traçable, la reprise du dossier exact et
la sélection ou création d'un enfant sans faire confiance à une identité
fournie par le client.

## Problèmes observés

- aucune route versionnée ne présentait encore l'admission canonique ;
- le rate-limit public retombait en mémoire lorsque le backend distribué était
  absent ou indisponible en production ;
- le lien magique ne disposait que d'un quota IP, sans quota secondaire par
  adresse normalisée et hachée ;
- le jeton de lien magique initial créé avec la demande n'était pas encore
  remis à la couche de composition email ;
- la reprise sur un autre appareil nécessitait une autorité liée à la demande,
  sans recherche du « dernier dossier » d'un parent ;
- la sélection d'enfant devait traiter distinctement le parent authentifié par
  lien magique et le parent déjà connecté disposant du cookie de parcours exact.

## Décisions prises

- ajout de `POST /api/bilan-gratuit/v1/requests`, avec schéma strict,
  idempotency key bornée en en-tête, CSRF, taille maximale, honeypot neutre et
  cookie `nr_bf_s` HttpOnly uniquement lors d'une création non rejouée ;
- envoi best-effort du lien magique initial avec le template sécurisé existant.
  Une panne SMTP ne modifie ni la réponse publique ni les logs et le renouvellement
  reste disponible par la route de tâche 6 ;
- délégation de `/api/bilan-gratuit` vers la v1 seulement lorsque
  `BILAN_CANONICAL_INTAKE_ENABLED` est actif. Le chemin historique reste inchangé
  lorsque le flag est désactivé ;
- ajout d'un mode `requireDistributed` au rate-limit asynchrone. En production,
  l'absence ou la panne du backend distribué produit un contrat 503 stable et
  sobre, sans fallback mémoire ;
- application du mode fail-closed à l'admission v1, à l'admission compatible et
  à la demande de lien magique ;
- ajout d'un second quota de lien magique par
  `hashForKey(emailNormalisé)`. Aucune adresse brute n'entre dans la clé ;
- ajout de `GET /api/bilan-gratuit/v1/requests/current`, lié soit au cookie exact,
  soit au claim Auth.js `bilanRequestId` émis lors de la consommation du lien.
  Aucun dossier n'est recherché par email ou par récence ;
- ajout de `POST .../current/child`, avec schéma discriminé strict et identité
  parent/demande dérivée exclusivement de la session, du claim ou du cookie
  serveur ;
- le parent déjà connecté peut utiliser son cookie de parcours exact. La
  vérification `VERIFICATION_PENDING → VERIFIED`, l'événement
  `ACCOUNT_VERIFIED/EXISTING_SESSION`, l'attachement et l'événement enfant sont
  réalisés dans la même transaction `Serializable` ;
- le hash du flow cookie est revalidé dans le prédicat transactionnel et dans
  l'update conditionnel. Une révocation ou expiration entre la résolution de
  route et la transaction échoue donc fermée ;
- la sélection d'un enfant existant exige exactement un
  `ParentStudentLink` `VERIFIED`, non révoqué et non expiré. La création produit
  un compte enfant inactif avec adresse interne opaque et un lien canonique
  vérifié ;
- toutes les mutations conditionnelles contrôlent `count === 1` et les conflits
  `P2034` sont rejoués au maximum trois fois.

## Fichiers modifiés

- `app/api/bilan-gratuit/route.ts`
- `app/api/bilan-gratuit/v1/requests/route.ts`
- `app/api/bilan-gratuit/v1/requests/current/route.ts`
- `app/api/bilan-gratuit/v1/requests/current/child/route.ts`
- `app/api/auth/bilan-magic/request/route.ts`
- `lib/rate-limit/index.ts`
- `lib/bilans/requests/access.ts`
- `lib/bilans/requests/attach-child.ts`
- `lib/bilans/requests/schemas.ts`
- `lib/bilans/auth/consume-magic-link.ts`
- `auth.config.ts`
- `types/next-auth.d.ts`
- tests API, domaine, authentification, rate-limit et PostgreSQL associés.

## Tests exécutés

- RED initial : 4 suites en échec attendu, routes v1 et mode
  `requireDistributed` absents ; 16 tests préexistants passaient.
- RED lien initial : 1 test en échec attendu, aucun email envoyé.
- RED parent connecté : 2 tests en échec attendu, session sans claim refusée et
  demande encore non vérifiée.
- RED TOCTOU : 3 tests en échec attendu, seul un booléen quittait la route.
- GREEN ciblé final : 16 suites, 281 tests réussis.
- PostgreSQL réel : 9 scénarios réussis, dont rejeu concurrent, rollback,
  création concurrente d'enfant, parent déjà connecté et flow révoqué.
- `npm run typecheck` : réussi.
- `npm run lint` : réussi, avertissements historiques uniquement.
- `npm run security:repo` : réussi.
- `git diff --check` : réussi.

## Résultats

- aucun identifiant de demande, d'enfant, token brut ou PII n'est exposé dans
  les réponses publiques ajoutées ;
- la session temporaire seule ne peut jamais sélectionner un enfant ;
- les demandes absentes, expirées, révoquées et étrangères partagent des refus
  non énumérables ;
- le rate-limit distribué est désormais une dépendance obligatoire en
  production sur les écritures publiques bilans concernées ;
- aucun déploiement, push ou feature flag n'a été effectué.

## Risques restants

- l'envoi parent initial reste SMTP best-effort. La tâche 8 doit le rendre
  durable ; en attendant, la route de renouvellement de tâche 6 permet de
  demander un nouveau lien ;
- le rate-limit distribué doit être effectivement configuré et supervisé avant
  activation du flag, sinon les routes protégées renverront volontairement 503 ;
- l'endpoint canonique de soumission appartient à la tâche 11 et devra utiliser
  lui aussi `requireDistributed: true`.

## Rollback

Laisser `BILAN_CANONICAL_INTAKE_ENABLED` désactivé conserve le chemin historique.
Le rollback code consiste à retirer les routes v1, le claim de demande et le
mode `requireDistributed`, puis à restaurer les trois appels de rate-limit. Ne
pas supprimer les demandes ou événements déjà créés : ils constituent la trace
canonique.
