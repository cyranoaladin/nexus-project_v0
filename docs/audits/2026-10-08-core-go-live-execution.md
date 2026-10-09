# Go-live Core — qualification du 8 octobre 2026

## Contexte et état initial

Mission : Nexus Réussite uniquement, PR #337. Aucune ouverture client autorisée par
la seule réussite de la CI. Les gates de sauvegarde/restauration, migrations,
runtime limité, artefact, approbation humaine, canari et surveillance restent obligatoires.

Vérifié le 8 octobre à 20:00–20:12 UTC :

- HEAD PR et distant : `de1c935e1afde8eb3fb2079b1d5ae70112b67983`, Draft, REVIEW_REQUIRED.
- Main : `c53729f8c6f2ea16dfd1829c15dc3bde9e5875de`.
- Worktree initial sur `9267a6853` avec modifications utilisateur ; conservé intact.
- Nouveau worktree isolé, branche `release/go-live-20261008`.
- CI candidate : run `37779634817`, SUCCESS ; tests Chromium, Firefox, WebKit et mobile verts.
- Résumé E2E : 137 fichiers suivis/collectés/exécutés, 1 099 records, zéro problème.
- GitGuardian natif NEUTRAL ; workflow scan en échec faute de secret, pas une détection.
  Présence de `GITGUARDIAN_API_KEY` vérifiée sans lecture de valeur : absent.
- Copilot a relu ce SHA ; aucune approbation humaine valide d'abenrhouma sur ce SHA.
- Production : manifeste de release rattaché au SHA
  `d743d2fb10567eaabab5b4325743d108ff65010d`. La topologie et les identifiants
  opérationnels restent dans les preuves privées. L'identité du processus
  réellement servi reste à recouper au moment de la bascule.
- Huit pages publiques, connexion et health : HTTP 200, mesures ponctuelles
  0,203–0,560 s. Ces mesures ne sont pas des percentiles ni une surveillance prolongée.

## Matrice consolidée

| Domaine | Composant | Configuration/source | Preuve existante | Preuve restante | État |
|---|---|---|---|---|---|
| Application/proxy | Next.js, Nginx, PM2 | vhost Nexus, launcher, liens release | HTTP 200 ; cible et processus identifiés | SHA complet runtime, canari, mesures avant/après | Production antérieure en service |
| Artefact | standalone CI | ci.yml, verify-standalone-artifact.mjs | ZIP 11552060929, SHA256 `6616094a80bbf408e3493f2ff06eb36ffbc21f58b73836d228e04105f59db630` ; static/public inclus | Nouvel artefact qualifié, puis identité avec livraison main | Ancien ZIP non retenu pour promotion |
| Provenance | SHA, Node/npm, SBOM | manifeste et CI | SHA merge synthétique `4a43b914278fe88cafc6b99131acb404bbbdeca7`, arbre identique au candidat ; Node 22.23.1/npm 10.9.8 | SHA explicite et SBOM dans même livraison | Correctif en qualification |
| PostgreSQL | PG 15.17, nexus_prod | conteneur Nexus ; EnvironmentFile protégé | 110 migrations, aucune inachevée ; 121 tables, 429 index, 29 triggers | Checksums bornés, deploy puis no-op sur restauration | Non migré |
| Rôles | runtime/migrator | pg_roles, pg_auth_members | Runtime membre du rôle admin superutilisateur ; limited/migrator absents | Rôle limité, négatifs SET ROLE/DDL/autres DB, smokes | P0 avant ouverture |
| Sauvegarde | dump custom + GPG | source Nexus seule ; clé privée hors serveur | Nouveau dump chiffré avant transfert, restauration isolée exit 0 | Inventaire d'un même snapshot, contraintes/triggers/journal | Qualification en cours |
| Redis/sessions/files | limiteur Redis, sessions JWT révocables, outboxes SQL | code rate-limit/sessionVersion/outbox | PING Redis authentifié PASS ; CI révocation/session | TTL/isolation et smokes artefact final | Connectivité actuelle vérifiée |
| SMTP | STARTTLS/auth/outbox | environnement runtime protégé | Auth transport réelle PASS sans mail ; SPF/DMARC et un sélecteur DKIM présents | Invitation/reset Mailpit, retry/idempotence ; livraison technique | Transport seulement qualifié |
| Stockage | documents/NPC | racines protégées runtime | Répertoires présents, 0750/0700 ; clés présentes | Lecture/écriture chiffrée et refus inter-familles candidat | À qualifier |
| Antivirus | ClamAV | service/variables diagnostics | Tests réels en CI ; services daemon/freshclam actuels inactifs | Moteur runtime, signatures, clean/EICAR/fail-closed | Non qualifié |
| ARIA/RAG | modèle, récupération | config modèle ; profil canonique RAG_API_BASE_URL | RAG absent dans environnement initial ; Core indépendant en tests | Config provider/model explicite, mode sans RAG et dégradé réellement exercés | Ne pas revendiquer RAG disponible |
| Auth/RBAC/profils | cinq rôles, ownership | CI auth/core-v2 | Chromium 569 tests ; Firefox 32/WebKit 32/mobile 22, zéro retry/flake/skip | Recette des cinq rôles sur artefact déployé | Preuve code, pas preuve production |
| Dashboards/Espace/docs | pages et API protégées | suites CI candidat | CI exacte candidate verte | Smokes isolés et post-bascule | Restant |
| Planning/finance | parcours existants | golden staff, factures et réservations | CI exacte candidate verte | Smokes avec rôles techniques | Restant |
| Capacités non qualifiées | paiement/WhatsApp/vidéo/sites-salles | flags et contrats existants | Paiement réel non implémenté ; vidéo CI pointe un hôte de test | Flags invisibles/refus serveur et vérification runtime | Désactivation exigée |
| Observabilité | santé, logs, files, DB, capacité | vhost safe logs ; métriques à extraire | Disque 64 %, RAM disponible ~55 Go ; health 200 | 5xx/p95/p99, auth/files, alertes et 30 min + 2 h | Restant |
| Rollback | artefact précédent + données conservées | ancienne preuve bd5b5fd/cac6237, scripts | Trois anciens cycles avec reset DB entre bascules | Trois cycles finaux sans reset/down-migration, RTO | Ancienne preuve insuffisante |

## Décisions et correctif minimal

