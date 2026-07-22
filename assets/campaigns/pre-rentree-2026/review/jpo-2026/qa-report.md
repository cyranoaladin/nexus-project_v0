# Rapport QA — Lot 1 JPO Pré-rentrée 2026

## Date

2026-07-22 · Africa/Tunis

## Verdict

`READY_FOR_OWNER_REVIEW`

Le lot est généré et techniquement exploitable pour la revue propriétaire. Il n'est ni `APPROVED` ni `FINAL`. Les décisions propriétaire listées plus bas restent ouvertes.

## Périmètre contrôlé

- Source maître : `content/pre-rentree-2026/jpo-2026/master.fr.json`.
- Cockpit local : `dashboard/index.html` et `dashboard/print.css`.
- Dossier parents : HTML et PDF.
- Fiche réflexe équipe : HTML et PDF.
- Documents Markdown internes.
- 18 rendus de pages PDF en PNG, deux planches de contact et deux captures du cockpit.

## Chaîne de génération

- HTML/CSS local, sans ressource réseau.
- WeasyPrint 68.1 pour HTML → PDF.
- Poppler 24.02.0 (`pdfinfo`, `pdftotext`, `pdffonts`, `pdftoppm`).
- qpdf pour l'intégrité syntaxique des PDF.
- PyMuPDF 1.27.2.3 pour les dimensions, blocs de texte, polices et glyphes.
- ImageMagick pour les planches de contact.
- Chromium/Playwright pour le cockpit local et le responsive.

Les corrections de compatibilité `font-weight` ont été appliquées avant la dernière génération. La génération finale ne produit aucun avertissement WeasyPrint.

## Cohérence des sources

| Contrôle | Résultat |
|---|---|
| Sections obligatoires de la source maître | 21 / 21 |
| Statuts utilisés | `CONFIRMED`, `REVIEW_REQUIRED`, `OWNER_DECISION_REQUIRED`, `PROHIBITED` uniquement |
| FAQ source maître | 30 |
| Objections source maître | 10 |
| Lignes tarifaires dérivées | 6 |
| Version tarifaire | `2026-2027.3` |
| Prix, acomptes et soldes | Identiques à `data/pricing.canonical.json` |
| Offre Seconde | Mathématiques, Physique-Chimie, Français ; aucune SNT/NSI dans la liste de disciplines |
| Ancien tarif autonome 800/450 dans le dossier parents | Aucun |
| Promesses interdites dans le dossier parents | Aucune occurrence de « 100 % Bac ou remboursé », « garantie réussite » ou « taux de réussite » |
| Formulations planning/contrat | Présentes dans les deux PDF avec le wording canonique |

Un faux positif QA a été observé puis corrigé : la recherche brute de « 800 TND » reconnaissait la sous-chaîne du tarif canonique « 1 800 TND ». Le contrôle final exige désormais un montant autonome, sans masquer l'ancien prix s'il réapparaît.

## Contrôle des PDF

| Document | Pages | Format | Taille | Texte/page | Blocs hors page | Glyphes de remplacement |
|---|---:|---|---:|---:|---:|---:|
| Dossier parents | 12 | A4 portrait | 493 951 octets | 411 à 1 415 caractères | 0 | 0 |
| Fiche réflexe équipe | 6 | A4 portrait | 440 151 octets | 1 305 à 1 832 caractères | 0 | 0 |

Contrôles complémentaires :

- qpdf : aucun défaut de syntaxe ou d'encodage de flux ; PDF 1.7 non chiffrés.
- Métadonnées : titre, sujet, auteur et producteur présents sur les deux PDF.
- Fraunces et DM Sans : embarquées, sous-ensembles et encodage Unicode confirmés par `pdffonts`.
- Logo : un objet image local présent sur chaque page ; source principale 1500 × 540 px.
- Ouverture : confirmée par `pdfinfo`, qpdf et PyMuPDF.
- Pages blanches : aucune ; minimum de 411 caractères extractibles sur la couverture parents.

## Rendus PNG et inspection visuelle

- Dossier parents : 12 PNG, 1191 × 1684 px, 144 dpi.
- Fiche équipe : 6 PNG, 1191 × 1684 px, 144 dpi.
- Planche parents : 12 pages contrôlées après la génération finale.
- Planche équipe : 6 pages contrôlées après la génération finale.
- Contrôle pleine résolution : Seconde sans SNT, grille tarifaire, qualité pédagogique/contacts, objections et décisions propriétaire.

Constats :

