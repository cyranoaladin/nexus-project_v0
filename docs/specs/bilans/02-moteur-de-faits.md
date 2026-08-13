# 02 — Moteur de faits déterministe
> [!IMPORTANT]
> **Arbitrage A97 — A1 superseded.** Ce document décrit computeFacts, seule autorité
> de calcul du socle Canonical. Les domaines viennent du pack validé et leurs scores sont
> agrégés depuis les résultats d'items de computeFacts. Le seul point de sortie autorisé est
> buildFactSheet(pack, facts) ; ni un agent ni un rendu ne doit appeler directement
> computeFacts.


**Source de vérité du calcul.** `lib/bilans/facts/compute-facts.ts` implémente exactement ce document.
En cas de divergence entre le code et ce fichier, le code est faux.

## §1. Propriétés exigées

1. **Pureté** — aucune I/O, aucun accès réseau, aucun accès horloge, aucun LLM.
   Signature : `score(input: ScoringInput): ScoringOutput`.
2. **Déterminisme total** — pas de `Math.random`, pas de `Date.now`, pas d'itération sur un
   objet dont l'ordre de clés n'est pas garanti. Tous les tris comportent un tie-break final sur `id`.
3. **Reproductibilité** — `engineVersion` est incrémentée à chaque changement de comportement observable.
   Un changement d'`engineVersion` impose la régénération des cas dorés, avec justification en ADR.
4. **Monotonie** — transformer une réponse fausse en réponse juste ne peut jamais faire baisser
   `globalScore` ni `nodeScore`. Testé par propriété.

## §2. Réussite d'un item

`rawSuccess ∈ [0, 1]`, arrondi au quart.

| Type | Règle |
|---|---|
| `QCM_SIMPLE` | 1 si option choisie == clé, sinon 0 |
| `NUMERIC` | 1 si `abs(v - cible) <= tolerance`, sinon 0 |
| `SHORT_TEXT` | 1 si la forme normalisée appartient à la liste d'acceptation. Normalisation : minuscules, suppression des accents, espaces compressés, ponctuation terminale retirée |
| `QCM_MULTIPLE` | `max(0, (justesCochées − faussesCochées) / nbJustes)`, puis arrondi au quart |

**Binarisation pour le profilage** : `isSuccess = rawSuccess >= SUCCESS_THRESHOLD` (0.75).
Le score utilise `rawSuccess` ; le profil utilise `isSuccess`. Les deux notions ne se confondent pas.

