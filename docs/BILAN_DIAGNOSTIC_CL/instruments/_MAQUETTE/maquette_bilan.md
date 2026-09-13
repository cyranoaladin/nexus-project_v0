# Maquette du bilan — application manuelle des règles du § 8.2

> **Jeu de données fictif.** Candidat `CL-2026-0000`, aucune passation réelle, aucun élément nominatif. Ce document montre, règle par règle, la donnée d'entrée, la règle citée et le résultat obtenu. Il n'est pas le bilan : c'est sa dérivation.

## Entrée — ce dont on part

- Profil **P3**, session **2027**, statut **majeur**
- Dernière classe complète : **seconde**, interruption de **2 ans**
- Spécialités : **MATH, SES, PC**, dont **SES** abandonnée
- Statut par spécialité : MATH jamais_abordee · PC deja_suivie_en_classe · SES etudiee_seul
- Heures disponibles déclarées : **18 h/semaine**, activité en parallèle : temps_partiel
- Auto-positionnement par matière : MATH 4/4 · SES 3/4 · PC 3/4
- Français déclaré, donnée de contexte hors calibration (EC-23) : comprendre 4/4 · ecrire 2/4 · parler 2/4 · lire_textes_litteraires 2/4
- 257 items saisis, 43 lignes de critères

---

## Règle 0 — quels instruments ce candidat a passés

**Règle citée** — Cahier § 3.1 et § 3.2, convention `selection_version_specialite` du catalogue : Le champ profils d'un enregistrement EDS dit à quels profils la version est ouverte, pas laquelle un candidat donné passe : un P3 figure sur N1 et sur NT. La version se choisit sur le statut de la spécialité chez ce candidat.

| Instrument | Version | Périmètre | Pourquoi celui-ci |
|---|---|---|---|
| QP | standard | — | ouvert au profil P3 |
| FR-EAF | standard | FR-EAF | ouvert au profil P3 |
| FR-EAF-ORAL | standard | — | ouvert au profil P3 |
| PHI | standard | PHI | ouvert au profil P3 |
| TC-ES | ETENDUE | TC-ES | ouvert au profil P3 |
| MET | standard | — | ouvert au profil P3 |
| GO | standard | — | ouvert au profil P3 |
| MATH-EA | SPE | MATH-EA | ouvert au profil P3 |
| EDS-MATH | NT | EDS-MATH | spécialité poursuivie → version NT |
| EDS-SES | N1 | EDS-SES | spécialité abandonnée → version N1 |
| EDS-PC | NT | EDS-PC | spécialité poursuivie → version NT |

*Aucune matière n'est écrite dans le script : cette table est le produit du profil déclaré, de la liste des spécialités et de la spécialité abandonnée.*

---

## Règle 1 — score, niveau et palier de chaque compétence

**Règle citée** — § 5.1 : *S(c) = points obtenus / points maximum sur les items rattachés à c*. § 5.2 : Solide ≥ 75 %, En consolidation 55–74 %, Fragile 30–54 %, Non acquis < 30 %, Non évalué sous 3 mesures renseignées. § 5.3 : le palier de profondeur est le plus haut palier où le candidat obtient au moins 2/3 des points. EC-08 : les points d'un critère de grille vont à sa compétence propriétaire.

### FR-EAF / standard

| Compétence | Intitulé | Points | Score | Niveau | Palier | Base |
|---|---|---|---|---|---|---|
| COMP | Compréhension fine d'un texte littéraire : sens explicite, implicite, enjeux | 7/12 | 58 % | En consolidation | D1 | 9 mesures |
| LANG | Correction de la langue : orthographe, accords, syntaxe, ponctuation, registres | 8/9 | 89 % | Solide | D3 | 7 mesures |
| GRAM | Grammaire du programme de l'oral : subordonnées (relatives, conjonctives complétives et circonstancielles), négation, interrogation | 7/13 | 54 % | Fragile | D1 | 9 mesures |
| ANAL | Outils d'analyse : figures, énonciation, versification, point de vue, genres et mouvements | 5/12 | 42 % | Fragile | — | 6 mesures |
| ARGU | Construction d'un raisonnement : thèse, arguments, exemples, connecteurs | 4/10 | 40 % | Fragile | D1 | 5 mesures |
| REDA | Rédaction d'un paragraphe de commentaire structuré : idée directrice, citation, analyse, conclusion partielle | 5/10 | 50 % | Fragile | — | 4 mesures |
| CULT | Repères : œuvres au programme, parcours associés, mouvements littéraires | 1/6 | 17 % | Non acquis | — | 6 mesures |
| EXPL | Explication linéaire d'un extrait : mouvement du texte, procédés au service du sens, lecture personnelle argumentée | 1/3 | 33 % | Fragile | — | 1 critère de FR-EAF-ORAL |
| ENTR | Entretien sur une œuvre choisie : présentation du choix, appui sur la lecture, réponse aux relances | 2/3 | 67 % | En consolidation | — | 1 critère de FR-EAF-ORAL |
| LANG-ORAL | Langue parlée : lecture expressive, correction syntaxique et interaction | 3/6 | 50 % | Fragile | — | 2 sources |

### PHI / standard

| Compétence | Intitulé | Points | Score | Niveau | Palier | Base |
|---|---|---|---|---|---|---|
| NOT | Notions du programme : définir, distinguer | 1/6 | 17 % | Non acquis | — | 4 mesures |
| PROB | Problématiser : transformer une question de sujet en problème, repérer un présupposé | 2/7 | 29 % | Non acquis | — | 5 mesures |
| ARGU | Reconstituer et évaluer un argument : prémisses, conclusion, objection | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| TEXT | Explication de texte : dégager la thèse et les étapes d'un extrait d'une vingtaine de lignes | 4/8 | 50 % | Fragile | — | 3 mesures |
| DISS | Rédiger une introduction de dissertation : accroche, définitions, problème, annonce | 5/11 | 45 % | Fragile | — | 4 mesures |
| REP | Repères et auteurs : rattacher une thèse à un auteur, situer un courant | 2/6 | 33 % | Fragile | — | 6 mesures |
| LANG | Qualité de l'expression écrite | 6/6 | 100 % | Solide | D3 | 2 sources |

