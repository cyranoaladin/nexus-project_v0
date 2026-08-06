# MISSION CODEX M1 — Bilans en ligne par agents contraints
> [!IMPORTANT]
> **Arbitrage A2.** Après une reprise en échec, le rapport reste en REPORT_PENDING_REVIEW
> avec validationFailures[] non vide et ne peut jamais atteindre PUBLISHED.


Prompt à coller tel quel. Trois phases, la première en lecture seule.

---

```
=== RAPPEL CADRE ===
Dépôt : cyranoaladin/nexus-project_v0. Instance unique. Gel actif.
Exigence : qualité pédagogique irréprochable, zéro dette.
Aucun questionnaire non validé pédagogiquement ne va en ligne.

DÉCISION PRODUIT ACTÉE (ADR-0013, docs/adr/) :
Tous les bilans et questionnaires passent en ligne et sont traités par des agents LLM.
L'ADR-0012 (« aucun LLM ») est SUPERSEDED. Elle est remplacée, pas contredite :
son unique invariant survivant est qu'un modèle ne produit jamais un chiffre affiché
à une famille.

ARCHITECTURE IMPOSÉE — quatre contraintes, non négociables :
C1  Une couche de FAITS déterministe calcule toutes les grandeurs et produit une
    FactSheet immuable. Les agents rédigent de la prose, rien d'autre.
C2  Aucun caractère numérique dans les champs de prose destinés aux audiences ELEVE
    et PARENTS. Les chiffres sont insérés au rendu, depuis la FactSheet.
C3  Chaque agent répond en JSON strict, schéma fixe, validé par Zod. Sortie non conforme
    = jamais rendue.
C4  REPORT_PENDING_REVIEW → COACH_VALIDATED → PUBLISHED. Revue humaine à 100 % au départ.

RÈGLE D'ORDONNANCEMENT ABSOLUE :
Ne PAS modifier OLLAMA_URL en production, ne PAS installer de modèle en production,
ne PAS ajouter de clé OpenRouter, tant que les validateurs de la phase 3 ne sont pas
verts. L'échec « fetch failed » en production est aujourd'hui le seul garde-fou qui
empêche l'émission de bilans erronés : sur données synthétiques, le pipeline actuel a
produit une moyenne de 12/20 rendue « 12/100 » et un basculement au pluriel.
Tout le travail de cette mission se fait en local et en préproduction.

RÉFÉRENCES À LIRE AVANT D'ÉCRIRE UNE LIGNE :
  AGENTS.md
  AGENTS.bilans.md
  docs/adr/ADR-0013-architecture-bilans-agents.md
  docs/specs/bilans/08-agents-et-validateurs.md
  docs/specs/bilans/02-moteur-de-faits.md
  docs/decisions/2026-07-31-recadrage-kit.md

=== PHASE 1 — LECTURE SEULE ===

Objectif : cartographier l'existant avant d'ajouter quoi que ce soit. Le dépôt contient
déjà des briques qui font une partie du travail ; les ignorer créerait une seconde source
de vérité, ce qu'AGENTS.md interdit.

1. Inventorier et décrire précisément, fichier par fichier :
   - lib/diagnostics/bilan-renderer.ts : les trois renderers déterministes existants,
     leurs entrées, leurs sorties, ce qu'ils affichent déjà sans scores bruts
   - lib/diagnostics/score-diagnostic.ts (computeScoringV2) : domaines produits, forme exacte
   - lib/diagnostics/signed-token.ts : mécanisme d'accès par audience
   - lib/assessments/** : QuestionBank, ScoringFactory, generators
   - lib/bilan-generator.ts : pipeline historique
   - lib/ollama-client.ts, lib/rag-client.ts
   - lib/bilans/catalog/fixtures/maths-nsi.v1.ts : statuts REVIEW_REQUIRED

2. Répondre par oui/non argumenté, avec fichier:ligne :
   a) Existe-t-il déjà une séparation faits / langue quelque part ?
   b) Où exactement, dans le pipeline actuel, un chiffre est-il transmis à un modèle ?
   c) computeScoringV2 produit-il tous les domaines, et à quel endroit précis du code
      la bascule vers computeScoring V1 en perd-elle (prob_stats, algorithmic) ?
   d) Existe-t-il une file de jobs, un worker, Redis ? Sinon, que faudrait-il ajouter ?
   e) Le rendu React-PDF existant peut-il recevoir une FactSheet et insérer les chiffres
      lui-même, ou faut-il l'adapter ?

3. Proposer le plan de réutilisation : quelles briques existantes sont conservées telles
   quelles, lesquelles sont étendues, lesquelles sont retirées du chemin d'appel.
   Aucune suppression de fichier.

LIVRABLE PHASE 1 : Verdict / Constats P0-P1-P2 (fichier:ligne) / Plan d'action.
Aucune modification. Aucun déploiement.

=== PHASE 2 — COUCHE DE FAITS ET PACK CANONIQUE ===

Branche : feat/bilans-m1-faits

M1.1  Intégrer lib/bilans/facts/ (compute-facts.ts, types.ts, constants.ts) fourni dans
      le kit. Le brancher sur computeScoringV2 comme source des domaines. C'est une
      COUCHE, pas un système parallèle : ne créer aucun modèle Prisma nouveau.
M1.2  Produire FactSheet conforme à la spec 08 §3, avec student.alias (ELEVE_A…) et
      JAMAIS le nom réel.
M1.3  Test permanent : FactSheet.domains.length == nombre de domaines évalués par le pack.
      Ce test doit échouer si quelqu'un rebranche V1. C'est le filet du bug identifié.
M1.4  Reprendre les 6 cas dorés de __tests__/bilans/fixtures/. Ils restent contractuels :
      toute modification impose une bascule d'ENGINE_VERSION et une justification en ADR.
M1.5  Créer le pack canonique data/bilans/banks/maths-terminale-v1.json au format de la
      spec 08 §2, alimenté par les 50 questions Maths Terminale existantes. status: DRAFT,
      review.validatedBy: null. Prompts et schémas de sortie DANS le pack, jamais en dur
      dans le TypeScript.

CRITÈRES : 100 % de branches sur compute-facts.ts ; cas dorés verts ; aucun nom réel dans
la FactSheet, prouvé par test ; lint, typecheck, test, build verts.

=== PHASE 3 — VALIDATEURS, PUIS AGENTS ===

Branche : feat/bilans-m1-validateurs

IMPORTANT : les validateurs sont écrits et testés AVANT les agents. Écrire les agents
d'abord conduirait à ajuster les règles pour faire passer les sorties, ce qui vide
le dispositif de son sens.

M1.6  lib/bilans/validators/ — implémenter V1 à V7 (spec 08 §6). Tests unitaires
      exhaustifs : au moins une sortie fautive par règle, plus une sortie valide.
      V2 (zéro chiffre) et V6 (pseudonymat) sont les deux règles critiques.
M1.7  lib/bilans/agents/ — les cinq agents. Chacun lit son prompt et son schéma dans le
      pack. Modèle piloté par OLLAMA_MODEL, JAMAIS codé en dur : supprimer le
      llama3.2:latest en dur de lib/assessments/generators/index.ts:221.
      Sortie en response_format json_object, parsée puis validée par Zod.
M1.8  Reprise sur échec : une seule reprise avec prompt correctif listant les violations,
      puis REPORT_PENDING_REVIEW. Un échec de génération ne marque JAMAIS COMPLETED —
      corriger le comportement de lib/assessments/generators/index.ts:143.
M1.9  Mode LLM_MODE=mock : pipeline complet exécutable sans réseau, pour la CI.
M1.10 Rendu : les chiffres viennent de la FactSheet, jamais de la sortie d'agent.
      Réutiliser bilan-renderer.ts plutôt que d'en écrire un nouveau.
M1.11 Cycle de publication C4 effectif. Un parent ne voit que PUBLISHED.
M1.12 Jeu de recette versionné : 20 FactSheets représentatives × 3 audiences, taux de
      violation par règle. Il sera la preuve produite à la validation pédagogique.

CRITÈRES DE SORTIE, tous obligatoires :
  [ ] Aucun chiffre dans une sortie d'agent ELEVE ou PARENTS, prouvé par V2 sur le
      jeu de recette complet
  [ ] Aucun nom, prénom ou e-mail réel dans un prompt émis, prouvé par interception
  [ ] Aucun domaine évalué absent du bilan rendu
  [ ] Un échec de validation ne produit jamais COMPLETED
  [ ] Aucun rapport non PUBLISHED visible d'un parent ou d'un élève
  [ ] Pipeline complet exécutable avec LLM_MODE=mock, sans réseau
  [ ] Aucun modèle LLM codé en dur dans le code
  [ ] lint, typecheck, test, build verts
  [ ] Aucun débordement horizontal en 375 px sur les écrans touchés

INTERDITS PENDANT TOUTE LA MISSION :
  - créer un modèle Prisma parallèle à Assessment
  - écrire un prompt ailleurs que dans le JSON du pack
  - publier un pack dont review.validatedBy est nul
  - modifier la configuration LLM de production
  - déployer, merger, ou supprimer un fichier

FORMAT DE RAPPORT, à chaque ticket :
  Résumé / Fichiers modifiés / Vérifications exécutées / Points de vigilance /
  Recommandation suivante
```

