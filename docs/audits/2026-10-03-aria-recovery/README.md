# Reprise ARIA / Core — 3 octobre 2026

## Décision et base

Le mandat de direction choisit exclusivement un clone neuf de GitHub, branche
`codex/aria-go-live-recovery-20261003`, base `5ffd4dd8e1fb91b0eea42398670a260402660699`.
Aucun état sale ne devient autorité. PR #317, #318 et #319 déjà fusionnées.
Les règles live exigent un merge de PR, une approbation du dernier push et les
contrôles requis. La preuve d'identité Review Gate ne vaut pas revue humaine.

## Préservation

Les preuves privées comprennent métadonnées, statuts porcelain v2, reflogs,
stashes, manifests taille/mtime/hash, diffs contrôlés et empreintes. 43 sources
inventoriées, 8 659 fichiers recensés. Aucun environnement, base ni gros binaire
copié. Plus de 50 Gio restent disponibles. Les patches suspects sont retenus
sous forme de hash uniquement. Gitleaks sur les preuves : exit 0.
Les trois empreintes de l'inspection précédente sont identiques.

Incident : le sous-agent de provenance a exécuté `git write-tree` dans la source
candidate malgré la consigne lecture seule. L'objet retourné est
`3354ce37bdce891210260cec13f51c37965f1bdf`. Il n'est pas prouvé si cet objet
existait déjà. Pas de modification de fichiers/index/références par cette commande.
Aucun effacement correctif ni autre mutation autorisé dans cette source.

## Provenance et non-import

`provenance.json` compte chaque fichier modifié/non suivi développé depuis les
entrées de statut. Les 141 entrées principales deviennent 273 chemins lorsque les
répertoires non suivis sont développés. Les 1 897 entrées candidates sont classées
individuellement. Les environnements Python et la copie historique sont groupés,
avec manifests exhaustifs privés identifiés par hash. Aucun code local importé.
Les 2 179 chemins individuels sont classés : 54 identiques à main, 607 versions
historiques rejetées, 1 229 suppressions obsolètes rejetées, 59 artefacts,
224 chemins dépréciés/hors périmètre et 6 preuves historiques non promues.
Les 85 chevauchements suivis comprennent 61 divergences ; aucune ne justifie
un remplacement de main. `divergences.md` détaille les décisions.
Cette classification ne constitue pas une qualification fonctionnelle production.

## Réconciliation critique

- Prisma : aucune nouvelle entité/enum utile démontrée dans les deux variantes ;
  elles retirent notamment académique, famille, téléphone, planning et cycle ARIA,
  et réintroduisent des cascades. Garder main ; aucune migration de récupération.
- Pricing : garder main, sans variante commerciale non validée. Historique
  `76d542ebf` et `5ebac7ee2` formalise les corrections sans acompte. Les variantes
  locales ne constituent pas une décision de direction nouvelle.
- Next : garder les dépendances standalone PDF.js/canvas, les protections et le
  rewrite planning de main ; pas d'option expérimentale ajoutée.
- Devis : conserver contrats/services actuels. Certaines routes principales sont
  déjà identiques ; les variantes qui retirent le contexte candidat sont rejetées.
- Tests : ne pas importer les anciennes suppressions d'assertions ; tester main.
- Python : prototype FastAPI août 2025, mini-agents maquettes, pas d'appel démontré
  depuis le Core actuel. Environnements/backups/PDF préservés, aucun import.
- PDF/manifestes/smoke : preuves historiques, pas artefacts à promouvoir. Ne pas
  déclarer un manifeste ancien comme preuve de la release actuelle.

## Critères et lots autorisés

Le design et l'ordre des lots sont ceux expressément approuvés par le mandat.
1. Terminer provenance et qualification de la base sans modification produit.
2. Exécuter guards architecture, auth/famille/planning, prix/factures et ARIA.
3. Pour tout défaut démontré : test rouge, correction minimale, test vert,
   contrôle des permissions/concurrence et commit atomique.
4. Qualification complète : statiques, build, PostgreSQL isolé, E2E par rôle.
5. Préparer PR séparée ; aucune publication avant ensemble cohérent vert.
6. Avant déploiement : revue SHA, preuves TLS/révocation, sauvegarde restaurée,
   runbook privé effectif, rétention et configuration validés. Aucun contournement.