Le job Production Build compilait une URL Jitsi de test avec le mode legacy
activé. Le garde runtime interdit de changer ensuite le mode compilé. Une simple
configuration serveur ne corrige donc pas cet artefact.

Le correctif conserve les autres lanes de qualification : checkout du SHA candidat
explicite, configuration publique production, vidéo DISABLED et paiement public
false, même mode au smoke, SBOM des dépendances du build inclus dans le ZIP.
L'audit des fichiers réellement livrés reste distinct du SBOM des dépendances.
Le runtime devra déclarer DISABLED et ne fournir aucune URL Jitsi.

Plan exécuté sous l'autorisation de la mission : test de régression RED, changement
CI minimal, GREEN, revue indépendante en lecture seule, lint/typecheck, commit
atomique et push fast-forward. Toute nouvelle tête exige nouvelle CI et approbation.

## Tests exécutés

- Première invocation Jest sans --config : refus de configuration multiple,
  aucun test exécuté ; invocation corrigée avec `--config jest.config.js`.
- RED : deux tests échouent pour mode absent et SBOM non inclus, 31 passent.
- GREEN : les deux suites passent, 33 tests.
- Revue indépendante du diff : aucun P0/P1 trouvé.
- `npm run lint` : exit 0, avertissements préexistants conservés.
- `npm run typecheck` : exit 0.
- Restauration initiale : garde canonique migrations PASS, 110 appliquées,
  PRE_PENDING / PRODUCTION ; seule divergence bornée admise, 30 migrations
  legacy restantes à cet instant, avant les opérations isolées ci-dessous.
- Après cette mesure initiale : sauvegarde chiffrée avec snapshot partagé entre
  pg_dump et inventaire, restauration isolée, 121 comptages égaux, 337 contraintes,
  429 index, 29 triggers et 110 entrées Prisma identiques. Seuls les trous de
  numérotation physique des colonnes supprimées sont normalisés en rangs,
  sans changer leur ordre ni ignorer leur type ou définition.
- Sur cette restauration : 30 migrations appliquées, second passage sans
  opération, postflight POST_APPLIED PASS, aucun comptage métier modifié,
  aucune contrainte ni index invalide. Aucun changement de base production.
- Core-v2 isolé : migrations puis second passage sans opération réussis.
- Rôle limité isolé : lecture/DML autorisés après grants ; rôle admin, création
  de base/rôle/schéma/table et écriture journal Prisma refusés. Règle HBA ciblée
  prouvée nécessaire pour empêcher CONNECT hérité de PUBLIC vers une autre base.
- CI du premier correctif : gate de sécurité documentaire en échec sur un alias
  d'infrastructure dans ce rapport. Reproduit localement ; alias retiré.

## Correctif bootstrap découvert pendant la qualification

Le CLI du premier ADMIN appelait directement un ancien adaptateur de livraison
avec `tokenHash` au lieu de `invitationId`, alors que le service d'invitation
persistait déjà un handoff durable. Cela pouvait doubler l'envoi et dédupliquer
une réinvitation vers un ancien lien révoqué. La validation regex acceptait aussi
les types non chaîne par coercition.

- RED : 6 échecs, 3 succès, reproduisant les deux chemins CLI, le préflight absent
  et les identifiants undefined/null/number.
- Correctif : préflight runtime avant création, suppression des deux envois
  directs, utilisation exclusive du handoff durable, garde de type stricte.
- GREEN : 3 suites, 11 tests ; revue indépendante sans bloquant.
- Lint, typecheck et gate de sécurité du dépôt réussis.
- CLI réel exécuté sur Core-v2 isolé avec le rôle limité : ADMIN technique
  créé, invitation durable persistée, aucun envoi direct.
- Le worker applicatif reste nécessaire à la livraison ; le CLI annonce une
  mise en file durable et ne prétend pas avoir livré le message.

## Décisions humaines encore indispensables

Le générateur de roster exécuté en lecture seule sur la restauration compte
194 élèves historiques et aucun candidat portant les signaux contractuels
2026/2027 requis. Aucun élève n'a été auto-approuvé. L'ADMIN initial et le roster
réel restent à valider par le propriétaire avant la migration Core-v2.
La révocation des anciens identifiants SMTP/PAT et le retrait des clés historiques
restent à attester ; aucune valeur de secret n'est requise dans la conversation.

## Preuves privées et risques

Rapports opérationnels conservés hors dépôt dans le dossier de preuves local.
Aucun secret, dump déchiffré ou donnée de famille ajouté à ce rapport.
La clé privée de sauvegarde demeure sur la machine opérateur, permissions privées.
La seconde sauvegarde partage le snapshot de son inventaire et sa restauration
est comparée avec succès. Elle devra être renouvelée avant la migration réelle
pour couvrir les écritures de production intervenues depuis.

Le conteneur historique de répétition sans mot de passe a été identifié exactement,
arrêté et déconnecté. Son volume est conservé ; la santé production est restée HTTP 200.

## Rollback

Aucune migration ni bascule applicative de production effectuée par cette session.
Conserver le build servi et les rôles historiques jusqu'à stabilité attestée.
Ne pas réutiliser le script de rollback historique qui réinitialise la base.
Le nouveau drill doit conserver schéma et données et utiliser les mêmes artefacts.

## Résultat

GO_LIVE_NON_ACCOMPLI. Cette matrice décrit les preuves disponibles et les gates
restants ; elle n'autorise ni fusion ni ouverture tant qu'ils ne sont pas fermés.


## Qualification isolée du candidat 510efc0

- SHA : `510efc0f37de99683c92d9c4a581ae7737e4c2ca` ; artefact CI unique,
  digest ZIP `ccd9e779a748f447c63c014ebdd94731c3876ce51a21cc2880ace38e07c924fd`.
  Manifeste et SBOM présents ; vidéo désactivée ; origine publique production.
- Exécution isolée avec le même Node 22.23.1 et OpenSSL 3 que la cible, montage
  de l'artefact en lecture seule, identité système non privilégiée.
- Sept identités synthétiques activées via invitations natives : ADMIN, ASSISTANTE,
  COACH, deux PARENT et deux ELEVE ; deux familles distinctes. Année et inscriptions,
  affectation coach et trois séances créées via les API canoniques.
- Perte d'acquittement après persistance du handoff simulée : reprise réussie,
  un seul intent et un seul message Mailpit, puis drain sans travail.