---

## Notes pour Nexus, hors prompt

**L'ordre validateurs → agents est le point structurant.** Il est contre-intuitif et sera
la première chose que Codex proposera d'inverser, pour « voir un bilan plus vite ». Tenir
bon : des règles écrites après les sorties sont des règles ajustées aux sorties.

**M1.5 est un travail de contenu déguisé en travail technique.** Les prompts du pack
déterminent la qualité pédagogique de tous les bilans produits. Ils méritent votre relecture
personnelle, ligne à ligne, pas une validation en bloc.

**Ce que M1 ne fait pas** : les banques des matières manquantes (Français, PC, SVT, SES,
Philo, HG, Grand Oral), estimées par l'audit entre 4 et 10 jours chacune. Elles font l'objet
de la mission M3, une fois qu'un pack complet aura prouvé la chaîne de bout en bout.

**Décision restant à prendre** : fournisseur des modèles. L'architecture rend OpenRouter ou
OpenAI activables sans travail de conformité supplémentaire, puisque les agents ne reçoivent
jamais de donnée nominative. La qualité rédactionnelle d'un modèle de la classe gpt-4o est
sans commune mesure avec qwen2.5:1.5b tournant sur CPU — l'audit a mesuré 51 secondes pour
trois bilans médiocres. À arbitrer sur le coût par bilan, pas sur la conformité.
