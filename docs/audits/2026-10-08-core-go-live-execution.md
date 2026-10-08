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
