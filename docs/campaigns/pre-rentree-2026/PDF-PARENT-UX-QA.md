# QA visuelle et structurelle des 4 dossiers complets parents (Phase 8)

Contrôles exécutés sur les 4 PDF générés par `tools/pdf-generator/generate_level_dossiers.py`
(branche `feat/pre-rentree-2026-parent-pdf-redesign`), rendus à 200 dpi dans
`assets/campaigns/pre-rentree-2026/documents-final/visual-review-v2/` (planches-contact
`{fichier}-contact-sheet.png` + `qa-report.json`, produits par
`tools/pdf-generator/build_dossier_qa.py`, script séparé et en lecture seule).

## Résultats structurels (qpdf, PyMuPDF)

| Dossier | Pages | qpdf --check | Blocs hors-page | Pages quasi-vides | Fraunces | DM Sans | Liens réels (dernière page) |
|---|---:|---|---:|---|---|---|---:|
| Programme_3e.pdf | 9 | OK | 0 | aucune | oui | oui | 4 (tel/mailto/https×2) |
| Programme_Seconde.pdf | 9 | OK | 0 | aucune | oui | oui | 4 |
| Programme_Premiere.pdf | 15 | OK | 0 | aucune | oui | oui | 4 |
| Programme_Terminale.pdf | 15 | OK | 0 | aucune | oui | oui | 4 |

- **Aucun texte hors-page** (bbox de bloc de texte comparé aux dimensions A4 sur toutes les pages
  des 4 dossiers) — pas de troncature ni de débordement.
- **Aucune page quasi-vide** (seuil : moins de 80 caractères de texte extrait).
- **Polices** : Fraunces (titres) et DM Sans (corps) confirmées présentes et embarquées dans
  chacun des 4 PDF, via `@font-face` sur les fichiers locaux `app/fonts/*.woff2` (aucune requête
  réseau).
- **Liens cliquables réels** vérifiés par annotation `/URI` (pas seulement du texte qui y
  ressemble) : `tel:+21699192829`, `mailto:contact@nexusreussite.academy`,
  `https://nexusreussite.academy/stages/pre-rentree-2026`,
  `https://nexusreussite.academy/conditions-generales`.

## Défaut mineur connu (préexistant, non bloquant)

Les 4 dossiers utilisent ponctuellement `DejaVu-Sans-Bold` en secours pour le caractère « & »
(dans « STE M&M ACADEMY SUARL », pied de page). Ce même défaut existait déjà avant la refonte
(confirmé dans `PDF-PARENT-UX-AUDIT.md`, `Tarifs.pdf`) — il ne produit pas de glyphe manquant
(DejaVu Sans est une police complète, le caractère reste lisible), seulement une légère rupture
de cohérence typographique sur un caractère isolé en petit texte de pied de page. Non corrigé
dans cette refonte (racine probable : interpolation de graisse d'une police variable par
Pango/WeasyPrint sur ce glyphe précis) ; à traiter séparément si jugé prioritaire.

## Comparaison avant/après (fragmentation, cf. `PDF-PARENT-UX-AUDIT.md`)

| Point | Avant | Après |
|---|---|---|
| Documents à ouvrir pour le programme complet (Première/Terminale) | 2 (Programme + Programme_SVT séparé) | 1 (dossier complet, SVT en chapitre) |
| Présentation d'une matière | Tableau dense 4 colonnes | Cartes verticales par séance |
| Combinaison de matières | Non traitée | Section dédiée, dérivée du calcul d'incompatibilités réel |
| Page de couverture | ~75 % d'espace mort | Page "en un coup d'œil" occupant l'espace avec les infos clés |
| Liens cliquables | Non vérifiés (audit initial) | Confirmés réels (tel/mailto/https) |
| Filigrane statut | Absent avant refonte (déjà propre) | Conservé propre ; badge REVIEW/PUBLIC dérivé des données |

## Limites de cette QA

- La comparaison avant/après reste qualitative (pas de diff pixel-à-pixel automatisé) : jugée
  suffisante compte tenu du changement structurel (nombre de pages et mise en page différents
  par construction).
- Les 4 documents partagés non repris dans cette refonte (Planning_InfosPratiques, Tarifs,
  DossierAccueil_PRINT, FlyerEssentiel) n'ont pas reçu le nouveau système de design — décision
  Phase 11 (voir rapport final), documentés comme limite plutôt que traités superficiellement.
