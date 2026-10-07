# Bilans Terminale maths et NSI — extension du 7 octobre 2026

## Contenu et périmètre

Deux profils ajoutés aux bilans de septembre : `tle-maths` et `tle-nsi`. Chacun propose six thèmes, huit essais possibles (deux maximum à choisir) et trente questions de méthodes, fonctionnement des séances, ressentis, difficultés et objectifs. Maths : 24 compétences sur les suites, la récurrence, les variations, les suites affines et, sous réserve de travail effectif, les limites/seuils. NSI : 22 compétences sur objets, contrats/TAD, ensembles, structures linéaires et récursivité.

Les sources et pages sont documentées dans `docs/pedagogie/bilans-terminale/`. Les sources non datées attestent un contenu disponible, pas une séance effectivement réalisée. Aucun chapitre du programme annuel ni stage hors accompagnement n’a été ajouté par défaut. Le questionnaire commence donc par la déclaration du périmètre réel ; une compétence non travaillée n’est jamais assimilée à une difficulté. Le bilan maths vise la spécialité de Terminale générale, pas automatiquement STMG ou mathématiques complémentaires.

Les énoncés sont autonomes ; calculs et cinq programmes Python vérifiés. Corrigés et points d’observation séparés dans une banque réservée au serveur et à la correction authentifiée. Les réponses ne produisent aucune note ou conclusion automatique de progression. Les rapports distinguent auto-positionnement, essais, aide, reprise et commentaire du professeur.

## Intégration et corrections de revue

- Registre commun profil/slug/matière/version ; NSI déclaré comme NSI dans le catalogue, les séances et les exports. Quatre aperçus enseignants ; intitulés du rapport adaptés à la matière.
- Banques, identifiants, options et version historiques 3e/2nde inchangés.
- Huit étapes, au maximum 24 champs chacune. Les rubriques inapplicables sont écartées de la navigation ; le lecteur enseignant contrôle aussi les thèmes des prérequis d’un essai.
- Refus et réponses exclusives NSI partagés entre formulaire et validation serveur ; impossibilité de combiner « aucune aide » et aide déclarée.
- Indentation Python conservée dans les énoncés et le rapport.
- Défaut préexistant découvert par la revue : après retrait d’inscription matière, une place de séance suffisait encore à accéder à une copie déjà créée. Contrôle d’inscription ajouté à chaque lecture/modification/transmission de bilan, avec quatre régressions reproduites avant correction.

## Vérifications avant compilation

- TDD : échecs observés avant implémentation sur reconnaissance des profils, matières/routes, en-têtes, exclusives, prérequis et révocation.
- 846 tests unitaires réussis, 47 suites espace (dont sync, formulaires, routes, rapports et banques historiques).
- 22 tests d’intégration en PostgreSQL jetable réussis, deux suites cycle de vie/attribution.
- TypeScript sans erreur, lint ciblé sans erreur, `git diff --check` propre.
- Revue indépendante pédagogique et technique terminée sans blocage restant sur le commit `76c545c59`.

## Affectations

L’espace contient actuellement les groupes `terminale-principal` et `jean-racine`, dont les inscriptions ont été inspectées en lecture seule. Une question précise sur les groupes/élèves destinataires a été posée. Les séances réelles de Terminale ne sont pas publiées sans confirmation de cette population, notamment pour distinguer spécialité et autres parcours de maths. Aucun code réel n’est réinitialisé et aucun compte réel n’est utilisé pour les tests.

## Artefact et campagne navigateur

Compilation de production réussie sur la source `c481fc9850712c411a409d91f831d4d1190ee7d7`, build `DSeStcoHpnln-KApVHN7Y`. Les contrôles de traces, ressources, copies statiques, provenance et absence de données d’exécution embarquées passent. Les seize corrigés Terminale sont absents des fichiers JavaScript publics. Les sommes de contrôle du transfert serveur correspondent exactement (rsync checksum sans écart).

Dix scénarios Terminale passent d’abord sur le serveur local de développement. La matrice suivante s’exécute sur l’artefact compilé, avec PostgreSQL et Redis jetables, sans compte réel.

La première campagne cumulée atteint la protection de connexion par IP (150 tentatives / 15 minutes), après les essais de développement et 78 E2E réussis. Le journal serveur identifie le refus `429 THROTTLED` ; la trace du scénario concerné montre une attente de connexion, avant les contrôles d’autorisation. La campagne est arrêtée (un échec de connexion, un scénario interrompu, trois non lancés). Les 31 Chromium et 26 Firefox sont intégralement réussis. Toute la suite WebKit est relancée avec un espace de clés Redis local distinct ; les seuils et le code de production ne sont pas modifiés. Pour reproduire plusieurs campagnes successives, isoler les espaces de clés des navigateurs ou repartir d’un harnais jetable neuf.

Le contrôle visuel des PDF a fait supprimer les balises Markdown brutes autour des énoncés Python ; leurs indentations sont conservées. Une nouvelle compilation complète a suivi cette finition.

Journaux, traces, captures et exports fictifs sont conservés hors dépôt, dans `~/.local/state/nexus-bilan-terminale-20261007/`. La relance isolée réussit : **26 WebKit / 26**, notamment le scénario bloqué à la connexion. Couverture finale de **83 scénarios réussis** sur l’artefact : 31 Chromium, 26 Firefox, 26 WebKit. Aucun changement de code applicatif entre les deux campagnes ; seule l’isolation des compteurs locaux change. Les 846 tests unitaires ont aussi été relancés avec succès après la dernière finition de contenu.

## Déploiement

Sauvegarde PostgreSQL préalable de 13 097 150 octets, permissions0600, dans `/var/backups/nexus/espace-bilan-terminale-20261007/before.dump`. Aucune migration de schéma. Synchronisation explicite des neuf activités par la CLI officielle de provisioning, puis audit et preflight sans écart. Bascule atomique verrouillée avec comparaison de la release attendue.

Release active : `c481fc985-espace-bilan-terminale-20261007`, build `DSeStcoHpnln-KApVHN7Y`. Santé interne et publique HTTP200, garde finale des pointeurs réussie. La release précédente est conservée pour retour arrière.

Les contrôles de production emploient exclusivement deux nouveaux comptes `val.*`, isolés dans `validation-technique`, et deux séances n’attribuant le bilan qu’à l’élève technique concerné. Fumée réussie pour les deux matières : aperçus mobiles et questions effectives, huit rubriques, essai/aide/reprise, sauvegarde après rechargement, transmission, correction, export JSON privé et PDF familial, retours visibles par l’élève. La copie maths conserve son état et sa révision après le parcours NSI. Captures mobiles inspectées, texte des deux PDF vérifié, aucune balise de code brute restante.

Les deux comptes techniques sont désactivés et les deux séances clôturées ; une relecture de la base confirme la fermeture. Les groupes réels gardent leurs effectifs et leurs séances antérieures. Le compteur de travaux réels reste14 avant/après ; aucune écriture n’a ciblé une réponse réelle. Les groupes Terminale réels restent sans séance de bilan publiée en attente de confirmation de la population.

Le harnais local et ses conteneurs jetables sont arrêtés et supprimés. Dernier contrôle public : HTTP200. Aucun identifiant, secret ou contenu réel d’élève n’est versionné.

## Liens de consultation

- Aperçu professeur maths : `https://nexusreussite.academy/espace/enseignant/bilans?niveau=tle-maths`
- Aperçu professeur NSI : `https://nexusreussite.academy/espace/enseignant/bilans?niveau=tle-nsi`
- Pages élèves après attribution : `/espace/bilan/tle-maths`, `/espace/bilan/tle-nsi`.

