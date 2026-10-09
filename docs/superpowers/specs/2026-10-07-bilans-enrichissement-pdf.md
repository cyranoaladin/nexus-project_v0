# Enrichissement des quatre bilans à partir des PDF de septembre

## Statut et demande

Conception validée par le « go » utilisateur le 7 octobre 2026. Le périmètre final comprend troisième, seconde, Terminale mathématiques et Terminale NSI, dans l’espace existant. L’implémentation, les tests et le déploiement sont autorisés ; les comptes et données existants doivent être préservés.

Sources utilisateur, huit pages chacune : `Nexus_Bilan_Septembre_2026_Troisieme.pdf` (SHA256 `5a19d48b90f7874150f9b0a3af2b5586d23ced2b5fb4cc2550efc9026c67069d`) et `Nexus_Bilan_Septembre_2026_Seconde.pdf` (SHA256 `d2a964607a9ed312e0c3c402162e00cbc3c7756f32501eef58cc90efb9a210e5`). Les inventaires dans `docs/pedagogie/bilans-enrichissement-pdf/` constituent la référence de couverture. Les figures ont été examinées, notamment les mesures de Thalès absentes de l’extraction textuelle.

## Résultat attendu

Chaque item, option, consigne et information pédagogique des PDF a une correspondance explicite : champ existant réellement équivalent, complément, ou adaptation motivée au niveau et à la matière. Aucune notion de collège n’est importée comme chapitre Terminale. Aucune présence d’un thème dans un support ne prouve qu’il a été travaillé : le périmètre individuel et les prérequis continuent à commander son affichage.

Les bilans couvrent parcours et assiduité déclarative ; attentes initiales et actuelles ; dix habitudes de travail ; réactions aux blocages ; travail personnel ; auto-positionnement ; réussites et difficultés contextualisées ; fonctionnement des séances ; compréhension, autonomie et confiance ; besoins d’aide hiérarchisés ; objectif disciplinaire et objectif méthodologique ; action, aide, échéance et critère de vérification ; préparation de la synthèse familiale et souhait d’échange individuel ; conditions, confiance et recul sur les essais.

L’identité disponible est affichée à partir du compte, sans redemander les identifiants. Les dates, absences et présences déclarées restent facultatives et ne sont pas présentées comme des données administratives vérifiées. Aucun contact parental supplémentaire n’est collecté.

Troisième : intégrer notamment le calcul littéral, les opérations détaillées sur fractions, les longueurs par similitude et Thalès/réciproque. Seconde : intégrer le calcul littéral et les précisions sur arithmétique/ensembles. Conserver les thèmes des livrets déjà présents. Ajouter les six essais de chaque PDF sous des identifiants nouveaux et avec les données complètes, sans remplacer les anciens essais.

Terminale maths : adapter les méthodes aux suites, indices, signes, hypothèses, preuves et contrôle des résultats déjà couverts. Terminale NSI : adapter aux contrats, traces, tests, objets, structures et récursivité déjà couverts. Conserver les banques disciplinaires actuelles et leurs conditions d’application.

## Compatibilité et cohérence

L’enrichissement est additif : identifiants, sens, énoncés et valeurs des réponses historiques conservés. Une nouvelle formulation qui mesure autre chose reçoit un nouvel identifiant. Les anciennes copies restent lisibles, les copies transmises restent verrouillées et les nouveaux champs demeurent vides jusqu’à réponse volontaire. Le numéro de version de l’activité ne constitue pas à lui seul un versionnement des copies.

Les questions réellement équivalentes sont réutilisées et documentées dans la matrice. Les questions complémentaires ont une fonction distincte ; elles sont réparties en rubriques courtes. Les échelles nouvelles sont des choix textuels explicites, avec absence d’occasion et refus de répondre. Elles ne deviennent ni un score ni une conclusion automatique de maîtrise. Le temps annoncé tient compte du questionnaire enrichi ; la sauvegarde permet de le compléter en plusieurs temps.

Les essais restent facultatifs, choisis avec le professeur, deux au maximum. La consigne initiale sans aide est adaptée à chaque essai : ne pas interdire globalement la calculatrice lorsque l’énoncé l’autorise, ni imposer l’exécution de code au premier raisonnement NSI. Les conditions et la confiance après essai sont des métadonnées facultatives conservées dans toutes les restitutions. Un essai non fait, un thème non travaillé ou une réponse manquante ne constituent pas un échec.

## Contrat technique

Conserver les limites actuelles : 16 étapes au maximum, 24 champs par étape, 5 000 caractères par valeur, 256 Kio par copie, deux essais sélectionnés. Pour les niveaux dépassant 24 compétences, conserver les compétences historiques sous `mastery` et ranger les nouvelles sous `mastery-extra`. Centraliser la lecture des deux étapes et l’association compétence/étape pour les prérequis, le questionnaire, la validation, les vues enseignant et le rapport. Cette association est stable par identifiant ; aucun découpage par position ne peut déplacer une ancienne compétence vers une autre étape.

Un type d’échelle compact utilise un contrôle natif accessible et la même validation de valeurs qu’un choix simple. Les essais ajoutent des propriétés facultatives validées pour conditions et confiance ; parser, édition, relecture, export et rapport doivent les préserver ensemble. Corrigés réservés au serveur. Les aides prioritaires sont validées parmi les aides effectivement choisies ; les options exclusives sont contrôlées côté client et serveur. La validation dépendante porte sur le contenu fusionné ; retirer une aide efface seulement la priorité devenue invalide, sans bloquer une sauvegarde ni supprimer les autres réponses.

Les routes, comptes, mots de passe, groupes et attributions restent identiques. Les métadonnées des quatre activités sont synchronisées par l’outil officiel après sauvegarde. Aucune migration de schéma prévue.

## Critères de recette

1. Matrice exhaustive des deux PDF relue, chaque référence reliée à un champ/texte/essai cible ou une adaptation pédagogique explicite.
2. Tests rouges puis verts pour nouveaux champs, contraintes, conservation des anciens contenus et filtrage par périmètre.
3. Tous les niveaux respectent les plafonds, sans rubrique vide accessible ; navigation trouvée par identifiant plutôt que par indice historique fixe.
4. Parcours E2E sur comptes fictifs : saisie, sauvegarde/rechargement, transmission, consultation enseignant, commentaire, export, rapport PDF et réouverture ; contrôle mobile et plusieurs navigateurs.
5. Régression des 846 tests existants (47 suites espace au contrôle préparatoire), tests d’intégration PostgreSQL jetable, typage/lint, compilation et vérification de l’artefact exact.
6. Déploiement atomique après sauvegarde, santé et fumée de production sur comptes techniques. Comparaison des comptes, attributions et réponses réelles avant/après ; aucune connexion ni écriture de test sous identité réelle.

## Retour arrière

Après saisie de nouveaux champs, une ancienne release ne sait pas nécessairement les valider. Préparer un retour arrière compatible avec les nouveaux identifiants et propriétés ou une correction en avant ; ne pas restaurer une ancienne base au prix de réponses récentes. Les artefacts précédents et sauvegardes sont conservés comme preuves et moyens de reprise, sans constituer une autorisation de suppression.

Revue indépendante de conception : couverture des quatre niveaux, cohérence et périmètre confirmés ; recommandations sur association stable des compétences, validation dépendante et retour arrière incorporées.
