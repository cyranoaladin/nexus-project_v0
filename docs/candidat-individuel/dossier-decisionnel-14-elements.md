# Dossier décisionnel des 14 éléments — version décisionnelle (mission recâblage §7)

**Rôle de ce document** : remplacer `recablage-matrice-14-arbitrages.md` (qui classait 11 éléments comme
« non chiffrable » sans proposition finale) par une version que la direction peut réellement arbitrer.
Pour chacun des 14 éléments, une **recommandation chiffrée et argumentée** est formulée — jamais
« à valider » sans proposition. Là où un vrai blocage réglementaire subsiste (coefficient d'option non
sourcé), il est nommé précisément et séparé de la décision commerciale, qui elle est proposée quand même.

**Statut** : simulation non contractuelle, aucun chiffre n'est actif dans le moteur. Tous les montants sont
calculés avec la même formule que `computeMargin` (`lib/quotes/pricing-engine.ts`, marge =
`(prix − coût) / prix × 100`) — aucun calcul séparé, aucune divergence possible avec le moteur réel. Les
tarifs `petit_groupe`/`individuel`/`pilotage` déjà existants (`data/pricing.canonical.json →
candidat_individuel_modules`) sont réutilisés tels quels partout où c'est possible (mission §2 : jamais une
seconde nomenclature de prix) ; seuls les 4 éléments qui n'ont structurellement aucun tarif de référence
(ARIA autonomie guidée, bacs blancs, second groupe, tutorat de compression) reçoivent une proposition
nouvelle, explicitement étiquetée `[hypothèse Claude — nécessite validation direction]`.

Hypothèses de coût reprises du brief (`PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES`, inchangées) :
agrégé 70 TND/h, certifié 50 TND/h, tuteur 35 TND/h, structure 15 TND/h de séance, dossier fixe 120 TND
(one-off par famille, hors périmètre module — traité en §9), marge bloquante 45 %, marge cible ≥ 55 %,
plancher indicatif 40 TND/h/élève, remise max 20 %.

