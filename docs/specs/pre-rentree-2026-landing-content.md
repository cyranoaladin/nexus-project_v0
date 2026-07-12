# Contenu actif — Landing Pré-rentrée 2026

> Version : 1.1.0
>
> Statut : `VERIFIED_IN_TEST`
>
> Dernière mise à jour : 2026-07-12

Ce document remplace la version 1.0.0 du contenu de landing. Les chaînes exécutables restent centralisées dans `data/campaigns/pre-rentree-2026.json` et `content/pre-rentree-2026/modules.json` ; ce document en fixe la sémantique produit.

## Public et invariant

La campagne s'adresse aux élèves selon leur classe d'entrée à la rentrée 2026-2027 :

- élève actuellement en Troisième : **Entrée en Seconde** ;
- élève actuellement en Seconde : **Entrée en Première** ;
- élève actuellement en Première : **Entrée en Terminale**.

Le configurateur emploie « Classe de rentrée ». Une surface publique active ne présente pas l'élève comme ayant déjà suivi le programme de la classe cible.

## Hero

- Surtitre : « Stages de pré-rentrée 2026 · Mutuelleville, Tunis ».
- H1 : « Deux semaines pour préparer sérieusement la rentrée ».
- Sous-titre : « Du 17 au 28 août 2026, pour les élèves entrant en Seconde, Première ou Terminale. Une à quatre matières au choix : Mathématiques, Physique-Chimie, Français et informatique/NSI — initiation informatique, algorithmique et SNT pour l'entrée en Seconde. »
- Faits : 17–28 août 2026 ; cinq séances de deux heures par matière ; groupes de trois à cinq ; présentiel à Mutuelleville ; une à quatre matières.
- CTA : « Composer le stage de mon enfant », « Voir les horaires », « Poser une question ».

## Configurateur

### Étape 1 — Classe de rentrée 2026

- Entrée en Seconde ;
- Entrée en Première ;
- Entrée en Terminale.

### Étape 2 — Profil pédagogique

- Entrée en Seconde : tronc commun, sans prérequis NSI.
- Entrée en Première : voie générale/technologique, profil Maths EDS ou hors EDS, profil EAF général ou technologique.
- Entrée en Terminale : spécialités conservées (maximum deux) et option Mathématiques distincte (`AUCUNE`, Maths expertes ou Maths complémentaires).

Maths expertes et Maths complémentaires sont des options, jamais un troisième EDS. Les choix incohérents ou incomplets entraînent une validation pédagogique explicite.

### Étape 3 — Matières

- Mathématiques ;
- Physique-Chimie ;
- « Initiation informatique, algorithmique et SNT » pour une entrée en Seconde, NSI pour les autres classes d'entrée ;
- Français, Français EAF ou « Expression écrite, argumentation et maîtrise de l'oral » selon la classe d'entrée.

### Étape 4 — Résumé

Le résumé desktop et mobile affiche la classe de rentrée, le profil, les matières, les dates de présence, les semaines, horaires, séances, volume, pack, prix, acompte, solde et éventuelle validation pédagogique. Les CTA ouvrent le bilan prérempli ou WhatsApp ; aucun paiement n'est initié.

## Programmes par transition

### Entrée en Seconde — transition Troisième–Seconde

- Mathématiques : calcul, calcul littéral, proportionnalité, fonctions élémentaires, résolution et rédaction ; introduction progressive des attentes de Seconde.
- Français : compréhension, expression, grammaire, argumentation et méthode du lycée.
- Initiation informatique, algorithmique et SNT : aucun prérequis NSI, aucune EDS, jamais « NSI Seconde ».
- Physique-Chimie : acquis de collège, unités, grandeurs, calcul et raisonnement scientifique avant les méthodes de Seconde.

### Entrée en Première — transition Seconde–Première

- Mathématiques : prérequis de Seconde, différenciation Maths EDS/hors EDS, sans supposer la Première déjà étudiée.
- Français EAF : préparation de l'EAF à venir, différenciée entre voies générale et technologique.
- NSI : démarrage possible sans NSI antérieure, à partir de l'algorithmique, Python et des fondamentaux.
- Physique-Chimie : prérequis de Seconde et préparation à l'EDS de Première.

