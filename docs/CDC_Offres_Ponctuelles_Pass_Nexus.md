# CAHIER DES CHARGES — Offres ponctuelles, Pass & Carte Nexus
### Document de référence itératif pour Claude Opus

> **Mode d'emploi.** Ce document est la **source de spécification** de la couche « offres ponctuelles ». À **chaque itération**, Claude Opus relit la §9 (Matrice de vérification) et la §10 (Definition of Done) et met à jour le statut de chaque ligne (`☐` → `☑`). Aucune livraison n'est considérée terminée tant que **toutes** les lignes ne sont pas `☑`. En cas de conflit avec le code existant, **ce document et le JSON canonique font foi**.
>
> **Dépendance.** Ce CDC s'ajoute au prompt de refonte `PROMPT_Claude_Opus_Refonte_Nexus.md` et en **hérite intégralement** des invariants (cf. §1). Il ne les redéfinit pas, il les réutilise.

---

## 1. INVARIANTS HÉRITÉS (rappel — non négociables)

1. **Source de vérité unique** : tout prix / effectif / acompte / échéancier / date provient du **JSON canonique**. Zéro valeur codée en dur dans pages/composants (test bloquant déjà en place).
2. **Effectif** : `group_max = 5` partout, sans exception. Ouverture garantie : **dès 3** (lycée, online, stage), **dès 4** (collège/Brevet). Sous le minimum → semi-individuel **+50 %** ou report.
3. **Planchers de marge** (prof = 120 TND/h, fixe quel que soit l'effectif) :
   - matière simple : **≥ 50 TND/élève/h**
   - multi-matières : **≥ 45 TND/élève/h**
   - collège : **≥ 40 TND/élève/h**
   - **stage unitaire : ≥ 45 TND/élève/h**
   - **pack : prix ≥ 80 % de la somme des prix unitaires** (remise pack ≤ 20 %)
4. **Remises** : non cumulables (sauf décision direction), **plafond global 20 %**, jamais sous plancher.
5. **Campagne** : `campaign.deadline_iso = 2026-08-31`, pilotée par date ; bascule auto vers tarif public ensuite. Fidélité = statut (familles 2025/2026), sans date.
6. **Qualité** : suite de tests verte (≥ 72/72) + nouveaux tests ; build OK ; Lighthouse mobile non régressé ; aucun lien/ancre cassé ; aucun `TODO` orphelin.

---

## 2. OBJET & PÉRIMÈTRE DE CE LOT

Ajouter au catalogue une **couche d'offres ponctuelles** entièrement pilotée par le JSON canonique :

- **A. Les Intensifs Nexus** — stages saisonniers (marque ombrelle).
- **B. Prépa épreuves** — Cap EAF, Cap Maths Première, Studio Grand Oral, Épreuve Blanche.
- **C. Coaching « Boussole »** — Diagnostic, Méthode, Orientation & Parcoursup, Individuel.
- **D. Les Pass** — packs de fidélisation réservés par acompte.
- **E. Carte Nexus** — adhésion légère.

Objectif business : **convertir vite** (petit acompte verrouillant) et **fidéliser** (engagement annuel en un seul achat, acompte déductible/reportable).

---

## 3. DONNÉES CANONIQUES — EXTENSION DU JSON

> Adapte la **structure** au fichier canonique existant, mais conserve **tous les champs et toutes les valeurs**. Tous les montants sont en TND. `group_min_open = 3` sauf mention « (Brevet : 4) ».

### 3.A — Stages : formats & éditions

**Formats (grille de prix de référence, groupe 5 max, dès 3) :**

| `format_id` | Nom | Volume | Prix/élève | TND/h | Acompte (30 %) | Solde |
|---|---|--:|--:|--:|--:|--:|
| `intensif-express` | Intensif Express | 10 h | 490 | 49 | 150 | 340 |
| `intensif-solo` | Intensif Solo (1 matière) | 12 h | 580 | 48 | 170 | 410 |
| `intensif-renfort` | Intensif Renfort | 15 h | 720 | 48 | 220 | 500 |
| `intensif-duo` | Intensif Duo (2 matières) | 18 h | 850 | 47 | 260 | 590 |
| `intensif-duo-plus` | Intensif Duo+ | 20 h | 950 | 48 | 290 | 660 |
| `sprint-final` | Sprint Final | 20 h | 950 | 48 | 290 | 660 |
| `sprint-final-max` | Sprint Final Max | 30 h | 1 450 | 48 | 440 | 1 010 |

**Éditions (attribut `edition`, calées sur le calendrier AEFE rythme nord ; dates précises = champ `dates_display`, communiquées, non figées ici) :**

| `edition_id` | Nom affiché | Période indicative | Formats proposés |
|---|---|---|---|
| `cap-rentree` | Cap Rentrée | Août–septembre | solo, renfort, duo, duo-plus |
| `toussaint` | Intensif Toussaint | Octobre–novembre | solo, renfort, duo |
| `noel` | Intensif Noël | Décembre | solo, renfort, duo |
| `fevrier` | Intensif Février | Février | solo, renfort, duo-plus |
| `printemps` | Intensif Printemps | Avril | solo, renfort, duo-plus |
| `sprint` | Sprint Final | Mai–juin | sprint-final, sprint-final-max |

> **Brevet** : un format stage Brevet existe déjà (Stage Brevet) — le conformer à **5 max, dès 4**, prix selon grille collège.

### 3.B — Prépa épreuves (offres ciblées)

| `id` | Nom | Public | Contenu | Volume | Prix | TND/h | Acompte | Solde |
|---|---|---|---|--:|--:|--:|--:|--:|
| `cap-eaf` | Cap EAF | Première | Français écrit + oral, textes, méthode | 15 h | 720 | 48 | 220 | 500 |
| `cap-maths-1re` | Cap Maths Première | Première | Épreuve anticipée de maths | 12 h | 580 | 48 | 170 | 410 |
| `studio-grand-oral` | Studio Grand Oral | Terminale | Posture, structuration, simulations | 10 h | 490 | 49 | 150 | 340 |
| `epreuve-blanche` | Épreuve Blanche | Tous | Bac blanc conditions réelles + correction sur grille officielle | 1 épreuve | 150 | — | **payé intégralement à la réservation** | — |

### 3.C — Coaching « Boussole »

| `id` | Nom | Format | Effectif | Prix | Acompte | Solde |
|---|---|---|---|--:|--:|--:|
| `diagnostic` | Diagnostic Stratégique | Bilan + carte d'examen | individuel | **Offert en campagne / 100 déductible** | — | — |
| `boussole-methode` | Boussole Méthode | Atelier méthodo, 3 séances | 5 max (dès 3) | 390 / cycle | 120 | 270 |
| `boussole-orientation` | Boussole Orientation & Parcoursup | 3 RDV (individuel + atelier) | mixte | 540 / cycle | 160 | 380 |
| `boussole-individuel` | Boussole Individuel | Coaching 1:1 à la séance | individuel | 190 / séance | — | payé à la séance |
| `boussole-individuel-pack3` | Boussole Individuel — Pack 3 | 3 séances 1:1 | individuel | 540 | 160 | 2 × 190 |
| `boussole-individuel-pack5` | Boussole Individuel — Pack 5 | 5 séances 1:1 | individuel | 850 | 250 | solde 600 |

> ⚠️ **Garde-fou marge 1:1** : le coaching individuel est exempté du plancher 50 (un seul élève × 120 TND/h), mais son prix unitaire **≥ 180 TND/h** est un invariant. Test à ajouter.

### 3.D — Les Pass (packs fidélité, réservés par acompte)

Chaque pack **référence des `id`/`format_id` existants** (intégrité référentielle obligatoire). `value` = somme des prix unitaires des composants ; `price` ≤ 0,80 × `value`. Solde réparti **avant chaque prestation**.

| `id` | Nom | Public | Composition (refs) | `value` | **`price`** | Remise | Acompte | Échéancier solde |
|---|---|---|---|--:|--:|--:|--:|---|
| `pass-intensifs-1re` | Pass Intensifs Année | Première | 4× `intensif-solo` (toussaint, noel, fevrier, printemps) | 2 320 | **1 990** | −14 % | 250 | 4 × 435 |
| `pass-intensifs-term` | Pass Intensifs Année | Terminale | 4× `intensif-renfort` (toussaint, noel, fevrier, printemps) | 2 880 | **2 490** | −13 % | 290 | 4 × 550 |
| `pass-cap-bac-1re` | Cap Bac Première | Première | `cap-eaf` + `cap-maths-1re` + 2× `epreuve-blanche` | 1 720 | **1 490** | −13 % | 200 | 320 + 320 + 320 + 330 |
| `pass-go-sprint` | Pass Grand Oral & Sprint | Terminale | `studio-grand-oral` + `sprint-final` | 1 440 | **1 290** | −10 % | 200 | 2 × 545 |
| `pass-excellence-ponctuel` | Pass Excellence Ponctuel | Terminale | `toussaint:renfort` + `fevrier:renfort` + `studio-grand-oral` + `sprint-final` | 2 780 | **2 390** | −14 % | 290 | 4 × 525 |
| `pass-candidat-libre` | Pass Candidat Libre | Libre | `diagnostic` + 2× `intensif-renfort` + 3× `epreuve-blanche` + cellule Cyclades | 2 050 | **1 690** | −18 % | 290 | 4 × 350 |

**Règles Pass (à encoder + tester) :**
- Intégrité référentielle : chaque composant doit exister dans le JSON ; le build **échoue** si un `id` référencé est introuvable.
- Cohérence valeur : `value` recalculée à partir des composants doit correspondre (tolérance 0) au champ stocké ; sinon échec.
- Plancher pack : `price ≥ 0,80 × value` ; sinon échec.
- Cohérence échéancier : `acompte + Σ tranches == price` ; sinon échec.
- Acompte **déductible** du parcours annuel (champ `deposit_deductible_to_annual: true`) et **reportable** sur l'année suivante (`deposit_carryover: true`).

### 3.E — Carte Nexus

| `id` | Nom | Prix | Contenu | Règle de remise |
|---|---|--:|---|---|
| `carte-nexus` | Carte Nexus | 290 / an | Plateforme Autonomie + **−10 % sur stages unitaires & coaching** + réservation prioritaire + 1 Diagnostic | La remise **−10 % s'applique aux unités, PAS aux Pass** (déjà remisés). **Non cumulable**. Le prix unitaire remisé reste **≥ 40 TND/h** (plancher membre). Test à ajouter. |

---

## 4. RÈGLES MÉTIER SPÉCIFIQUES (logique, pas seulement affichage)

1. **Effectif & ouverture** : tous stages/coaching de groupe à 5 max, dès 3 (Brevet : dès 4). Si module d'inscription : bloquer le 6ᵉ inscrit (serveur + UI).
2. **Acompte verrouillant** : la réservation d'un stage/Pass avec acompte **fige le tarif campagne** jusqu'à la prestation, même après le 31 août 2026.
3. **Déductibilité** : l'acompte d'un Pass/stage est déductible si la famille bascule sur un parcours annuel (afficher l'avantage sur la carte).
4. **Remise Carte** : appliquée aux unités uniquement ; jamais empilée sur un Pass ; jamais sous plancher membre 40.
5. **Plafond global 20 %** : la fonction `applyDiscount` centralisée (héritée) borne toute combinaison à 20 % et vérifie le plancher applicable au type d'offre.
6. **Épreuve Blanche** : payée intégralement à la réservation (montant trop faible pour échelonner).

---

## 5. SPÉCIFICATIONS D'AFFICHAGE (UX)

### 5.1 Emplacement & navigation
- Créer/compléter une section **« Stages & Pass »** (ancre `#stages` déjà liée depuis l'accueil ; étendre, ne pas casser les ancres existantes).
- Ajouter au menu : lien « Stages & Pass ». Lien depuis la page d'accueil (bloc stages) et le catalogue.

### 5.2 Carte de stage (Les Intensifs)
Ordre imposé : **Nom (édition)** · objectif court · **prix net/élève** · « soit ~X TND/séance de 2 h » · volume + effectif « groupe 5 max, dès 3 » · **CTA « Réserver (acompte Y) »** + CTA WhatsApp.

### 5.3 Carte de Pass
Ordre imposé : **Nom du Pass** · public · composition listée (les prestations incluses) · **prix Pass en avant** + **« au lieu de `value` »** (barré) + **badge « −Z % »** · « Acompte `deposit` à la réservation, solde avant chaque prestation » · mention **« acompte déductible du parcours annuel »** · CTA « Réserver mon Pass ».
- Le « au lieu de » n'apparaît **que** si `value > price` (honnêteté : pas de faux barré).

### 5.4 Carte Nexus
Bloc dédié : prix 290/an, bénéfices listés, mention claire « remise −10 % sur stages & coaching (hors Pass) ».

### 5.5 Flux de réservation par acompte
Réutiliser le flux « Réserver ma place » (lot précédent) en le paramétrant par `id` d'offre ponctuelle :
- pré-remplir offre + acompte + échéancier depuis le JSON ;
- afficher le montant d'acompte et les coordonnées de paiement ;
- enregistrer la réservation (Prisma si dispo) + confirmation ;
- paiement en ligne : si non intégrable, capture + instructions, `TODO` tracké (pas de faux bouton).

---

## 6. SPÉCIFICATIONS TECHNIQUES

1. **Lecture JSON** : pages HTML statiques et composants Next.js consomment le même fichier canonique (mécanisme d'inclusion cohérent avec l'existant). Aucun prix en dur.
2. **Intégrité référentielle des Pass** : implémenter une validation au build (les composants existent ; `value` recalculée = valeur stockée).
3. **Calculs dérivés** : `price_per_student_hour`, `equiv_per_2h_session`, `deposit`, échéanciers — soit stockés et testés, soit calculés à partir de fonctions pures testées (pas de double source divergente).
4. **i18n / typographie** : montants au format français (espace insécable, « TND »).
5. **Performance** : images de section optimisées (webp) ; pas de régression Lighthouse.

---

## 7. TESTS À AJOUTER (en plus des tests hérités)

| `T#` | Test | Échec si… |
|---|---|---|
| T1 | Effectif stages/coaching de groupe | `group_max > 5` sur une offre ponctuelle |
| T2 | Plancher stage unitaire | un stage unitaire < 45 TND/élève/h |
| T3 | Plancher coaching 1:1 | `boussole-individuel` < 180 TND/h |
| T4 | Intégrité référentielle Pass | un composant de Pass introuvable |
| T5 | Cohérence valeur Pass | `value` stockée ≠ Σ prix composants |
| T6 | Plancher pack | `price > 0,80 × value` (remise > 20 %) |
| T7 | Échéancier (toutes offres ponctuelles & Pass) | `acompte + Σ tranches ≠ price` |
| T8 | Carte non empilable | remise Carte appliquée à un Pass |
| T9 | Carte plancher membre | unité remisée Carte < 40 TND/h |
| T10 | Anti-hardcode (hérité, étendu) | un montant TND des nouvelles offres codé en dur hors JSON |
| T11 | Anti-fuite (hérité, étendu) | « à confirmer par la direction » / « X TND les 2 h » présent |
| T12 | Liens/ancres | ancre `#stages` ou lien menu « Stages & Pass » cassé |

---

## 8. ANNEXE — ÉCHÉANCIERS CALCULÉS (référence, somme vérifiée)

**Stages unitaires** (acompte 30 % arrondi 10 + solde) :
`490 → 150 + 340` · `580 → 170 + 410` · `720 → 220 + 500` · `850 → 260 + 590` · `950 → 290 + 660` · `1150 → 350 + 800` · `1450 → 440 + 1010` · `Épreuve Blanche 150 → intégral`.

**Coaching** : `Boussole Méthode 390 → 120 + 270` · `Boussole Orientation 540 → 160 + 380` · `Pack 3 540 → 160 + 2×190` · `Pack 5 850 → 250 + 600`.

**Pass** (acompte + tranches avant chaque prestation = prix) :
- `pass-intensifs-1re` 1 990 → 250 + 4×435 ✔
- `pass-intensifs-term` 2 490 → 290 + 4×550 ✔
- `pass-cap-bac-1re` 1 490 → 200 + (320+320+320+330) ✔
- `pass-go-sprint` 1 290 → 200 + 2×545 ✔
- `pass-excellence-ponctuel` 2 390 → 290 + 4×525 ✔
- `pass-candidat-libre` 1 690 → 290 + 4×350 ✔

**Carte Nexus** : 290 → intégral à l'achat.

---

## 9. MATRICE DE VÉRIFICATION ITÉRATIVE
> À relire et mettre à jour **à chaque passe**. Cocher `☑` uniquement après vérification effective (test vert ou contrôle visuel).

### 9.1 Données
- ☐ Tous les formats de stage (3.A) présents dans le JSON aux prix exacts
- ☐ Les 6 éditions présentes avec formats associés et champ `dates_display`
- ☐ Les 4 offres Prépa épreuves (3.B) présentes, prix exacts
- ☐ Les 6 lignes Coaching (3.C) présentes, prix exacts
- ☐ Les 6 Pass (3.D) présents, composition par `id`, `value`/`price`/acompte/échéancier exacts
- ☐ Carte Nexus (3.E) présente, 290/an, règle de remise encodée

### 9.2 Règles métier
- ☐ `group_max = 5` sur 100 % des offres ponctuelles ; ouverture dès 3 (dès 4 Brevet)
- ☐ Acompte verrouille le tarif campagne jusqu'à la prestation
- ☐ Acompte Pass déductible (annuel) et reportable (année suivante) — champs présents + affichés
- ☐ Remise Carte : unités uniquement, jamais sur Pass, jamais sous plancher membre 40
- ☐ Plafond global 20 % respecté par toute combinaison

### 9.3 Affichage / UX
- ☐ Section « Stages & Pass » créée, liée depuis menu + accueil + catalogue
- ☐ Cartes de stage au gabarit imposé (5.2)
- ☐ Cartes de Pass avec « au lieu de `value` » + badge remise + mention déductibilité (5.3)
- ☐ Bloc Carte Nexus (5.4)
- ☐ Flux « Réserver (acompte) » paramétré par `id`, échéancier pré-rempli (5.5)
- ☐ « au lieu de » affiché uniquement si `value > price`

### 9.4 Technique & qualité
- ☐ Aucun prix/effectif/acompte des nouvelles offres codé en dur (T10)
- ☐ Tests T1–T12 écrits et **verts**
- ☐ Suite globale verte (≥ 72/72 + nouveaux tests)
- ☐ Build OK, Lighthouse mobile non régressé
- ☐ Aucun lien/ancre cassé, aucun `TODO` orphelin
- ☐ Intégrité référentielle Pass validée au build (T4/T5)

---

## 10. DEFINITION OF DONE
La couche ponctuelle est **terminée** uniquement lorsque :
1. Les 6 sous-sections de la §9 sont **toutes** `☑`.
2. Le JSON canonique contient l'intégralité des offres aux **valeurs exactes** de la §3 (annexe §8 vérifiée).
3. Les tests **T1–T12** sont verts et la suite globale est verte.
4. Le rapport d'itération final liste : fichiers modifiés/créés, statut des 12 tests, capture des trois gabarits (carte stage, carte Pass, bloc Carte Nexus), `TODO` trackés, ambiguïtés et hypothèses retenues.

---

## 11. RAPPELS DE COHÉRENCE (à ne jamais perdre)
- Le coût enseignant (120 TND/h) est **fixe** : la rentabilité vient du remplissage → ne jamais retirer le minimum d'ouverture (3 / 4 Brevet).
- **Ne baisser aucun prix** au-delà des remises encadrées ; la valeur va à la lisibilité et à l'engagement, pas au rabais.
- **Aucun chiffre d'élèves invérifiable** (ligne éditoriale Nexus) ; réassurance par enseignants agrégés/certifiés, grilles officielles, cellule Cyclades, témoignages avec accord.
- Le « au lieu de » des Pass doit refléter une **vraie** somme de prix unitaires existants (honnêteté commerciale).
