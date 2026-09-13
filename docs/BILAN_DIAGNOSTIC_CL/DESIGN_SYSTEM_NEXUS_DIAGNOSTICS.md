# Charte des diagnostics Nexus Réussite

Ce document n'est pas une intention : c'est ce que `scripts/livret.py` applique. Toute
règle énoncée ici est dans le préambule LaTeX ou dans un test de `tests/test_design.py`.

## 1. Le conflit de palette, et comment il est tranché

Les deux marques de Nexus portent leurs propres couleurs, relevées sur les fichiers :
**bleu `#0257A7`** et **rouge `#E0121C`**. La palette éditoriale demandée est navy, ivoire
et or. Les deux ne se confondent pas, et c'est délibéré :

- **le logo n'est jamais recoloré** — il garde son bleu et son rouge ;
- **le document** est composé en navy, ivoire et or. Le navy `#0B1F3A` est un bleu profond
  de la même famille que le bleu de la marque : le logo s'y pose sans jurer ;
- le rouge de la marque n'entre pas dans la palette du document. Il reste dans le logo.

Conséquence pour les corrections : l'accent qui distingue un document de correction est un
**bordeaux `#7B1E28`**, choisi pour ne pas se confondre avec le rouge vif de la marque. Un
coach qui voit du bordeaux sait qu'il tient un corrigé ; il ne le confond pas avec la
signature Nexus présente sur toutes les couvertures.

## 2. Palette

| Rôle | Valeur | Emploi |
|---|---|---|
| navy | `#0B1F3A` | couverture, bandeaux de partie, titres |
| navy clair | `#12294D` | aplats secondaires, dégradé de couverture |
| ivoire | `#F7F3EA` | fonds de cartouche, bandeau « Avant de commencer » |
| or | `#C9A227` | filet de couverture, numéro de partie, accents |
| gris technique | `#8A8F98` | codes internes, métadonnées, filets |
| gris cadre | `#D9DCE1` | bordures de cartouche et de zone de réponse |
| bordeaux | `#7B1E28` | **corrections coach uniquement** |

L'intérieur est blanc en très grande majorité. La couleur sert à la structure — bandeau de
partie, filet, numéro — jamais à décorer. Tout est conçu pour rester lisible en niveaux de
gris : aucune information ne repose sur la seule couleur.

## 3. Typographie

Polices auditées sur le poste, aucune n'est distribuée avec les documents.

| Rôle | Police | Repli |
|---|---|---|
| corps, questions, titres | **Lato** — sans-serif humaniste | DejaVu Sans |
| extraits littéraires et philosophiques | **EB Garamond** — serif de lecture | DejaVu Serif |
| codes internes, saisie machine | **DejaVu Sans Mono** | — |

Échelle : 22 pt titre de couverture · 13 pt titre de partie · 11 pt intertitre ·
**10,5 pt corps** · 9 pt cartouche · 7,5 pt code interne. Interligne du corps 1,35.
Aucun texte destiné au candidat sous 10,5 pt, à l'exception des codes internes et des
mentions de pied de page.

Les extraits sont composés en EB Garamond à 11 pt, interligne 1,45 : la littérature doit
rester agréable à lire, et une serif de lecture y aide plus qu'une sans-serif serrée.

## 4. Gabarit

A4 portrait. Marges : 18 mm à gauche et à droite, 16 mm en haut, 20 mm en bas — le pied de
page porte la pagination et la mention de confidentialité.

En-tête courant : icône Nexus à gauche, matière et profil à droite, filet gris fin.
Pied de page : « page n / N » centré, référence du livret à droite.

## 5. Règles de composition, et ce qui les applique

| Règle | Moyen |
|---|---|
| jamais de titre de partie seul en bas de page | `\needspace{13\baselineskip}` avant chaque bandeau : le bandeau voyage avec de quoi commencer |
| jamais un énoncé séparé de sa figure | la réserve calculée avant la question inclut la hauteur des documents qu'elle imprime |
| jamais un extrait séparé de la première question qui l'exploite | l'extrait est composé dans la même réserve que sa question |
| jamais un QCM séparé de ses propositions | la réserve inclut l'en-tête, l'énoncé et toutes les propositions |
| jamais une grille coupée illisiblement | chaque critère est un `tcolorbox` insécable |
| veuves et orphelines | `\clubpenalty=10000`, `\widowpenalty=10000`, `\displaywidowpenalty=10000` |
| une grande partie commence proprement | bandeau précédé d'un `\needspace` ; si la partie ne tient pas, elle commence à la page suivante |
| ponctuation double française | espace insécable rendue au rendu, et `polyglossia` en français |

## 6. Couverture

Bandeau navy en tête, logo horizontal Nexus en réserve blanche, filet or, puis le titre de
la matière en grand. Sous le titre, des cartouches sobres — profil, session, durée,
matériel, calculatrice — remplis **depuis `referentiels/modalites_epreuves.json`**, jamais
saisis à la main. En bas, deux champs à remplir : référence candidat et date.