### Entrée en Terminale — transition Première–Terminale

- Mathématiques : EDS Mathématiques distingué des options Maths expertes et Maths complémentaires.
- NSI : pour les élèves conservant l'EDS NSI ; prérequis de Première NSI ; validation pédagogique si le profil est absent ou incompatible.
- Physique-Chimie : pour les élèves conservant l'EDS PC ; prérequis de Première PC.
- Expression : « Expression écrite, argumentation et maîtrise de l'oral », jamais « EAF Terminale ».

Les 12 modules contiennent exactement cinq séances chacun, soit 60 séances.

## Planning et ressources

Le planning approuvé ne change pas : cinq jours du 17 au 21 août et cinq jours du 24 au 28 août, aucun cours les 22 et 23 août.

- `MATHS_NSI_SNT_TEACHER` : six modules, 30 séances, 60 h, sans simultanéité.
- `FRENCH_TEACHER` : trois modules semaine 1, 15 séances, 30 h.
- `PHYSICS_CHEMISTRY_TEACHER` : trois modules semaine 2, 15 séances, 30 h.
- Salle logique 1 : Mathématiques/NSI/SNT.
- Salle logique 2 : Français semaine 1, Physique-Chimie semaine 2.
- Maximum : deux salles simultanées et six heures par rôle enseignant et par jour.

Aucun nom personnel n'est publié ni stocké dans le manifeste.

## Tarifs

Les prix sont résolus depuis le pricing canonique :

| Matières | Volume | Prix par élève | Acompte | Solde |
|---:|---:|---:|---:|---:|
| 1 | 10 h | 480 TND | 140 TND | 340 TND |
| 2 | 20 h | 900 TND | 270 TND | 630 TND |
| 3 | 30 h | 1 350 TND | 410 TND | 940 TND |
| 4 | 40 h | 1 800 TND | 540 TND | 1 260 TND |

Aucun prix barré, remise automatique, Carte Nexus, ancienne durée, disponibilité fictive ou paiement en ligne n'est affiché.

## Conditions pratiques et commerciales

- Présentiel au centre d'accompagnement pédagogique de Mutuelleville.
- Cinq séances de deux heures par matière.
- Ouverture à partir de trois élèves, maximum cinq.
- Décision d'ouverture le 10 août 2026 à 18:00.
- La pré-inscription transmet une demande et ne confirme pas une place.
- Une demande sans acompte ne bloque pas une place.
- La confirmation intervient après validations administrative et pédagogique, puis réception de l'acompte.
- Si Nexus n'ouvre pas le groupe, tout acompte déjà versé est intégralement remboursé.
- Un report nécessite un accord écrit ; aucune conversion automatique en cours individuel.
- Aucun paiement en ligne sur la landing et aucun résultat scolaire garanti.
- Les conditions contractuelles applicables sont communiquées avant confirmation.

## Bilan et WhatsApp

Le bilan affiche « Classe de rentrée », le libellé « Entrée en… », le profil, les matières, le pack et le contexte Pré-rentrée 2026. Le parent peut modifier ces données.

Le message WhatsApp contient la classe de rentrée, le profil, les matières, le volume, les dates, les horaires, le pack lisible, le prix et l'acompte. Il est généré par `buildWhatsAppUrl()` et ne contient aucun code de pack technique ni PII.

## FAQ active

La FAQ couvre notamment : élèves entrant en Seconde/Première/Terminale, une ou deux semaines, SNT contre NSI, profils Maths Première, EAF général/technologique, options Maths Terminale, seuil/capacité, acompte, non-ouverture, report écrit, liste d'attente, absence, matériel, groupe complet, absence d'engagement d'une demande non payée et conseil personnalisé.

Les réponses reprennent les conditions ci-dessus et ne promettent ni place, ni rattrapage, ni résultat.

## CTA final

- « Composer le stage » ;
- « Bilan gratuit » ;
- « WhatsApp ».

Le CTA principal revient au configurateur ; les deux alternatives permettent une qualification sans paiement.