- Mailpit filtre les destinataires synthétiques ; aucun message client envoyé.
- ClamAV isolé : document sain, EICAR refusé et indisponibilité fermée vérifiés.
  Cela qualifie le pipeline diagnostic, pas les anciens documents généraux.
- Le runtime Core limité a besoin de SELECT sur quatre colonnes du journal Prisma
  (migration_name, checksum, finished_at, rolled_back_at). Droit borné accordé
  uniquement sur restauration ; écritures journal et SELECT global refusés.
  TEMP hérité de PUBLIC a aussi été retiré sur les seules bases isolées testées.
- DNS MX/SPF/DKIM/DMARC concordants avec les paramètres Hostinger transmis.
  DMARC reste en observation (`p=none`). Transport modèle réel vérifié par une
  requête synthétique ; ce résultat ne qualifie pas le parcours ARIA complet.

## Défauts fonctionnels reproduits et correction en qualification

1. Coach d'autorité Core-v2 : appels répétés aux API dashboard/cohorte V1 en 404.
   Le home utilise maintenant exclusivement les affectations/plannings Core.
   Les liens V1 confirmés incompatibles sont retirés de la navigation Core.
   Cette restriction inclut les identités miroirs portant l'autorité Core.
2. Documents élève : anciennes API inexistantes et téléchargement non implémenté.
   La page V1 réutilise la liste propriétaire et le téléchargement autorisé existants.
   Le partage général Core demeure indisponible, sans miroir improvisé ; les
   diagnostics natifs restent accessibles. Les liens et ancres non disponibles
   sont retirés pour ces identités.
3. Paiement : le flag ClicToPay ne fermait pas les virements. Nouveau flag distinct
   `NEXT_PUBLIC_ENABLE_BANK_TRANSFER`, fermé par défaut et compilé à false dans
   l'artefact de production. Pages, confirmation, navigation, achat de packs et
   approbation sont fermés ; API de déclaration, validation et réservation
   refusent les mutations bancaires. Consultation, factures et rejet restent
   soumis aux autorisations existantes. Les builds E2E isolés activent explicitement
   les fixtures bancaires, sans modifier le build de production.

Preuves RED/GREEN : coach 1 échec puis 2 succès ; documents 3 échecs puis 26 succès
avec les suites d'ownership/téléchargement ; gates paiement API/UI et configuration
CI reproduits en échec avant correction. Vérification consolidée : 11 suites,
80 tests réussis, lint et typecheck exit 0. Revue indépendante en lecture seule :
aucun nouveau bloquant ; landmarks main imbriqués corrigés.

Ces changements exigent un nouveau SHA, une nouvelle CI et un nouvel artefact.
Les anciens smokes ne constituent pas la preuve finale. L'artefact de repli de1c935
réouvrirait les virements ; il n'est donc plus un rollback qualifié pour cette
configuration. Les trois cycles authentifiés restent à prouver avec un repli sûr.

## Fermeture antivirus des uploads documentaires historiques

Le contrôle de couverture a confirmé deux entrées non scannées : upload admin et
upload coach multipart. Le transport ClamAV existant est réutilisé via un helper
interne de fichier privé ; le wrapper diagnostique conserve sa résolution paresseuse
du stockage, ses modes et ses refus en production.

- Écriture exclusive du nouveau fichier, permissions 0600 ; nom coach aléatoire.
- Scan avant toute création de métadonnées téléchargeables.
- Malware : 422 ; scanner indisponible : 503 ; nettoyage borné au nouveau fichier.
- Aucun détail scanner, chemin ou nom original dans les erreurs journalisées.
- CSRF et limiteur par acteur/IP avant parsing ; bornes MIME/taille conservées,
  fichiers vides refusés. La borne du corps HTTP total reste à vérifier au proxy.
- RED : quatre défauts admin, puis cinq défauts coach/gates reproduits.
- GREEN : cinq suites, 53 tests ; ClamAV réel : six tests, couvrant les wrappers
  diagnostic et général (sain, EICAR, moteur injoignable).

Deux invocations de qualification ont été corrigées : une suite de pipeline DB
appelée sans sa configuration Core a refusé avant connexion ; la suite `.real`
appelée avec le projet Jest unitaire a été exclue par ses règles. Elle a ensuite
été exécutée sans exclusion avec `jest.core-v2.config.js`, six succès. Aucune suite
ignorée n'est comptée comme preuve et aucun reset de restauration n'a été lancé.

L'artefact c46ea1af6 ne contient pas ce correctif ; une nouvelle tête et une nouvelle
CI sont donc nécessaires avant qualification finale ou ouverture documentaire.

## Extension de la couverture antivirus et correction de la frontière de modules

CI `d3397f4930c7cd93874c8ffdada27083a7e44bc9` : le garde d'architecture a
rejeté les imports directs du scanner Core depuis les routes documentaires V1.
Le transport est extrait dans `lib/security/private-file-antivirus.ts` sans
changer le contrat Core ni importer son stockage depuis le module partagé.

L'inventaire complet des entrées binaires a aussi identifié Espace et les deux
uploads NPC. Espace scanne le fichier privé avant transaction. NPC scanne l'inode
ouvert de quarantaine avant le hardlink de publication, puis revalide l'identité
et conserve son nettoyage borné. L'API assistante refuse désormais tout chemin
local fourni par le client ; son parcours URL est conservé.

- RED Espace : trois défauts reproduits, ownership déjà correct.
- RED NPC/assistante : quatre défauts reproduits ; RED erreurs publiques NPC : six.
- GREEN stockage/routes NPC : six suites, 99 tests.
- GREEN documents/Espace/frontière architecture : cinq suites, 78 tests.
- ClamAV réel : huit tests, dont écriture NPC via descripteur ouvert, fichier sain
  publié et EICAR refusé sans fichier final.
- Borne Nginx actuelle vérifiée sans données client : requête annonçant plus de
  50 Mio rejetée HTTP 413 avant corps ; aucune écriture ni reconfiguration proxy.
- Diagnostic candidat-libre V1 : son scan porte sur le fichier chiffré ; cette
  capacité reste fermée par `CANDIDATE_DIAGNOSTIC_ENABLED=false`. Elle n'est pas
  qualifiée pour ouverture par ces tests.
- Revue indépendante : aucun nouveau bloquant dans le diff de publication.

Ces preuves restent isolées. Elles ne qualifient ni la production, ni un rollback
compatible, ni l'artefact final encore à construire et vérifier.

