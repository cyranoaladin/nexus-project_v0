# Bilans de septembre — validation approfondie

## Objectif et méthode

Vérifier le parcours réellement utilisé par l’élève et le professeur : connexion et changement de code, questionnaire des deux niveaux, sauvegarde/reprise, transmission, lecture, annotation, correction, export, rapport familial et réouverture. Des tests unitaires reproductibles, des tests HTTP sur PostgreSQL réel et des scénarios Chromium, Firefox et WebKit complètent la vérification de l’artefact de production.

Les essais modifiant des réponses utilisent uniquement des personnes fictives sur une base PostgreSQL jetable, avec Redis dédié. Aucune donnée ni aucun code des neuf élèves inscrits ne sont utilisés dans cette campagne. Les fixtures vérifient l’origine locale et le nom de la base avant toute écriture, puis suppriment leurs données. Le harnais reproductible est documenté dans `e2e/bilan-validation/README.md`.

Un test de régression a d’abord reproduit chaque défaut corrigé. Les erreurs de préparation du harnais (configuration Redis et longueur de namespace) ont été distinguées des défauts applicatifs.

## Couverture

- Les huit étapes des deux niveaux ; choix simples, multiples, refus de répondre, champs libres, aides, reprise, maximum de deux essais et dépendances des compétences.
- Fidélité des caractères français, formules, sauts de ligne et contenu ressemblant à du HTML ; absence d’exécution de ce contenu.
- Validation de toutes les options de la banque, clés inconnues, JSON malformé, tailles limites et absence de modification en cas de rejet.
- Sauvegarde asynchrone, IndexedDB, panne réseau, chargement tardif du brouillon, plusieurs modifications en attente, deux appareils, résolution explicite des conflits et révision optimiste.
- Remise pendant une sauvegarde ; verrouillage ; rejeu sans double instantané ; réouverture et nouvelle confirmation de relecture.
- Attribution du bon niveau ; élève voisin, compte sans attribution, enseignant hors périmètre, visiteur, compte désactivé et séance clôturée.
- Commentaires globaux et ciblés, visibilité après correction, panne d’enregistrement, conservation d’une nouvelle saisie et isolation entre copies.
- Consultation d’une ancienne version puis retour à l’actuelle ; protection contre les réponses réseau tardives.
- Exports par copie, séance et élève : réponses, historique, observations, statut, absence de codes et identifiants de connexion.
- Rapport familial imprimable : restitution fidèle, distinction déclarations/observations, contraste des titres, PDF A4 et mise à jour après reprise.
- Chargement JavaScript retardé ou absent à la connexion et au changement de code ; aucune soumission native de secret dans l’URL.

## Corrections vérifiées

Le moteur de synchronisation conserve les différentes bases de comparaison des modifications en attente, restitue les fusions du serveur à l’interface, préserve une frappe survenue pendant le chargement du brouillon et attend les sauvegardes avant transmission. Le contenu normalisé renvoyé par le serveur est réconcilié avec les modifications locales. Le stockage local attend la fin de transaction ; son repli en mémoire n’est plus présenté comme une sauvegarde durable.

Côté serveur, le rejeu d’une réponse normalisée est reconnu. Une modification effective des réponses invalide la confirmation ; la réouverture la réinitialise sans changer les réponses pédagogiques ni leur instantané de remise. La révision est vérifiée lors de la relecture concurrente.

Côté enseignant, le changement de copie réinitialise les états propres à cette copie. Une réponse historique tardive ne remplace plus la version sélectionnée ensuite. L’acquittement d’un commentaire n’efface plus une nouvelle saisie effectuée entre-temps.

Les formulaires de connexion et de changement de code attendent l’initialisation JavaScript avant d’autoriser une saisie et utilisent aussi `method="post"` comme défense contre une soumission native.

## Résultats et livraison

