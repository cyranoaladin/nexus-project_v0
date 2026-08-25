# Catalogue de services et modules — architecture livrée (Lot 5)

Référence technique du catalogue implémenté dans `data/pricing.canonical.json::candidat_individuel_catalogue`
et résolu par `lib/quotes/catalogue.ts`, conformément aux décisions validées dans
`lot5-catalogue-brainstorming.md` (STATUS = DIRECTION_APPROVED_FOR_IMPLEMENTATION).

## Architecture en couches

| Couche | Fichier | Rôle |
|---|---|---|
| Données canoniques | `data/pricing.canonical.json::candidat_individuel_catalogue` | Seule source — étend `candidat_individuel_modules` existant (taux), ne le duplique jamais |
| Types + validation structurelle | `lib/quotes/catalogue-schema.ts` | Zod : unicité des ids/coverageKeys, cohérence approbation↔prix↔volume |
| Accès raw | `lib/pricing.ts::getCandidatIndividuelCatalogueRaw()` | Lecture JSON typée, non validée (symétrique à `getCandidatIndividuelModules`) |
| Résolution + calcul | `lib/quotes/catalogue.ts` | `getCatalogue()` (validé, caché), `resolveCatalogueModules()`, `detectDoubleBilling()`, adaptateur transitoire |

## Matrice épreuves/options → modules

| Épreuve / Option | Module | Format | Statuts exclus | Approbation | Volume |
|---|---|---|---|---|---|
| eaf-ecrit, eaf-oral | MOD_EAF_ECRIT_ORAL (EAF écrit et oral) | petit_groupe | CONSERVEE, DISPENSEE, RECONDUITE | APPROVED | 8h/mois (dérivé) |
| eaf-oral | MOD_EAF_DESCRIPTIF (Accompagnement du descriptif EAF) | individuel_presentiel | CONSERVEE, DISPENSEE, RECONDUITE | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| eam | MOD_EAM (Mathématiques anticipées) | petit_groupe | CONSERVEE, DISPENSEE, RECONDUITE | APPROVED | 4h/mois (dérivé) |
| eds1 | MOD_EDS1 | petit_groupe | CONSERVEE, DISPENSEE, RECONDUITE | APPROVED | 8h/mois (dérivé) |
| eds2 | MOD_EDS2 | petit_groupe | CONSERVEE, DISPENSEE, RECONDUITE | APPROVED | 8h/mois (dérivé) |
| philosophie | MOD_PHILOSOPHIE | petit_groupe | CONSERVEE, DISPENSEE, RECONDUITE | APPROVED | 4h/mois (dérivé) |
| grand-oral | MOD_GRAND_ORAL | individuel_presentiel | DISPENSEE | APPROVED | plafonné 8h/an |
| histoire-geographie | MOD_HG_ARIA | autonomie_guidee_aria | CONSERVEE, DISPENSEE, RECONDUITE | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| enseignement-scientifique | MOD_ES_ARIA | autonomie_guidee_aria | CONSERVEE, DISPENSEE, RECONDUITE | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| emc | MOD_EMC_ARIA | autonomie_guidee_aria | CONSERVEE, DISPENSEE, RECONDUITE | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| lva | MOD_LVA | petit_groupe | CONSERVEE, DISPENSEE, RECONDUITE | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| lvb | MOD_LVB | petit_groupe | CONSERVEE, DISPENSEE, RECONDUITE | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| specialite-abandonnee | MOD_SPECIALITE_ABANDONNEE | petit_groupe (mono-discipline) | CONSERVEE, DISPENSEE, RECONDUITE | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| option:MATHS_EXPERTES | MOD_MATHS_EXPERTES | petit_groupe | — | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| option:MATHS_COMPLEMENTAIRES | MOD_MATHS_COMPLEMENTAIRES | petit_groupe | — | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| option:DGEMC | MOD_DGEMC | petit_groupe | — | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |
| option:LCA_LATIN, LCA_GREC | MOD_LCA | petit_groupe | — | DIRECTION_A_VALIDER | DIRECTION_A_VALIDER |