Le code technique de l'instrument n'est jamais le titre. Il figure en 7,5 pt gris dans le
pied de la couverture, pour que l'administration s'y retrouve.

## 7. Zones de réponse

| Attendu | Zone |
|---|---|
| QCM | carré de 4,5 mm, filet gris, aligné |
| réponse numérique ou d'un mot | ligne de 45 mm |
| justification courte | cadre de 3 lignes |
| production dont l'énoncé annonce la longueur | cadre de la longueur annoncée **plus trois lignes** — « une quinzaine de lignes » donne 18 lignes |
| production longue sans longueur annoncée | cadre de `12 + barème` lignes, plafonné à 30 |

La hauteur est déduite de ce que l'item attend, jamais d'un remplissage uniforme :
`livret.lignes_attendues` lit la longueur dans l'énoncé — « dix à douze lignes »,
« une vingtaine de lignes », « en 80 mots » — et retombe sur le barème à défaut. Une page
entière de pointillés est aussi fautive que deux lignes pour quinze. Le candidat écrit
dans le livret : il n'y a plus de renvoi à un cahier de composition.

## 7 bis. Documents d'appui

Figures et tableaux sont composés **avec la question qui les exploite**, jamais omis. Le
placement suit l'énoncé : « d'après le tableau ci-dessus » imprime le document avant la
question, « la droite tracée ci-dessous » l'imprime après. Un document déjà montré est
rappelé — *Voir « … » ci-dessus* — plutôt que réimprimé.

| Support | Composition |
|---|---|
| figure | tracé vectoriel déterministe dans un cadre gris fin, hauteur plafonnée à 70 mm, rapport conservé |
| tableau | `booktabs`, filets fins, intitulés à gauche, nombres alignés à droite |
| provenance | 8 pt gris sous le document ; une figure construite pour la question le dit au lieu de citer une source |

## 8. Extraits

Cadre très sobre : filet gris fin à gauche seulement, fond blanc, EB Garamond, interligne
1,45, paragraphes de l'édition conservés. La référence — auteur, œuvre, édition — vient
sous le texte, en 9 pt gris : plus discrète que ce qu'elle situe.

## 7 ter. Variantes réglementaires

Deux candidats d'un même profil ne présentent pas toujours la même chose. Une matière peut
donc exister en plusieurs livrets, et ils ne partagent jamais un chemin :

| Matière | Variantes | Nom de fichier |
|---|---|---|
| Mathématiques | avec / sans spécialité | `MATHEMATIQUES_AVEC_SPECIALITE`, `MATHEMATIQUES_SANS_SPECIALITE` |
| Français | écrit et oral / écrit seul / oral seul | `FRANCAIS_ECRIT_ET_ORAL`, `FRANCAIS_ECRIT_SEUL`, `FRANCAIS_ORAL_SEUL` |

Le suffixe est un mot que lit un opérateur, jamais un code technique. Dans le dossier d'un
candidat réel, le fichier reprend le nom simple de la matière une fois la variante choisie.

## 7 quater. Modules

Un livret qui réunit deux instruments n'est pas leur concaténation. Les modules se
succèdent — `MODULE A`, `MODULE B` — et la numérotation des parties court d'un bout à
l'autre du livret : jamais deux « Partie 1 » dans le même document.

## 8 bis. Dossier d'entrée

Il n'est pas un diagnostic : il ne mesure rien et ne porte ni barème ni durée par
question. Il suit pourtant le même gabarit — même couverture, même en-tête, même case à
cocher, même cadre de réponse — parce qu'il est le premier document que le candidat
ouvre. Ses questions portent `\demande` plutôt que `\question` : ni points ni minutes,
seulement le numéro et le code interne en marge. Une section conditionnelle s'annonce
dans un encadré ivoire, avec la situation qu'elle vise et son fondement réglementaire.
Rien de ce qui relève du correcteur — méthode de dépouillement, seuils — n'y figure.

## 8 ter. Balisage des énoncés

Les énoncés de la banque sont écrits en balisage léger. Il devient de la typographie —
`**gras**` en `\textbf`, `` `code` `` en `\texttt`, `*emphase*` en `\emph`, puces en
retrait pendu — et jamais des astérisques imprimées. Un contrôle preflight refuse tout
gras, titre ou lien Markdown resté brut dans un PDF candidat.

## 9. Corrections coach

Même gabarit, même grille, couverture distincte : bandeau bordeaux, mention
`CORRECTION COACH — CONFIDENTIEL`, et la même mention en pied de chaque page. Le bordeaux
n'apparaît nulle part ailleurs dans la collection : sa seule présence identifie un
document qui ne sort pas de chez Nexus.

## 10. Les trois profils

Une seule collection, une seule charte. Le profil se lit sur la couverture dans un
cartouche, en toutes lettres — `PREMIÈRE PARTIE`, `DEUXIÈME PARTIE`, `BAC EN UNE SESSION` —
et par un repère de trois traits dont un seul est or. Jamais par la couleur seule, jamais
par un code `P1`/`P2`/`P3`.
