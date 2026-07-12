# Pré-rentrée 2026 — conception du planning premium

## Contexte

La landing est fonctionnellement validée. Le planning existant restitue les bonnes
données, mais répète les cinq dates dans chaque carte, ne distingue pas les salles
et ne synchronise pas sa classe affichée avec le configurateur et les programmes.
La présente évolution est strictement visuelle et conserve le manifeste, les
créneaux, les dates, les douze modules et les tarifs.

## Architecture retenue

- Le manifeste validé reste l'unique source du planning.
- Le DTO serveur expose les semaines, les rôles de salle et les rôles enseignants
  déjà présents dans le manifeste, sans nouvelle logique métier dans le JSX.
- Un contexte client de campagne partage uniquement la classe réellement choisie
  par le parent. Une vue locale peut changer d'onglet sans muter le formulaire.
- Sans choix parent, les vues affichent Seconde par défaut sans enregistrer de
  sélection.
- Un module client-safe centralise les quatre familles de thèmes matière et leurs
  classes de contraste, d'impression et de focus.
- Un module client-safe centralise le statut public, l'heure française, le lieu et
  les intervalles de dates.

## Présentation

La section porte le titre « Planning et emplois du temps », une introduction
courte et une légende à quatre familles. Deux onglets accessibles proposent :

1. « Par classe de rentrée » : sous-onglets Seconde, Première et Terminale ;
   tableau HTML à six colonnes à partir de 640 px ; cartes compactes en dessous.
2. « Emploi du temps par semaine » : sous-onglets des deux semaines ; tableau
   Créneau/Salle 1/Salle 2 sur écran large ; liste par bloc sur mobile.

Chaque cellule occupée comporte un indicateur non chromatique, la matière, la
classe d'entrée, le bloc et la durée. Chaque cellule inoccupée affiche « Libre ».
Le bloc « Organisation pédagogique » décrit exactement trois rôles techniques
humanisés et deux salles, sans nom ni charge de gestion interne.

## Thèmes matière

- Mathématiques : bleu profond sur fond bleu clair.
- Français / Expression : bordeaux sur fond rose clair.
- NSI / SNT : violet sur fond lavande clair.
- Physique-Chimie : sarcelle sur fond turquoise clair.

Le doré reste réservé à la marque et à la sélection. Les thèmes sont identifiés
par un libellé et un pictogramme en plus de la couleur. Les variantes impression
restent lisibles en niveaux de gris.

## Accessibilité et responsive

- Radix Tabs fournit tablist, tab, tabpanel, aria-selected, flèches, Home et End.
- Les tableaux ont caption, en-têtes avec scope et intitulés de ligne.
- Les cibles interactives mesurent au moins 44 px et gardent un focus visible.
- Aucun tableau horizontal n'est rendu sous 640 px ; aucun débordement à 320 px.
- La couleur ne constitue jamais l'unique information.
- Les animations respectent reduced motion et les vérifications axe couvrent les
  deux vues, le configurateur et les programmes.

## Hors périmètre

Tarifs, disponibilités, programmes pédagogiques, dates, horaires, capacités,
Prisma, migrations, API, paiements, dashboards et production restent inchangés.
