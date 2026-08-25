# Dossier décisionnel des 14 éléments — version étendue (mission "vers un produit complet" §1)

**Rôle de ce document** : version étendue de la précédente (mission recâblage §7), avec les 3 colonnes
supplémentaires demandées (Prix renforcé, Coût retenu, Inclusion ou supplément explicite) et la mise à jour
du 14ᵉ élément (SVC_TUTORAT_COMPRESSION — voir `resolution-tutorat-compression.md`, retiré du catalogue
actif). **Aucune valeur de ce document n'est approuvée** — chaque ligne porte une recommandation argumentée,
jamais une décision déjà prise, tant que la direction n'a pas répondu explicitement (statut global :
`À_APPROUVER`).

**Convention « Coût retenu »** : coût mensuel/unitaire au **volume recommandé**, qualification **certifiée**
(la valeur la moins risquée des trois d'après `proposition-calibration-couts-v1.md` §2 — ni la plus
optimiste comme l'agrégé, ni la plus fragile côté référentiel comme le tuteur), sauf pour les 3 modules ARIA
où seul le tuteur est pertinent au format (noté explicitement). Marge = `(prix − coût) / prix × 100`
(`computeMargin`, `lib/quotes/pricing-engine.ts` — même formule que le moteur réel, aucun calcul séparé).

Tarifs `petit_groupe`/`individuel` déjà existants réutilisés tels quels partout où c'est possible (mission
§2 : jamais une seconde nomenclature de prix). Hypothèses de coût : agrégé 70 TND/h, certifié 50 TND/h,
tuteur 35 TND/h, structure 15 TND/h de séance — toutes `[hypothèse Claude — nécessite validation direction]`.

---

## 1 — MOD_LVA (Langue vivante A)

| Champ | Valeur |
|---|---|
| Code | MOD_LVA |
| Libellé public | Préparation Langue Vivante A |
| Service rendu | Renforcer l'écrit + l'oral de LVA pour un candidat libre sans enseignement d'établissement |
| Épreuve couverte | `lva` |
| Format | `petit_groupe` (3-6 élèves) |
| Volume minimal | 4 h/mois |
| Volume recommandé | 8 h/mois |
| Volume renforcé | 12 h/mois |
| Prix minimal | 250 TND/élève/mois (existant) |
| Prix recommandé | 470 TND/élève/mois (existant) |
| Prix renforcé | 680 TND/élève/mois (existant) |
| Coût retenu | 520 TND/mois (certifié, 8h : 8×50 + 8×15) |
| Marge selon effectif | eff.1 bloquant tous profils (agrégé −44,7 % à tuteur +14,9 %) · eff.2 signalé/cible selon enseignant (27,7-57,4 %) · eff.3+ cible atteinte (51,8-85,8 %) |
| Inclusion ou supplément | Supplément — absent des 6 offres actuelles, aucune inclusion |
| Offres concernées | Aucune modifiée ; tarif identique à Cap Anticipées (cohérence, pas nouveauté) |
| Recommandation | Valider le tarif existant tel quel ; imposer la bascule DUO/SOLO sous 3 élèves (déjà codée, jamais activée commercialement) |
| Décision demandée | Approuver 250/470/680 TND + politique DUO/SOLO systématique sous effectif 3 |

## 2 — MOD_LVB (Langue vivante B)

| Champ | Valeur |
|---|---|
| Code | MOD_LVB |
| Épreuve couverte | `lvb` |
| Autres champs | Identiques à MOD_LVA (même famille tarifaire, même moteur) |
| Décision demandée | Identique à MOD_LVA — risque d'effectif plus élevé (population LVB plus faible) |

## 3 — MOD_SPECIALITE_ABANDONNEE

| Champ | Valeur |
|---|---|
| Code | MOD_SPECIALITE_ABANDONNEE |
| Service rendu | Socle méthodologique/culture générale sur la spécialité de 1ère non poursuivie — hors épreuve |
| Épreuve couverte | Aucune |
| Format / Volumes / Prix / Coût / Marge | Identiques à MOD_LVA |
| Inclusion ou supplément | Supplément, avec avertissement commercial obligatoire (« ne prépare aucune épreuve du bac ») |
| Offres concernées | Aucune |
| Recommandation | Même grille que LVA/LVB + avertissement obligatoire à l'affichage |
| Décision demandée | Approuver la grille + le principe de l'avertissement |

## 4 — MOD_HG_ARIA (autonomie guidée)