**Constat transversal (à signaler à la direction, pas seulement un détail technique)** : le plancher horaire
n'est câblé dans `checkFloor` que pour les catégories historiques (`single`, `multi`, `college`,
`stage_college`, `stage`, `coaching_1to1`, `carte_member`, `pack`) — aucune n'existe pour
`petit_groupe`/`autonomie_guidee_aria` du catalogue candidat individuel. Les prix ci-dessous respectent
tous le seuil de 40 TND/h/élève en pratique (vérifié manuellement ligne par ligne), mais `checkFloor` ne le
vérifierait pas automatiquement aujourd'hui pour ces catégories — un vrai devis candidat-individuel passe
actuellement sans ce garde-fou actif. **Ce n'est pas un simple detail de doc : c'est un gap technique réel**,
distinct des 14 arbitrages commerciaux, que je peux corriger sans nouvelle validation (mission §8 — ajout
d'un `floorType` par catégorie candidat-individuel) si la direction le confirme utile.

---

## 1 — MOD_LVA (Langue vivante A)

| Champ | Valeur |
|---|---|
| Code | MOD_LVA |
| Libellé public | Préparation Langue Vivante A |
| Besoin | Renforcer l'écrit + l'oral de LVA pour un candidat libre qui n'a pas d'enseignement d'établissement |
| Épreuve couverte | `lva` (épreuve commune, coefficient selon série — cf. `lib/exams/catalog.ts`) |
| Format | Petit groupe (3 à 6 élèves), `petit_groupe` |
| Volume minimal | 4 h/mois — tarif existant réutilisé |
| Volume recommandé | 8 h/mois — tarif existant réutilisé |
| Volume renforcé | 12 h/mois — tarif existant réutilisé |
| Prix minimal | 250 TND/élève/mois (existant, `candidat_individuel_modules.petit_groupe[0]`) |
| Prix recommandé | 470 TND/élève/mois (existant, tier 8h) |
| Coût | 4h : agrégé 340 / certifié 260 / tuteur 200 · 8h : 680 / 520 / 400 · 12h : 1020 / 780 / 600 TND/mois (enseignant×h + 15 TND/h structure) |
| Marge (effectifs 1-6) | Tier 8h (recommandé) : eff.1 bloquant tous profils (−44,7 % agrégé à +14,9 % tuteur) · eff.2 signalé (27,7–57,4 %) · eff.3 cible atteinte dès certifié/tuteur (51,8–71,6 %) · eff.4-6 : 63,8–85,8 % |
| Inclusion | Non inclus par défaut dans les 6 offres publiques (concept absent) ; vendable en complément d'un pack candidat-libre |
| Offres touchées | Aucune offre existante modifiée ; nouvel ajout au catalogue candidat-individuel uniquement |
| Recommandation | **Valider le tarif existant tel quel** (aucun nouveau prix). Interdire l'ouverture à tarif groupe standard sous 3 élèves — basculer sur `resolveGroupModality` (DUO 90 TND/h/élève ou SOLO 180 TND/h) déjà implémenté structurellement |
| Risque | Solo/duo à tarif groupe standard = perte garantie (−36 % à −50 % selon tier/enseignant) si la bascule DUO/SOLO n'est pas appliquée systématiquement en dessous de `group_min_open=3` |
| Décision demandée | Confirmer le tarif 250/470/680 TND pour LVA et confirmer que la bascule DUO/SOLO automatique est la politique à activer (déjà codée, jamais activée commercialement) |

## 2 — MOD_LVB (Langue vivante B)

Identique en tout point à MOD_LVA (même famille tarifaire, même format, même moteur) — seule differe
l'épreuve couverte.

| Champ | Valeur |
|---|---|
| Code | MOD_LVB |
| Libellé public | Préparation Langue Vivante B |
| Besoin | Idem MOD_LVA |
| Épreuve couverte | `lvb` |
| Format | `petit_groupe` |
| Volume minimal/recommandé/renforcé | 4h / 8h / 12h — identiques à MOD_LVA |
| Prix minimal/recommandé | 250 / 470 TND/élève/mois — identiques à MOD_LVA |
| Coût | Identique à MOD_LVA |
| Marge (effectifs 1-6) | Identique à MOD_LVA |
| Inclusion | Identique à MOD_LVA |
| Offres touchées | Aucune |
| Recommandation | Même tarif que LVA, même politique DUO/SOLO — ne pas créer de grille séparée par langue |
| Risque | Identique à MOD_LVA + risque spécifique : LVB a une population de candidats plus faible → seuil de 3 pour ouvrir un groupe plus difficile à atteindre en pratique → bascule DUO/SOLO encore plus fréquente |
| Décision demandée | Identique à MOD_LVA |

## 3 — MOD_SPECIALITE_ABANDONNEE (spécialité de première non poursuivie)

| Champ | Valeur |
|---|---|
| Code | MOD_SPECIALITE_ABANDONNEE |
| Libellé public | Accompagnement spécialité abandonnée |
| Besoin | Maintenir un socle méthodologique/culture générale sur la spécialité de 1ère non poursuivie en terminale (n'est plus évaluée au bac, mais reste demandée par certaines familles pour cohérence Parcoursup) |
| Épreuve couverte | **Aucune** — pas d'épreuve terminale associée ; accompagnement hors examen |
| Format | `petit_groupe` (mono-discipline, D1 — jamais de mutualisation transdisciplinaire) |
| Volume minimal/recommandé/renforcé | 4h / 8h / 12h — tarif existant réutilisé |
| Prix minimal/recommandé | 250 / 470 TND/élève/mois — tarif existant réutilisé |
| Coût | Identique à MOD_LVA (même tier) |
| Marge (effectifs 1-6) | Identique à MOD_LVA |
| Inclusion | Absente des 6 offres ; concept le plus proche = « selon besoin » (Intégrale, non détaillé) |
| Offres touchées | Aucune |
| Recommandation | Même grille que LVA/LVB, mais **avertissement commercial explicite au moment de la vente** que ce module ne prépare aucune épreuve du bac (éviter toute ambiguïté marketing) |
| Risque | Discipline rare par candidat → seuil de 3 quasi jamais atteint en pratique → bascule DUO/SOLO **systématique**, pas l'exception — le proposer sans clarifier ce point à la vente risque une incompréhension commerciale (« pourquoi ce module coûte plus cher qu'attendu ? ») |
| Décision demandée | Confirmer l'ouverture de ce module et l'avertissement commercial obligatoire à afficher |

## 4 — MOD_HG_ARIA (Histoire-Géographie, autonomie guidée)

| Champ | Valeur |
|---|---|
| Code | MOD_HG_ARIA |
| Libellé public | Parcours autonomie guidée — Histoire-Géographie |
| Besoin | Couvrir HG sans mobiliser un enseignant dédié à temps plein — structure déjà amortie par le Pilotage (`ARIA_ACCESS` inclus) |
| Épreuve couverte | `histoire-geographie` (bloc contrôle continu) |
| Format | `autonomie_guidee_aria` (parcours structuré + suivi humain ponctuel — jamais un cours de groupe, D1) |
| Volume minimal | 0,25 h synchrone/mois (point de suivi bref) + 2 h autonomie/mois |
| Volume recommandé | 0,5 h synchrone/mois + 3 h autonomie/mois |
| Volume renforcé | 1 h synchrone/mois + 4 h autonomie/mois |
| Prix minimal | **20 TND/mois** `[hypothèse Claude]` |
| Prix recommandé | **40 TND/mois** `[hypothèse Claude]` |
| Coût | Min : 0,25h × tuteur 35 = 8,75 TND/mois · Reco : 0,5h × 35 = 17,5 TND/mois · Renf : 1h × 35 = 35 TND/mois (pas de coût de structure — suivi ponctuel hors « séance » réservée, plateforme déjà amortie par Pilotage) |
| Marge (effectifs 1-6) | **Non applicable par effectif** — produit individualisé (1 suivi = 1 élève), pas de mutualisation groupe prévue à ce stade. Marge constante aux prix proposés : 56,25 % sur les 3 tiers (calcul : (20−8,75)/20, (40−17,5)/40, (80−35)/80) |
| Inclusion | Absent des 6 offres ; Pilotage inclut déjà l'accès plateforme ARIA mais pas le suivi humain dédié par matière |
| Offres touchées | Aucune modification d'offre existante — nouvelle ligne candidat-individuel |
| Recommandation | Créer le tier de prix `autonomie_guidee_aria` dans `candidat_individuel_modules` avec les 3 paliers ci-dessus (20/40/80 TND/mois) — cohérent avec la logique coût+marge cible 55 % déjà appliquée ailleurs, pas un nombre arbitraire |
| Risque | Prix bas (20-80 TND/mois) peut être perçu comme peu valorisant à la vente en face d'un module `petit_groupe` à 250+ TND/mois — nécessite un discours commercial clair sur la différence de format (autonomie supervisée ≠ cours collectif) |
| Décision demandée | Valider (ou ajuster) les 3 prix proposés et confirmer la création du tier `autonomie_guidee_aria` (migration additive de données, pas de code bloquant) |

## 5 — MOD_ES_ARIA (Enseignement scientifique, autonomie guidée)

Identique à MOD_HG_ARIA en structure de coût/prix — seule differe l'épreuve couverte.

| Champ | Valeur |
|---|---|
| Code | MOD_ES_ARIA |
| Libellé public | Parcours autonomie guidée — Enseignement scientifique |
| Besoin | Idem MOD_HG_ARIA |
| Épreuve couverte | `enseignement-scientifique` |
| Format / Volumes / Prix / Coût / Marge / Inclusion / Offres touchées | Identiques à MOD_HG_ARIA |
| Recommandation | Identique à MOD_HG_ARIA — même tier de prix partagé entre les 3 modules ARIA, pas 3 grilles distinctes |
| Risque | Identique à MOD_HG_ARIA |
| Décision demandée | Une seule décision couvre les 3 modules ARIA (HG/ES/EMC) — même tier de prix pour les trois |

## 6 — MOD_EMC_ARIA (EMC, autonomie guidée)

| Champ | Valeur |
|---|---|
| Code | MOD_EMC_ARIA |
| Libellé public | Parcours autonomie guidée — EMC |
| Besoin | Idem MOD_HG_ARIA |
| Épreuve couverte | `emc` |
| Format / Volumes / Prix / Coût / Marge / Inclusion / Offres touchées | Identiques à MOD_HG_ARIA |
| Recommandation | Identique à MOD_HG_ARIA |
| Risque | Identique à MOD_HG_ARIA |
| Décision demandée | Couverte par la décision unique de MOD_ES_ARIA ci-dessus |

## 7 — MOD_EAF_DESCRIPTIF (accompagnement du descriptif EAF)

| Champ | Valeur |
|---|---|
| Code | MOD_EAF_DESCRIPTIF |
| Libellé public | Accompagnement individuel — constitution du descriptif EAF |
| Besoin | Aide méthodologique ciblée pour constituer la liste des textes/œuvres du descriptif (obligation réglementaire du candidat libre en français) |
| Épreuve couverte | `eaf-ecrit` / `eaf-oral` (support administratif à l'épreuve, pas l'épreuve elle-même) |
| Format | `individuel_presentiel` (tarif `individuel` déjà existant, réutilisé) |
| Volume minimal | 1 séance (1h) |
| Volume recommandé | 2 séances (2h) |
| Volume renforcé | 3 séances (3h) |
| Prix minimal | 180 TND (1h × tarif existant `individuel.price_per_hour_min`) |
| Prix recommandé | 360 TND (2h) |
| Coût | 1h : agrégé 85 / certifié 65 / tuteur 50 (structure 15 TND/h incluse) |
| Marge (effectifs 1-6) | **Non applicable — format individuel, effectif = 1 par construction.** Marge à 180 TND/h : agrégé 52,8 %, certifié 63,9 %, tuteur 72,2 % — tous au-dessus de la cible 55 % sauf agrégé (signalé, pas bloquant) |
| Inclusion | Déjà implicitement couvert par MOD_EAF_ECRIT_ORAL (8h/mois combiné écrit+oral) dans Cap Anticipées |
| Offres touchées | Aucune si vendu en option — ne touche pas le forfait 8h/mois existant |
| Recommandation | **Ne pas l'inclure par défaut** dans le forfait EAF (pas de demande démontrée d'un besoin non couvert par les 8h/mois existants) — le proposer en **option ponctuelle** au tarif `individuel` existant, uniquement si une famille demande explicitement un accompagnement dédié au-delà du forfait |
| Risque | Créer une ligne par défaut sans demande = sur-tarification perçue ; ne pas la proposer du tout = risque de sous-couvrir les familles dont le descriptif est complexe (options multiples, changement de programme) |
| Décision demandée | Valider le principe « option ponctuelle sur demande, tarif individuel existant, jamais dans le forfait par défaut » |