- Suite unitaire complète : **1 162 suites, 13 658 tests et 7 snapshots réussis**. La vérification finale ciblée du moteur de synchronisation passe également (25 tests).
- Intégration Espace sur PostgreSQL jetable : **11 suites et 178 tests réussis**, dont les limites de validation et le cycle complet de remise, correction et réouverture.
- TypeScript, lint et compilation de production réussis ; avertissements historiques du lint sans erreur. Vérification de l’artefact : 655 fichiers statiques contrôlés.
- La récupération de deux rubriques hors connexion après fermeture réelle de l’onglet et réouverture via IndexedDB, ainsi que la connexion avec JavaScript retardé, passent sur les trois moteurs (6 scénarios).
- E2E sur l’artefact compilé : **47 scénarios réussis** (19 Chromium, 14 Firefox, 14 WebKit), sans nouvelle tentative automatique après échec. Les quatre parcours intégraux Chromium/Firefox ont aussi été rejoués après stabilisation du geste de sélection : 4/4 réussis.
- Publication effectuée : source applicative `c8e52e68720509c9dbc5c897e9a5ccdc33027dc5`, build `SOcbVfH-9HsiWgaKydsal`, release `c8e52e687-espace-bilan-fiabilite-20261007T1039Z`. Le catalogue de 7 activités, les sommes de contrôle du transfert, le garde de bascule et la santé HTTP 200 ont été vérifiés. Sauvegarde préalable conservée ; aucune migration de schéma nécessaire.
- Après déploiement, deux parcours réels sur `nexusreussite.academy` ont réussi avec des comptes techniques : saisie sur mobile, sauvegarde et rechargement, remise, lecture exacte par le professeur, commentaire, correction, export, PDF familial et lecture seule avec retour visible côté élève. Le compte technique sans attribution ne peut ouvrir aucun bilan.
- Les quatre comptes techniques ont été désactivés et leurs deux séances clôturées après le test. Le contrôle en lecture seule confirme les groupes réels de 4 élèves de troisième et 5 de seconde, leurs séances publiées et zéro copie réelle créée par cette campagne. Les neuf comptes réels et leurs codes n’ont pas été employés.
- Les pages protégées redirigent les visiteurs vers la connexion ; les deux PDF de production contiennent les réponses et commentaires attendus. Les rapports PDF sont issus uniquement des données fictives.

Les journaux, résultats techniques et PDF de test sont conservés dans le dossier privé local `~/.local/state/nexus-bilan-validation-deep-20261007/`. Le code des tests et le harnais sont versionnés ; les secrets et fichiers de codes ne le sont pas.

## Diagnostic des navigateurs

Un échec intermittent du clic automatisé WebKit a été instrumenté : le pointeur était pressé sur un petit bouton radio au bord de l’écran puis relâché sur un autre élément après déplacement de la page. Aucun événement de changement n’atteignait le champ ; il ne s’agissait pas d’une réponse enregistrée puis perdue. Le parcours affiche désormais la carte entière, attend sa stabilité géométrique puis effectue un seul clic, suivi de l’assertion de sélection. Trois répétitions complètes du scénario de seconde ont réussi. Aucun second clic automatique ni changement des assertions métier n’a été ajouté. Les autres interactions restent testées normalement.

Le test de JavaScript retardé retient puis libère les téléchargements dans la même page. Il ne simule plus un téléchargement annulé, que WebKit pouvait conserver en échec lors de la navigation suivante. Un ancien verrou Firefox sans processus actif a été archivé avant exécution ; il s’agissait d’un incident de préparation locale.

## Limites d’interprétation

Les tests ne démontrent pas l’absence de tout défaut possible. Ils vérifient les scénarios et invariants décrits, sur le navigateur et l’environnement indiqués. Une coupure réseau empêche toute sauvegarde distante ; l’interface demande de garder la page ouverte jusqu’à la confirmation de synchronisation. La synthèse pédagogique nécessite toujours la relecture du professeur.