## Revue Copilot d339 : deux observations confirmées et corrigées

- `CONFIRMED_MAJOR` : le parseur des commandes shell comptait une exécution
  restreinte comme voie complète. RED reproduit `--runTestsByPath` et filtre de
  nom ; tous les arguments sont désormais vérifiés, continuations comprises.
  GREEN : six tests ; contrôle de couverture : zéro fichier orphelin.
- `CONFIRMED_MAJOR` : aucune règle Next active après l'ancien retrait du plugin
  pour sa dépendance vulnérable. RED : deux tests échouent. Le plugin officiel
  15.5.27 est réactivé avec les niveaux core-web-vitals ; seule sa dépendance
  fast-glob est remplacée par tinyglobby 0.2.17. Dans cette configuration
  monoracine, la branche de glob n'est jamais appelée. Un test impose l'absence
  de `settings.next.rootDir` dans la configuration effective des pages, API,
  composants et bibliothèques. Toute future configuration multiracine devra
  fournir un adaptateur qualifié avant de modifier cet invariant.
- Deux sentinelles réelles prouvent le warning client async et l'erreur script
  synchrone. Aucune dépendance upstream braces/micromatch/fast-glob dans le lock.
  Le lien natif de la page d'erreur globale conserve une exemption locale motivée
  par le rechargement complet lorsque le routeur a planté.
- Lint exit 0 ; typecheck exit 0 après déplacement du test ESLint en JavaScript
  (première exécution TypeScript refusée faute de déclarations ESLint).
- Audit npm complet : zéro HIGH/CRITICAL ; 19 alertes MODERATE transitives issues
  de sprintf-js dans la chaîne de tests Jest. Elles ne sont pas comptées comme
  audit sans alerte. Propriétaire : mainteneur dépendances Nexus ; revue et
  qualification d'une correction sous 24 heures, sans rétrograder Jest.
- Mention account-deletion dans le résumé Copilot : aucune nouvelle preuve,
  pas de correctif ajouté sur cette seule mention.

Aucune fusion ni migration ou bascule de production. Les gates humains, le
rollback dégradé, la recette de l'artefact final et l'observation restent ouverts.

## Contrat exhaustif du limiteur après CI a7a0a04

La CI `a7a0a04c37dd097756e5fd8f481782d5d9f5ef2e` a validé Core v2 et le build,
mais son unité a révélé une omission du contrat de scopes : `document-upload`
n'était pas attendu dans la liste exhaustive. 1 388 suites et 15 745 tests ont
réussi ; une suite et un test ont échoué. L'échec est reproduit localement, puis
la liste et les presets `expensiveIp`/`expensiveIdentity` sont vérifiés explicitement.
GREEN : les trois tests du contrat passent. Aucun code applicatif modifié.
Une nouvelle CI exacte-SHA reste requise ; le build a7a0a04 n'est pas promu.

### Qualification du candidat 527314d5 et correction ARIA bornée

- Artefact CI `11582165498`, SHA complet `527314d559c8383216abdb019cb0ad5e085256a0`, ZIP SHA-256 `be798117cff92e77d81455988507a9e8042cbdb4e657f95e339ece4afcf1f600`, manifeste concordant. Même ZIP vérifié dans les deux environnements isolés.
- Sur cet artefact : auth/RBAC cinq rôles, isolation familiale, reset via Mailpit avec révocation de deux sessions et jeton à usage unique, changement de mot de passe, suspension/réactivation passent. Chromium, Firefox, WebKit et mobile passent les smokes de dashboard, logout et retour arrière.
- Documents : antivirus HTTP réel, document propre, lecture propriétaire, refus inter-familles, page élève et facture synthétique/PDF privé passent. Espace : changement obligatoire du code et révocation, propriété du travail, professeur affecté, documents propres et EICAR PDF embarqué passent.
- Scan artefact : 11 identifiants UI/curriculum faux positifs et quatre occurrences de deux clés Next générées côté serveur ; aucune occurrence de ces clés dans les fichiers publics. Artefact conservé privé. La révocation des anciens identifiants reste à attester ; aucun check compensatoire publié.
- ARIA réel échoue avant appel fournisseur : `COURSE_NOT_FOUND`. Reproduction indépendante : les 18 cours annoncés chat sans RAG n'ont aucune identité canonique exécutable après conversion. Ne pas déclarer le fournisseur ou le parcours opérationnel sur cette preuve.
- Correction limitée aux deux correspondances déjà exactes : Philosophie et Histoire-Géographie Terminale vers leurs identités canoniques. La garde vérifie niveau et voie canoniques après les contrôles d'identité, cursus et droits. Le cockpit Core et ses actions affichent les autres cours comme indisponibles. Pas de correspondance approximative Première/Terminale, langue A/B ou Histoire/HGGSP.
- RED : deux échecs réels de résolution retrieval/prompt, deux échecs de refus niveau/voie, deux actions UI indûment actives. GREEN : 6 tests alias/prompt ; 16 tests Core purs dont projection ; 46 tests Core sur une base de test neuve et isolée ; 87 tests ciblés UI/bouton/alias ; 39 contrôles de frontière Core. Lint et typecheck sans erreur.
- Borne de lancement sans RAG : droits explicitement limités aux seuls cours non-RAG qualifiés, jamais grant global. Les autres capacités restent fermées. Deux nouveaux élèves techniques Terminale générale sont créés et activés par les parcours canoniques sur la restauration isolée ; les scolarités Première existantes restent intactes.
- Production : aucune fusion, migration de production, promotion ou ouverture client. Nouveau SHA/CI/revue et smokes de l'artefact corrigé restent nécessaires.

### Contraste des boutons lors de la reprise de session

- CI du SHA 527314d5 : WebKit, 85/86 tests passent ; trois boutons planning réactivés échouent `color-contrast` (ratios 2,89 et 3,95).
- Cause reproduite dans WebKit avec le CSS Tailwind compilé depuis la classe réelle : `transition-all` anime l'opacité de 0,5 à 1 après retrait de `disabled`, alors que le bouton est déjà actif. Pas de défaut auth/RBAC identifié sur cet échec.
- Correction produit : conserver les transitions couleur/fond/bordure/ombre/transformation ; exclure l'opacité. Contre-épreuve avec classe corrigée : opacité immédiatement 1, aucune violation axe. Aucun délai ajouté au test et aucune règle axe supprimée.
- Régression durable ajoutée à `auth-client-lifecycle.spec.ts` : clonage des classes du vrai bouton servi, transition disabled/active, lecture immédiate de l'opacité et contrôle axe ciblé du contraste. Les audits complets existants restent inchangés.
- La CI complète sur le prochain HEAD reste requise.