## 8 — MOD_MATHS_EXPERTES (option)

| Champ | Valeur |
|---|---|
| Code | MOD_MATHS_EXPERTES |
| Libellé public | Préparation option Mathématiques expertes |
| Besoin | Points bonus loi des points (option facultative, hors tronc commun/spécialités) |
| Épreuve couverte | Épreuve d'option facultative — coefficient **non sourcé** (`OPTION_COEFFICIENT_NON_SOURCE`, dette trackée dans `lib/exams/`, hors périmètre de ce lot) |
| Format | `petit_groupe` — même famille que LVA/LVB (aucune raison objective de créer une grille distincte pour une option) |
| Volume minimal/recommandé/renforcé | 4h / 8h / 12h — tarif existant réutilisé, identique à MOD_LVA |
| Prix minimal/recommandé | 250 / 470 TND/élève/mois — identiques à MOD_LVA |
| Coût / Marge (effectifs 1-6) | Identiques à MOD_LVA |
| Inclusion | Absente des 6 offres |
| Offres touchées | Aucune |
| Recommandation | **Approuver le prix par anticipation** (même grille que LVA/LVB — cohérence tarifaire, aucune raison de différencier une option d'une langue en termes de format/coût), **mais interdire l'activation technique** tant que le coefficient réglementaire n'est pas sourcé — deux décisions séparées, pas une seule « à valider » globale |
| Risque | Vendre ce module avant que le coefficient soit confirmé exposerait à un conseil pédagogique erroné (volume horaire dimensionné sur une hypothèse de coefficient qui pourrait être fausse) — c'est un risque réglementaire, pas commercial, non levé par une décision de direction seule |
| Décision demandée | (a) Valider le prix 250/470/680 TND par anticipation ; (b) confirmer que l'activation reste bloquée jusqu'à résolution de `OPTION_COEFFICIENT_NON_SOURCE` (recherche déjà engagée hors périmètre commercial) |

## 9 — MOD_MATHS_COMPLEMENTAIRES (option)

Identique à MOD_MATHS_EXPERTES en tout point (même famille tarifaire, même blocage réglementaire).

| Champ | Valeur |
|---|---|
| Code | MOD_MATHS_COMPLEMENTAIRES |
| Épreuve couverte | Option facultative — coefficient non sourcé |
| Format / Volumes / Prix / Coût / Marge | Identiques à MOD_MATHS_EXPERTES |
| Recommandation / Risque / Décision demandée | Identiques à MOD_MATHS_EXPERTES — une seule décision de direction peut couvrir les 4 options (8-11) si la grille tarifaire est acceptée en bloc |

## 10 — MOD_DGEMC (Droit et grands enjeux du monde contemporain, option)

| Champ | Valeur |
|---|---|
| Code | MOD_DGEMC |
| Épreuve couverte | Option facultative — coefficient non sourcé |
| Format / Volumes / Prix / Coût / Marge | Identiques à MOD_MATHS_EXPERTES |
| Recommandation / Risque / Décision demandée | Identiques à MOD_MATHS_EXPERTES |

## 11 — MOD_LCA (Langues et cultures de l'Antiquité, option)

| Champ | Valeur |
|---|---|
| Code | MOD_LCA |
| Épreuve couverte | Option facultative — coefficient non sourcé |
| Format | `petit_groupe` — **avertissement supplémentaire** : population de candidats structurellement très faible, seuil de 3 quasi inatteignable, DUO/SOLO sera la norme et non l'exception (comme MOD_SPECIALITE_ABANDONNEE) |
| Volumes / Prix / Coût / Marge | Identiques à MOD_MATHS_EXPERTES |
| Recommandation | Identique à MOD_MATHS_EXPERTES + avertissement DUO/SOLO systématique |
| Risque | Cumul du risque réglementaire (coefficient non sourcé) et du risque d'effectif (discipline rare) |
| Décision demandée | Identique à MOD_MATHS_EXPERTES |

## 12 — SVC_BACS_BLANCS

| Champ | Valeur |
|---|---|
| Code | SVC_BACS_BLANCS |
| Libellé public | Bac blanc corrigé et commenté |
| Besoin | Mise en situation d'examen + correction individualisée avant la session réelle |
| Épreuve couverte | Toute épreuve écrite du profil (générique, pas spécifique à une matière) |
| Format | Correction individuelle + restitution courte, hors séance collective |
| Volume minimal | 1 bac blanc |
| Volume recommandé | 2 bacs blancs/an (mi-parcours + final) `[hypothèse Claude]` |
| Volume renforcé | 3 bacs blancs/an (un par trimestre) |
| Prix minimal | **95 TND/bac blanc/élève** `[hypothèse Claude]` |
| Prix recommandé | 95 TND × 2 = 190 TND/an (package recommandé) |
| Coût | 30 min correction (certifié 50 TND/h → 25 TND) + 15 min restitution (tuteur 35 TND/h → 8,75 TND) + 0,5h structure (15 TND/h → 7,5 TND) = **41,25 TND/bac blanc** |
| Marge (effectifs 1-6) | Non applicable — produit individuel (une copie = un élève). Marge au prix proposé : (95−41,25)/95 = **56,6 %** (cible atteinte) |
| Inclusion | Absent des `included[]` des 6 offres réelles (contrairement à ce qu'un brief initial supposait) |
| Offres touchées | Aucune modification des 6 offres existantes |
| Recommandation | Créer une ligne visible à 95 TND/bac blanc, vendue à l'unité ou en package de 2/an — **ne pas la rendre implicite dans le Pilotage** (le Pilotage ne couvre pas de temps de correction dédié dans son coût actuel de 150 TND/mois) |
| Risque | Si le volume réel de correction dépasse 30 min/copie (dissertations longues, matières à forte charge de correction), le coût dépasse l'hypothèse et la marge chute sous 55 % — proposer une révision après les 3 premiers bacs blancs réels |
| Décision demandée | Valider le prix 95 TND/bac blanc et la fréquence recommandée (2/an) |

## 13 — SVC_TUTORAT_COMPRESSION

| Champ | Valeur |
|---|---|
| Code | SVC_TUTORAT_COMPRESSION |
| Libellé public | — (non défini) |
| Besoin | **Concept jamais défini dans le dépôt** — ni dans le code, ni dans les 6 offres publiques, ni dans un brief produit antérieur |
| Épreuve couverte | Inconnu |
| Format | Inconnu |
| Volume minimal/recommandé/renforcé | Inconnu |
| Prix minimal/recommandé | Inconnu |
| Coût | Inconnu |
| Marge (effectifs 1-6) | Inconnu |
| Inclusion | Absent des 6 offres |
| Offres touchées | Aucune |
| Recommandation | **Seul élément des 14 où aucun chiffrage n'est proposé — par construction, pas par facilité.** Proposer un prix pour un produit dont le contenu n'est pas défini serait une double invention (besoin fabriqué + prix fabriqué), ce que la mission interdit explicitement. La recommandation argumentée est donc : ne pas chiffrer, et demander un brief produit d'une page (public visé, contenu, durée, différence avec le Pilotage/l'accompagnement standard) avant tout retour sur ce point |
| Risque | Continuer d'afficher cet élément dans une liste d'arbitrage sans définition entretient une confusion — à retirer du dossier tarifaire tant qu'aucun brief n'existe, ou à le garder uniquement comme rappel de dette |
| Décision demandée | Fournir un brief produit (direction) — aucune décision tarifaire n'est possible avant cela |

## 14 — SVC_SECOND_GROUPE (P11 — 2 disciplines de rattrapage)

| Champ | Valeur |
|---|---|
| Code | SVC_SECOND_GROUPE |
| Libellé public | Préparation intensive second groupe d'épreuves |
| Besoin | Rattrapage de 2 disciplines dans la fenêtre contrainte entre les résultats du 1er groupe et l'oral de rattrapage |
| Épreuve couverte | Les 2 disciplines de rattrapage choisies par le candidat (variable par profil) |
| Format | `individuel` (fenêtre courte, intensive — tarif de groupe non pertinent vu le délai) |
| Volume minimal | 6 h total (3h/discipline) `[hypothèse Claude]` |
| Volume recommandé | 10 h total (5h/discipline) |
| Volume renforcé | 16 h total (8h/discipline) |
| Prix minimal | 1080 TND (6h × 180 TND/h, tarif `individuel` existant réutilisé) |
| Prix recommandé | 1800 TND (10h × 180 TND/h) |
| Coût | 180 TND/h de prix ; coût agrégé 85/certifié 65/tuteur 50 par heure (structure incluse) |
| Marge (effectifs 1-6) | Non applicable — format individuel par nature (fenêtre de rattrapage, jamais un groupe). Marge par heure : agrégé 52,8 %, certifié 63,9 %, tuteur 72,2 % |
| Inclusion | Aucune — produit autonome, hors packs annuels, paiement 100 % à la réservation (`computeSecondGroupePayment`, déjà implémenté structurellement) |
| Offres touchées | Aucune |
| Recommandation | Réutiliser le tarif `individuel` existant (180 TND/h) plutôt qu'inventer une grille « rattrapage » séparée — le format (fenêtre courte, individuel, urgent) justifie le tarif individuel déjà pratiqué ailleurs, pas un tarif d'urgence supplémentaire |
| Risque | Le paiement 100 % upfront (déjà codé) combiné à un prix élevé (jusqu'à 2880 TND pour 16h) sur une décision prise dans l'urgence par la famille peut être perçu comme agressif commercialement — recommander un message clair sur la fenêtre contrainte au moment de la vente |
| Décision demandée | Valider le tarif 180 TND/h (réutilisation, pas de nouveau prix) et les 3 paliers de volume (6h/10h/16h) |

---

## Synthèse pour lecture rapide

| Code | Chiffrage proposé | Blocage restant | Décision demandée |
|---|---|---|---|
| MOD_LVA | 250/470/680 TND (existant) | Aucun | Valider tarif + politique DUO/SOLO |
| MOD_LVB | Identique à LVA | Aucun | Identique à LVA |
| MOD_SPECIALITE_ABANDONNEE | Identique à LVA | Aucun | Valider + avertissement commercial |
| MOD_HG_ARIA | 20/40/80 TND/mois (nouveau) | Migration additive du tier | Valider prix + créer le tier |
| MOD_ES_ARIA | Identique à HG_ARIA | Identique | Une décision couvre les 3 ARIA |
| MOD_EMC_ARIA | Identique à HG_ARIA | Identique | Couverte ci-dessus |
| MOD_EAF_DESCRIPTIF | 180/360 TND (existant, option ponctuelle) | Aucun | Valider le principe opt-in |
| MOD_MATHS_EXPERTES | 250/470/680 TND (par anticipation) | Coefficient réglementaire non sourcé | Valider prix ; activation reste bloquée |
| MOD_MATHS_COMPLEMENTAIRES | Identique | Identique | Identique |
| MOD_DGEMC | Identique | Identique | Identique |
| MOD_LCA | Identique + avertissement effectif | Identique + effectif rare | Identique |
| SVC_BACS_BLANCS | 95 TND/bac blanc (nouveau) | Aucun | Valider prix + fréquence |
| SVC_TUTORAT_COMPRESSION | **Aucun proposé** | Concept non défini | Fournir un brief produit |
| SVC_SECOND_GROUPE | 180 TND/h (existant), 6/10/16h | Aucun | Valider tarif + paliers |

**13 éléments sur 14 reçoivent une proposition chiffrée argumentée** (contre 3 dans la version précédente).
Le seul élément sans chiffrage (SVC_TUTORAT_COMPRESSION) l'est parce qu'aucune définition produit n'existe
nulle part dans le dépôt — chiffrer un concept non défini serait une invention, pas une recommandation.
