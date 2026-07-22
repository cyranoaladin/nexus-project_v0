# Scoring, preuves et état de l'art

## Cadre d'évaluation

Le bilan initial doit être une évaluation critériée : il estime ce qui est observé sur une définition et un curriculum donnés. Il ne prétend pas classer une population ni mesurer un trait latent tant que banque, difficulté et validité ne sont pas calibrées.

| Axe | Mesure | Ne doit pas être confondu avec |
|---|---|---|
| Maîtrise | réussite sur éléments étudiés et observés | couverture du programme |
| Couverture | part de notions/compétences valablement testées | note zéro sur le non étudié |
| Prérequis | dépendances de l'année précédente | programme cible |
| Automatismes | exactitude + temps sur tâches bornées | raisonnement long |
| Raisonnement | étapes, justification, transfert | résultat final seul |
| Méthodologie | organisation, stratégie, vérification | sentiment de méthode |
| Qualité des données | complétude, cohérence, durée, incidents | confiance statistique |
| Confiance du diagnostic | fiabilité de l'interprétation sous règles explicites | confiance déclarée par l'élève |
| Métacognition | écart autoévaluation/performance | score disciplinaire |

## Taxonomie de réponse

`CORRECT`, `PARTIALLY_CORRECT`, `INCORRECT`, `NOT_STUDIED`, `DONT_KNOW`, `UNANSWERED`, `TIMEOUT`, `INVALIDATED`. Les erreurs observées ajoutent une classification séparée : `CONCEPTUAL`, `TECHNICAL`, `READING`, `METHOD`, `TIME_MANAGEMENT`, `INSUFFICIENT_DATA`. Ne jamais coder ces sens dans une sentinelle ambiguë.

## Contrat déterministe

Un `ScoringRun` fixe `engineName`, `engineVersion`, `ruleSetVersion`, checksum de définition/réponses/curricula, instant et code commit. À entrée identique et version identique, le `ScoreSnapshot` est identique. Les arrondis, poids, seuils, données exclues et règles de minimum de preuve sont explicites et couverts par tests unitaires, propriétés et snapshots.

Chaque agrégat conserve ses `SkillEvidence` sources. Une preuve référence : attempt, response, question/version, compétence, notion, barème/règle, curriculum/source, valeur brute, contribution, statut et éventuelle revue.

## État actuel constaté

`BaseScorer` produit un score global pondéré, métriques et un « confidenceIndex » dérivé surtout du taux de NSP ; ce nom ne correspond pas à une véritable confiance du diagnostic. `score-diagnostic.ts` sépare mieux couverture, maîtrise, risque, readiness et cohérences, mais mélange encore mini-test, réponses déclaratives, stress et notes historiques dans certains axes. Les `DomainScore`/`SkillScore` ne remontent pas à une preuve itemisée persistée.

Deux défauts précis sont reproduits/confirmés :

- le bouton « Je ne sais pas » envoie `__NSP__`, que la route ne trouve pas parmi les options et classe `incorrect` ;
- si `scoringResultSchema.safeParse` échoue, la route journalise l'erreur mais continue la persistance.

## Règles de qualité et confiance

La confiance doit baisser si : couverture insuffisante, trop de non-réponses, durée anormale, incohérence répétée, incident technique, réponses trop rapides ou définition non calibrée. Elle ne doit pas baisser parce qu'un élève admet ne pas avoir étudié une notion. Une limite lisible accompagne toujours un seuil faible.

L'écart métacognitif peut être par compétence : `selfEstimate - observedPerformance`, avec intervalle/règle et libellé non stigmatisant. Il ne contribue pas à la maîtrise ; il guide la méthode et l'entretien avec le coach.

## Sorties déterministes minimales

Même sans RAG/LLM/PDF : axes et sous-axes, couverture, qualité/confiance, top erreurs dominantes selon règles, limites, priorités et gains rapides issus d'un catalogue versionné. Les recommandations libres du LLM ne remplacent pas cette sortie.

## Validation

- tests exemples et limites par règle ;
- property tests : bornes, monotonie conditionnelle, invariance de l'ordre, non-impact de `NOT_STUDIED` sur maîtrise ;
- golden snapshots versionnés ;
- tests DB de transaction, unicité et immutabilité ;
- revue pédagogique d'une banque de cas anonymisés ;
- aucune question IA publiée sans validation.