### Contrats E2E alignés sur l'autorité et la protection CSRF

- CI Chromium du SHA 527314d5 : 562/569 tests passent. Cinq tests coach attendent le titre exclusivement V1, alors que la session HYBRID possède l'autorité Core v2 et affiche son dashboard natif. Le helper corrigé vérifie le rôle COACH et l'autorité signée, puis le titre et les affectations correspondant à cette autorité ; aucune alternative de titre aveugle.
- Les deux autres échecs surviennent avant les assertions documentaires : le helper multipart omet `Origin` et est refusé par CSRF. Il transmet maintenant l'origine réelle de la page via le helper canonique ; les assertions IDOR et nosniff restent intactes.
- Contre-épreuves : dashboard coach Core réellement rendu ; APIRequestContext n'émet pas spontanément Origin/Referer, ajout explicite confirmé ; dépôt propre avec Origin et refus inter-familles déjà passés sur l'artefact exact. La tentative additionnelle de vérification est arrêtée par le limiteur de connexion normal après les nombreux smokes : aucune purge Redis ou usurpation d'IP, rejeu après expiration normale.
- Typecheck sans erreur. Les scénarios complets et la régression déterministe du contraste seront rejoués par la nouvelle CI ; les échecs de 527314d5 ne sont pas reclassés verts.

### Fermeture des capacités V1 non raccordées aux nouveaux comptes Core

- La qualification documentaire et facture de 527314d5 utilise des comptes techniques V1. Elle ne prouve pas la bibliothèque générale ou le rattachement de factures aux comptes Core-only : ces objets référencent encore User V1. Les diagnostics natifs Core sont un parcours distinct.
- Navigation Core : ressources/factures parent et documents généraux admin masqués, comme les documents généraux élève déjà masqués. Les accès directs affichent une indisponibilité explicite avant toute lecture V1 ou formulaire de dépôt. Aucun adaptateur de facturation ni utilisateur miroir artificiel n'est créé.
- Dépôt général : un opérateur Core-only est refusé avant parsing, écriture ou scan ; un miroir V1 préexistant conserve le contrat API autorisé. L'autorisation de rôle reste celle de la session canonique.
- RED : cinq échecs navigation/pages/dépôt. GREEN : 23 tests couvrant ces fermetures, les documents existants, les factures V1 et les accès élève ; lint sans erreur. Rectification : le journal local du typecheck contenait déjà deux erreurs TS2339, contrairement au compte rendu initial ; la CI du SHA d7716d1a les a confirmées.
- Rejeu des contrats E2E après expiration normale du limiteur : coach Core et affectations visibles ; upload sans Origin refusé403, avec Origin accepté201, lecture propriétaire200 avec nosniff et accès étranger404. Aucune purge de limiteur.
- Les capacités non implémentées restent indisponibles. La vérification du diagnostic natif exige un instrument autorisé et son PDF réel ; une fixture de démonstration ne sera pas présentée comme diagnostic pédagogique qualifié.

### Autorité signée dans le type des guards

- RED sans compilation incrémentale : deux TS2339 sur `session.user.authority`, dans l'API et la page de documents admin. `requireAuth` conserve la session mais son type exporté omettait ce champ déjà déclaré dans NextAuth.
- Correction : réutilisation du type `Session['user']['authority']`, sans changer le contrôle d'identité à l'exécution ni ajouter de cast aux consommateurs.
- GREEN : 17 tests de guards, dont préservation explicite des autorités Core/V1 ; compilation complète `tsc --noEmit --incremental false`, exit 0. Aucun résultat local antérieur erroné n'est retenu comme gate.

### ARIA Core : arrêt de la première génération et mode sans RAG

- Défaut confirmé sur le dialogue réellement monté : le POST Core attendait le modèle avant de retourner les identifiants en JSON. Le bouton restait en démarrage et ne pouvait annuler cette première génération. La mention sans RAG existait sur la carte mais pas dans le dialogue.
- RED : le client ne reçoit pas l'identité avant la fin, la route ne retourne pas le flux réservé, et `NOT_CONFIGURED` ne produit aucun libellé explicite.
- Correction : réutilisation du transport SSE canonique avec executor/repository Core injectés, après les mêmes gates auth, CSRF, actor, contexte et ownership. Le wrapper accepte cette réponse privée après ses vérifications et conserve la corrélation. Le client négocie SSE ; les clients JSON restent compatibles. La mention sans base documentaire Nexus est explicite dans le dialogue.
- GREEN : 212 tests UI/transport, 85 contrôles de frontière, 33 tests HTTP dont annulation sur PostgreSQL isolé avant le premier token. Ce dernier test utilise un fournisseur contrôlé respectant le contrat typé du gateway : `202 CANCELLATION_REQUESTED`, arrêt par heartbeat, puis état durable `CANCELLED` et deux messages, sans token généré. Les premières versions du test omettaient la configuration de limiteur synthétique, attendaient 200 au lieu de 202, puis simulaient un AbortError brut au lieu du contrat gateway ; elles ne sont pas des preuves vertes.
- Lint exit 0 avec warnings préexistants ; compilation sans cache exit 0. Revue indépendante en lecture seule : aucun défaut bloquant identifié dans ce delta. Le fournisseur réel et le proxy restent à vérifier sur le prochain artefact CI.

### Snapshots du bouton corrigé

- CI d7716d1a : 1 388 suites et 15 749 tests unitaires passent ; six snapshots de deux suites échouent uniquement sur la classe de transition du bouton corrigé pour le contraste WebKit.
- RED reproduit localement. Les six lignes attendues sont actualisées après revue du diff : aucun contenu, attribut ARIA ou comportement modifié. Rejeu sans mise à jour : six tests et six snapshots passent.

### 2026-10-09 — qualification de l’artefact 47ec et correction du test SSE