`eps` : hors tableau — traité comme service (`SVC_EPS_ADMINISTRATIF`), pas comme module horaire (D1 : jamais
d'entraînement sportif facturé).

## Services transverses

| Service | Coverage keys | Inclusion | Approbation |
|---|---|---|---|
| SVC_PILOTAGE | PILOTAGE_REGLEMENTAIRE, DIAGNOSTIC_STRATEGIQUE, CARTE_EXAMEN, APPUI_CYCLADES, SUIVI_ECHEANCES, ARIA_ACCESS, BILANS_PERIODIQUES, SUIVI_FAMILLE | vendable_separement | APPROVED |
| SVC_EPS_ADMINISTRATIF | EPS_ADMINISTRATIF | inclus_uniquement | APPROVED |
| SVC_BACS_BLANCS | BACS_BLANCS | inclus_uniquement | DIRECTION_A_VALIDER |
| SVC_TUTORAT_COMPRESSION | TUTORAT_COMPRESSION | vendable_separement | DIRECTION_A_VALIDER |
| SVC_SECOND_GROUPE | SECOND_GROUPE | vendable_separement | DIRECTION_A_VALIDER |

Note de conception : Pilotage documente ses 8 couvertures directement dans `coverageKeys` — aucun service
séparé (ex. "SVC_DIAGNOSTIC_STRATEGIQUE") n'existe pour chaque sous-item, pour que chaque `coverageKey` du
catalogue identifie une unité vendable unique (contrainte imposée par le schema). Les scénarios anti-doublon
(Pilotage+Cyclades, etc.) sont testés avec des `SelectedCoverageItem` synthétiques
(`__tests__/lib/quotes/catalogue.test.ts`) plutôt qu'avec un second service catalogué redondant.

## Anti-double-facturation

`lib/quotes/catalogue.ts::detectDoubleBilling(items: SelectedCoverageItem[])` : générique, détecte toute
`coverageKey` apparaissant plus d'une fois dans une liste de `{id, coverageKey}`. `coverageItemsForSelection()`
construit cette liste pour une résolution réelle (Pilotage inclus + modules `SELECTED`) — une résolution
nominale ne produit jamais de doublon aujourd'hui (`__tests__/lib/quotes/catalogue.test.ts`, testé).

Scénarios explicitement testés (mission §6/§14) : Pilotage+Cyclades, Pilotage+diagnostic, Pilotage+carte,
pack+modules élémentaires, ARIA incluse+forfait ARIA, Grand Oral inclus+module ajouté — tous détectés.

## Impact sur les 6 offres candidat individuel

Voir `lot5-catalogue-brainstorming.md` §7 pour la matrice complète (services inclus, volume, prix,
classification). **Aucune offre n'est modifiée, supprimée, ou reprix par ce lot.** Anomalie relevée
(texte libre `included[]`, pas structurelle) : Focus Bac et Intégrale ne mentionnent pas explicitement
"Pilotage Nexus complet" dans leur propre liste `included`, contrairement à Cap Anticipées/Renforcée — à
corriger dans une future normalisation des `included[]` en `coverageKeys` structurés, hors périmètre de
ce lot (aucune donnée de prix touchée).

## Plan pour le moteur tarifaire (lot suivant, non construit ici)

1. Étendre `lib/quotes/pricing.ts`/`optimizer.ts`/`priority.ts` pour consommer soit l'adaptateur
   (`adaptCatalogueSelectionToExamProfile`, zéro régression immédiate) soit directement `CatalogueSelection`
   (refonte plus profonde, décision à prendre séparément — non tranchée par ce lot).
2. Résoudre l'échéancier P11 (Décision 3, différé) : acompte/mensualités courts liés à la réservation et à
   la disponibilité réelle, distincts du 25%/10 mensualités annuel.
3. Ajouter un namespace `BusinessConfig` (`pricing.candidatIndividuelCatalogue`) si des overrides
   versionnés du catalogue deviennent nécessaires — le mécanisme existe déjà (`lib/config/schemas.ts`),
   aucun nouveau système à construire.
4. Lever les fiches d'arbitrage (`lot5-fiches-arbitrage-volumes.md`) une à une avec la direction avant que
   chaque module concerné puisse quitter `DIRECTION_A_VALIDER`.
5. Ne recâbler `/recommandation`/`RecommendationWizard`/`app/api/quotes/*` sur ce nouveau moteur que dans
   un lot séparé, explicitement annoncé (Décision 1) — retirer l'adaptateur transitoire à ce moment-là.
