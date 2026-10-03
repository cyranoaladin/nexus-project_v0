# Admission atomique des ateliers ARIA

## Critères et périmètre

Une dernière place ne peut être attribuée qu'une fois, y compris par deux
connexions PostgreSQL indépendantes. Un double clic est idempotent. Une
annulation ou modification de cours validée avant l'admission bloque celle-ci.
La capacité ne descend pas sous les présences existantes. L'intention email
chiffrée est enregistrée dans la transaction de l'inscription ; sa livraison
reste un événement fournisseur distinct, avec retries.

Le consentement/rattachement familial reste un lot séparé. Aucun changement de
prix, de programme, de canal externe ou de droit pédagogique n'est importé.

## Invariants

- Transaction READ COMMITTED et verrou session `FOR NO KEY UPDATE` paramétré.
- Relecture du statut, cours, inscription existante et compteur sous verrou.
- Unicité SQL historique session–élève conservée.
- Deux fonctions/triggers SQL protègent les écritures directes : statut et
  capacité d'admission, capacité nouvelle positive et compatible avec l'occupation.
- Tous les statuts de présence occupent une place, comme auparavant. Aucun
  crédit ou règle de libération n'est inventé.
- Échec de persistance de l'intention : rollback inscription. Provider indisponible :
  intention durable PENDING et worker séparé, jamais faux statut envoyé.
- Le lancement du drain se fait après commit. Aucun envoi réel dans les tests.

## Migration et compatibilité

Migration additive `20261003194000_aria_workshop_admission_invariants` :
un champ technique `admissionRevision` est ajouté avec défaut 0 ; aucun champ
existant, ligne historique ou PDF n'est supprimé/réécrit. Pas de
backfill. DDL dans BEGIN/COMMIT explicite ; fonctions/installation des triggers
forment une unité atomique. L'installation prend un verrou DDL bref sur les
sessions et inscriptions : évaluer attente/charge en préproduction avant promotion,
aucune durée production n'est annoncée à partir de ces fixtures.

Une session historiquement surchargée conserve ses inscriptions et permet les
updates qui ne changent pas sa capacité. Une nouvelle admission ne peut pas
aggraver cette surcharge. L'ancien client reste compatible avec le schéma ;
les écritures anciennes incohérentes sont refusées par la base et peuvent produire
une erreur générique dans l'ancienne UI. Le rollback applicatif conserve ces
gardes : aucune down migration destructive, aucune suppression de trigger sous pression.

Si un déploiement de migration est interrompu et marqué failed par Prisma,
la procédure opérateur devra vérifier l'absence complète de DDL partielle puis
utiliser le mécanisme Prisma documenté de résolution rolled-back avant relance.
Le test local ferme une connexion sans commit et vérifie le rollback PostgreSQL ;
il ne prétend pas avoir simulé le registre failed de Prisma en production.

## Preuves locales

- Cinq défauts de service/notification reproduits en rouge. Le sixième premier
  test SQL omettait updatedAt : fixture corrigée, puis vraie reproduction sur
  ancien schéma, deux admissions pour une place (une assertion rouge, cinq
  tests non sélectionnés). Aucun relâchement de l'assertion.
- Deux suites réelles finales : **34/34**, zéro ignoré, dont courses, SQL direct,
  annulation, changement de cours, capacité, audit de l'intention et retry.
- Ancien schéma : 124 migrations canoniques installées dans une nouvelle base
  jetable ; fixture de deux inscriptions pour capacité 1. Fermeture avant commit
  du DDL : aucun trigger installé. Migration/redeploy réussis ; comptages exacts
  des 120 tables applicatives inchangés ; update compatible et admission refusée.
- Base vide distincte : toutes les migrations, puis relance sans changement,
  puis les deux suites réelles ci-dessus.
- Première campagne élargie mélangée à la fixture historique : golden path
  refusait deux ateliers au lieu d'un ; preuve conservée, environnements séparés.
  Aucun changement d'assertion ou suppression de données réelles.
- Contrôle architectural initial lancé avec un nom de fichier inexistant :
  aucun test, échec explicite conservé ; relance avec les trois vrais guards.

Les preuves privées restent dans `.artifacts/recovery/` ; les URLs, clés de
fixtures et corps email ne sont pas reproduits ici. Ces résultats ne démontrent
ni sauvegarde production restaurée, ni déploiement, ni révocation TLS.


## Snapshots PostgreSQL et revue

Une première garde RC, conservée comme brouillon privé non committé, laissait
passer deux admissions SQL REPEATABLE READ ayant établi leur snapshot avant
la première écriture. La revue lecture seule l'a signalé ; un test réel rouge
confirme deux commits sans erreur. La migration finale installe atomiquement
le champ `admissionRevision` et les deux gardes. L'admission écrit réellement
cette révision sous verrou avant de compter : un snapshot ancien reçoit 40001,
une transaction RC recompte les inscriptions actuelles. La révision ne remplace
pas le compteur réel et ne touche pas updatedAt métier.

Toutes les preuves sont renouvelées sur de nouvelles bases, sans modifier les
bases du premier brouillon pour cacher l'écart. Le rôle DB applicatif doit pouvoir
mettre à jour la révision de session ; aucun SECURITY DEFINER n'est ajouté.
La clé dédiée de chiffrement outbox est une précondition : si elle manque,
l'inscription est refusée et annulée ; une panne du provider, elle, est gérée
après persistance par le worker. Les anciens clients n'ont pas à envoyer le
nouveau champ, dont le défaut est 0.


La fixture historique de la migration finale comporte 18 lignes applicatives
sur 120 tables (deux familles synthétiques et leurs inscriptions). Les 120
comptages sont identiques avant/après. C'est une preuve d'invariants et de
compatibilité, pas une mesure de volumétrie ou durée de migration production.
Prisma generate/validate, typecheck, lint ciblé et les trois guards Core-v2
réussissent après la correction RR. Le premier validate sans URL de fixture
refusait sa configuration ; preuve conservée, relance avec l'environnement
jetable réussie. Revue finale lecture seule : aucun P0/P1 concret dans ce lot,
sans remplacer la revue humaine exigée par GitHub.