- Artefact CI `11583319732`, SHA `47ec80d80415e49829376e6afc6a11e0db8713f6`, digest ZIP `ac6b06c11ce3dd19dd94979f1a1ad5632f486af0e397ad0af0ec68b02f57ba7a`. Manifeste vérifié, Node 22.23.1/npm 10.9.8 ; SBOM CycloneDX 554 composants, empreinte `b34b97beab54f05cf5ae795a79b1b97ac5e4e3588fea225e9d3aec04eccbd8f0`.
- Sur restauration isolée et runtimes limités : smokes cinq rôles, reset, changement de mot de passe, révocation des sessions, suspension/réactivation, documents et factures V1, Espace et antivirus PASS. Chromium, Firefox, WebKit, mobile et retour arrière après déconnexion PASS. Ce résultat ne qualifie pas les fonctions documentaires/facturation natives Core encore fermées.
- ARIA sur fournisseur réel : réponse sans RAG explicitement signalée, historique, idempotence, conflit de requête, ownership inter-familles et refus parent PASS. Interface : arrêt durable CANCELLED et reprise du même UUID après rechargement sans doublon PASS. Injection négative sans récupération/citations PASS. Timeout contrôlé de configuration : HTTP 503 MODEL_UNAVAILABLE, tour ERROR durable, aucun tour actif ; retour aux délais normaux puis HTTP 200 COMPLETED PASS.
- Les premiers essais d’interface ont révélé un profil synthétique Terminale sans spécialités. L’onboarding restait correctement incomplet ; deux spécialités ont été déclarées par l’API d’administration sur ce seul compte technique. Aucun correctif produit nécessaire.
- Scan artefact : aucun fichier interdit ; 15 détections Gitleaks inchangées (11 faux positifs UI/catalogue, quatre occurrences de deux clés de prévisualisation Next générées côté serveur, absentes des fichiers publics/statiques). Les attestations de révocation historique et de contrôles compensatoires restent requises. Les journaux ARIA conservés après expurgation n’ont aucun motif sensible détecté ; cela n’atteste pas le flux avant expurgation.
- Aucun delta Prisma depuis `de1c935` : preuves 140 migrations V1 et 25 Core conservées. Le drill final n’est pas encore qualifié. Une correction erronée du script avait confondu SHA de release (40 hex) et hash documentaire (64 hex) ; le préflight l’a refusée avant toute bascule. Ces métadonnées sont désormais distinctes. Le nouvel essai a atteint la limite normale de connexions IP ; attente d’expiration sans vidage Redis ni relâchement de limite. Les tentatives et résultats négatifs sont conservés hors dépôt.
- **RED CI** : run `37855055785`, job Chromium `113577914540`, 569/570 passent. Le test Core ARIA lit encore `sent.json()` après HTTP 200 alors que le client utilise désormais SSE. Le test est corrigé pour exiger HTTP 200, Content-Type SSE et fin du transport, puis rattacher le résultat au couple acteur/UUID et lire l’historique natif paginé du tour exact. Les assertions COMPLETED/SUCCESS/citations, feedback, invocation unique et absence de routes V1 sont conservées.
- **GREEN ciblé** : le bloc de contrôle corrigé a été exécuté contre l’artefact 47ec et le fournisseur réel, avec les seules attentes RAG adaptées au mode sans RAG : transport FINISHED, un tour exact COMPLETED et deux messages persistés. Le harness initial omettait son baseURL et a échoué Invalid URL ; il a été corrigé avant le résultat GREEN. Typecheck complet non incrémental, lint ciblé et revue indépendante PASS. Le scénario complet avec fixture RAG reste à confirmer par la nouvelle CI ; aucun vert de cette CI n’est anticipé.
- La revue Copilot du nouveau candidat reste indisponible : GitHub affiche épuisement des crédits jusqu’au 1er novembre 2026. L’intervention opérateur a été demandée ; aucune dépense engagée. Approbation humaine finale, fusion, déploiement et ouverture client non effectués.
# Confidentialité des artefacts — contrôle du 2026-10-08 23:30 UTC

- Le dépôt GitHub est public. Les artefacts Actions ne sont donc pas un stockage
  privé. Le scan du standalone `1377f2178970579c5c9a67f08b931244d2c363c2`
  identifie 11 faux positifs et quatre occurrences de deux clés Next réelles.
  `previewModeId` et la clé AES Server Actions sont également présents.
  Aucune valeur n'a été imprimée ou copiée dans les preuves.
- Aucun usage applicatif preview/draftMode, closure ou argument lié n'est trouvé.
  Les 13 Server Actions appliquent auth() et leurs gardes métier. Aucun bypass
  d'authentification démontré ; le jeton Next de revalidation/bypass demeure
  néanmoins fonctionnel. Les artefacts exposés sont exclus de la promotion.
- Correction minimale des deux producteurs : CI et Preview chiffrent leur
  archive avec GPG avant upload, sous une clé publique de release dédiée. Seuls
  le ciphertext et les sidecars publics explicitement listés sont publiés.
  La clé privée demeure dans le stockage opérateur local protégé, hors serveur.
- RED : les deux workflows publiaient du runtime clair et le wrapper de
  chiffrement manquait. GREEN : aller-retour réel GPG, octets et modes conservés,
  absence de clé privée et archive altérée refusées, clé invalide sans résultat
  publiable, sortie existante préservée ; garde des deux listes d'upload.
- Les preuves d'authentification, documents, Espace et invitation Mailpit du SHA
  `1377f2178` restent des preuves fonctionnelles intermédiaires. Aucun nouveau
  déploiement de production, aucune migration de production et aucun mail client.
- À fermer après la nouvelle CI : téléchargement/déchiffrement/digests, rotation
  des clés Next en mémoire, smokes du nouveau bundle et trois rollbacks. L'artefact
  de repli local a été construit en privé ; il n'a pas été publié dans Actions.

## Alignement des contrats CI du bundle chiffré

- CI `37860688580`, SHA `ad1a856f8` : deux tests attendent encore le standalone
  publié en clair ou l'ancien chemin du SBOM. RED reproduit localement : deux
  assertions en échec, 31 tests ciblés déjà verts.
- Les assertions vérifient désormais les cinq fichiers explicitement publiés,
  les expressions GitHub conservées par découpage en lignes, et la copie du
  SBOM canonique après sa génération et avant upload. Aucun runtime modifié.
- GREEN : quatre suites, 50 tests ; typecheck complet sans erreur ; lint
  canonique sans erreur. Le lint direct du test JS ancien signale trois imports
  `require` inchangés ; aucun contournement ajouté à ces règles.

## 9 octobre — identité du cours dans le flux SSE Core avec citations