## État

RECOVERY_CLASSIFIED. Aucun parcours qualifié production par cette reprise.
La documentation historique ne remplace pas les tests du SHA courant.

## Corrections démontrées sur la base GitHub

| Commit | Invariant | Preuve |
| --- | --- | --- |
| `852884586` | verrou bootstrap ADMIN via SQL paramétré | guard rouge puis vert ; 7 tests bootstrap PostgreSQL |
| `4c9599cc3` | lieu/modalité propagés aux séances futures | 3 cas rouges puis 16 tests planning verts ; test Africa/Tunis |
| `336f29e61` | historique et exceptions conservés lors d'une révision | cas rouges séance commencée/terminée, annulation/report ; 22 tests planning verts |
| `83761b3c7` | pause/reprise sans ressusciter annulation explicite | rouge puis vert ; 26 tests incluant collision, édition pendant pause, ancien audit ambigu et course réelle |

Typecheck final du lot planning : exit 0. Lint ciblé, Gitleaks du diff et
`git diff --check` : exit 0. Pas de migration nouvelle.
Suite Core-v2 avant les derniers correctifs planning : 631 tests passés,
3 ClamAV non exécutés dans cette lane puis exécutés séparément (3/3).
Unitaires de base : 1 266 suites, 14 225 tests passés. Build de base : exit 0.
Ces preuves doivent être renouvelées sur le SHA final ; elles ne qualifient
pas un SHA ultérieur automatiquement.

## Sécurité et gates externes

Audit npm runtime : zéro vulnérabilité signalée. Audit complet : 39 packages
HIGH relevant de deux advisories dev ; validateur de l'exception versionnée
PR #336 : exit 0. Exception limitée au 10 octobre 2026, jamais une autorisation
de vulnérabilité runtime.
Scan historique : 120 alertes à qualifier, dont une clé privée historique
dans `AGENT_ARIA_RAG.md`. Aucune valeur extraite ni copiée.
Certificat public actuellement valide ; révocation/rotation historique NON PROUVÉE.
Runbook privé actuel, restauration récente et politique de rétention globale
restent à fournir ; aucun déploiement ou accès DB production entrepris.

## Revalidation des sources gelées

43 sources : HEAD et empreintes indexées/non indexées identiques à la capture
initiale ; aucun index.lock présent à la relecture. Les manifests des fichiers
ont été revalidés : 7 419 fichiers/liens avec hash disponible, zéro changement
de contenu, taille ou mtime ; les 12 liens Python sont contrôlés par readlink. L'incident write-tree
interdit de revendiquer une absence absolue de toute écriture Git : seule
l'intégrité observée des fichiers, index et références peut être affirmée.

L'audit de pause transporte désormais la révision et les IDs réellement annulés
(par UPDATE RETURNING paramétré). Une pause historique sans preuve suffisante
des overrides exige une revue : aucune restauration devinée. Une édition de
série pendant la pause ne remplace pas cette preuve. L'audit reste append-only.

Intégration Core-v1 : 52 tests critiques / 11 suites, 289 tests DB / 20 suites
passés sur PostgreSQL pgvector jetable. Un premier essai avec vidéo désactivée
échouait quatre assertions de la lane Jitsi ; relance avec sa configuration
Jitsi prévue, zéro modification produit pour contourner ces tests.
Le seed E2E v2 accepte uniquement le hostname/port jetable documenté : il a été
exécuté dans un conteneur Node épinglé, sur réseau privé de test et montage
lecture seule du clone, sans assouplir le guard.

## Qualification élargie et échecs conservés

SHA `9e8d0d8cf` : Core-v2 67 suites / 647 tests verts, aucun ignoré ;
Core-v1 critiques 52/52 et DB 289/289 ; lint/typecheck/lanes verts.
Le build a compilé mais son audit a refusé une trace `.artifacts/recovery/rag`
(`ARIA_STANDALONE_ROUTE_TRACE_FORBIDDEN`). Le garde n'a pas été assoupli.
La suite générale a détecté l'import runtime du namespace Prisma interdit
dans planning ; un second échec provenait d'un test de configuration modifié
pendant cette exécution. Cette exécution mixte n'est pas une preuve SHA exacte.

