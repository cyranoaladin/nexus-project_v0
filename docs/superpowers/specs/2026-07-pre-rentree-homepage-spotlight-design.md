# Pré-rentrée 2026 — design du spotlight homepage

## Décision validée

L'option 1 place une bande de campagne premium immédiatement après la navbar et
avant le hero permanent. Le spotlight est rendu côté serveur avec un DTO minimal
dérivé de `getPreRentreeLandingDTO()` ; le composant ne lit aucun JSON et ne
contient aucune donnée commerciale recopiée.

## Cause du défaut actuel

La zone bleu nuit n'est pas causée par une hauteur minimale, un composant vide,
une animation bloquée ou une erreur d'hydratation. Elle correspond au hero réel :
sur mobile, l'image est rendue avant un contenu long, avec `py-16`, plusieurs
espacements et une transition basse de 80 px. L'ancienne bannière n'arrive
qu'après ce hero. La correction consiste donc à déplacer la campagne avant le
hero, sans réduire ni masquer le contenu permanent.

## Données

Le getter serveur expose seulement : identifiant de campagne, statut public,
cartouche de date, libellé accessible complet, classes d'entrée, familles de
matières, capacité, volume par matière, lieu, résumé éditorial existant, route
canonique et ancre planning. Les dates, capacités, heures et contenus proviennent
du DTO de campagne et du pricing canonique déjà résolu.

## Composition

Sur desktop, le composant forme trois zones asymétriques : cartouche date bleu
nuit, contenu central sur ivoire et colonne d'actions. Une bordure dorée de 5 px,
une ombre sobre et un contraste plus fort le distinguent des rubriques
permanentes. Sur mobile, la date devient un bandeau compact, les chips passent en
grille deux colonnes et les deux actions occupent toute la largeur.

L'ordre de lecture est date, statut, titre, classes, matières, résumé, chips,
actions. Le titre est un H2. La date visuelle dispose d'un texte complet pour les
technologies d'assistance.

## Navigation

Le lien desktop reçoit une icône calendrier, une bordure dorée et un fond doré
translucide. Sur mobile, l'action campagne remplace le bouton Connexion dans la
barre fermée afin de rester visible à 320 px. Connexion demeure accessible dans
le menu plein écran, ainsi que l'accès bilan/espace famille existant.

## Analytics

Quatre événements typés sont ajoutés : impression du spotlight, clic principal,
clic planning et clic navbar. Les seules propriétés sont `cta_location`,
`viewport_category`, `destination` et `campaign_id`. L'impression est protégée
par une ref afin de ne partir qu'une fois par montage.

## Hors périmètre

Hero permanent, routeur de niveaux, tarifs, dates, planning, programmes, Prisma,
migrations, API, paiements, dashboards et production ne changent pas.