Le candidat `da55c2dda8630fe5778544873682059897bbd24d` échoue dans la CI
`37862167895`, job auth Chromium `113600752289` : 569 tests passent, un échoue,
zéro retry/flaky/skip dans la première passe. La répétition Chromium suivante
n'est pas exécutée après cet échec. Le test Core ARIA reçoit bien HTTP 200/SSE,
mais le navigateur signale `requestfailed` avant la fin du flux.

Diagnostic reproduit avec le parser réel : le start Core porte l'alias cockpit
`maths-terminale-eds`, tandis que la citation autorisée et persistée porte la clé
canonique `eds-maths-terminale`. La comparaison brute déclenche
`EVENT_IDENTITY_MISMATCH` et annule le flux. Un start canonique avec citation,
ou un start alias sans citation, passent. Les smokes fournisseur réel sans RAG
sur le même artefact ne prouvaient donc pas ce chemin avec citations.

### Décision et plan ciblé

1. Reproduire en RED deux couples alias/canonique et conserver quatre refus
   pour autre matière, autre niveau, option et alias inconnu.
2. Utiliser le mapping explicite existant `toCanonicalAriaCourseKey` uniquement
   pour comparer l'identité de cours des citations dans le parser client.
   Préserver les citations canoniques, les contrôles turn/message/metadata,
   la validation EOF et l'assertion navigateur `FINISHED`.
3. Exécuter les tests SSE/EOF/reader/alias, lint et typecheck, revue indépendante,
   puis commit atomique et push fast-forward. Exiger nouvelle CI complète et
   nouvelle qualification de l'artefact produit ; aucune fusion sur `da55`.

### Preuves

- RED : deux échecs `EVENT_IDENTITY_MISMATCH`, quatre refus attendus verts.
  L'invocation initiale sans `--config` a été refusée pour double configuration
  Jest ; la reproduction utilise explicitement `jest.config.js`.
- GREEN : cinq suites, 64 tests, y compris EOF et transport natif.
- Revue indépendante en lecture seule : aucun défaut bloquant ; module pur
  compatible navigateur et aucun élargissement entre matières/niveaux/options.
- Les smokes isolés `da55` documents, antivirus, factures, Espace, invitation,
  ARIA sans RAG, annulation/reprise/timeout/récupération, trois moteurs desktop
  et huit pages publiques mobiles sont conservés hors dépôt. Ils ne sont pas
  requalifiés silencieusement pour le prochain SHA.
- Auth `da55` : premier timeout UI au changement de mot de passe, essai ciblé
  suivant vert ; cause encore non établie, preuve initiale conservée.
- Artefact `da55` chiffré, clés Next renouvelées, archive claire SHA-256
  `070656c6ccfee0920ab7b3f168a83e1ee311b7a807b624d399286c6f5f82d91c`.
  Source/artefact scellés et rapports expurgés conservés hors dépôt.

Aucune migration ni bascule production. Repli privé `a2ef1f1ef` conservé ; les
scripts de bascule historiques ne sont pas utilisables tels quels pour le canari
(repli implicite vers ancien build, secrets en argv, contrôles santé insuffisants).
L'approbation humaine finale, la voie secrets/attestation et la revue Copilot
(capacité du compte épuisée) restent des gates ouverts.

Vérification finale du correctif : lint canonique et typecheck non incrémental
terminent avec code 0. Reproduction Chromium sur un vrai flux HTTP local : ancien
parser = `EVENT_IDENTITY_MISMATCH`, zéro citation publiée, `requestfailed` ;
parser corrigé = une citation canonique, `onDone` après EOF et `requestfinished`.
Le rapport RED/GREEN expurgé est conservé hors dépôt. Il prouve le mécanisme de
l'échec ; la CI Core native complète du prochain SHA reste obligatoire.

## 9 octobre — revue du candidat `1b1d130d` et fermeture des capacités V1

### État prouvé avant le nouveau correctif

La CI exacte `1b1d130dc86dd7b65b29ea530c05e6810aa9bbb5`, run `37864929959`,
termine avec 44 jobs réussis, aucun job annulé, ignoré ou en échec. Les rapports
navigateur contrôlés n'ont aucun test inattendu, flaky, ignoré ou retenté.
Le workflow GitGuardian distinct n'a pas exécuté de scan : secret API absent.
Le statut `Secret Scan — Compensating Controls` reste honnêtement en attente.

L'artefact CI chiffré `11587738444` a été vérifié et utilisé pour les smokes et
les trois rollbacks isolés, sans rebuild : archive claire SHA-256
`317cb17c845eeb54b724a6bf1db7800cceeb6f77baf20f0f1fe8e1e7799911b4`,
archive publiée chiffrée SHA-256
`9dcbcb887ed0bc68a3a06a6e80e73be2f7d2fb6833ab510414d046a4ab7f2ae9`.
Les trois reprises du repli privé `a2ef1f1ef` mesurent 6806, 6802 et 7130 ms ;
les contrôles authentifiés et empreintes schéma/données restent identiques.
Le fournisseur ARIA réel a produit un 503 contrôlé, état durable ERROR sans tour
actif, puis une reprise 200/COMPLETED dans la même conversation. Les quotas ont
expiré naturellement ; aucun reset de quota. Les compteurs de motifs sensibles
sur les sorties brutes isolées sont nuls ; ceci n'est pas une preuve exhaustive
contre toute forme de PII.

Manifestes expurgés conservés hors dépôt :

- `manifest-1b1d13-final-rollback.json` :
  `967088f32804e0a01ec3a2f15e50635708ea28b8552c8e7021970ff5566f4852`.
- `manifest-1b1d13-terminal-ci-and-provider.json` :
  `114e65ea79d02cf8b6599438f37718aa8f1e8bd5ce58599619d46c1bcad30d94`.

### Défauts reproduits et décisions

La revue Cubic `5464471281` ajoute 49 conversations ; elle ne remplace pas une
revue Copilot ni l'approbation humaine. Deux défauts de capacités V1 sont confirmés :

1. Les liens coach V1 étaient masqués pour Core, mais plusieurs API restaient
   accessibles avec une affectation V1 portant le même identifiant. Les guards
   de rôle historiques refusent maintenant les coachs sans autorité V1 explicite.
   Les handlers directs, téléchargements documentaires et trois pages legacy
   appliquent la même frontière avant lecture privée ou mutation. `requireAuth`
   est conservé pour les authorizers Core natifs ; aucun droit Core n'est déduit
   d'un miroir d'identifiants V1.
