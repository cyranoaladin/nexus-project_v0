# Journal des changements

## 2.1.0 — 26 juillet 2026

- distingue explicitement 14 modules pédagogiques, 70 séances modèles, 17 cohortes opérationnelles et 85 occurrences calendaires ;
- regroupe les cohortes alternatives par matière sans doubler les cinq séances ni les dix heures suivies par l’élève ;
- limite le sélecteur à quatre matières et réserve l’action publique aux parcours structurellement compacts, sous réserve de disponibilité ;
- publie un DTO planning sanitizé, sept PDF allowlistés et une campagne sociale datée avec familles `PUBLIC` et `REVIEW` séparées ;
- qualifie par test paramétré les 66 combinaisons publiques d'une à quatre matières : 57 parcours actionnables et 9 incompatibilités explicitement bloquées ;
- met à jour la seule lignée officielle `brace-expansion@5` vers `5.0.8`, conserve le raw audit des lignées 1.x/2.x et ajoute une validation d'exception exacte, bornée et fail-closed ;
- prouve l'absence de `brace-expansion` dans l'artefact standalone et dans le SBOM runtime ;
- rend la source Reel reproductible sans chemin absolu de checkout ;
- conserve `releaseStatus=READY_FOR_OWNER_GO` et la gate `publication_authorization` ouverte jusqu’au GO lié au SHA validé.

## 6.0.0-rc.5 — 23 juillet 2026

- rétablit le module « initiation informatique / algorithmique / SNT » en Seconde (décision direction R2) : la campagne porte à **16 modules et 80 séances**, l'offre Seconde revient à quatre matières, le créneau semaine 2 / bloc A / salle 1 est restauré ;
- le module SNT de Seconde (subjectId NSI, label public SNT) reste distinct de la spécialité NSI de Première et Terminale ;
- autorise la mention collective « enseignants certifiés ou agrégés de l'Éducation nationale française, en exercice » sur les supports commerciaux (décision direction R4), distincte de l'anonymat nominatif maintenu.

## 6.0.0-rc.4 — 23 juillet 2026

- supprime l’initiation informatique/SNT de l’offre, des modules et du planning de Seconde (revertée en rc.5 — décision direction R2) ;
- porte la campagne à 15 modules et 75 séances après l’intégration de la SVT en Première et Terminale ;
- restaure la capacité Fondations à 4–6 élèves, maximum 6, sans modifier le plafond Premium de 5 ;
- dérive les acomptes et soldes des PDF depuis le pricing canonique, notamment 144 + 336 = 480 TND et 405 + 945 = 1 350 TND ;
- maintient la demande d’information sans paiement et retire les promesses de positionnement personnalisé et de bilan parent non validées.

## 6.0.0-rc.3 — 20 juillet 2026

- supprime la page d’en-tête vide avant les couvertures de la brochure et de l’Essentiel ;
- exige la présence du titre, de l’année et du lieu sur la première page des documents à couverture.

## 6.0.0-rc.2 — 20 juillet 2026

- conserve le bandeau de revue sur la couverture sans créer de page vide ;
- désactive les ligatures typographiques susceptibles de corrompre le texte PDF extrait ;
- remplace le jargon de capacité par une formulation destinée aux familles ;
- retire la dernière mention du bilan gratuit dans la FAQ de campagne.

## 6.0.0-rc.1 — 20 juillet 2026

- ajoute Nexus Fondations pour l’entrée en 3e et en Seconde ;
- maintient Nexus Premium pour l’entrée en Première et en Terminale ;
- porte le catalogue à 14 modules et 70 séances ;
- conserve l’initiation informatique/algorithmique/SNT en Seconde ;
- remplace le Français Terminale par la Philosophie ;
- adopte les acomptes exacts de 30 % : 105, 120, 144, 270, 405 et 540 TND selon les offres ;
- distingue demande d’information, qualification, proposition et réservation après acompte ;
- matérialise 14 tests, 70 évaluations rapides et 70 livrables dans l’artefact de revue ;
- ajoute le registre de quatre manuels avec publicité bloquée tant que le stock manque ;
- ajoute les kits WhatsApp et réseaux, le CRM vierge, les gabarits anonymes et le modèle économique ;
- aligne la page `/stages/pre-rentree-2026` sur les sources canoniques ;
- maintient la branche, les documents et le site en mode REVIEW.

## 5.1.0-rc.2 — 20 juillet 2026

- corrige le contraste, le débordement mobile et plusieurs défauts PDF/HTML.

## 5.1.0-rc.1 — 20 juillet 2026

- introduit le Guide Parents principal, la source unique du générateur, les artefacts non suivis et la CI documentaire.

La v4 reste un état historique de comparaison et n’alimente aucun compilateur.