### TC-ES / ETENDUE

| Compétence | Intitulé | Points | Score | Niveau | Palier | Base |
|---|---|---|---|---|---|---|
| MAT | Une longue histoire de la matière : cristaux, cellule, Soleil, rayonnement | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| SON | Son et musique ; Le Soleil, notre source d'énergie | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| ASTR | La Terre, un astre singulier | 5/6 | 83 % | Solide | D2 | 4 mesures |
| CLIM | Science, climat et société | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| ENER | Le futur des énergies | 4/6 | 67 % | En consolidation | D2 | 4 mesures |
| INFO | Une histoire du vivant | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| DEM | Démarche scientifique : lire un graphique, identifier une variable, critiquer un protocole | 6/9 | 67 % | En consolidation | D1 | 6 mesures |

### MATH-EA / SPE

| Compétence | Intitulé | Points | Score | Niveau | Palier | Base |
|---|---|---|---|---|---|---|
| AUTO | Automatismes de calcul : taux d'évolution, calcul numérique et algébrique | 3/8 | 38 % | Fragile | — | 8 mesures |
| AUTOG | Automatismes graphiques et statistiques : lectures, droites, indicateurs | 3/7 | 43 % | Fragile | — | 7 mesures |
| PROBA | Probabilités conditionnelles, indépendance et répétition d'épreuves | 6/8 | 75 % | Solide | D2 | 4 mesures |
| ALGAN | Algèbre et analyse de la spécialité : suites, second degré, dérivation, exponentielle | 6/8 | 75 % | Solide | D2 | 4 mesures |
| GEOM | Géométrie et trigonométrie de la spécialité : produit scalaire, géométrie repérée | 6/8 | 75 % | Solide | D2 | 4 mesures |
| EXACT | Conduite d'une épreuve sans calculatrice : calcul exact, ordres de grandeur, vraisemblance | 9/14 | 64 % | En consolidation | D3 | 6 mesures |
| RAIS | Raisonnement et rédaction : justifier une étape, rédiger une réponse complète | 11/16 | 69 % | En consolidation | D3 | 6 mesures |

### EDS-MATH / NT

| Compétence | Intitulé | Points | Score | Niveau | Palier | Base |
|---|---|---|---|---|---|---|
| CALC | Automatismes : calcul littéral, fractions, puissances, racines, équations et inéquations | 5/9 | 56 % | En consolidation | D3 | 7 mesures |
| FONC | Fonctions : variations, dérivation, tangente, second degré, exponentielle | 2/6 | 33 % | Fragile | D1 | 6 mesures |
| SUIT | Suites : arithmétiques, géométriques, sens de variation ; récurrence et limites en Terminale | 4/11 | 36 % | Fragile | D1 | 9 mesures |
| GEO | Produit scalaire, géométrie repérée ; vecteurs, droites et plans de l'espace en Terminale | 5/6 | 83 % | Solide | D2 | 4 mesures |
| PROB | Probabilités conditionnelles, indépendance, variables aléatoires ; loi binomiale et dénombrement en Terminale | 4/10 | 40 % | Fragile | — | 8 mesures |
| ANA | Limites, continuité, convexité, logarithme, primitives | 6/6 | 100 % | Solide | D2 | 4 mesures |
| ALGO | Python : lire, compléter, prédire la sortie d'un programme court | 5/6 | 83 % | Solide | D2 | 4 mesures |
| RAIS | Raisonnement et rédaction : démontrer, justifier, rédiger une solution complète | 8/13 | 62 % | En consolidation | D3 | 5 mesures |

### EDS-SES / N1

| Compétence | Intitulé | Points | Score | Niveau | Palier | Base |
|---|---|---|---|---|---|---|
| ECO | Marché, monnaie et financement, défaillances | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| SOC | Socialisation, liens sociaux, déviance | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| POL | Opinion publique, vote | 2/6 | 33 % | Fragile | — | 4 mesures |
| STAT | Lecture de données : pourcentage, taux de variation, indice, coefficient multiplicateur, lecture de tableau et de graphique | 3/11 | 27 % | Non acquis | — | 7 mesures |
| MOB | Mobilisation des connaissances : définir, expliquer un mécanisme | 2/6 | 33 % | Fragile | D1 | 4 mesures |
| DOCU | Étude d'un document : présenter, analyser, calculer | 4/8 | 50 % | Fragile | — | 3 mesures |
| RAIS | Raisonnement argumenté et dissertation : structurer, articuler théorie et données | 4/8 | 50 % | Fragile | — | 3 mesures |

### EDS-PC / NT

| Compétence | Intitulé | Points | Score | Niveau | Palier | Base |
|---|---|---|---|---|---|---|
| QUANT | Grandeurs, unités, conversions, chiffres significatifs, proportionnalité, lecture de graphique | 3/9 | 33 % | Fragile | — | 7 mesures |
| MAT | Constitution et transformations de la matière : mole, concentration, avancement, dosage ; acide-base et cinétique en Terminale | 5/10 | 50 % | Fragile | D1 | 6 mesures |
| MOUV | Mouvement et interactions : vecteurs vitesse, forces ; deuxième loi de Newton en Terminale | 5/9 | 56 % | En consolidation | D1 | 6 mesures |
| ENER | Énergie : travail, énergie cinétique et potentielle, conservation, bilans énergétiques | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| OND | Ondes et signaux : caractéristiques, optique géométrique ; diffraction et interférences en Terminale | 3/6 | 50 % | Fragile | D1 | 4 mesures |
| EXP | Démarche expérimentale : protocole, incertitude, exploitation d'un tableau de mesures | 4/6 | 67 % | En consolidation | D2 | 4 mesures |
| RES | Résolution de problème : identifier, modéliser, calculer, conclure avec unités | 6/11 | 55 % | Fragile | — | 4 mesures |

