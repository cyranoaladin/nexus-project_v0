# Bilans de septembre — validation approfondie

## Objectif et méthode

Vérifier le parcours réellement utilisé par l’élève et le professeur : connexion et changement de code, questionnaire des deux niveaux, sauvegarde/reprise, transmission, lecture, annotation, correction, export, rapport familial et réouverture. Des tests unitaires reproductibles, des tests HTTP sur PostgreSQL réel et des scénarios Chromium complètent la vérification de l’artefact de production.

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

Campagne en cours. Les nombres définitifs, l’identifiant de release et les contrôles après déploiement seront inscrits ici après leur exécution.

## Limites d’interprétation

Les tests ne démontrent pas l’absence de tout défaut possible. Ils vérifient les scénarios et invariants décrits, sur le navigateur et l’environnement indiqués. Une coupure réseau empêche toute sauvegarde distante ; l’interface demande de garder la page ouverte jusqu’à la confirmation de synchronisation. La synthèse pédagogique nécessite toujours la relecture du professeur.