- aucun texte coupé ;
- aucun chevauchement ;
- aucun tableau débordant ;
- aucun glyphe manquant visible ;
- aucune page presque vide ;
- marges cohérentes ;
- logo net ;
- aucun titre orphelin ;
- hiérarchie et contrastes homogènes.

La couverture est volontairement plus aérée ; les pages intérieures conservent une densité éditoriale lisible et un espace blanc maîtrisé.

## Contrôle du cockpit

Le fichier a été ouvert directement via `file://`, sans serveur.

| Contrôle | Résultat |
|---|---|
| Titre de page | Conforme |
| Blocs recherchables | 66 |
| Liens de navigation interne | 7 |
| Recherche « SNT » | 4 résultats visibles |
| État vide de recherche | Fonctionnel |
| Navigation vers `#tarifs` | Fonctionnelle |
| Débordement bureau 1440 × 1000 | Aucun |
| Débordement mobile 390 × 844 | Aucun |
| Logo local | Chargé, largeur intrinsèque 1500 px |
| Mode impression | Barre supérieure masquée |
| Erreurs JavaScript / console | 0 |

Captures : `previews/dashboard-desktop.png` et `previews/dashboard-mobile.png`.

## Revues Chutes — exactement deux appels

### 1. Revue éditoriale

- Modèle : `Qwen/Qwen3.5-397B-A17B-TEE`.
- Paramètres : température 0.2, maximum 3500 tokens.
- Résultat : réponse reçue, `finish_reason=length`, aucun nouvel appel.
- Retenu : séparer strictement les alertes internes du dossier parents ; renforcer la visibilité des tarifs totaux ; maintenir une hiérarchie page par page claire.
- Non retenu : toute suggestion de « sélection stricte », de conformité non démontrée ou de reformulation libre du planning, faute de preuve ou parce que le wording propriétaire est impératif.

### 2. Revue de production

- Modèle : `MiniMaxAI/MiniMax-M2.5-TEE`.
- Paramètres : température 0.1, maximum 2500 tokens.
- Résultat : réponse reçue, `finish_reason=length`, aucun nouvel appel.
- P0 retenu : régénérer PDF, PNG et empreintes après la correction des poids de police ; effectué.
- P1 retenus : contrôler source maître → livrables et métadonnées PDF ; effectués.
- Réserve opérationnelle : un tirage physique recto-verso sur l'imprimante utilisée demain n'a pas été exécuté dans cet environnement.

## Quality gates du dépôt

| Commande | Résultat |
|---|---|
| `npm run lint` | Réussite (code 0) ; avertissements historiques du dépôt, sans erreur bloquante |
| `npm run typecheck` | Réussite (code 0) |
| `npm run test -- --runInBand` | 559 suites réussies, 1 ignorée ; 6 819 tests réussis, 4 ignorés |
| `npm run build` | Réussite ; 144 pages statiques générées et artefact standalone déclaré valide |

La première exécution Jest sous sandbox a échoué sur 46 tests qui tentaient de lancer des sous-processus (`node`, `pdfinfo` et `tsx`) avec `EPERM`. La relance autorisée hors sandbox a isolé deux échecs réels du garde-fou de confiance de marque. La source maître a été corrigée pour référencer les bornes d'effectif canoniques dans son wording et ne plus stocker une expression commerciale interdite telle quelle. Le test ciblé (9/9) puis la suite complète ont réussi après correction.

## Décisions propriétaire non résolues

1. Canal de règlement, rapprochement et justificatif de paiement.
2. Conditions juridiques d'annulation, absence, report, interruption et remboursement.
3. Date de fin publiable, jours, horaires, salles et affectations enseignantes.
4. Validation pédagogique humaine matière par matière des ressources détaillées.
5. Critères publiables de sélection et de maîtrise disciplinaire des enseignants.
6. Adresse de rue du centre pédagogique.
7. Bon à utiliser externe du lot JPO.

## Risques restants

- Faire un test recto-verso physique, bord long, sur l'imprimante réellement utilisée demain.
- Ne pas montrer le cockpit interne ou la fiche équipe aux parents.
- Ne pas modifier un tarif directement dans les HTML : repartir de `data/pricing.canonical.json` et de la source maître.
- Ne pas remplacer les deux formulations prudentes obligatoires par une réponse improvisée.

## Rollback

Le lot est entièrement nouveau sous les trois répertoires JPO demandés. Aucun fichier existant n'a été modifié ou supprimé. Aucun commit, push ou déploiement n'a été effectué.
