# Enrichissement des quatre bilans de septembre à partir des PDF

## Demande et couverture

Plan validé par le « go » utilisateur. Seize pages analysées visuellement et par extraction ; inventaires et correspondances dans `docs/pedagogie/bilans-enrichissement-pdf/`. Les figures sont transcrites intégralement, notamment AM3, AB6, AN4 et BC10 pour Thalès.

| Profil | Questions réflexives | Compétences | Essais disponibles | Étapes |
|---|---:|---:|---:|---:|
| Troisième | 76 | 30 | 14 | 13 |
| Seconde | 79 | 30 | 13 | 13 |
| Terminale maths | 74 | 24 | 8 | 12 |
| Terminale NSI | 75 | 22 | 8 | 12 |

Les questions nouvelles restent facultatives ; le parcours peut être fractionné. Les dix habitudes emploient des choix compacts. Les essais restent séparés, facultatifs et limités à deux avec le professeur. Aucun score ni diagnostic automatique. Les nouveaux thèmes sont proposés uniquement après déclaration de travail effectif ; aucune notion collège/Seconde n’est importée comme chapitre Terminale.

## Conservation des données et restitutions

Banques historiques inchangées ; compléments distincts. Identifiants, énoncés, options et prérequis historiques conservés. Les compétences nouvelles utilisent `mastery-extra` sans déplacer les anciennes réponses. Nouveau code `difficulty` ajouté sans modifier le sens de `start`. Les aides prioritaires sont choisies parmi les aides sélectionnées, et seule une priorité devenue incompatible est vidée. Les conditions et la confiance des essais sont facultatives, validées et restituées dans la relecture, la vue enseignant, le rapport et l’export.

L’identité connue et le groupe de la copie sont affichés en lecture seule. La date `startedAt` est celle du début du bilan ; une revue a fait corriger un libellé qui la confondait avec le début de l’accompagnement. L’assiduité et la date de début Nexus sont des déclarations facultatives distinctes. Les copies transmises restent verrouillées ; les nouveaux champs vides ne sont pas interprétés comme une difficulté.

Navigation par identifiants et critères d’affichage adaptés aux deux étapes de maîtrise. Maximum 24 champs par étape, 16 étapes, 256 Kio par copie. Les douze nouveaux corrigés restent exclusivement dans le module `server-only`.

## Vérifications effectuées avant compilation

- TDD : échecs observés pour fichiers de données absents, rubriques nouvelles, maîtrise complémentaire, métadonnées d’essai, priorité dépendante, contexte, hints et retour après essais ; tests rendus verts.
- Régression initiale : 846 tests / 47 suites.
- Régression enrichie finale : 902 tests / 51 suites, tous réussis.
- Intégration PostgreSQL jetable : 23 tests / 2 suites, dont saisie complémentaire, transmission, récupération enseignant/export et verrouillage.
- Typage global, lint ciblé et `git diff --check` réussis.
- Revue pédagogique et technique indépendante : aucun P0/P1 restant identifié après correction de la date.

## Artefact exact

Compilation Node 22.23.1 du commit `d743d2fb10567eaabab5b4325743d108ff65010d` réussie, avec l’ensemble des contrôles de traces, ressources, absence de données runtime et validité standalone. BUILD_ID : `k90hnlhrcZWshgRWbc6uF`. Les 655 fichiers statiques source et standalone ont la même empreinte d’arbre : `76f07c4fc7cd8ccd35f2cc2d9580862235db098d639403d5fe5f03b8428d77b0`.

Contrôle complémentaire : les 43 attendus de correction sont absents des 584 fichiers JavaScript statiques publics (formes directe et échappée). Les quatre nouveaux scénarios de bout en bout passent d’abord sur serveur de développement ; campagne complète sur l’artefact final réussie. Un premier lancement du banc compilé a été interrompu : le namespace Redis choisi pour le test dépassait la limite de 32 caractères. La correction concerne uniquement l’environnement privé du banc, sans changement de l’application ni affaiblissement de ses protections.

La dernière relecture a précisé deux consignes, couvertes par trois tests supplémentaires : premier essai sans cours ni calculatrice en Seconde, prédiction sur papier avant exécution pour les essais NSI de lecture/trace. Le premier artefact a ensuite été remplacé par l’artefact final ci-dessus ; aucun déploiement intermédiaire n’a été activé.

Inspection visuelle préparatoire des quatre rapports fictifs : 20 pages (3e 3, Seconde 3, Terminale maths 7, NSI 7), sans texte tronqué ni superposition. Sur les deux rapports très peu remplis des niveaux 3e/Seconde, la mention finale occupait seule une dernière page : limite mineure de pagination, sans perte de contenu. Les rapports de production sur comptes fictifs font l’objet d’une vérification distincte.

La sauvegarde avant publication est stockée dans `/var/backups/nexus/bilan-enrichment-20261007-i0qPRg/before.dump` : 13 101 011 octets, permissions 0600, empreinte enregistrée et archive vérifiée par `pg_restore --list`. Les activités existent déjà ; simulation de synchronisation des neuf entrées du catalogue effectuée sans écriture.