- `15e58df70` : SQL tagged template directement paramétré, import généré
  uniquement typé ; guard d'isolation du client et 26 tests PostgreSQL verts.
- `6b7a67ae0` : exclusions nommées de `.artifacts`, mocks, tests, coverage,
  E2E, rapports et résultats, préservant Next, PDF.js, Canvas et ressources.
  Test rouge sur le manifeste synthétique puis vert ; tests d'audit artefact
  et typecheck verts avant commit. Build complet à renouveler.

Restauration de la base synthétique : dump chiffré AES-256-CBC/PBKDF2
200 000 itérations, répertoire 0700/fichiers 0600, rétention maximale 72 h.
Restauré sur une autre base jetable : 124 migrations, 121 tables et 284 lignes
identiques. Ce test ne remplace pas la restauration de la production.

État actuel : NOT_READY ; tests exacts et E2E à renouveler, parcours annoncés
à qualifier, gates TLS/runbook/backup réel/rétention/roster/revue toujours
non prouvées. Les sources gelées restent inchangées selon les vérifications
décrites, avec l'exception possible de l'objet write-tree déjà consignée.

## Qualification du SHA 39aa0fcdf et lot récupération de compte

Sur `39aa0fcdf3b728e3f668d2cf4ab3b9d2f6491562`, après correction du harnais
TMPDIR : 1 266 suites / 14 226 tests unitaires, 67 suites / 647 tests
Core-v2 PostgreSQL avec ClamAV, 11 suites / 52 intégrations Core-v1 et
20 suites / 289 tests DB passent, sans ignorés. Lint, types et build complet
passent ; extraction standalone PDF.js réelle et contrôle négatif passent.
Les exécutions antérieures en échec sont conservées : TMPDIR imbriqué dans
le dépôt invalidait les hypothèses de stockage/isolation et le lancement
Chromium. Les temporaires générés par ce seul harnais ont été inventoriés
puis nettoyés ; aucun ancien worktree n'est concerné.

E2E Chromium : 75 scénarios exécutés, 69 succès, 6 échecs, aucun ignoré.
Cinq échecs de redirection avaient une cause de configuration du harnais :
BASE_URL sur 127.0.0.1 et NEXTAUTH_URL sur localhost provoquaient un changement
d'hôte sans cookie. Le sixième démontre une course d'hydratation du formulaire
oubli de mot de passe. Un test bloquant les chunks JavaScript échoue avant
correction (champ actif avant hydratation). Le formulaire reprend la garde
d'hydratation du formulaire signin existant. La confirmation reset utilise
déjà une frontière Suspense client : un scénario supposant un champ SSR
a été rejeté, sans modifier cette page.

Les huit pages publiques passent à 390 et 1 440 px : HTTP 200, un H1, sans
débordement horizontal mesuré. Captures homepage/contact inspectées ;
adresses distinctes et CTA lisibles. Ce contrôle ne vaut pas conformité
WCAG complète ni qualification de toutes les pages authentifiées.

Les preuves du SHA précédent ne qualifient pas le nouveau commit. Build et
E2E doivent être renouvelés. Changement du mot de passe authentifié absent
en API/UI et longueur bcrypt des nouveaux mots de passe : lot à poursuivre.
Statut reste NOT_READY ; aucune promotion ou mutation production effectuée.

## Qualification du SHA 9bc7816 et correction du harness

Sur `9bc781657b8ef58459c77373b5a8a9deb833b600`, build, lint, typecheck et
647 tests Core-v2 passent. La campagne navigateur Node 22, PostgreSQL Core-v2
neuf et origines localhost cohérentes passe : **81/81**, aucun test ignoré.
Deux suites unitaires complètes donnent chacune 14 225 succès et un timeout du
même test de navigation. Le mock `useRouter` recréait l'objet à chaque rendu,
relançant le fetch dépendant de cet objet. Le cas ciblé avec assertion d'une seule
requête échoue avant correction ; avec un routeur stable : 3/3 en 0,825 s.
Aucun délai augmenté ni assertion retirée. Les campagnes complètes doivent être
renouvelées après le commit de cette correction de test.

