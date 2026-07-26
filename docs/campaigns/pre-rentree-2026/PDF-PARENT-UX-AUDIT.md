# Audit visuel et technique des PDF parents — état avant refonte

> Archive de baseline avant refonte. Cet inventaire de dix fichiers n'est pas
> l'allowlist publique 2.1.0. La release active contient exactement sept PDF
> publics totalisant 59 pages ; voir `FINAL-RELEASE-QA.md`.

**Contexte** : branche `feat/pre-rentree-2026-parent-pdf-redesign`, créée depuis un worktree isolé
`/home/alaeddine/Bureau/nexus-wt-pre-rentree-parent-pdf-redesign`, branchée sur
`BASELINE_SHA = 202cd06fd3aff7762820a5953d60deaad6835283` (branche
`feat/pre-rentree-planning-scheduler`, post-nettoyage de l'audit Codex).
Aucune modification appliquée à ce stade — audit en lecture seule des 10 PDF existants
dans `assets/campaigns/pre-rentree-2026/documents-final/`.

Outils utilisés : `pdfinfo`, `pdffonts`, `pdftotext -layout`, `pdftoppm -r 150/200`
(rendu réel des pages, pas d'inférence). Toutes les conclusions ci-dessous sont basées
sur des pages effectivement rendues en PNG, inspectées visuellement.

## Inventaire (état actuel)

| Fichier | Pages | Poids | Filigrane DRAFT/REVIEW détecté | Fonts |
|---|---:|---:|---|---|
| DossierAccueil_PRINT.pdf | 4 | 423 Ko | Oui (2 — attendu, document interne) | Inter (4 graisses) |
| FlyerEssentiel.pdf | 1 | 401 Ko | Non | Inter (3 graisses) |
| Planning_InfosPratiques.pdf | 7 | 439 Ko | Non | Inter (4 graisses) |
| Programme_3e.pdf | 3 | 423 Ko | Non | Inter (4 graisses) |
| Programme_Premiere.pdf | 5 | 432 Ko | Non | Inter (4 graisses) |
| Programme_Seconde.pdf | 3 | 424 Ko | Faux positif¹ | Inter (4 graisses) |
| **Programme_SVT_Première.pdf** | 2 | 419 Ko | Non | Inter (4 graisses) |
| **Programme_SVT_Terminale.pdf** | 2 | 419 Ko | Non | Inter (4 graisses) |
| Programme_Terminale.pdf | 5 | 432 Ko | Non | Inter (4 graisses) |
| Tarifs.pdf | 1 | 423 Ko | Non | Inter (4 graisses) + **DejaVu-Sans-Bold (fallback)** |

¹ Le seul texte matché est « **Proposition** subordonnée » (terme de grammaire française, module
Français 3e), sans rapport avec un statut de document. Confirmé sans changement requis.

Toutes les polices sont **embarquées** (`emb: yes`), sous-ensemblées (`sub: yes`) — aucune
dépendance réseau. Aucune métadonnée PDF (titre/sujet) n'est renseignée sur les documents inspectés
(`pdfinfo -meta` vide) : un gestionnaire de fichiers ou un lecteur PDF affichera le nom de fichier
brut, pas un titre lisible.

**Défaut mineur relevé** : `Tarifs.pdf` bascule sur `DejaVu-Sans-Bold` (police de secours) pour au
moins un caractère (probablement le « & » de « M&M ACADEMY », absent du sous-ensemble Inter-Bold
embarqué) — rupture de cohérence typographique, un seul caractère, impact visuel réel mais mineur.

## Constat n°1 — fragmentation, pas de dossier complet par niveau

Confirmé par rendu réel (page de couverture identique en structure, cf. captures) : **SVT est un
document séparé**, avec sa propre page de couverture redondante (`Programme détaillé — SVT`,
mêmes logo/bandeau/mentions que le programme principal), pour Première et Terminale. Un parent
d'un élève de Première doit donc télécharger et ouvrir **deux fichiers distincts**
(`Programme_Premiere.pdf` + `Programme_SVT_Première.pdf`) pour voir le programme complet du
niveau. Idem Terminale. Aucun sommaire ni lien ne relie les deux fichiers entre eux.

Pour 3e et Seconde (pas de SVT à ce niveau), le programme est déjà consolidé — mais reste
dans le même fichier que rien d'autre (pas de planning, pas d'infos pratiques : celles-ci sont
dans un fichier séparé, `Planning_InfosPratiques.pdf`, commun aux 4 niveaux).

**Conclusion** : aucun niveau ne dispose aujourd'hui d'un document unique consolidant planning +
programmes de toutes les matières + infos pratiques. C'est exactement la prémisse de la mission de
refonte — confirmée par preuve, pas supposée.

## Constat n°2 — programme verrouillé dans un tableau dense 4 colonnes

Rendu réel de `Programme_Premiere.pdf` page 3 (Français EAF) : chaque séance est une ligne d'un
tableau à 4 colonnes (Séance | Objectif | Notions clés | Livrable), fond alterné gris clair,
texte de cellule dense (jusqu'à 5 items de liste dans une seule cellule "Notions clés"). Lisible,
mais dense — aucune respiration visuelle, aucune hiérarchie typographique au sein d'une séance,
pas de distinction visuelle entre les 5 séances au premier coup d'œil (juste un numéro en gras en
première colonne). C'est le format explicitement visé par la mission pour remplacement par des
cartes verticales par séance.

## Constat n°3 — pages de couverture avec espace mort important

Rendu réel de la page 1 de `Programme_Premiere.pdf` et de `Programme_SVT_Première.pdf` : logo,
titre, sous-titre, bandeau tarif/capacité, puis **environ 75 % de la page A4 reste vide** avant le
pied de page (contact). Aucun contenu structurant (sommaire, aperçu du niveau, CTA) n'occupe cet
espace. Confirme le constat "pas de sommaire cliquable, pas de vue d'ensemble en page 1" attendu
par la mission.

## Constat n°4 — absence de liens cliquables réels

`pdftotext` révèle du texte ressemblant à des URLs/téléphones (`nexusreussite.academy/...`,
`+216 99 19 28 29`) mais du texte seul n'est pas nécessairement une annotation `/URI` cliquable
dans le PDF. Vérification à faire plus précisément en Phase 8 (les générateurs actuels
n'utilisent pas systématiquement de balises `<a href>` dans le HTML source — à confirmer module par
module lors du portage vers le nouveau template).

## Constat n°5 — statuts DRAFT/REVIEW proprement gérés

Le nettoyage effectué lors de la validation pédagogique (voir DEBTS.md, `residual-debt.fr.json`)
a fonctionné : sur les 9 PDF destinés au parent, **zéro** filigrane résiduel « DOCUMENT DE REVUE »,
conforme à `PUBLIC_FINAL`. Seul `DossierAccueil_PRINT.pdf` (usage interne, jamais dans
`PRE_RENTREE_DOCUMENTS`) garde intentionnellement son bandeau interne. Bon état de départ — la
refonte n'a pas besoin de "réparer" un problème de filigrane, seulement de ne pas en réintroduire.

## Ce que la refonte doit produire (rappel du besoin, confirmé par cet audit)

1. Fusionner par niveau : `Programme_{niveau}.pdf` + `Programme_SVT_{niveau}.pdf` (Première,
   Terminale) + les sections pertinentes de `Planning_InfosPratiques.pdf` → un seul
   "dossier complet parents" par niveau (3e, Seconde, Première, Terminale).
2. Remplacer le tableau 4 colonnes par des cartes verticales par séance (objectif, notions,
   méthode, livrable en blocs visuellement distincts, pas en lignes de tableau).
3. Occuper la page de couverture avec un sommaire réel / aperçu "en un coup d'œil" plutôt que de
   l'espace vide.
4. Ajouter des liens cliquables réels (tel:, mailto:, https:) vérifiés en Phase 8.
5. Retirer `DejaVu-Sans-Bold` en s'assurant que le sous-ensemble de polices embarqué couvre tous
   les caractères utilisés (notamment `&`).
6. Renseigner les métadonnées PDF (titre, sujet) à la génération.

## Limite de cet audit

Cet audit couvre l'inventaire technique complet (10/10 PDF) et un rendu visuel ciblé des pages les
plus représentatives de chaque défaut (couverture, tableau de programme, SVT séparé). Il ne
constitue pas encore la planche-contact exhaustive de toutes les pages des 10 documents — celle-ci
sera produite en Phase 8 (QA visuelle) sur les nouveaux documents, en comparaison avant/après.
