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
- la première projection de reprise réutilisait une sélection interne sûre pour
  la base, mais exposait encore des identifiants techniques dans la réponse ;
- le contrôle de taille initial utilisait `Content-Length`, qui peut être absent
  ou sous-déclaré alors que le proxy accepte des corps sensiblement plus grands ;
- la première entrée de `X-Forwarded-For` était contrôlable par le client avec
  la configuration nginx actuelle utilisant `$proxy_add_x_forwarded_for`.
- même sans identifiants bruts, la première projection temporaire révélait par
  `hasChild`, `status` et `accountVerificationState` si l'email appartenait à un
  parent existant, à un nouveau parent ou à un compte d'un autre rôle.
- l'étape temporaire « vérifier le compte parent » rendait implicitement l'email
  bloquant, alors que le diagnostic doit pouvoir commencer immédiatement et en
  parallèle de cette vérification ;
- sur le même appareil après consommation du lien magique, la présence du
  cookie forçait encore la projection temporaire malgré un claim familial
  vérifié portant exactement la même demande.
- l'URL v1 directe acceptait encore une admission lorsque le flag canonique
  était désactivé, ce qui contournait le rollback prévu par la route compatible ;
- les honeypots vides, présents dans la forme publique courante, n'étaient pas
  remplis mais restaient des champs inconnus pour le schéma strict ;
- Redis ou Upstash pouvaient suspendre indéfiniment une écriture publique malgré
  le mode distribué fail-closed.

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
- l'URL v1 directe applique le même flag avant CSRF, taille, rate-limit,
  persistance ou email et répond 404 lorsqu'il est désactivé. Les routes de
  reprise et d'association enfant restent disponibles pour les dossiers déjà
  créés ;
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

### Correctifs issus de la revue de sécurité

- la reprise `TEMPORARY_FLOW` passe désormais par un contrat constant limité à
  « reprise disponible », « évaluation » et « vérification du compte requise ».
  L'évaluation reste donc immédiate et la vérification se poursuit en parallèle.
  Ce contrat ne dépend d'aucun état, rôle, lien familial ou identifiant interne ;
- après authentification, la projection `FAMILY` conserve un DTO allowlisté
  utile contenant uniquement les états métier, indicateurs et horodatages
  nécessaires. Les identifiants de demande, enfant, tentative et coach restent
  confinés à la couche d'accès ;
- lorsque le cookie exact et un claim `PARENT` vérifié désignent la même
  demande, la route promeut la requête vers `FAMILY`. Un claim absent ou portant
  une demande historique ne supplante jamais le cookie frais : la réponse reste
  temporaire et neutre. Une panne d'authentification conserve également ce
  fallback temporaire sans élargir l'accès ;
- un lecteur JSON réutilisable compte les octets réellement reçus avant tout
  parsing et interrompt la lecture au-delà de 1 Mio. `checkBodySize` reste un
  précontrôle rapide, mais ne constitue plus la limite effective ;
- cette lecture bornée couvre l'admission v1, l'association enfant, la route
  historique lorsque le flag est désactivé et la demande de lien magique. Les
  corps trop grands répondent 413 avant persistance ou email, et les JSON
  malformés répondent 400 sans journalisation de leur contenu ;
- l'identité réseau utilise la dernière IP valide ajoutée par nginx dans
  `X-Forwarded-For`, avec validation IP et bornes sur l'en-tête et le nombre
  d'entrées. Un préfixe fourni par le client ne modifie plus la clé distribuée.
- les trois champs honeypot sont inspectés puis retirés avant le schéma strict :
  une valeur remplie obtient le succès neutre sans effet, une valeur vide suit
  l'admission normale, et tout autre champ inconnu reste refusé ;
- Redis et Upstash partagent un timeout court, configurable et validé
  (`RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS`, 1 500 ms par défaut, borné entre 100 et
  10 000 ms). Upstash reçoit un signal d'annulation ; Redis borne connexion et
  commandes. Les timers sont nettoyés et `requireDistributed` reste fail-closed
  sans fallback mémoire en production.

## Fichiers modifiés

- `app/api/bilan-gratuit/route.ts`
- `app/api/bilan-gratuit/v1/requests/route.ts`
- `app/api/bilan-gratuit/v1/requests/current/route.ts`
- `app/api/bilan-gratuit/v1/requests/current/child/route.ts`
- `app/api/auth/bilan-magic/request/route.ts`
- `lib/rate-limit/index.ts`
- `lib/rate-limit/keys.ts`
- `lib/rate-limit/timeout.ts`
- `lib/rate-limit/redis-store.ts`
- `lib/rate-limit/upstash-store.ts`
- `lib/http/bounded-json.ts`
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
- RED revue sécurité : fuite de la projection publique reproduite (2 tests),
  corps réels sous-déclarés acceptés sur les quatre mutations (5 suites) et
  préfixe `X-Forwarded-For` forgé utilisé par Redis (3 tests).
- GREEN revue sécurité : DTO public, lecture JSON réellement bornée et clé
  réseau de confiance validés par leurs suites ciblées.
- GREEN ciblé initial : 16 suites, 281 tests réussis.
- GREEN final après revue : 18 suites, 311 tests réussis.
- RED oracle email : les trois variantes temporaires produisaient trois réponses
  distinctes ; GREEN : elles produisent le même contrat neutre, tandis que le
  parent authentifié reprend toujours le dossier exact via son claim serveur.
- GREEN final après neutralisation de l'oracle : 18 suites, 312 tests réussis.
- RED promotion/étape : 5 échecs ciblés reproduisaient l'absence de promotion
  familiale et l'étape email bloquante ; GREEN ciblé : 30 tests réussis.
- GREEN final après promotion exacte : 18 suites, 315 tests réussis.
- RED revue qualité finale : 8 échecs ciblés reproduisaient le contournement du
  flag, les honeypots vides rejetés et les backends distribués suspendus.
- GREEN final après revue qualité : 18 suites, 326 tests réussis.
- Revue indépendante du correctif : `APPROVE`, confiance haute, aucun constat
  critique, important ou mineur.
- PostgreSQL réel : 9 scénarios réussis, dont rejeu concurrent, rollback,
  création concurrente d'enfant, parent déjà connecté et flow révoqué.
- `npm run typecheck` : réussi.
- `npm run lint` : réussi, avertissements historiques uniquement.
- `npm run build` : réussi ; artefact standalone validé.
- `npm run security:repo` : réussi.
- `git diff --check` : réussi.
- revue production indépendante du correctif : aucun constat critique,
  important ou mineur ; verdict prêt à intégrer.
- revue indépendante fraîche de la neutralisation de l'oracle : aucun constat
  critique, important ou mineur ; verdict prêt à intégrer.
- revue indépendante fraîche de la promotion cookie/claim : aucun constat
  critique, important ou mineur ; verdict prêt à intégrer.

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

Laisser `BILAN_CANONICAL_INTAKE_ENABLED` désactivé conserve le chemin historique
sur `/api/bilan-gratuit` et fait répondre 404 à l'admission v1 directe. Les
routes GET de reprise et POST d'association enfant restent disponibles pour les
dossiers existants.
Le rollback code consiste à retirer les routes v1, le claim de demande et le
mode `requireDistributed`, puis à restaurer les trois appels de rate-limit. Ne
pas supprimer les demandes ou événements déjà créés : ils constituent la trace
canonique.