**Non-réponse** : `rawAnswer` absent ou vide ⇒ `rawSuccess = 0`, `confidence = null`, profil `NON_TRAITE`.
Une non-réponse compte 0 dans le score (sinon l'omission devient une stratégie gagnante) mais est
**exclue** du calcul de l'indice de calibration.

## §3. Confiance

Échelle 1..4, sans valeur médiane : `1 = je devine`, `2 = peu sûr`, `3 = plutôt sûr`, `4 = certain`.
`isConfident = confidence >= CONFIDENCE_THRESHOLD` (3).

## §4. Profil d'item — croisement réussite × confiance

| | Confiance basse (1–2) | Confiance haute (3–4) |
|---|---|---|
| **Réussi** | `MAITRISE_FRAGILE` | `MAITRISE` |
| **Échoué** | `LACUNE_CONSCIENTE` | `ERREUR_CONFIANTE` |

Cinquième valeur sentinelle : `NON_TRAITE` (item non renseigné).

Lecture pédagogique :

- `ERREUR_CONFIANTE` — le plus coûteux. L'élève ne sait pas qu'il ne sait pas ; sans intervention,
  il ne révisera pas ce point. **Priorité 1 de toute restitution.**
- `LACUNE_CONSCIENTE` — lacune identifiée par l'élève. Traitable directement en séance.
- `MAITRISE_FRAGILE` — réussite sans assurance : soit chance, soit défaut d'automatisation.
  Se traite par répétition, pas par ré-explication.
- `MAITRISE` — acquis, à ne pas retravailler en stage.

## §5. Poids

`weight = item.difficulty ∈ {1, 2, 3}`. Aucun autre facteur de pondération. Pas de pondération temporelle.

## §6. Agrégation par nœud CPS

Pour un nœud `n` regroupant les items `I(n)` :

```
W        = Σ weight_i                       (tous les items du nœud)
nodeScore = 100 × Σ (rawSuccess_i × weight_i) / W        → arrondi à 1 décimale
m_EC = Σ weight_i où profil = ERREUR_CONFIANTE
m_LC = Σ weight_i où profil = LACUNE_CONSCIENTE
m_NT = Σ weight_i où profil = NON_TRAITE
m_MF = Σ weight_i où profil = MAITRISE_FRAGILE
m_M  = Σ weight_i où profil = MAITRISE
```

Détermination du profil du nœud, **règles évaluées dans l'ordre, première applicable retenue** (ENGINE_VERSION ≥ 1.1.0) :

1. `m_EC > 0` → `ERREUR_CONFIANTE`
2. `m_NT / W > 0.5` → `NON_TRAITE`
3. `m_LC > 0` → `LACUNE_CONSCIENTE`
4. `m_NT > 0` → `MAITRISE_FRAGILE` — un périmètre partiellement inconnu n'est
   jamais « acquis » : ce qui a été vu est réussi, le reste est à situer au
   démarrage
5. sinon → nœud réellement réussi :
   `MAITRISE` si `m_M >= m_MF`, sinon `MAITRISE_FRAGILE`

**La présence prime sur la masse.** Une erreur confiante — item faux répondu
avec une certitude élevée — est le signal prioritaire de la méthode : elle
qualifie le nœud quel que soit son poids relatif. De même, une lacune
consciente présente interdit tout profil « acquis ». Le score du nœud, lui,
continue de mesurer la réussite pondérée : un nœud peut afficher 75 avec un
profil `ERREUR_CONFIANTE` — le profil désigne le point à traiter, le score
situe l'ampleur.

> Historique : jusqu'à ENGINE_VERSION 1.0.1, les règles exigeaient 50 % de
> masse en difficulté avant de qualifier le nœud. Un item faux assumé,
> minoritaire en poids, laissait le nœud `MAITRISE` : le bilan présentait
> comme acquis une notion ratée avec aplomb, et le plan de séances l'ignorait
> (défaut constaté sur un bilan réel, 13/08/2026).

Aucune égalité n'est laissée non résolue : chaque comparaison est explicite.

## §7. Score global et couverture

```
globalScore = 100 × Σ (rawSuccess_i × weight_i) / Σ weight_i     (sur tous les items du test)
coverage    = 100 × (nb items traités) / (nb items du test)
```

`coverage` mesure exclusivement la couverture de la passation : la proportion d'items
traités dans ce questionnaire. Elle ne mesure jamais une couverture du programme, des
chapitres vus ou des notions enseignées. Une passation d'entrée ne collecte aucune donnée
permettant d'établir cette seconde grandeur.

`globalScore` est une donnée **interne**. Il n'apparaît jamais dans un bilan `ELEVE` ou `PARENT`.

## §8. Indice de calibration métacognitive

Sur les seuls items traités :

```
concordance_i = 1 si (isSuccess ∧ isConfident) ∨ (¬isSuccess ∧ ¬isConfident), sinon 0
calibrationIndex = 100 × Σ (concordance_i × weight_i) / Σ weight_i     (items traités)
```

Si aucun item n'est traité, `calibrationIndex = null`.

Interprétation : un indice bas signale un élève qui évalue mal sa propre performance.
C'est un objet de travail en soi (relecture, vérification, contrôle de vraisemblance),
distinct du niveau disciplinaire.

## §9. Priorisation des nœuds

Tri par clés successives :

1. `severityRank` décroissant — `ERREUR_CONFIANTE = 4`, `LACUNE_CONSCIENTE = 3`,
   `MAITRISE_FRAGILE = 2`, `NON_TRAITE = 1`, `MAITRISE = 0` (ENGINE_VERSION ≥ 1.1.0 ;
   position de NON_TRAITE alignée sur la méthode publiée : « confronter,
   installer, consolider, diagnostiquer » — une fragilité prouvée prime sur
   une absence d'information)
2. `criticality` du nœud CPS, décroissant (issue du CPS compilé ; défaut `1` si absente)
3. `nodeScore` croissant
4. `nodeId` lexicographique croissant — tie-break garantissant le déterminisme

Les `PRIORITY_NODES_MAX` (3) premiers nœuds de profil ≠ `MAITRISE` alimentent le micro-plan élève.

## §10. Bande de calibration de groupe

Indicative, jamais présentée comme un engagement.

| `globalScore` | Bande |
|---|---|
| `< 40` | `CONSOLIDATION_PRIORITAIRE` |
| `40 ≤ s < 65` | `CONSOLIDATION_STANDARD` |
| `65 ≤ s < 85` | `RENFORCEMENT` |
| `≥ 85` | `APPROFONDISSEMENT` |

Ces bandes servent à **calibrer la composition des groupes réduits**, pas à classer un élève.
Elles ne sont jamais affichées telles quelles à un parent.

## §11. Drapeaux

Ajoutés à `flags[]`, non exclusifs :

| Drapeau | Condition |
|---|---|
| `COUVERTURE_INSUFFISANTE` | `coverage < 70` — le résultat est indicatif, à signaler dans toute restitution |
| `CALIBRATION_A_TRAVAILLER` | `calibrationIndex !== null && calibrationIndex < 60` |
| `ERREURS_CONFIANTES_MULTIPLES` | au moins 2 nœuds de profil `ERREUR_CONFIANTE` |
| `PASSATION_EXPRESS` | durée totale `< EXPRESS_RATIO` (0.35) × `targetDurationMin` — fiabilité douteuse |
| `PASSATION_PARTIELLE` | passation soumise depuis un état `EXPIRED` |

`COUVERTURE_INSUFFISANTE` et `PASSATION_EXPRESS` **bloquent** la génération automatique d'un bilan
`PARENT` : revue humaine obligatoire, quelle que soit la valeur de `REQUIRE_HUMAN_REVIEW_PARENT`.

## §12. Ce que le moteur ne fait pas

- Il ne produit **aucune phrase**. Il produit des structures. La mise en mots est en spec 05.
- Il ne recommande **aucune formule commerciale** ni aucun tarif.
- Il n'appelle **jamais** ARIA ni aucun modèle.
