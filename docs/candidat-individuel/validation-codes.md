# Registre des codes — `validateProfilCandidat` (`lib/exams/profile-validation.ts`)

Mission Lot 4 correctif §6 : convention figée avant le câblage du moteur/wizard. Un code est un
identifiant stable, non traduit, jamais un texte réglementaire brut. `messageFamille` est le texte
destiné à l'utilisateur final (traduisible, reformulable librement) ; `messageInterne` est réservé au
staff/debug et peut évoluer sans contrat. `source` n'est renseigné que pour un contrôle dont le fondement
est un texte réglementaire (jamais pour un contrôle structurel ou une règle de coefficient non sourcée).

Ce fichier est vérifié par `__tests__/lib/exams/validation-codes-registry.test.ts` : tout code présent
dans `lib/exams/profile-validation.ts` ou propagé depuis `lib/exams/options.ts` doit apparaître ici, et
réciproquement — un code qui disparaît (ou apparaît) sans mise à jour de ce fichier fait échouer la
suite.

## Session / éligibilité

| Code | Sévérité | Bloquant | Origine |
|---|---|---|---|
| `SESSION_NON_SUPPORTEE` | ERROR | oui | structurel (`getSupportedSessions`) |
| `SESSION_NON_COMMERCIALISABLE` | ERROR | oui | structurel (`getSessionStatus`) |
| `P3_ELIGIBILITE_INDETERMINEE` | WARNING | oui | `checkSameSessionEligibility` → `ELIGIBILITY_REQUIRES_HUMAN_REVIEW` |
| `P3_ELIGIBLE_CONFIRMEE` | INFO | non | `checkSameSessionEligibility` → `ELIGIBLE` |
| `P3_NON_ELIGIBLE` | INFO | non | `checkSameSessionEligibility` → `NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH` |

## P11 / P12

| Code | Sévérité | Bloquant | Origine |
|---|---|---|---|
| `P11_MOYENNE_HORS_PLAGE` | INFO | non | structurel (plage 8-10 déclarée dans `secondGroupe`) |
| `P12_VALIDATION_HUMAINE_OBLIGATOIRE` | WARNING | oui | décision produit (mission §3.3, non sourcée réglementairement) |

## Modalité

| Code | Sévérité | Bloquant | Origine |
|---|---|---|---|
| `MODALITE_B_COEFFICIENT_A_VERIFIER` | WARNING | oui | référentiel session (`coefficientParModalite.B === 'À_VERIFIER'`) |