| Champ | Valeur |
|---|---|
| Code | MOD_HG_ARIA |
| Service rendu | Parcours structuré + suivi humain ponctuel, sans cours de groupe |
| Épreuve couverte | `histoire-geographie` |
| Format | `autonomie_guidee_aria` |
| Volume minimal | 0,25 h synchrone + 2 h autonomie/mois |
| Volume recommandé | 0,5 h synchrone + 3 h autonomie/mois |
| Volume renforcé | 1 h synchrone + 4 h autonomie/mois |
| Prix minimal | 20 TND/mois `[hypothèse Claude]` |
| Prix recommandé | 40 TND/mois `[hypothèse Claude]` |
| Prix renforcé | 80 TND/mois `[hypothèse Claude]` |
| Coût retenu | 17,5 TND/mois (**tuteur**, seule qualification pertinente à ce format — 0,5h×35) |
| Marge selon effectif | Non applicable — produit individualisé, marge constante 56,25 % aux 3 paliers |
| Inclusion ou supplément | Supplément — Pilotage inclut l'accès plateforme ARIA, pas le suivi humain dédié |
| Offres concernées | Aucune |
| Recommandation | Créer le tier `autonomie_guidee_aria` (migration additive) aux 3 prix ci-dessus |
| Décision demandée | Approuver 20/40/80 TND/mois + création du tier de données |

## 5 — MOD_ES_ARIA

Identique à MOD_HG_ARIA — épreuve couverte : `enseignement-scientifique`. Une seule décision de direction
couvre les 3 modules ARIA (4-6).

## 6 — MOD_EMC_ARIA

Identique à MOD_HG_ARIA — épreuve couverte : `emc`.

## 7 — MOD_EAF_DESCRIPTIF