## Recette finale avant publication

95 exécutions E2E réussies, sans nouvelle tentative automatique : Chromium 35/35 (6,0 min), Firefox 30/30 (5,0 min), WebKit 30/30 (5,9 min). Chaque campagne utilise un namespace de limitation de débit neuf sur le banc local, avec les protections applicatives inchangées. Le processus de prévisualisation et son répertoire ont été vérifiés à chaque rotation ; même SHA et même BUILD_ID que l’artefact final.

Couverture : quatre parcours enrichis, saisie et rechargement, aides prioritaires, réponses facultatives, essais et reprises, interruption réseau, fermeture/reprise IndexedDB, conflits entre deux onglets, transmission et lecture seule, réouverture, récupération enseignant, annotations, exports privés et rapports, droits par élève/groupe/matière, indépendance des copies maths/NSI, mobile 390 px, connexion avant hydratation et sans JavaScript. Les cinq scénarios propres à l’enseignant avec génération PDF sont exécutés sous Chromium ; les 30 autres sont exécutés sur chacun des trois moteurs.

Une première campagne sur l’artefact préliminaire avait 33 succès et deux assertions de test devenues obsolètes (« Essai non fait » remplacé par « Essai non fait — aucune conclusion de maîtrise. »). Ces assertions ont été corrigées ; les 95 exécutions finales sont toutes vertes.

Empreintes avant bascule : comptes, secrets de connexion, groupes, inscriptions, séances, 50 copies existantes, annotations et historiques inchangés. Les mêmes empreintes sont confirmées inchangées après publication et recette en ligne.

## Publication et vérification en ligne

- Site : https://nexusreussite.academy/espace.
- Release active : répertoire `d743d2fb1-espace-bilan-enrichissement-20261007` sous la racine des releases du serveur, SHA et BUILD_ID conformes à l’artefact testé.
- Archive transférée vérifiée par SHA-256. Catalogue de neuf activités synchronisé par la commande officielle, puis audité sans écart ; les quatre bilans sont en version `2026-09.2`, avec 13/13/12/12 étapes.
- Bascule par le script officiel, verrou et comparaison de la release précédente `c481fc985-espace-bilan-terminale-20261007`. Gardes avant/après réussies ; santé interne et publique HTTP 200, connexion publique HTTP 200.
- Deux nouveaux comptes exclusivement techniques, quatre séances avec un unique participant fictif. Le premier plan a refusé une homonymie avec d’anciennes identités techniques, avant toute écriture ; des noms techniques distincts ont été utilisés, sans adopter ni réinitialiser de compte existant.
- Quatre parcours de production validés : aperçu enseignant mobile, thèmes/maîtrise, questions de chaque rubrique, premier essai/aide/reprise/conditions/confiance, sauvegarde/rechargement, transmission, verrouillage, commentaire/correction, export JSON privé, synthèse PDF et lecture des retours par l’élève. Indépendance des quatre copies contrôlée.
- La dernière reprise de page NSI a été interrompue par `ERR_NETWORK_CHANGED` lorsque l’arrêt du Docker local a modifié les interfaces du navigateur de recette. Seul le parcours NSI a été repris ; les trois copies déjà corrigées ont été revérifiées en lecture seule, sans les modifier. Résultat consolidé : quatre profils réussis. Aucun changement applicatif n’a été effectué après le gel de l’artefact.
- Inspection finale des quatre PDF de production fictifs : **16 pages**, sans coupe, superposition ou débordement significatif. Quatre captures mobiles d’essai et les aperçus de maîtrise complémentaire également examinés. Les nouvelles rubriques, les traces, les aides et les observations sont présentes et lisibles.
- Quatre séances techniques clôturées et deux comptes désactivés. Les comptes réels, leurs identifiants/secrets, groupes, inscriptions, séances, 50 copies préexistantes, annotations et historiques conservent leurs empreintes de référence. Parmi ces copies, 14 appartiennent aux groupes réels ; les autres sont des copies techniques antérieures.
- Serveur de recette compilé arrêté ; conteneurs PostgreSQL/Redis jetables supprimés. Preuves privées conservées dans `/home/alaeddine/.local/state/nexus-bilan-enrichment-20261007` ; sauvegarde et ancienne release conservées sur le serveur. Aucun secret ni contenu de réponse réelle n’est ajouté au dépôt.

## Limites de la preuve

Les tests couvrent les scénarios décrits et les trois moteurs vérifiés ; ils ne constituent pas une garantie d’absence absolue de défaut sur tout appareil et toute situation. Le rapport est une restitution à relire et compléter par l’enseignant, sans note ni diagnostic automatique. Une rubrique non renseignée n’est pas interprétée comme une difficulté.

## Retour arrière

Après saisie de nouveaux champs, une ancienne release peut rejeter leur validation. Ne pas restaurer la base en supprimant des réponses récentes. Employer un correctif compatible avec les nouveaux IDs/propriétés, ou limiter temporairement les écritures avant reprise. Les sauvegardes et l’ancienne release sont conservées, mais ne constituent pas à elles seules un retour arrière applicatif compatible.