Autres invariants modalité demandés (obligatoire/interdite selon applicabilité, panachage A/B, gel après
clôture d'inscription, cohérence avec le `ParcoursType` résolu) : voir §13 "hors périmètre" plus bas —
déjà garantis structurellement par le typage (`modalite` non-nullable, un seul champ), ou non sourcés,
ou temporels/hors `lib/exams/`. Aucun code fabriqué faute de source.

## Spécialités

| Code | Sévérité | Bloquant | Origine |
|---|---|---|---|
| `SPECIALITE_CODE_INCONNU` | ERROR | oui | structurel (`KNOWN_SUBJECTS`), s'applique à `specialite1`/`specialite2`/`specialiteAbandonnee` |
| `SPECIALITES_DOUBLON` | ERROR | oui | structurel |
| `SPECIALITE_ABANDONNEE_INCOHERENTE` | ERROR | oui | structurel |
| `SPECIALITE_ABANDONNEE_MANQUANTE_POUR_P9` | ERROR | oui | cohérence P9 (`changementSpecialite`) ↔ `specialiteAbandonnee` |
| `SPECIALITE_ABANDONNEE_SANS_P9` | ERROR | oui | cohérence P9 ↔ `specialiteAbandonnee` |

## Options (propagés depuis `lib/exams/options.ts`, jamais dupliqués)

| Code | Sévérité | Bloquant | Origine |
|---|---|---|---|
| `OPTIONS_EXCLUSIVES` | ERROR | oui | `lib/exams/options.ts::validateOptionsSelection` |
| `EXPERTES_REQUIERT_SPE_MATHS` | ERROR | oui | idem |
| `COMPLEMENTAIRES_REQUIERT_ABANDON_MATHS` | ERROR | oui | idem |
| `NB_OPTIONS_TERMINALE` | ERROR | oui | idem |
| `OPTION_LCA_TRAITEMENT_DISTINCT` | INFO | non | `lib/exams/options.ts::isLcaOption` |
| `OPTION_COEFFICIENT_NON_SOURCE` | WARNING | oui | absence de coefficient sourcé dans le référentiel Lot 1 |

Non couverts, faute de source (ne pas fabriquer) : disponibilité académique confirmée en Tunisie par
option, incohérence année d'introduction de l'option / session (aucune donnée `introducedSession`
n'existe pour les options, contrairement aux épreuves), plafond distinct d'options en Première (aucun
concept d'option de Première n'existe dans le modèle actuel).

## Notes antérieures (`notesConservees`)

| Code | Sévérité | Bloquant | Origine |
|---|---|---|---|
| `NOTE_HORS_BAREME` | ERROR | oui | structurel (0-20) |
| `NOTE_EPREUVE_INCONNUE` | ERROR | oui | structurel (`getEpreuve`) |
| `NOTE_SESSION_ORIGINE_INVALIDE` | ERROR | oui | structurel (arithmétique session) |
| `NOTE_DELAI_MAXIMAL_DEPASSE` | ERROR | oui | Article D. 334-13 (`VERIFIE_TEXTE_INTEGRAL`) |
| `NOTE_SEUIL_NON_ATTEINT` | INFO | non | Article D. 334-13 |
| `NOTE_DOUBLE_STATUT` | ERROR | oui | structurel |
| `NOTE_MECANISME_INDETERMINE` | WARNING | oui | fail-closed (D. 334-13 vs D. 334-7-1 non tranché) |
| `NOTE_RECONDUCTION_SANS_REDOUBLEMENT` | ERROR | oui | Article D. 334-7-1 (`VERIFIE_TEXTE_INTEGRAL`) |
| `NOTE_DIVERGENCE_COEFFICIENT` | WARNING | oui | `resolveConservedNoteCoefficient` |
| `NOTE_PERTE_MENTION` | INFO | non | Articles D. 334-13 / D. 336-13 |

## Dispenses déclarées (`dispensesDeclarees`, P7)

| Code | Sévérité | Bloquant | Origine |
|---|---|---|---|
| `DISPENSE_EPREUVE_INCONNUE` | ERROR | oui | structurel |
| `DISPENSE_DOUBLE_STATUT` | ERROR | oui | structurel |
| `DISPENSE_HORS_CONTEXTE_P7` | WARNING | non | cohérence de saisie |
| `DISPENSE_DECLAREE_NON_CONFIRMEE` | WARNING | oui | arrêté du 14 mai 2020, périmètre déclaratif |
| `DISPENSE_CONFIRMEE_SANS_JUSTIFICATIF` | ERROR | oui | structurel |

## Cohérence globale

| Code | Sévérité | Bloquant | Origine |
|---|---|---|---|
| `INFORMATIONS_CONTRADICTOIRES` | ERROR | oui | cohérence de saisie |
| `FAITS_CONCURRENTS_PRESENTS` | INFO | non | `resolveParcoursType().faitsConcurrents` |

## Hors périmètre `lib/exams/` — codes futurs documentés, non construits (mission Lot 4 correctif §1 "Charge et cohérence temporelle")

Ces contrôles dépendent d'un calendrier (date de démarrage, date de clôture d'inscription, durée de
session commerciale) que `ProfilCandidat` ne modélise pas aujourd'hui — délibérément, cf. décision D5 et
la séparation `lib/exams/` (référentiel réglementaire pur, sans notion de temps commercial) vs.
`lib/quotes/`/le futur wizard (couche commerciale). Noms de code réservés pour le futur contrat, à ne
PAS préempter dans `lib/exams/` :

- `DATE_DEMARRAGE_POSTERIEURE_EPREUVE`
- `DUREE_SEMAINES_INVALIDE`
- `CHARGE_HEBDOMADAIRE_IMPOSSIBLE`
- `P11_HORS_FENETRE_UTILE`
- `SESSION_FENETRE_COMMERCIALE_FERMEE`
- `MODALITE_MODIFIEE_APRES_CLOTURE`

## Anomalie ouverte, signalée mais non traitée dans ce lot

`ConservedNoteInput.mecanisme = 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE'` est renseigné par l'appelant
(candidat ou staff) sans piste d'audit distincte déclaré/confirmé — contrairement à `dispensesDeclarees`
qui distingue explicitement `DECLAREE`/`CONFIRMEE`/`REFUSEE`. Le texte réglementaire (D. 334-7-1) est
désormais vérifié en intégralité (`VERIFIE_TEXTE_INTEGRAL`, Lot 4 correctif), mais rien n'empêche
aujourd'hui qu'une valeur `RECONDUCTION_AUTOMATIQUE_CONFIRMEE` soit posée sans qu'un humain ait
réellement vérifié la condition "immédiat, sans lacune" exigée par l'article. Décision produit à
prendre : étendre `MecanismeNote` sur le même modèle à 3 états que `StatutDispenseDeclaree`, ou accepter
le risque tel quel. Non implémenté ici — changement de scope explicite, pas fabriqué sans arbitrage.
