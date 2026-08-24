# ADR — Taxonomie `ParcoursType` P1→P12

**STATUS = APPROVED (décision de direction, mission finale « Go-Live Ready » du 2026-08-24).**

> Ce document résout les 9 questions ouvertes du §10 de `docs/candidat-individuel/reconstruction-parcours-p1-p12.md` (STATUS = `DRAFT_RECONSTRUCTED_FROM_EVIDENCE`, non résolu par preuve). La résolution ne vient pas d'une preuve retrouvée dans le dépôt — le brief original reste introuvable, confirmé par recherche exhaustive — mais d'une **décision de direction explicite**, transmise dans la mission finale « Go-Live Ready » du 2026-08-24, §2 (D1-D6) et §3.3. C'est le mode de résolution que le document de reconstruction anticipait lui-même en §11 : *« décision produit fraîche assumée comme telle, pas comme une reconstruction de l'existant »*.

---

## Taxonomie approuvée

| Code | Nom | Nature |
|---|---|---|
| `P1_LIBRE_2ANS_MODALITE_A` | Candidat libre, cycle 2 ans, modalité A | Parcours principal |
| `P2_LIBRE_2ANS_MODALITE_B` | Candidat libre, cycle 2 ans, modalité B | Parcours principal |
| `P3_LIBRE_1AN_DEROGATION` | Bac accéléré (dérogation article 3, même session) | Parcours principal |
| `P4_REDOUBLEMENT_PREMIERE` | Redoublement, échec/représentation niveau première | Parcours principal |
| `P5_REDOUBLEMENT_TERMINALE` | Redoublement, échec/représentation niveau terminale | Parcours principal |
| `P6_AMELIORATION_ET_TERMINALE` | Amélioration de note(s) tout en se présentant en terminale | Parcours principal |
| `P7_TITULAIRE_BAC` | Déjà titulaire du baccalauréat, dispenses déclaratives | Parcours principal |
| `P8_SCOLARISE_VERS_LIBRE` | Bascule scolaire → individuel en cours de cycle | Parcours principal |
| `P9_CHANGEMENT_SPECIALITE` | Changement de spécialité | **Modificateur transverse, cumulable** — pas mutuellement exclusif |
| `P10_EPREUVES_ANTICIPEES_SEULES` | Seules les épreuves anticipées restent à présenter | Parcours principal |
| `P11_SECOND_GROUPE` | Rattrapage (second groupe) | Parcours principal, produit autonome |
| `P12_ETALEMENT_PLURISESSIONS` | Étalement sur plusieurs sessions | Parcours principal, **manuel assisté** |

---

## Réponses aux 9 questions du §10 de la reconstruction

### Q1 — Définition de P1, P2, P4, P6, P9, P10, P12

**Choix retenu** : donnée ci-dessus (mission §3.3), verbatim.
**Options rejetées** : aucune — ces 7 codes n'avaient aucune définition candidate dans la reconstruction ; ce n'est pas un arbitrage entre options mais un comblement d'un vide, ce que la reconstruction interdisait explicitement de faire seul.
**Raison** : décision de direction explicite, hors périmètre de ce que le dépôt pouvait prouver.
**Impact DB** : ces 7 valeurs entrent dans l'enum `ParcoursType` (voir Lot 2 complémentaire).
**Impact moteur** : chacune doit avoir une règle de résolution dans le futur résolveur `resolveParcoursType(profil, carteExamen)` (Lot 3).
**Impact UI** : wizard §9 de la mission, étape « situation antérieure » doit collecter les faits distinguant ces 7 cas.
**Test de non-régression** : au moins un cas nominal par parcours (mission §14, « P1–P12 »).

### Q2 — P1 = primo-candidat cycle 2 ans ?