---

## Règle 2 — agrégats par matière

**Règle citée** — § 5.5 : *Score global matière = moyenne des S(c) pondérée par le nombre d'items de chaque compétence* ; *Taux de prérequis = score global du bloc A* ; *Score tâche type épreuve = bloc C seul, rapporté à la grille de l'épreuve réelle : c'est le seul indicateur comparable d'un bilan au suivant*.

Deux points d'application. Pondération par le nombre d'items, non par les points. Les deux diffèrent dès qu'un critère de production vaut 3 points et un item fermé 1 point. L'assiette est le bloc porté par l'item, non les blocs déclarés de sa compétence : une compétence présente en A et en B ne verse au taux de prérequis que ses items A.

| Matière | Score global | Mesures | Taux de prérequis | Tâche type épreuve | Non-réponse |
|---|---|---|---|---|---|
| FR-EAF | 52 % | 48 | 50 % (6/12) | 58 % (7/12) | 20 % |
| PHI | 36 % | 26 | 25 % (2/8) | 62 % (13/21) | 14 % |
| TC-ES | 60 % | 30 | 80 % (4/5) | — | 17 % |
| MATH-EA | 59 % | 39 | 67 % (4/6) | 67 % (12/18) | 3 % |
| EDS-MATH | 56 % | 47 | 33 % (8/24) | 67 % (8/12) | 2 % |
| EDS-SES | 40 % | 29 | 25 % (2/8) | 47 % (7/15) | 29 % |
| EDS-PC | 50 % | 35 | 44 % (8/18) | 50 % (6/12) | 16 % |

*TC-ES n'a pas de bloc C dans l'assemblage passé. Une matière sans bloc C n'a pas de score de tâche : la ligne disparaît du rendu, elle n'affiche pas un tiret.*

---

## Règle 3 — module d'entrée de chaque matière