| Champ | Valeur |
|---|---|
| Code | MOD_EAF_DESCRIPTIF |
| Service rendu | Aide à la constitution du descriptif des textes/œuvres (obligation réglementaire EAF) |
| Épreuve couverte | `eaf-ecrit`/`eaf-oral` (support administratif, pas l'épreuve) |
| Format | `individuel_presentiel` (tarif existant réutilisé) |
| Volume minimal | 1 séance (1h) |
| Volume recommandé | 2 séances (2h) |
| Volume renforcé | 3 séances (3h) |
| Prix minimal | 180 TND |
| Prix recommandé | 360 TND |
| Prix renforcé | 540 TND |
| Coût retenu | 130 TND (certifié, 2h : 2×50 + 2×15) |
| Marge selon effectif | Non applicable — format individuel (eff.=1 par construction). Marge constante 63,9 % aux 3 paliers |
| Inclusion ou supplément | Supplément optionnel — jamais dans le forfait EAF 8h/mois par défaut, sur demande uniquement |
| Offres concernées | Aucune — ne touche pas le forfait 8h/mois existant (Cap Anticipées) |
| Recommandation | Option ponctuelle sur demande au tarif individuel existant, jamais par défaut |
| Décision demandée | Approuver le principe opt-in + le tarif 180/360/540 TND |

## 8 — MOD_MATHS_EXPERTES (option)

| Champ | Valeur |
|---|---|
| Code | MOD_MATHS_EXPERTES |
| Service rendu | Points bonus loi des points (option facultative) |
| Épreuve couverte | Option facultative — coefficient **non sourcé** (`OPTION_COEFFICIENT_NON_SOURCE`, dette `lib/exams/`, hors périmètre commercial) |
| Format / Volumes / Prix / Coût / Marge | Identiques à MOD_LVA (250/470/680, coût retenu 520 TND certifié) |
| Inclusion ou supplément | Supplément — absent des 6 offres |
| Offres concernées | Aucune |
| Recommandation | Approuver le prix **par anticipation** ; activation technique **bloquée séparément** tant que le coefficient n'est pas sourcé — 2 décisions distinctes, jamais fusionnées |
| Décision demandée | (a) Approuver 250/470/680 TND ; (b) confirmer le blocage technique jusqu'à résolution réglementaire |

## 9 — MOD_MATHS_COMPLEMENTAIRES (option)

Identique à MOD_MATHS_EXPERTES en tout point — une décision de direction peut couvrir les 4 options (8-11)
en bloc si la grille est acceptée.

## 10 — MOD_DGEMC (option)

Identique à MOD_MATHS_EXPERTES.

## 11 — MOD_LCA (option)

Identique à MOD_MATHS_EXPERTES + avertissement : population de candidats très faible, DUO/SOLO sera la
norme (pas l'exception).

## 12 — SVC_BACS_BLANCS

| Champ | Valeur |
|---|---|
| Code | SVC_BACS_BLANCS |
| Service rendu | Mise en situation d'examen + correction individualisée |
| Épreuve couverte | Générique — toute épreuve écrite du profil |
| Format | Correction individuelle + restitution courte |
| Volume minimal | 1 bac blanc |
| Volume recommandé | 2 bacs blancs/an |
| Volume renforcé | 3 bacs blancs/an |
| Prix minimal | 95 TND (1 bac blanc) `[hypothèse Claude]` |
| Prix recommandé | 190 TND (2/an) `[hypothèse Claude]` |
| Prix renforcé | 285 TND (3/an) `[hypothèse Claude]` |
| Coût retenu | 82,5 TND/an (2 × 41,25 — 30 min correction certifié + 15 min restitution tuteur + structure) |
| Marge selon effectif | Non applicable — produit individuel (1 copie = 1 élève). Marge constante 56,6 % |
| Inclusion ou supplément | Supplément visible — pas implicite dans le Pilotage (150 TND/mois ne couvre pas de temps de correction dédié) |
| Offres concernées | Aucune (absent des `included[]` des 6 offres réelles) |
| Recommandation | Ligne visible à 95 TND/bac blanc, vendue à l'unité ou en package annuel |
| Décision demandée | Approuver 95/190/285 TND + la fréquence recommandée |

## 13 — SVC_TUTORAT_COMPRESSION — **RETIRÉ DU CATALOGUE ACTIF**

| Champ | Valeur |
|---|---|
| Code | SVC_TUTORAT_COMPRESSION |
| Statut | **RETIRÉ** (mission "vers un produit complet" §2, voir `resolution-tutorat-compression.md`) |
| Motif | Concept jamais défini dans le dépôt (ni code, ni brief, ni les 6 offres publiques) — chiffrer un produit non défini serait une double invention, refusée par principe |
| Ce qui a été fait | Entrée supprimée de `data/pricing.canonical.json → candidat_individuel_catalogue.services` ; historique conservé par git + ce document ; garanties moteur vérifiées (n'apparaît dans aucun devis, ne bloque aucun profil, non sélectionnable, non activable par configuration) |
| Décision demandée | **Aucune décision tarifaire à prendre.** Si un besoin réel émerge, il devra repartir d'un brief produit d'une page, pas d'une réactivation de cette entrée |

## 14 — SVC_SECOND_GROUPE (P11)

| Champ | Valeur |
|---|---|
| Code | SVC_SECOND_GROUPE |
| Service rendu | Rattrapage de 2 disciplines dans la fenêtre contrainte post-1er groupe |
| Épreuve couverte | Les 2 disciplines de rattrapage choisies (variable) |
| Format | `individuel` (tarif existant réutilisé) |
| Volume minimal | 6 h total (3h/discipline) `[hypothèse Claude]` |
| Volume recommandé | 10 h total (5h/discipline) |
| Volume renforcé | 16 h total (8h/discipline) |
| Prix minimal | 1080 TND (6h × 180 TND/h existant) |
| Prix recommandé | 1800 TND (10h) |
| Prix renforcé | 2880 TND (16h) |
| Coût retenu | 650 TND (certifié, 10h : 10×50 + 10×15) |
| Marge selon effectif | Non applicable — format individuel par nature. Marge constante 63,9 % |
| Inclusion ou supplément | Supplément — produit autonome, hors packs annuels |
| Offres concernées | Aucune |
| Recommandation | Réutiliser le tarif individuel existant (180 TND/h), pas de grille « urgence » séparée |
| Décision demandée | Approuver 180 TND/h + les 3 paliers (6h/10h/16h) |

---

## Synthèse

| Code | Prix min/reco/renforcé | Coût retenu | Statut |
|---|---|---|---|
| MOD_LVA | 250/470/680 | 520 (certifié) | À_APPROUVER |
| MOD_LVB | 250/470/680 | 520 (certifié) | À_APPROUVER |
| MOD_SPECIALITE_ABANDONNEE | 250/470/680 | 520 (certifié) | À_APPROUVER |
| MOD_HG_ARIA | 20/40/80 | 17,5 (tuteur) | À_APPROUVER |
| MOD_ES_ARIA | 20/40/80 | 17,5 (tuteur) | À_APPROUVER |
| MOD_EMC_ARIA | 20/40/80 | 17,5 (tuteur) | À_APPROUVER |
| MOD_EAF_DESCRIPTIF | 180/360/540 | 130 (certifié) | À_APPROUVER |
| MOD_MATHS_EXPERTES | 250/470/680 | 520 (certifié) | À_APPROUVER (+ blocage réglementaire séparé) |
| MOD_MATHS_COMPLEMENTAIRES | 250/470/680 | 520 (certifié) | À_APPROUVER (+ blocage réglementaire séparé) |
| MOD_DGEMC | 250/470/680 | 520 (certifié) | À_APPROUVER (+ blocage réglementaire séparé) |
| MOD_LCA | 250/470/680 | 520 (certifié) | À_APPROUVER (+ blocage réglementaire séparé) |
| SVC_BACS_BLANCS | 95/190/285 | 82,5 (mixte) | À_APPROUVER |
| SVC_TUTORAT_COMPRESSION | — | — | **RETIRÉ** |
| SVC_SECOND_GROUPE | 1080/1800/2880 | 650 (certifié) | À_APPROUVER |

**13 éléments avec proposition chiffrée argumentée, 1 résolu par retrait.** Aucun n'est approuvé — chaque
statut reste `À_APPROUVER` jusqu'à retour explicite de la direction.