2. Les formulaires documentaires pouvaient créer une métadonnée URL sans fichier
   privé téléchargeable. L'assistante envoie maintenant un fichier avec le
   `User.id` réel vers l'uploader canonique ; le coach conserve son multipart
   soumis à ownership, CSRF, limitation et antivirus. Les anciens POST JSON
   retournent 410 sans création. La fiche Core ne propose pas l'uploader V1.
   Le formulaire assistante annonce son contrat réel : titre issu du nom du
   fichier, type AUTRE, visibilité STUDENT_ONLY, 10 Mo maximum.

### RED / GREEN et revue

- Frontière dashboard/disponibilités/pages : RED 14 échecs, 4 succès ;
  GREEN six suites, 38 tests.
- Upload assistante : deux échecs UI causaux ; trois contrats API et transmission
  d'identité échouent également avant correction. Upload coach : quatre échecs
  causaux ; GREEN documentaire six suites, 43 tests, antivirus inclus.
- Adjacence documents/comptes rendus : RED 13 échecs, 12 succès ;
  GREEN neuf suites, 134 tests.
- Frontière complète des guards et handlers directs : RED 16 échecs, 25 succès ;
  GREEN huit suites, 113 tests. Reproduction indépendante après correction :
  notes et mode survie refusés en 403 avec zéro lecture/écriture V1.
- Vérification consolidée : 26 suites, 312 tests réussis, architecture Core,
  droits familiaux et factures inclus. Revues indépendantes en lecture seule :
  aucun défaut concret restant dans le delta coach et documentaire.

Ces preuves locales qualifient le correctif source. Elles ne transfèrent pas la
qualification de l'artefact `1b1d130d` au prochain SHA : nouvelle CI complète,
artefact, smokes et rollback final requis. Aucun changement de schéma, aucune
migration, aucun changement de rôle DB ni de trafic en production. Le go-live
reste conditionné aux gates humains, secrets et opérationnels documentés.

Lint canonique et typecheck complet non incrémental terminent tous deux avec
code 0 sur ce delta. La recette alternative `docker-compose.prod.yml` manque
encore le câblage d'authentification Core : son en-tête la marque explicitement
non qualifiée et interdit son usage pour cette release. Elle ne constitue pas
la procédure du launcher protégé utilisée pour qualifier l'artefact.

La vérification des dépendants de `lib/guards.ts` a identifié 12 attentes
historiques avec sessions mockées sans autorité. Les quatre fixtures concernées
précisent maintenant V1, comme la projection réelle ; les nouvelles assertions
Core/sans autorité restent refusées. GREEN : 168 suites, 1832 tests unitaires
liés aux guards. La [classification des 49 commentaires Cubic](2026-10-09-cubic-candidate-triage.md)
est consignée séparément, sans clôture implicite des gates de release.

Manifest du delta source expurgé conservé hors dépôt :
`manifest-cubic-source-delta.json`, SHA-256
`71240579df353dda62d636a5527b9e0003563c395fd18acc7ecea73a87701c96`.

## 9 octobre — fixtures V1 distinctes du coach Core

Candidat publié `823861d333dc6f6a1f3bc7111dd75083f3bec295`, CI `37870036583` :
les jobs Integration Tests `113625766783` et Real DB Integration `113625766835`
confirment trois échecs dans `idor-real.test.ts`. Les sessions mockées n'indiquent
pas V1 ; le nouveau refus 403 intervient avant le contrôle d'affectation. Les
assertions métier restent intactes (200 pour son stage, 403 pour l'autre).
Après ajout de l'autorité explicite, les trois tests passent sur une nouvelle
base isolée `nexus_idor_test_20261009`, créée vide puis migrée avec Prisma. Aucune
restauration de qualification ni base existante n'est réinitialisée.

La CI verte antérieure prouvait que `loginAsUser('coach')` produit une session
CORE_V2 dans `core-v2-staff-golden`. Quatre attentes positives legacy utilisaient
ce même acteur dans trois specs. Une persona `coachV1` distincte possède désormais
son utilisateur, profil, affectation et réservation de test. Le miroir Core
l'exclut explicitement et s'arrête si cette identité existe déjà dans Core ;
aucune suppression ni modification de la politique d'authentification.

Les parcours legacy exigent maintenant COACH/V1 avant leurs assertions métier.
Le drill-down exige une cohorte non vide au lieu de sortir sans preuve. Le coach
Core reste inchangé ; le golden Core exige aussi trois refus legacy en 403/no-store
et conserve les assertions positives de ses panneaux natifs.

RED causal du miroir réel exécuté avec doubles de stockage : promotion indue de
la persona V1. GREEN : trois suites, 24 tests, incluant collision Core et guards
contre les cibles non jetables. Revue indépendante : aucun défaut concret ni
conflit de réservation/compteur identifié. Lint et typecheck complets terminent
avec code 0. Les parcours navigateur complets restent à exécuter dans la nouvelle
CI ; ces résultats ne sont pas déclarés verts par anticipation.

Manifest expurgé hors dépôt : `manifest-coach-v1-fixture-delta.json`, SHA-256
`c37acae5ec62264331fbf7b0c4e195e7348fc9b8ba8ad8a28497f8ac5b2118ab`.

## 9 octobre — dernière fixture assistante et suite unitaire complète

CI du candidat `e3005ef983b759a3b5f2b0f2fd8a18e78fd052f8`, run
`37870695206`, job unitaire `113628817923` : une attente Documents élève
échoue, car la session mockée ASSISTANTE ne porte pas l’autorité V1.
RED local confirmé (1 échec, 7 succès). La fixture précise maintenant V1
et distingue Student.id de Student.userId ; les assertions métier sont conservées.

GREEN local complet : 1398 suites, 15826 tests et 7 snapshots, code 0
(600,673 secondes). Lint et typecheck complets terminent également avec code 0.
Preuves hors dépôt : `assistante-authority-fixture-red.log`,
`final-unit-authority-fixtures.log`, `assistante-final-fixture-lint.log`,
`assistante-final-fixture-typecheck.log`. Nouvelle CI exacte-SHA, nouveau
scellement d’artefact et smokes restent requis après ce commit de fixture.
Aucun code applicatif, schéma ou état de production modifié par ce delta.