**Règle citée** — § 8.2 : *prérequis < 40 % → "Remise à niveau" ; sinon, la première compétence du programme (dans l'ordre des chapitres) classée Fragile ou Non acquis ; si aucune, la première En consolidation ; si aucune, "Entraînement type bac"*

| Matière | Donnée décisive | Module d'entrée |
|---|---|---|
| FR-EAF | première compétence classée Fragile dans l'ordre des chapitres | **GRAM — Grammaire du programme de l'oral : subordonnées (relatives, conjonctives complétives et circonstancielles), négation, interrogation** |
| PHI | taux de prérequis 25 % < 40 % | **Remise à niveau** |
| TC-ES | première compétence classée Fragile dans l'ordre des chapitres | **MAT — Une longue histoire de la matière : cristaux, cellule, Soleil, rayonnement** |
| MATH-EA | première compétence classée Fragile dans l'ordre des chapitres | **AUTO — Automatismes de calcul : taux d'évolution, calcul numérique et algébrique** |
| EDS-MATH | taux de prérequis 33 % < 40 % | **Remise à niveau** |
| EDS-SES | taux de prérequis 25 % < 40 % | **Remise à niveau** |
| EDS-PC | première compétence classée Fragile dans l'ordre des chapitres | **QUANT — Grandeurs, unités, conversions, chiffres significatifs, proportionnalité, lecture de graphique** |

**EC-22 — lecture du taux de prérequis avec le statut de la spécialité.** Le Cahier collecte le statut de chaque spécialité sans dire ce que le bilan en fait. Un taux de prérequis de 35 % après zéro heure de cours ne se lit pas comme un 35 % après un an de classe.

- **EDS-MATH** — taux de prérequis 33 %. Ce taux se lit en tenant compte du statut déclaré pour cette spécialité : elle n'a jamais été abordée en classe. Il mesure un point de départ, non une perte.

*Effet : prose. Le calcul du taux de prérequis est inchangé.*

---

## Règle 4 — rythme hebdomadaire par matière

**Règle citée** — § 8.2 : *Non acquis ou remise à niveau : 3 h ; Fragile : 2 h ; En consolidation : 1 h 30 ; Solide : 1 h d'entretien. Le total est plafonné aux heures disponibles déclarées. Si le plafond est dépassé, le bilan le signale explicitement et propose un étalement de calendrier, jamais une réduction silencieuse.*

**EC-17 — assiette du rythme.** Le § 8.2 associe un rythme à un niveau sans dire de quel niveau il s'agit pour une matière qui en porte plusieurs — une matière compte six à neuf compétences. Le rythme d'une matière se fonde sur son niveau le plus bas hors Non évalué, ou sur « Remise à niveau » quand le module d'entrée l'impose.

| Matière | Niveau retenu | Rythme |
|---|---|---|
| FR-EAF | Non acquis | 3 h |
| PHI | Remise à niveau | 3 h |
| TC-ES | Fragile | 2 h |
| MATH-EA | Fragile | 2 h |
| EDS-MATH | Remise à niveau | 3 h |
| EDS-SES | Remise à niveau | 3 h |
| EDS-PC | Fragile | 2 h |

**EC-28 — le rythme se compte par matière de travail.** Depuis Q-19, un P2 qui repasse une partie de l'épreuve anticipée passe FR-MAI, sélectionné par son profil, et un assemblage FR-EAF, sélectionné par sa configuration. Le § 8.2 raisonne par matière et le moteur raisonnait par périmètre : le plan accordait 2 h à chacun, soit 4 h de français par semaine, pour une seule matière de travail. Décision Q-22 : les deux périmètres sont conservés — ils ne mesurent pas la même chose et ne sont pas substituables — mais ils forment un unique groupe de planification FRANCAIS. Le rythme du groupe est le maximum des rythmes de ses périmètres, jamais leur somme ; le plan nomme le module français prioritaire et, s'il existe, le second objectif français. Les résultats diagnostiques restent séparés : aucun score moyenné, aucune compétence fusionnée, la famille LANGUE continue sa mise en regard.

| Matière de travail | Périmètres diagnostiques | Niveau retenu | Rythme |
|---|---|---|---|
| Français | FR-EAF | Non acquis (FR-EAF) | 3 h |
| PHI | PHI | Remise à niveau (PHI) | 3 h |
| TC-ES | TC-ES | Fragile (TC-ES) | 2 h |
| Mathématiques | MATH-EA, EDS-MATH | Remise à niveau (EDS-MATH) | 3 h |
| EDS-SES | EDS-SES | Remise à niveau (EDS-SES) | 3 h |
| EDS-PC | EDS-PC | Fragile (EDS-PC) | 2 h |

**Somme des rythmes : 16 h par semaine.** Heures déclarées : 18 h. Comptée par périmètre plutôt que par matière de travail, elle vaudrait 18 h : c'est l'erreur que EC-28 corrige.

*Ni la grille d'entretien Grand oral ni celle de l'oral de français n'ajoutent d'heures à la somme des rythmes. Instruments concernés : GO, FR-EAF-ORAL, MET, QP.*

---

## Règle 5 — priorité entre matières

**Règle citée** — § 8.2 : *P2 et P3 : spécialités poursuivies en Terminale d'abord, philosophie ensuite, tronc commun en fond continu*. *En cas d'égalité, la matière au coefficient le plus élevé*

**EC-16 — deux points que le § 8.2 ne réglait pas.** Les spécialités de Terminale ont toutes le même coefficient : la règle de départage ne départage rien. Et le § 8.2 range le français en fond continu pour un P3, alors qu'un P3 passe l'EAF la même année que les épreuves terminales. Entre spécialités poursuivies, le départage se fait d'abord sur la gravité du module d'entrée — remise à niveau, puis compétence Non acquis, Fragile, En consolidation, entraînement type bac — et ensuite seulement sur le score global le plus bas. Un score global voisin ne dit pas la même urgence selon que la matière relève d'une remise à niveau ou d'une consolidation. Pour un P3, si FR-EAF est sous le seuil du niveau En consolidation, le français vient juste après les spécialités poursuivies et avant la philosophie : coefficients 5 + 5 la même année, et une langue fragile pèse sur la philosophie et sur le Grand oral. Placer le français en fond continu était conforme à la lettre du § 8.2 et contraire à son intention.

| Rang | Matière de travail | Périmètres | Motif |
|---|---|---|---|
| 1 | **MATHEMATIQUES** | MATH-EA, EDS-MATH | spécialité poursuivie ; module « Remise à niveau », score global 56 % — départage par gravité du module, puis par score |
| 2 | **EDS-PC** | EDS-PC | spécialité poursuivie ; module « QUANT — Grandeurs, unités, conversions, chiffres significatifs, proportionnalité, lecture de graphique », score global 50 % — départage par gravité du module, puis par score |
| 3 | **FRANCAIS** | FR-EAF | score global 52 % sous le seuil du niveau En consolidation (55 %) : épreuve anticipée due pendant l'année, sous le seuil du niveau En consolidation : elle passe avant les spécialités |
| 4 | **PHI** | PHI | philosophie, après les spécialités poursuivies |
| 5 | **EDS-SES** | EDS-SES | spécialité abandonnée, après les spécialités poursuivies |
| 6 | **TC-ES** | TC-ES | tronc commun, en fond continu |

---

## Règle 6 — indice de calibration

**Règle citée** — § 5.4 : *Écart entre l'auto-positionnement (bloc 0, converti sur 0--100) et le score mesuré*. *Écart > 25 points dans un sens ou dans l'autre = signal explicite dans le bilan*. *Cet indice ne modifie jamais le niveau de compétence.*

**EC-23 — source et grain.** Le Cahier nomme la source : le bloc 0 de chaque instrument, dont les domaines sont alignés sur les compétences évaluées. La maquette v2 lisait à la place l'auto-positionnement du questionnaire de parcours et rangeait ce choix en « origine : conception », en affirmant que le Cahier ne disait pas le grain. C'était inexact : la transcription du § 5.4 portée au référentiel dit « bloc 0 ». Conséquence du défaut : la calibration par compétence n'existait que pour trois compétences de français, et le bloc 0 rempli par le candidat dans chacun des quinze instruments n'était lu par personne.

Le bloc 0 est la source de la calibration par compétence, pour tous les instruments. La variable auto_par_matiere du questionnaire reste la source de la calibration par matière, qui complète la première sans la remplacer : c'est cette conservation qui constitue l'écart déclaré. La variable auto_francais sort de la calibration et devient une donnée de contexte de la section 1. Un domaine de bloc 0 sans réponse vaut « calibration non renseignée » pour la compétence visée, jamais un écart de zéro.

### Par compétence, depuis le bloc 0 de chaque instrument

| Domaine du bloc 0 | Compétence | Perçu | Converti | Mesuré | Écart | Signal |
|---|---|---|---|---|---|---|
| `EDS-MATH-0-CALC` | EDS-MATH/CALC | 4/4 | 100 | 56 | +44 | surestimation |
| `EDS-MATH-0-FONC` | EDS-MATH/FONC | 4/4 | 100 | 33 | +67 | surestimation |
| `EDS-MATH-0-PROB` | EDS-MATH/PROB | 3/4 | 67 | 40 | +27 | surestimation |
| `EDS-MATH-0-RAIS` | EDS-MATH/RAIS | 3/4 | 67 | 62 | +5 | — |
| `EDS-MATH-0-SUIT` | EDS-MATH/SUIT | 3/4 | 67 | 36 | +30 | surestimation |
| `EDS-PC-0-MAT` | EDS-PC/MAT | 3/4 | 67 | 50 | +17 | — |
| `EDS-PC-0-MOUV` | EDS-PC/MOUV | 3/4 | 67 | 56 | +11 | — |
| `EDS-PC-0-OND` | EDS-PC/OND | 2/4 | 33 | 50 | -17 | — |
| `EDS-PC-0-QUANT` | EDS-PC/QUANT | 2/4 | 33 | 33 | +0 | — |
| `EDS-PC-0-RES` | EDS-PC/RES | 2/4 | 33 | 55 | -21 | — |
| `EDS-SES-0-ECO` | EDS-SES/ECO | 3/4 | 67 | 50 | +17 | — |
| `EDS-SES-0-MOB` | EDS-SES/MOB | 2/4 | 33 | 33 | +0 | — |
| `EDS-SES-0-SOC` | EDS-SES/SOC | 3/4 | 67 | 50 | +17 | — |
| `EDS-SES-0-STAT` | EDS-SES/STAT | 2/4 | 33 | 27 | +6 | — |
| `FR-EAF-0-ANAL` | FR-EAF/ANAL | 2/4 | 33 | 42 | -8 | — |
| `FR-EAF-0-ARGU` | FR-EAF/ARGU | 2/4 | 33 | 40 | -7 | — |
| `FR-EAF-0-COMP` | FR-EAF/COMP | 4/4 | 100 | 58 | +42 | surestimation |
| `FR-EAF-0-LANG` | FR-EAF/LANG | 3/4 | 67 | 89 | -22 | — |
| `FR-EAF-0-REDA` | FR-EAF/REDA | 2/4 | 33 | 50 | -17 | — |
| `MATH-EA-0-AUTO` | MATH-EA/AUTO | 3/4 | 67 | 38 | +29 | surestimation |
| `MATH-EA-0-AUTOG` | MATH-EA/AUTOG | 3/4 | 67 | 43 | +24 | — |
| `MATH-EA-0-EXACT` | MATH-EA/EXACT | 3/4 | 67 | 64 | +2 | — |
| `MATH-EA-0-PROBA` | MATH-EA/PROBA | 3/4 | 67 | 75 | -8 | — |
| `MATH-EA-0-RAIS` | MATH-EA/RAIS | 3/4 | 67 | 69 | -2 | — |
| `PHI-0-ARGU` | PHI/ARGU | 2/4 | 33 | 50 | -17 | — |
| `PHI-0-DISS` | PHI/DISS | 2/4 | 33 | 45 | -12 | — |
| `PHI-0-NOT` | PHI/NOT | 2/4 | 33 | 17 | +17 | — |
| `PHI-0-PROB` | PHI/PROB | 2/4 | 33 | 29 | +5 | — |
| `PHI-0-TEXT` | PHI/TEXT | 1/4 | 0 | 50 | -50 | sous-estimation |
| `TC-ES-0-ASTR` | TC-ES/ASTR | 3/4 | 67 | 83 | -17 | — |
| `TC-ES-0-CLIM` | TC-ES/CLIM | 2/4 | 33 | 50 | -17 | — |
| `TC-ES-0-DEM` | TC-ES/DEM | 3/4 | 67 | 67 | +0 | — |
| `TC-ES-0-INFO` | TC-ES/INFO | 2/4 | 33 | 50 | -17 | — |
| `TC-ES-0-MAT` | TC-ES/MAT | 2/4 | 33 | 50 | -17 | — |

**Domaines non renseignés.** EDS-SES/DOCU. Un domaine sans réponse vaut « calibration non renseignée », jamais un écart de zéro.

> **Réserve.** 18 compétences évaluées de ce candidat n'ont pas de domaine dans le bloc 0 de leur instrument : EDS-MATH/ALGO, EDS-MATH/ANA, EDS-MATH/GEO, EDS-PC/ENER, EDS-PC/EXP, EDS-SES/POL, EDS-SES/RAIS, FR-EAF/CULT, FR-EAF/ENTR, FR-EAF/EXPL, FR-EAF/GRAM, FR-EAF/LANG-ORAL, MATH-EA/ALGAN, MATH-EA/GEOM, PHI/LANG, PHI/REP, TC-ES/ENER, TC-ES/SON. Le bloc 0 compte cinq domaines par instrument, pour six à neuf compétences ; la calibration par compétence ne peut donc pas couvrir tout l'assemblage. Sur l'ensemble du catalogue, trente et un couples compétence × assemblage sont dans ce cas. Étendre le bloc 0 à toutes les compétences toucherait les quinze instruments et relève d'une soumission préalable.

### Par matière, depuis le questionnaire de parcours

*Complète la calibration par compétence sans la remplacer.*

| Matière | Perçu | Converti | Mesuré | Écart | Signal |
|---|---|---|---|---|---|
| EDS-MATH | 4/4 | 100 | 56 | +44 | surestimation |
| EDS-SES | 3/4 | 67 | 40 | +27 | surestimation |
| EDS-PC | 3/4 | 67 | 50 | +17 | — |

- **EDS-MATH/CALC** — surestimation de 44 points : risque de sous-travail, priorité à des évaluations fréquentes.
- **EDS-MATH/FONC** — surestimation de 67 points : risque de sous-travail, priorité à des évaluations fréquentes.
- **EDS-MATH/PROB** — surestimation de 27 points : risque de sous-travail, priorité à des évaluations fréquentes.
- **EDS-MATH/SUIT** — surestimation de 30 points : risque de sous-travail, priorité à des évaluations fréquentes.
- **FR-EAF/COMP** — surestimation de 42 points : risque de sous-travail, priorité à des évaluations fréquentes.
- **MATH-EA/AUTO** — surestimation de 29 points : risque de sous-travail, priorité à des évaluations fréquentes.
- **PHI/TEXT** — sous-estimation de 50 points : risque de découragement, priorité à des réussites rapides visibles.
- **EDS-MATH** — surestimation de 44 points : risque de sous-travail, priorité à des évaluations fréquentes.
- **EDS-SES** — surestimation de 27 points : risque de sous-travail, priorité à des évaluations fréquentes.

---

## Règle 7 — charge de travail

**Règle citée** — § 8.2 : *si la somme des rythmes recommandés dépasse 20 h/semaine, le bilan propose un séquencement (Première partie visée en priorité sur le premier trimestre) et le mentionne comme choix à arbitrer avec la famille*

**EC-18 — le seuil du Cahier est rétabli.** L'écart initial abaissait le seuil de 20 h à 15 h au motif que 20 h était inatteignable : six matières porteuses d'un rythme, 3 h au maximum chacune, plafonnaient la somme à 18 h. La création de MATH-EA (Q-24) ouvre un septième groupe de planification et porte le plafond à 21 h. La justification enregistrée est donc devenue fausse, et la règle amendée survivait à son motif. Q-27 : le seuil du Cahier est rétabli tel qu'il est écrit — la somme des rythmes recommandés doit **dépasser** 20 h, strictement, pour que le bilan propose un séquencement. Le signal de 15 h n'est pas perdu mais devient un indicateur distinct, « vigilance — charge élevée », qui se déclenche à 15 h ou plus, ne remplace pas le seuil du Cahier et n'impose aucun séquencement.

**Deux indicateurs distincts.** Séquencement : la somme **dépasse** 20 h — « dépasse » se lit strictement : une somme de 20 h exactement ne déclenche pas le séquencement, une somme de 20,5 h le déclenche. Le Cahier écrit « dépasse 20 h/semaine » et non « atteint 20 h ». Vigilance : la somme **atteint** 15 h — « atteint » se lit largement : une somme de 15 h exactement déclenche la vigilance, une somme de 14,5 h ne la déclenche pas. Cet indicateur ne propose aucun séquencement et ne se substitue pas au seuil de 20 h : il nomme une charge élevée et invite à surveiller la tenue du rythme. Le séquencement reste commandé par le seul dépassement du seuil du Cahier.

**EC-30 — le séquencement descend du plan.** La proposition du § 8.2 est générique : elle vise la première partie du baccalauréat quel que soit l'ordre de priorité calculé. Sur le jeu P3, le plan met en tête une spécialité de Terminale ; le bilan énonçait alors deux ordres concurrents dans la même page. L'étiquette « première partie » ne porte aucune priorité pédagogique par elle-même. Le séquencement descend de l'ordre de priorité du plan et des prérequis bloquants : les matières sont introduites progressivement dans l'ordre calculé, et les modules de remise à niveau, qui conditionnent la suite, précèdent les notions qui en dépendent. Aucun découpage trimestriel n'est proposé.

Somme des rythmes : **16 h**. Seuil de séquencement : **20 h** (dépassement strict). Seuil de vigilance : **15 h** (atteint). Heures déclarées : **18 h**.

→ **Vigilance — charge élevée** : la somme atteint 16 h pour un seuil de vigilance de 15 h, sans dépasser le seuil de séquencement de 20 h ni les 18 h déclarées. Aucun séquencement n'est proposé.

---

## Règle 8 — première évaluation intermédiaire

**Règle citée** — § 8.2 : *toujours à 4 semaines, sur les compétences classées Fragile/Non acquis du module d'entrée, avec les mêmes codes d'items pour permettre la comparaison*

**EC-19 — portée.** Lu comme visant toutes les compétences fragiles de chaque matière, le § 8.2 conduisait à réévaluer vingt-six compétences à quatre semaines pour un P3, ce qui n'est pas praticable. Sont réévaluées la compétence du module d'entrée ; ou, quand le module est « Remise à niveau », les compétences du bloc A dont le score est sous le seuil du niveau En consolidation.

| Matière | Compétences à réévaluer à 4 semaines | Motif |
|---|---|---|
| FR-EAF | GRAM | compétence du module d'entrée |
| PHI | NOT, REP | module « Remise à niveau » : compétences du bloc A sous 55 % |
| TC-ES | MAT | compétence du module d'entrée |
| MATH-EA | AUTO | compétence du module d'entrée |
| EDS-MATH | FONC, PROB, SUIT | module « Remise à niveau » : compétences du bloc A sous 55 % |
| EDS-SES | STAT | module « Remise à niveau » : compétences du bloc A sous 55 % |
| EDS-PC | QUANT | compétence du module d'entrée |

**Total : 10 compétences.** L'ordre de grandeur attendu pour un profil P3 est de 6 à 13 : la portée restreinte au module d'entrée le respecte.

*Mêmes codes d'items qu'au diagnostic, pour permettre la comparaison. Les items réservés `reserve_intermediaire` des banques servent à cette réévaluation : ils portent les mêmes codes de compétence sans reprendre les mêmes énoncés.*

---

## Règle 9 — famille LANGUE, mise en regard

**Règle citée** — `conventions.familles` : *Compétences et indicateurs mesurant la maîtrise de la langue écrite, dans des instruments différents. Le moteur peut rapprocher ces mesures pour un même candidat, ce que le § 7.3 appelle la lecture croisée : elle distingue une difficulté disciplinaire d'une difficulté de langue. Les codes restent portés par leur périmètre ; la famille n'autorise aucune moyenne entre instruments, seulement une mise en regard.*

| Périmètre | Compétence | Score | Niveau |
|---|---|---|---|
| FR-EAF | LANG | 89 % | Solide |
| FR-EAF | LANG-ORAL | 50 % | Fragile |
| PHI | LANG | 100 % | Solide |

*Aucune moyenne n'est calculée entre ces lignes : elles sont affichées côte à côte pour que le coach distingue une difficulté de langue d'une difficulté disciplinaire.*

---

## Règle 10 — décision sur la préparation au Grand oral

**Règle citée** — § 7.13 : *Le résultat sert à décider si la préparation au GO commence en parallèle des spécialités ou après*

**EC-20 — le seuil qui tranche.** Le § 7.13 pose la décision sans donner le seuil qui la tranche : la règle n'était pas exécutable. Seuil fixé à 50 % du total de la grille. Au-dessus, préparation en parallèle des spécialités dès le premier mois ; en dessous, préparation différée après stabilisation des spécialités, avec réévaluation à l'évaluation intermédiaire. GO n'ajoute aucune heure à la somme des rythmes.

| Critère | Intitulé | Score |
|---|---|---|
| QUEST | Qualité des questions apportées | 1/3 |
| STRUCT | Structure du propos | 1/3 |
| DISCIP | Ancrage disciplinaire | 2/3 |
| ARGU | Argumentation et esprit critique | 1/3 |
| PRECIS | Précision et rigueur | 1/3 |
| LANGUE | Qualité de la langue orale | 1/3 |
| INTER | Interaction | 3/3 |
| POSTURE | Posture et gestion du temps | 1/3 |

Total **11/24**, soit **46 %**, pour un seuil de 50 % → **préparation différée** : préparation au Grand oral différée après stabilisation des spécialités, réévaluation à l'évaluation intermédiaire.

*GO n'alimente aucune compétence de ce candidat : sa grille reporte ORAL à un périmètre qu'il ne passe pas. Le résultat sert uniquement à cette décision, et n'ajoute aucune heure.*

---

## Règle 11 — oral de français, point de vigilance

**Règle citée** — § 7.1 : *Ce n'est pas un oral blanc : c'est une mesure de la langue parlée*

**EC-21 — rendu.** Le résultat est affiché en section 3 sous FR-EAF ; le critère le plus bas est nommé comme point de vigilance, départagé à égalité par l'ordre de la grille, qui est l'ordre dans lequel le coach l'a renseignée. Aucune règle de rythme.

| Critère | Intitulé | Score | Alimente |
|---|---|---|---|
| LECT | Lecture expressive de l'extrait | 1/3 | FR-EAF/LANG-ORAL |
| EXPLI | Explication linéaire de l'extrait | 1/3 | FR-EAF/EXPL |
| GRAMM | Réponse à la question de grammaire | 2/3 | FR-EAF/GRAM |
| ENTRET | Entretien sur l'œuvre choisie | 2/3 | FR-EAF/ENTR |
| LANGOR | Langue orale et interaction | 2/3 | FR-EAF/LANG-ORAL |

Total **8/15**, soit **53 %**. Critère le plus bas : **LECT — Lecture expressive de l'extrait** à 1/3, nommé comme point de vigilance en section 3, sous FR-EAF.

*À égalité de score, le critère retenu est le premier dans l'ordre de la grille, qui est l'ordre dans lequel le coach l'a renseignée pendant l'entretien.*

---

## Règle 12 — profil de méthode et outillage

**Règle citée** — § 7.5 : *chaque dimension produit un profil en trois niveaux et une recommandation d'outillage.* Les seuils et les recommandations sont au référentiel.

| Dimension | Somme | Part | Niveau | Outillage |
|---|---|---|---|---|
| Planification du travail | 1/6 | 17 % | 1 — Travaille au jour le jour, sans répartition prévue à l'avance | Planning hebdomadaire imposé, rempli avec le coach en fin de séance et vérifié à la séance suivante. Deux plages de travail fixes par matière, aux mêmes créneaux chaque semaine. |
| Stratégies d'apprentissage | 4/6 | 67 % | 2 — Relit et refait des exercices déjà traités | Exercices non vus introduits à chaque séance, et une auto-évaluation par semaine sur le chapitre précédent plutôt que sur le chapitre du jour. |
| Gestion de l'épreuve | 2/6 | 33 % | 1 — Compose sans répartir le temps ni relire | Chaque séance se termine par un exercice chronométré court. Une grille de relecture en trois points est fournie et remplie après chaque production. |
| Ressources et environnement de travail | 4/6 | 67 % | 2 — Dispose d'un lieu de travail, avec un matériel partiel | Prêt du matériel manquant lorsque le centre en dispose. Séances de spécialité sur machine programmées au centre lorsque l'ordinateur manque à domicile. |

---

## Règle 13 — MATH-EA : score au format de l'épreuve, et outil

**Règle citée** — note de service MENE2515469N : *épreuve de 2 h, coefficient 2, sans calculatrice, notée sur 20 — questionnaire à choix multiple d'automatismes sur 6 points, puis deux ou trois exercices sur 14.*

Le barème interne du diagnostic n'est pas celui de l'épreuve. Le score au format applique la pondération officielle à la **part réussie** de chaque partie : il ne dépend ni du nombre d'items, ni des points de la banque. La correspondance se fait par registre de tâche, non par bloc.

| Partie de l'épreuve | Points de banque | Part réussie | Points officiels |
|---|---|---|---|
| Automatismes — questionnaire à choix multiple (13 mesures) | 4/13 | 30.8 % | **1.9** / 6 |
| Deux ou trois exercices (20 mesures) | 33/46 | 71.7 % | **10.0** / 14 |

**Score au format de l'épreuve : 11.9 / 20.** Score global du diagnostic sur le même périmètre : 58.9 %. Les deux ne mesurent pas la même chose et ne se remplacent pas.

**Bloc A, D hors format.** Le bloc A mesure des acquis du programme de seconde, que les programmes de première demandent d'entretenir : ce sont des prérequis, non le contenu de l'épreuve. Le bloc D fait analyser au candidat une copie fautive pour repérer l'étape manquante d'une rédaction : l'épreuve ne comporte rien de tel. Ni l'un ni l'autre n'entre dans le score au format de l'épreuve, et le bilan le dit.

**Sans calculatrice.** Part réussie de l'indicateur de calcul exact : 64.3 % ; moyenne des autres compétences du périmètre : 62.4 %. Écart -1.9 points pour un seuil de 15. → aucune hypothèse de dépendance à l'outil. Cet indicateur ne produit ni niveau ni palier : il nomme une hypothèse de lecture, à confirmer par le professeur lors de la première séance.

---

## Conformité du jeu de données à la commande

La spécification de la Porte 7 est portée par `instruments/_MAQUETTE/specification.json` et confrontée au bilan produit. Un écart ne peut pas rester tacite : il apparaît ici et fait échouer le test.

| # | Demandé | Obtenu | Conforme | Règle exercée |
|---|---|---|---|---|
| S-01 | EDS-MATH en version NT · EDS-PC en version NT · EDS-SES en version N1 · specialite_abandonnee = SES | version NT · version NT · version N1 · SES | oui | priorité P3 entre spécialités poursuivies et abandonnée ; blocage SES/STAT lu sur la version N1 |
| S-02 | heures_disponibles = 18 | 18 | oui | confrontation de la somme des rythmes aux heures déclarées, sur un cas réaliste et non sur un écart absurde |
| S-03 | annees_interruption = 2 | 2 | oui | lecture du parcours en section 1 |
| S-04 | EDS-MATH : prerequis entre 30 % et 40 % · EDS-MATH : global entre 55 % et 75 % · EDS-MATH/ALGO Solide · EDS-MATH : module « Remise à niveau » | 33 % · 56 % · Solide (83 %) · « Remise à niveau » | oui | un taux de prérequis sous 40 % impose la remise à niveau malgré un score global correct |
| S-05 | EDS-MATH/SUIT palier D1 | palier D1 | oui | lecture croisée du score et du palier : deux candidats au même score ne relèvent pas du même accompagnement |
| S-06 | PHI/LANG Solide · PHI : global entre 30 % et 55 % | Solide (100 %) · 36 % | oui | famille LANGUE : la mise en regard distingue une difficulté de langue d'une difficulté disciplinaire ; ici elle montre que la langue n'est pas en cause |
| S-07 | FR-EAF/LANG Solide · FR-EAF/CULT Non acquis · FR-EAF/COMP En consolidation · FR-EAF/COMP : surestimation | Solide (89 %) · Non acquis (17 %) · En consolidation (58 %) · surestimation | oui | indice de calibration au grain de la compétence, lu dans le bloc 0 de l'instrument ; écart entre deux compétences d'une même matière |
| S-08 | EDS-PC/QUANT Fragile · critère UNITES propriété de QUANT, sous 50 % | Fragile (33 %) · 1/3 pour QUANT | oui | un critère transversal de la tâche de production — les unités — est la cause du niveau d'une compétence qui n'est pas celle de la tâche (EC-08) |
| S-09 | MET/PLAN au niveau 1 · MET/APPR au niveau 2 | niveau 1 · niveau 2 | oui | différenciation des niveaux de méthode et de leur outillage |
| S-10 | GO/STRUCT = 1 · GO/INTER = 3 · préparation au Grand oral différée | 1 · 3 · différée | oui | décision du § 7.13 : la préparation au Grand oral commence en parallèle ou après |
| S-11 | statut_par_specialite.MATH = jamais_abordee · phrase de statut sur EDS-MATH | jamais_abordee · EDS-MATH | oui | décision C6 : le taux de prérequis se lit avec le statut de la spécialité |
| S-12 | EDS-SES/DOCU : calibration non renseignée | non renseignée | oui | un domaine non renseigné vaut « calibration non renseignée » pour la compétence visée, jamais un écart de zéro |

### Points de la commande impossibles par construction

- **S-04 — le taux de prérequis exact de 35 %.** Le bloc A de EDS-MATH/NT compte vingt-quatre items à un point : les taux atteignables y vont de 4,2 % en 4,2 %. 35 % vaut 8,4 points. Le jeu retient 8 points sur 24, soit 33 %, valeur atteignable la plus proche de la commande, et la contrainte de fond — sous le seuil de 40 % — est tenue.
- **S-08 — un code d'erreur dominant sur EDS-PC/QUANT.** En version Terminale, QUANT n'est présent qu'au bloc A, dont les six items sont de type A. Un code d'erreur ne se saisit que sur un item de type B (§ 6.2) : aucun code ne peut donc être attaché à QUANT dans cet assemblage. Ce que la commande vise — les unités comme cause du niveau — est porté par le critère UNITES de la tâche de production, dont EC-08 donne la propriété à QUANT ; c'est lui que la vérification contrôle. Ajouter un item B à QUANT serait une substitution de nature, qui relève d'une soumission préalable (règle de la Porte 4) et non d'une maquette.
- **Plafond des heures déclarées dépassé « de peu » avec 18 h disponibles.** Un P3 passe six matières porteuses d'un rythme et le rythme maximal est de 3 h : la somme ne peut pas excéder 18 h. Avec 18 h déclarées, le plafond peut au mieux être égalé, jamais dépassé — c'est le même raisonnement que celui qui a fondé la décision Q-18 sur le seuil d'alerte. Le jeu exerce donc l'alerte de charge (somme ≥ 15 h) et non le dépassement de plafond ; la branche du dépassement, et la fusion des deux paragraphes qu'impose C4, sont couvertes par des tests unitaires dédiés.

---

## Ce que la maquette met en évidence

- Taux de prérequis sous le seuil de 40 % : **PHI**, **EDS-MATH**, **EDS-SES**. Le module d'entrée y est imposé par la règle des prérequis, indépendamment du score global — le cas de **EDS-MATH** (56 % de score global) le montre.
- **PHI/LANG** est évalué sur 2 sources et non sur 3 items : sans la règle propre aux indicateurs transversaux, il sortirait « Non évalué » à tort.
- **FR-EAF/LANG-ORAL** est évalué sur 2 sources et non sur 3 items : sans la règle propre aux indicateurs transversaux, il sortirait « Non évalué » à tort.
- **TC-ES** n'a pas de score de tâche type épreuve : la ligne doit disparaître du rendu, non afficher un tiret.
- La somme des rythmes vaut **16 h**. Elle ne dépasse pas le seuil de séquencement de 20 h, elle atteint le seuil de vigilance de 15 h, et elle ne dépasse pas les 18 h déclarées. Les trois règles disent des choses différentes : la première commande un séquencement, la deuxième signale une charge élevée sans rien imposer, la troisième porte sur la faisabilité pour ce candidat.
- La portée de l'évaluation intermédiaire, restreinte au module d'entrée par EC-19, ramène la réévaluation à **10 compétences**.

> **Conformité.** Les 12 attendus de la commande sont tenus par ce jeu de données, aux points signalés comme impossibles par construction près.