**Choix retenu** : **confirmé, mais scindé en deux** (`P1` = modalité A, `P2` = modalité B) — pas un seul P1 générique comme l'hypothèse FAIBLE de la reconstruction le proposait.
**Options rejetées** : P1 générique + `modalite` comme simple attribut orthogonal du profil (mon hypothèse d'origine).
**Raison** : décision de direction — la modalité cadence différemment le calendrier de travail (brief cité par l'audit), donc structurante pour le `ParcoursType`, pas seulement pour le calcul de coefficient.
**Impact DB** : `ProfilCandidat.modalite` (`Modalite` enum, déjà ajouté Lot 2) reste la source de vérité factuelle ; `ParcoursType` P1/P2 est **dérivé** de ce champ (cohérent avec Q8 ci-dessous), pas un doublon d'information à synchroniser manuellement.
**Impact moteur** : `resolveParcoursType` lit `profil.modalite` pour trancher P1 vs P2 quand les autres conditions du cas générique (non redoublant, cycle complet) sont réunies.
**Impact UI** : aucun changement — le wizard collectait déjà la modalité.
**Test de non-régression** : deux cas nominaux distincts (P1 et P2) plutôt qu'un seul.

### Q3 — P3/P3-bloqué = bac accéléré ?

**Choix retenu** : **confirmé** (`P3_LIBRE_1AN_DEROGATION`). « P3-bloqué » n'est **pas** un 13ᵉ code — c'est un **état de résolution** de l'éligibilité à P3 (`ELIGIBILITY_REQUIRES_HUMAN_REVIEW`, déjà codé Lot 1 via `checkSameSessionEligibility`), pas une valeur distincte de l'enum.
**Options rejetées** : un code `P3_BIS`/`P3_BLOQUE` séparé dans l'enum.
**Raison** : la mission distingue explicitement statut réglementaire (parcours) et résultat de validation (éligible/à réviser) — mélanger les deux romprait l'invariant « un profil résout à un seul `ParcoursType` ».
**Impact DB** : aucun champ enum supplémentaire ; le statut d'éligibilité reste porté par la logique existante `checkSameSessionEligibility`/`ELIGIBILITY_REQUIRES_HUMAN_REVIEW`.
**Impact moteur** : `resolveParcoursType` doit retourner `P3` avec un sous-statut d'éligibilité (`AUTO_ELIGIBLE` / `REQUIRES_HUMAN_REVIEW`), consommé par le moteur de recommandation (mission §8) pour bloquer l'émission automatique si nécessaire.
**Impact UI** : le wizard doit afficher un état « bloqué, en attente de confirmation » distinct de « refusé ».
**Test de non-régression** : cas P3 éligible + cas P3 non éligible (mission §14 les nomme explicitement).

### Q4 — P6 = amélioration de notes ?

**Choix retenu** : **confirmé et précisé** — `P6_AMELIORATION_ET_TERMINALE` : amélioration de note(s) combinée à une présentation en terminale (distinct de P5, qui est un redoublement terminale sans nécessairement viser une amélioration).
**Options rejetées** : fusionner P5/P6 en un seul code (la reconstruction notait leur proximité sans preuve de distinction) ; garder P6 non défini.
**Raison** : décision de direction — distinction utile pour le calcul du volume pédagogique (P6 cible une progression, P5 une reconstruction complète).
**Impact DB** : valeur d'enum distincte de P5.
**Impact moteur** : `resolveParcoursType` doit distinguer P5/P6 à partir de `notesConservees` (Lot 1/2) combiné à une intention déclarée d'amélioration — champ à ajouter si absent (voir Lot 2 complémentaire, §"champs restant à ajouter" plus bas).
**Impact UI** : wizard étape 11 (résultats antérieurs) doit permettre de déclarer une intention d'amélioration, pas seulement une conservation passive.
**Test de non-régression** : P5 avec notes conservées, P5 avec renonciation (mission §14) — pas de cas P6 explicitement listé au §14, à ajouter en test complémentaire.

### Q5 — P7/P8/P11 = bascule/titulaire/second-groupe (association par ordre) ?

**Choix retenu** : **partiellement infirmé** — l'association par ordre déduite de Lot 1 Task 6 était fausse sur deux points. Mapping définitif : `P7 = Titulaire Bac` (pas bascule), `P8 = Scolarisé → Libre` (pas titulaire), `P11 = Second groupe` (confirmé, seul correct).
**Options rejetées** : l'inférence par ordre d'écriture de la reconstruction (P7=bascule, P8=titulaire).
**Raison** : la reconstruction avait explicitement marqué cette inférence à confiance MOYENNE, « association par ordre, jamais nommée terme à terme » — précisément le genre d'erreur que la méthode evidence-first est censée éviter de figer comme un fait. La décision de direction corrige.
**Impact DB** : aucun changement de structure — seul le **libellé** associé à chaque code change. Les structures déclaratives Lot 1 (`basculeScolaireVersIndividuel`, `dispensesTitulaireBac`) restent valides telles quelles ; c'est leur **rattachement à P7 vs P8** qui s'inverse par rapport à l'hypothèse de travail précédente.
**Impact moteur** : `resolveParcoursType` doit lire `profil.estTitulaireBacDejaObtenu` → P7 ; `profil.brancheBascule` renseigné → P8. (Les deux champs existent déjà sur `ProfilCandidat`, Lot 2.)
**Impact UI** : aucun changement fonctionnel, seulement le libellé exposé si jamais un code provisoire P7/P8 avait fuité dans un composant — vérifié : aucun composant ne référence encore ces codes (Lot 2 n'avait pas codé `ParcoursType`).
**Test de non-régression** : mission §14 liste explicitement « P8 conservation des moyennes de Première » et « P8 renonciation » — confirme bien P8 = bascule scolaire (les deux branches `basculeScolaireVersIndividuel` sont bien sous P8, pas P7). « P7 avec dispenses partielles » confirme P7 = titulaire.

### Q6 — Où placer « changement de spécialité » et « étalement plurisessions » ?

**Choix retenu** : `changement de spécialité` → **P9, modificateur transverse cumulable** (pas un parcours principal exclusif). `étalement plurisessions` → **P12, parcours principal, manuel assisté**.
**Options rejetées** : forcer les deux dans une case P-exclusive parmi les emplacements vides (P2/P4/P9/P10/P12) sans justification — c'est explicitement ce que la reconstruction refusait de faire seule.
**Raison** : décision de direction, avec une justification structurelle donnée par la mission elle-même (§3.3) : le changement de spécialité peut se combiner avec plusieurs parcours principaux (ex. un redoublant qui change aussi de spécialité), donc le modéliser comme exclusif créerait un recouvrement artificiel — exactement l'invariant que l'Invariant #1 de la reconstruction (§7) laissait `AMBIGU`.
**Impact DB** : `ParcoursType` reste un enum à 11 valeurs mutuellement exclusives (P1,P2,P3,P4,P5,P6,P7,P8,P10,P11,P12) ; `P9` est représenté par un champ séparé `changementSpecialite: Boolean` sur `ProfilCandidat` (Lot 2 complémentaire), pas par une 12ᵉ valeur d'enum — le code public « P9 » reste néanmoins utilisé dans l'API/UI pour cohérence avec la nomenclature.
**Impact moteur** : le résolveur retourne `{ parcours: ParcoursType, changementSpecialite: boolean }`, jamais `ParcoursType.P9` seul.
**Impact UI** : le wizard doit pouvoir afficher « P1 + changement de spécialité » plutôt qu'un P9 isolé et vide de sens réglementaire.
**Test de non-régression** : mission §14 exige explicitement « P9 combiné avec un parcours principal ».

### Q7 — Relation entre « brief §X.Y » et « CDC §N » ?

**Choix retenu** : **non résolu par la mission, et désormais sans objet pratique.** La mission finale devient la source d'autorité unique pour tout ce qui concernait P1-P12 ; elle ne cite ni l'une ni l'autre numérotation. Les citations `brief §X.Y` déjà codées en commentaire (ex. Lot 1, `§2.9`) restent des traces historiques valides de *pourquoi* une règle a été écrite ainsi, mais cessent d'être la référence à consulter pour toute question encore ouverte.
**Impact** : aucun — documentation uniquement. Ne pas essayer de retrouver ou réconcilier ces deux numérotations plus avant ; ce serait un travail sans valeur ajoutée au vu de la mission actuelle.

### Q8 — `ParcoursType` saisi par la famille ou résolu automatiquement ?

**Choix retenu** : **résolu automatiquement**, confirmé explicitement par la mission §3 : *« `ParcoursType` est une classification opérationnelle dérivée. Ce n'est pas la source de vérité réglementaire »*. Jamais saisi directement.
**Options rejetées** : sélection directe par la famille dans le wizard (aurait permis une déclaration incohérente avec les faits saisis par ailleurs).
**Raison** : cohérence du pipeline `ProfilCandidat → CarteExamen → ParcoursType → Plan pédagogique → Scénarios` (mission §3, ordre exact — noter que la mission place `CarteExamen` **avant** `ParcoursType` dans le pipeline, alors que la reconstruction avait proposé l'ordre inverse ; conservé tel quel, c'est la carte d'examen qui informe la classification, pas l'inverse).
**Impact DB** : `ParcoursType` n'est jamais un champ saisi sur `ProfilCandidat` — uniquement calculé à la volée ou figé sur `Quote`/`CarteExamen` au moment de la génération (cohérent avec `Quote.parcours` mentionné dans l'audit §3 comme colonne candidate).
**Impact moteur** : `genererCarteExamen(profil, session)` produit la carte ; `resolveParcoursType(profil, carte)` en dérive la classification (Lot 3).
**Impact UI** : le wizard ne pose jamais la question « quel est votre parcours ? » — il pose des questions factuelles (Q1 ci-dessus) dont le parcours découle, puis l'affiche en résultat, pas en saisie.

### Q9 — Condition d'âge (« 20 ans ») ?

**Choix retenu** : **non tranché explicitement par la mission** — reste `A_VERIFIER` au sens strict. La mission ne mentionne aucune règle d'âge numérique précise ; elle confirme en revanche (§4, §14) que l'éligibilité à la session unique (P3) est déjà gérée par le pattern fail-closed existant (`autoCheckable` / `ELIGIBILITY_REQUIRES_HUMAN_REVIEW`).
**Décision opérationnelle** : ne pas ajouter de champ d'âge structuré à `ProfilCandidat` tant qu'aucune source officielle précise n'est citée (cohérent avec l'interdiction absolue « ne jamais généraliser par analogie », mission §21). Si une condition d'âge s'avère nécessaire à un cas particulier (ex. dérogation article 3), elle transite par le sac `EligibilityAnswers` existant (`lib/quotes/exam-profile.ts`), qui route déjà vers une révision humaine quand la réponse n'est pas fournie ou incertaine — comportement fail-closed déjà correct sans champ dédié.
**Impact** : aucun changement de schéma nécessaire immédiatement.

---

## Champs `ProfilCandidat` restant à ajouter (Lot 2 complémentaire)

Le Lot 2 initial (commit `2e9e67340`) a délibérément omis tout ce qui dépendait de la taxonomie. Cette ADR débloque l'ajout de :

- `changementSpecialite: Boolean @default(false)` — porte P9 (modificateur transverse, Q6).
- `intentionAmelioration: Boolean @default(false)` — distingue P5 de P6 (Q4) ; `false` + notes conservées + terminale ⇒ P5, `true` ⇒ P6.
- Un champ ou une convention pour distinguer redoublement niveau première (P4) vs terminale (P5/P6) — `estRedoublant` existe déjà (Lot 2) mais est booléen sans niveau ; combiné à `level` (déjà présent), c'est suffisant : `estRedoublant=true` + `level=PREMIERE` ⇒ P4, `estRedoublant=true` + `level=TERMINALE` ⇒ P5/P6 selon `intentionAmelioration`. **Aucun nouveau champ nécessaire pour cette distinction.**
- P10 (épreuves anticipées seules) et P3 (dérogation 1 an) et P12 (étalement) se dérivent de la combinaison `level`/`estRedoublant`/`estTitulaireBacDejaObtenu`/réponses d'éligibilité déjà modélisées — pas de nouveau champ brut identifié à ce stade ; à confirmer en écrivant `resolveParcoursType` (Lot 3), pas en amont.

## `ParcoursType` — définition Prisma proposée

```prisma
enum ParcoursType {
  P1_LIBRE_2ANS_MODALITE_A
  P2_LIBRE_2ANS_MODALITE_B
  P3_LIBRE_1AN_DEROGATION
  P4_REDOUBLEMENT_PREMIERE
  P5_REDOUBLEMENT_TERMINALE
  P6_AMELIORATION_ET_TERMINALE
  P7_TITULAIRE_BAC
  P8_SCOLARISE_VERS_LIBRE
  P10_EPREUVES_ANTICIPEES_SEULES
  P11_SECOND_GROUPE
  P12_ETALEMENT_PLURISESSIONS
}
```

Pas de valeur `P9` dans cet enum (Q6) — `changementSpecialite` est un booléen séparé. Cet enum est volontairement un type Prisma natif (pas une table de configuration) : ces 11 valeurs sont des faits réglementaires structurels, pas des paramètres commerciaux éditables depuis le back-office (contrairement au catalogue de services ou à la grille tarifaire) — cohérent avec la mise en garde de la mission §13 (« éviter les enums Prisma difficiles à faire évoluer lorsque la taxonomie doit rester configurable ») : cette taxonomie-ci n'a pas vocation à être éditée dynamiquement, elle est aussi stable que la réglementation qu'elle classe.
