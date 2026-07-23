# Homepage Mobile Candidat Libre Design

## Contexte

La page d'accueil `nexusreussite.academy` est rendue par Next.js depuis `app/page.tsx`, qui injecte le fichier statique `Nexus_Reussite_Accueil.html`. La production tourne derrière Nginx vers le process PM2 `<PROCESS_NAME>` sur `127.0.0.1:3001`.

Audit mobile initial sur `https://nexusreussite.academy`:

- Aucun scroll horizontal détecté sur 320, 390 et 430 px.
- Le hero mobile est trop long: environ 1565 px sur iPhone SE, 1366 px sur iPhone 14, 1212 px sur Galaxy.
- Sur iPhone SE, le CTA WhatsApp du hero n'est pas visible dans le premier écran.
- Sur iPhone 14, le CTA apparait très bas, autour de 753 px.
- Le contenu actuel est riche mais compressé depuis une logique desktop, ce qui retarde la compréhension et l'action.

## Décisions Validées

Audience prioritaire mobile:

- Candidats libres.
- Élèves en double cursus.
- Parents qui cherchent un cadre, une visibilité et un interlocuteur clair.

Direction retenue:

- Approche 1: landing mobile "Candidat libre sans flou".
- Le premier écran doit adresser le risque principal: préparer le bac français sans établissement, donc sans cadre pédagogique et administratif.
- Le bilan offert reste l'action commerciale principale, mais il est présenté comme moyen de clarifier le dossier et la stratégie.

## Design Mobile

Le hero mobile devient court, ciblé et orienté conversion.

Contenu attendu:

- Eyebrow: `CANDIDAT LIBRE · DOUBLE CURSUS`.
- Titre: `Ne laissez pas le bac français sans cadre.`
- Sous-texte: `Carte d'examen, Cyclades, bacs blancs, bulletins et suivi parents pour avancer sans flou.`
- CTA principal: `Réserver le bilan offert`, lien WhatsApp existant.
- CTA secondaire: `Voir l'accompagnement`, ancre vers la preuve ou la méthode.
- Trois preuves scannables dans le premier écran: `Cyclades`, `Bacs blancs`, `Parents`.

La section suivant le hero doit faire le pont "problème -> solution":

- Titre court: `Le vrai problème`.
- Texte: sans établissement, la famille doit piloter seule les épreuves, le dossier et le rythme.
- Trois blocs preuves:
  - `Carte d'examen`: coefficients, modalités, calendrier.
  - `Cadre pédagogique`: groupes limités, référent, bulletins.
  - `Entraînement officiel`: bacs blancs et corrections exploitées.

## Structure Mobile

Ordre recommandé sur mobile:

1. Header compact.
2. Hero candidat libre / double cursus.
3. Problème et preuve rapide.
4. Méthode Nexus ou comparaison raccourcie.
5. Offres principales, en cartes plus compactes.
6. Stages d'août comme offre secondaire saisonnière.
7. Candidats libres détaillé.
8. Suivi en ligne.
9. FAQ.
10. CTA final.

Le desktop peut rester proche de l'existant. Les changements prioritaires sont mobiles, via CSS responsive et ajouts HTML limités.

## CTA Et Friction

Le lien WhatsApp reste le canal prioritaire.

Règles UX mobile:

- CTA principal visible sans scroll sur 390 px et, autant que possible, sur 320 px.
- Touch target minimum 44 px.
- Sticky WhatsApp après le premier scroll, fixé en bas, avec marge de sécurité pour ne pas masquer le contenu.
- Le bouton sticky doit être absent ou discret dans le premier écran pour éviter de doubler inutilement le CTA principal.
- Menu mobile doit se fermer après clic d'ancre et ne pas couvrir durablement la page.

## Contraintes Techniques

Fichiers concernés attendus:

- `Nexus_Reussite_Accueil.html`: source HTML/CSS/JS de la home.
- `app/page.tsx`: à éviter sauf besoin de structure d'injection.
- `e2e/pages-public-homepage-mobile.spec.ts`: tests Playwright mobile existants à étendre.

Contraintes:

- Ne pas réécrire les autres pages.
- Ne pas casser les ancres existantes.
- Conserver les liens WhatsApp vers `wa.me/21699192829`.
- Garder le logo et les couleurs de marque, tout en évitant une page mobile trop dominée par un bloc hero long.
- Ne pas introduire de dépendance front-end pour cette optimisation.

## Tests Et Critères D'Acceptation

Critères Playwright:

- Pas de scroll horizontal sur 320, 390, 430 px.
- Le H1 mobile est visible dans le premier écran.
- Le CTA WhatsApp du hero est visible dans le premier écran sur 390 px.
- Le CTA WhatsApp du hero mesure au moins 44 px de haut.
- La mention `CANDIDAT LIBRE · DOUBLE CURSUS` est visible sur mobile.
- Les preuves `Cyclades`, `Bacs blancs`, `Parents` sont visibles rapidement.
- Le sticky WhatsApp apparait après scroll et pointe vers `wa.me/21699192829`.
- Le menu mobile s'ouvre, affiche les ancres clés, puis se ferme après clic.

Vérification manuelle:

- Captures Playwright à 320x568, 390x844, 430x932.
- Lecture du premier écran sans chevauchement texte/boutons.
- Aucun contenu essentiel masqué par le sticky CTA.
