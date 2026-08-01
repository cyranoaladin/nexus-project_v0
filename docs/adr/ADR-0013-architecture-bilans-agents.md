# ADR-0013 — Architecture des bilans : agents LLM contraints par une couche de faits

- **Statut** : Acceptée
- **Date** : 2026-08-01
- **Décideur** : Nexus (propriétaire produit)
- **Remplace** : ADR-0012 (moteur déterministe sans LLM) — passe en `SUPERSEDED`
- **S'appuie sur** : audit Codex du 31 juillet ; dépôts `nexus-bilan` et `Interface_NSI_Bilan_Support_Suivi`

---

## Contexte

La direction produit demande que **tous les bilans et questionnaires soient en ligne
et traités par LLM et agents**. L'ADR-0012 excluait le LLM du chemin critique après
l'incident du bilan de test : une moyenne de 12/20 rendue « 12/100 », un basculement
au pluriel, des recommandations non mesurables.

Deux découvertes rendent l'exclusion inutile.

**1. Le dépôt possède déjà une couche déterministe complète.**
`lib/diagnostics/bilan-renderer.ts` expose trois renderers déterministes
(`renderEleveBilan`, `renderParentsBilan`, `renderNexusBilan`), dont celui destiné aux
parents produit déjà des libellés qualitatifs sans scores bruts. `signed-token.ts`
fournit un accès HMAC-SHA256 par audience. Le socle est là.

**2. `Interface_NSI_Bilan_Support_Suivi` démontre une architecture LLM qui tient en production.**
Scoring déterministe d'abord, pré-analyse LLM des textes libres, RAG à deux niveaux,
appel final en `response_format: json_object`, validation Zod avec valeurs par défaut,
rendu React-PDF, file BullMQ avec reprise sur échec, métriques Prometheus.

L'erreur « 12/100 » n'était donc pas une fatalité du LLM. Elle vient d'un choix précis :
on a demandé au modèle de **raconter les chiffres**. Un modèle qui recopie une valeur
la recopie parfois mal — et il le fait dans une phrase parfaitement écrite, donc invisible
à la relecture.

## Décision

Les bilans sont produits **en ligne, par des agents LLM**, sous quatre contraintes
structurelles qui rendent l'erreur de type « 12/100 » impossible par construction.

**C1 — Séparation faits / langue.**
Une couche déterministe (`lib/bilans/facts/`) calcule l'intégralité des grandeurs :
scores par domaine, profils, priorités, couverture, calibration. Elle produit une
`FactSheet` immuable. Les agents reçoivent la FactSheet et **rédigent uniquement de la prose**.

**C2 — Aucun chiffre dans la sortie des agents.**
Les champs de prose destinés aux audiences ÉLÈVE et PARENTS ne contiennent aucun
caractère numérique. Les grandeurs sont insérées à l'affichage par les composants de rendu,
directement depuis la FactSheet. Le modèle ne peut pas se tromper sur un chiffre qu'il
n'a pas le droit d'écrire.

**C3 — Sortie contrainte et validée.**
Chaque agent répond en JSON strict, sur un schéma de clés fixe, validé par Zod.
Une sortie non conforme n'est jamais rendue : elle déclenche une reprise en mode
contraint, puis une revue humaine.

**C4 — Publication sous contrôle.**
`REPORT_PENDING_REVIEW → COACH_VALIDATED → PUBLISHED`. Revue humaine à 100 % au démarrage.
L'auto-publication ne s'ouvre, pack par pack, qu'après une série mesurée sans violation,
sur décision explicite.

Cinq agents : pré-analyse des textes libres, rédacteur élève, rédacteur parents,
rédacteur Nexus, et **vérificateur** qui relit les trois bilans contre la FactSheet.
Le vérificateur est un filet secondaire ; les validateurs déterministes restent l'autorité.

## Justification

- **La demande produit est satisfaite** : tout est en ligne, tout passe par des agents.
- **Le mode de défaillance observé disparaît** : il portait sur des chiffres, or les agents
  n'en écrivent plus.
- **La pseudonymisation devient un effet de bord gratuit.** Les agents ne reçoivent jamais
  le nom réel — le rendu l'insère. Un prestataire externe (OpenRouter, OpenAI) devient
  activable sans travail supplémentaire, et l'absence du nom réel dans toute sortie d'agent
  est **testable**.
- **L'architecture est éprouvée**, pas inventée : elle reprend un pipeline déjà en production
  sur un autre dépôt de la maison.
- **Le raisonnement de l'ADR-0012 est préservé là où il valait** : un modèle ne fait pas
  autorité sur un fait. Il ne devient plus un motif d'exclusion, mais une frontière de rôle.

## Conséquences

**Positives** — Qualité rédactionnelle nettement supérieure au templating ; couverture de
tous les cas pédagogiques sans catalogue de fragments à entretenir ; RAG ancre les conseils
dans les programmes officiels ; montée en charge par worker asynchrone ; pseudonymisation
native.

**Négatives** — Dépendance à un service LLM et à une file de jobs ; latence de plusieurs
dizaines de secondes par bilan ; non-déterminisme de la prose, donc tests statistiques et non
plus par cas dorés sur cette couche ; coût par bilan si l'on passe à un fournisseur externe ;
surface d'exploitation plus large (Redis, worker, métriques, alertes).

**Atténuations** — Les cas dorés restent contractuels sur la couche de faits, qui elle
demeure 100 % déterministe et testée à 100 % de branches. Les validateurs sont bloquants en
CI. Un échec de génération ne peut plus marquer un bilan comme terminé : c'est le défaut
`lib/assessments/generators/index.ts:143` corrigé.

## Invariants non négociables

Ils survivent à toute évolution ultérieure de cette ADR :

1. Un modèle de langage ne produit jamais un chiffre affiché à une famille.
2. Un bilan dont la validation échoue n'est jamais présenté comme terminé.
3. Aucun bilan n'est visible d'un parent avant `PUBLISHED`.
4. Aucune donnée nominative ne quitte le serveur.
5. Aucun questionnaire n'est publié sans validation pédagogique nominative et datée.

## Ordonnancement — règle héritée du 31 juillet

La configuration LLM en production reste gelée jusqu'à ce que les validateurs de C3 soient
en place et verts. En l'état, l'échec `fetch failed` empêche l'émission de bilans erronés :
le réparer avant les garde-fous publierait exactement le texte que cette ADR vise à rendre
impossible.
