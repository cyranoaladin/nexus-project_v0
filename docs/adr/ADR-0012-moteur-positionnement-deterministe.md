# ADR-0012 — Moteur de positionnement déterministe, sans LLM

- **Statut** : SUPERSEDED by ADR-0013
- **Date** : 2026-07-31
- **Décideur** : Nexus (propriétaire produit)
- **Remplace** : —
- **Lié à** : `docs/specs/positionnement/02-moteur-de-scoring.md`

## Contexte

Le système de tests de positionnement produit des bilans lus par des élèves et des parents,
et sert à calibrer la composition des groupes réduits. Deux options se présentaient :
un moteur déterministe templaté, ou une évaluation et une rédaction assistées par modèle
(ARIA / Ollama, déjà déployé).

## Décision

Le chemin critique — correction, agrégation, profilage, priorisation, rédaction du bilan —
est **entièrement déterministe**. Aucun appel à un modèle de langage.
`lib/positionnement/scoring.ts` est une fonction pure, sans I/O, testable hors réseau.

Une éventuelle reformulation assistée reste possible à l'avenir, mais : hors du chemin critique,
désactivée par défaut, et systématiquement soumise à revue humaine avant diffusion.

## Justification

1. **Reproductibilité.** Un parent qui conteste un bilan doit pouvoir obtenir la même sortie
   à partir des mêmes réponses. Un modèle non déterministe rend cette garantie impossible.
2. **Testabilité.** Un moteur pur atteint 100 % de couverture de branches et se valide
   par cas dorés. Une sortie de modèle ne se teste que statistiquement.
3. **Responsabilité.** Nexus assume le contenu des bilans. Une formulation générée non revue
   pourrait produire une promesse de résultat ou un ressort anxiogène — tous deux prohibés
   par `AGENTS.md`.
4. **Cohérence de positionnement.** ARIA complète l'accompagnement humain, ne le remplace pas.
   Faire rédiger un diagnostic par un modèle contredirait ce positionnement public.
5. **Coût et latence.** Le scoring s'exécute en millisecondes, sans dépendance à Ollama,
   sans point de défaillance supplémentaire.

## Conséquences

**Positives** : sorties auditables ; tests rapides et fiables ; aucune dépendance d'infrastructure
supplémentaire ; conformité éditoriale vérifiable automatiquement.

**Négatives** : les formulations sont moins variées et demandent un catalogue de fragments entretenu
à la main ; les cas pédagogiques inhabituels sont moins bien couverts ; toute évolution
de l'algorithme exige une bascule d'`engineVersion` et la régénération des cas dorés.

**Atténuation** : le catalogue de fragments est versionné et enrichi progressivement ;
la revue humaine des bilans `PARENT` reste active par défaut.

## Décisions liées à trancher

Ces points conditionnent les fixtures et doivent être arbitrés avant le lot L1 :

1. Échelle de confiance à 4 niveaux, seuil haute confiance ≥ 3
2. Aucun score brut affiché ni à l'élève ni au parent
3. ARIA hors du chemin de scoring et de rédaction
4. Passation sans compte, rattachée à un `Lead`
5. Accès par jeton opaque uniquement
6. Recommandation de groupe indicative, jamais engageante
