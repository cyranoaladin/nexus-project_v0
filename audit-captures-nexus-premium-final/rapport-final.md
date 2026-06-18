# Rapport final — passe premium Nexus Réussite

Date de vérification : 9 juin 2026  
URLs vérifiées :
- https://nexusreussite.academy/
- https://nexusreussite.academy/catalogue-nexus-reussite-2026-2027.html
- https://nexusreussite.academy/nexus_selecteur.html

## Déploiement

- Sources synchronisées vers `/var/www/nexus-project_v0`.
- `npm run build` exécuté sur le serveur.
- Injection build-time : 129 marqueurs traités, 0 résiduel.
- `public/` et `.next/standalone/public/` identiques sur les fichiers publics contrôlés.
- `pm2 restart nexus-prod --update-env` effectué.
- `nexus-prod` : online.

## MD5 production

| Page / fichier | MD5 servi / déployé |
|---|---|
| `/` | `d8a102678e9893e229d329a0e103d615` |
| `/catalogue-nexus-reussite-2026-2027.html` | `d191c992ffe8342d465d7b98864e91b9` |
| `/nexus_selecteur.html` | `4bfabb1b51c48ee7717a7cdf7fae97cd` |
| `/mentions-legales.html` | `d02b76ea6045f78cae3777b77532ff2c` |
| `/confidentialite.html` | `774af70e9c953a92e0072b69f96140c9` |

Headers publics cache-bustés : HTTP 200 sur les cinq URLs contrôlées, `Date` et `Last-Modified` du 9 juin 2026 pour les pages statiques.

## Tests

- Unit source unique : `20 passed`.
- E2E publics Playwright : `34 passed`.
- JSON de contrôle captures : `falseCount: 0`.
- Lighthouse mobile :
  - Homepage : Performance 100, Accessibilité 95.
  - Catalogue : Performance 100, Accessibilité 95.
  - Sélecteur : Performance 100, Accessibilité 98.

## Etat homepage

- Bloc `Préparer 2026/2027 dès maintenant` visible en haut, avec les trois CTA : `Trouver ma formule`, `Voir les offres & tarifs`, `Être conseillé sur WhatsApp`.
- Menu public corrigé : Accueil, Offres & tarifs, Trouver ma formule, Stages, Plateforme, Bilan gratuit, Contact.
- `Forfaits courts et accompagnements ciblés` corrigé, avec `Forfait Complet 16 h` et la note de distinction avec les parcours annuels.
- Section stages alignée calendrier : prérentrée, Toussaint, hiver/février, printemps, sprint final ; aucune date de stage figée.
- Note de prudence ajoutée sous les témoignages chiffrés.

## Etat catalogue

- Bloc de recommandation visible avant le catalogue.
- Cartes homogénéisées autour du badge, titre, profil, prix parent, bénéfices, CTA `Recevoir l’échéancier` et lien `Voir le détail`.
- Offres mises en avant conservées sans changement tarifaire ni nouvelle famille.
- Accordéons structurés avec chevron, fond teinté, grille interne, paiement, points à valider et CTA WhatsApp.
- Calendrier intégré :
  - AEFE : Toussaint, hiver/février, printemps selon calendrier AEFE rythme nord.
  - Candidats libres : calendrier adapté au statut candidat libre et aux échéances d’examen.
  - Dates précises communiquées avec la recommandation.

## Etat sélecteur

- Résultat présenté comme mini-diagnostic : formule recommandée, justification, inclus, repère tarifaire, prochaine étape, périodes de stages, WhatsApp, catalogue et retour accueil.
- Le prix reste un repère, pas l’élément dominant.
- Liens de navigation validés : sélecteur vers catalogue, accueil et WhatsApp.

## Corrections mobile

- Offres principales en cartes, sans tableau horizontal.
- Repères tarifaires en cartes.
- Accordéons lisibles sur mobile.
- Sticky CTA mobile présent et non bloquant.
- Captures mobile générées pour homepage, catalogue et sélecteur.

## Liens WhatsApp

- Numéro contrôlé : `21699192829`.
- Parcours validés :
  - Homepage → Sélecteur → WhatsApp.
  - Homepage → Catalogue → WhatsApp.
  - Catalogue → Sélecteur.
  - Sélecteur → Catalogue.
  - Sélecteur → Accueil.
- `message-whatsapp-reponse-tarifs-nexus.md` commence par le message de qualification demandé.

## Captures

- `homepage-hero-desktop.png`
- `homepage-hero-mobile.png`
- `homepage-preparer-2026-2027.png`
- `homepage-parcours-enfant.png`
- `homepage-reperes-tarifaires.png`
- `homepage-forfaits-courts.png`
- `homepage-temoignages-prudence.png`
- `catalogue-hero-desktop.png`
- `catalogue-hero-mobile.png`
- `catalogue-recommandation.png`
- `catalogue-candidats-libres.png`
- `catalogue-scolarises.png`
- `catalogue-carte-recommandee.png`
- `catalogue-accordeon-ouvert.png`
- `catalogue-plateforme.png`
- `catalogue-sticky-cta-mobile.png`
- `selecteur-initial.png`
- `selecteur-etape-intermediaire.png`
- `selecteur-resultat-final.png`
- `selecteur-resultat-mobile.png`
- `selecteur-cta-whatsapp.png`
- `contactsheet-homepage-validation.png`
- `contactsheet-catalogue-selecteur-validation.png`

## Validation visuelle humaine requise

Les tests automatisés, les scans HTML et les contrôles Lighthouse confirment la conformité technique et l'absence des anciens libellés bloquants ciblés. La revue visuelle des captures confirme que la homepage n'est plus dominée par `J-10`, `Finish 8 juin`, `Pack Première`, `Forfaits et formules` ou `Excellence 16 h`.

Avant diffusion large, la direction doit toutefois valider humainement le rendu premium des captures desktop et mobile : hiérarchie du hero, position du bloc 2026/2027, lisibilité des repères tarifaires, homogénéité des cartes catalogue, accordéons ouverts, sticky CTA mobile et résultat du sélecteur en format diagnostic.

## Points restant à valider

- Dates exactes des stages.
- Enseignants confirmés.
- Groupes ouverts.
- Date limite éventuelle tarif campagne.
- Validation juridique.

## Conclusion

Dispositif techniquement prêt, mais diffusion large conditionnée à validation visuelle humaine des captures et validation métier des dates, enseignants, groupes ouverts et conditions juridiques.