L'audit d'ownership distingue le lien de consentement aux bilans existant du
rattachement familial : `canonical-consent` permet volontairement une nouvelle
ligne vérifiée après retrait du consentement. Réutiliser ce seul état comme
révocation administrative globale serait insuffisant. Le mandat demande une
autorité familiale vérifiée et révocable ; cette séparation reste à réaliser et
à tester avant qualification production. Aucune exploitation en production.

## Limite des nouveaux mots de passe Core-v2

Bcrypt ignore les octets après le 72e. Le service acceptait jusqu'à 200 caractères,
ce qui rendait deux valeurs distinctes équivalentes. Deux tests PostgreSQL rouges
(73 octets ASCII, 74 octets UTF-8) démontrent l'acceptation avant correction.
La validation commune des nouveaux mots de passe impose désormais 8 caractères
minimum et 72 octets UTF-8 maximum. Les anciens credentials de connexion ne sont
pas réinterprétés. Les bornes exactes passent ; les refus laissent password,
sessionVersion, audit et jetons à usage unique inchangés.

Tests ciblés : 22/22. Suite Core-v2 complète : **67 suites, 653/653 tests**, aucun
ignoré. Typecheck et lint ciblé : exit 0 ; secret scan du diff : zéro détection ;
`git diff --check` : exit 0. Aucun schéma/migration modifié dans ce lot.
Ces preuves locales avant commit seront renouvelées sur le SHA final de release.

## Changement de mot de passe authentifié Core-v2

Critères : cible dérivée de l'acteur serveur, mot de passe actuel vérifié,
aucun userId accepté dans le body, CSRF et limite de corps réellement lu,
rate limit par identité, hash coût 12, CAS password/role/sessionVersion/status,
révocation atomique des sessions et des reset tokens, audit dans la transaction.
Le service ancien ignorait un `currentPassword` erroné et deux changements
simultanés réussissaient : deux tests PostgreSQL rouges, puis correction.
Les opérations reset prennent désormais le verrou User avant Invitation, dans
le même ordre que le changement authentifié, pour éviter une inversion de verrous.

API native ajoutée : `/api/v2/auth/password-change`. Formulaire protégé :
`/dashboard/account/security`, accessible depuis la navigation des dashboards.
Le formulaire attend l'hydratation, interdit les doubles soumissions, valide
confirmation/UTF-8, et distingue confirmation serveur et fermeture locale.
Core-v1 continue son parcours de réinitialisation existant ; son changement
avec mot de passe courant et audit durable reste une tranche distincte.

Tests PostgreSQL ciblés finaux : **39/39** (dont les cinq rôles, refus identité client,
CSRF exécuté en mode production, corps sans Content-Length, concurrence change/
reset et trigger PostgreSQL provoquant un échec d'audit avec rollback complet).
Le premier essai d'injection par spy échouait dans le harness ESM ; remplacé
par un refus INSERT réel, limité à la base jetable et nettoyé en finally.
Tests formulaire : **5/5**, dont déconnexion locale échouée. E2E deux navigateurs à 390/1440, axe et navigation clavier
ajoutés, **pas encore exécutés** au moment de cette entrée.

La suite unitaire canonique après correction du mock : **1 266 suites,
14 226/14 226 tests**, zéro ignoré. Cette campagne avait démarré sur b44421d0d ;
les changements Core-v2 ultérieurs sont exclus de cette lane, mais la preuve
ne qualifie pas un SHA ultérieur. Le lancement erroné avec jest.config.js a
été interrompu (Core-v2 mélangé à la lane unitaire sans son environnement),
journal conservé ; la commande correcte emploie jest.unit.config.js.

Le typecheck a détecté un scope de rate limit absent ; deux cas rouges du
limiteur réel démontrent l'erreur. Le scope est désormais enregistré avec les
presets auth existants, et les tests protègent agrégation par compte malgré
rotation IP et agrégation IP malgré rotation de compte. Le contrat exhaustif
est étendu avec assertion des deux presets, sans retrait d'assertion.
Le guard RBAC a refusé une lecture de rôle inline ; la vérification identité/
rôle est centralisée dans `rbac.ts` et le guard reste inchangé.
Les cinq suites ciblées UI/rate/architecture passent : **69/69 tests**.
