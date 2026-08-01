# Rapport final M1 — architecture des bilans contraints

**Date :** 2026-08-01  
**Branche :** `docs/bilans-kit-integration`  
**Statut :** M1 terminé techniquement, aucune mise en service réelle autorisée

## 1. Ce qui est en place et éprouvé

- **FactSheet unique :** `buildFactSheet(scoringV2, facts)` compose les domaines et la couverture de `computeScoringV2` avec les profils de `computeFacts`. Les tests imposent qu'aucun domaine du pack ne soit omis.
- **Moteur de faits stable :** `ENGINE_VERSION` reste à `1.0.1`. Les six cas dorés contractuels sont verts et leurs résultats sont inchangés.
- **Cycle de revue bloquant :** `validationFailures[]` existe dans les contrats TypeScript, le schéma Zod et la contrainte PostgreSQL. Une révision comportant un échec ne peut pas atteindre `PUBLISHED`.
- **Validateurs V1 à V7 :** schéma, absence de chiffres publics, lexique, ancrage aux domaines, singularité, PII et CTA sont bloquants avant revue.
- **Frontière PII :** le gateway exige une `PseudonymizedFactSheet` liée par checksum. La recette interceptée ne contient aucun nom ou e-mail réel et n'émet aucun appel réseau.
- **Gateway métier unique :** les agents ne peuvent recevoir ni chaîne libre ni `messages[]`. Aucun import OpenRouter hors frontière autorisée et aucun identifiant de modèle n'est codé en dur.
- **Reprise ciblée :** après un échec PARENTS, la sortie ELEVE est conservée par identité stricte ; seuls PARENTS et le vérificateur sont rappelés, soit sept appels au total au lieu de dix.
- **Rendu déterministe :** les chiffres proviennent exclusivement de la FactSheet. Les rendus ELEVE et PARENTS n'exposent aucun score brut.
- **Recette mock :** vingt FactSheets multipliées par trois audiences produisent soixante rapports. Les compteurs V2 et V6 sont tous deux à zéro.
- **Preuve versionnée :** deux générations successives sont identiques au bit près et égales aux deux JSON suivis. La CI compare ces preuves sans les réécrire.
- **Gates finaux :** lint exit 0, typecheck exit 0, build Next.js exit 0, 609 suites et 7 319 tests passés ; une suite et quatre tests sont explicitement ignorés.

## 2. Ce qui est volontairement inactif

- **Pack Maths Terminale :** statut `DRAFT`, `review.validatedBy` et `review.validatedAt` nuls. Activation conditionnée à la validation nominative et datée d'un enseignant de mathématiques.
- **Allowlist LLM :** vide. Activation conditionnée au choix Nexus du fournisseur et des modèles autorisés, puis à leur ajout explicite dans la politique versionnée.
- **Routes Canonical publiques :** aucune route ouverte. Activation conditionnée à la validation pédagogique, aux feature flags pack par pack et à une autorisation de mise en service.
- **Feature flags Canonical :** aucun flag activé. Chaque bascule doit rester désactivée par défaut et réversible.
- **Migration `validationFailures[]` :** créée et éprouvée uniquement sur la copie isolée ; elle n'est pas appliquée en production. Son application exige backup, fenêtre autorisée et `GO DEPLOY` explicite.
- **Configuration LLM :** gelée en production. Aucun fournisseur externe ni modèle local n'a été activé dans M1.

## 3. Les trois dépendances non techniques

### a) Validation pédagogique des packs

Un enseignant de la discipline, nommé et qualifié, doit relire les cinquante items, chaque distracteur, les cinq prompts et le paquet aveugle de soixante rapports. Il signe la version exacte du pack avec `validatedBy` et `validatedAt`. Estimation : **deux à trois jours enseignant**, hors cycles de correction éventuels. Toute modification d'un item, d'un prompt ou d'un checksum annule cette validation.

### b) Choix et activation d'un fournisseur LLM

Nexus doit choisir le fournisseur, les modèles et les limites d'usage. Après décision, il reste environ **six à dix heures d'ingénierie** : adapter le fournisseur derrière le gateway, renseigner l'allowlist et la configuration, ajouter les tests d'erreur et de JSON strict, puis exécuter le préflight sans données nominatives. La pose d'un secret ou l'activation en production n'est pas comprise et exige une autorisation séparée.

### c) Écart RAG : 40 lignes contre 211 chunks

La copie de production contient quarante lignes dans `pedagogical_contents`, alors que l'exploitation annonce 211 chunks. Il faut déterminer s'il s'agit de deux niveaux d'agrégation, d'un stockage complémentaire ou d'une ingestion incomplète. Tant que ce point n'est pas tranché, le RAG peut produire une narration fondée sur un corpus tronqué ; il ne doit donc pas être activé pour les bilans réels.

## 4. Ce que Nexus doit décider avant M2

- L'enseignant relecteur Maths Terminale est-il nommé, qualifié et disponible pour deux à trois jours de revue ?
- Le pack doit-il rester entièrement bloqué jusqu'à validation des cinquante items, des distracteurs, des cinq prompts et des soixante rapports ? **Recommandation : oui.**
- Quel fournisseur et quels modèles Nexus autorise-t-il dans l'allowlist versionnée ?
- L'écart entre quarante lignes RAG et 211 chunks est-il expliqué et documenté ?
- Nexus autorise-t-il, lors d'une mission distincte, l'application en production de la migration additive `validationFailures[]` après backup ?
- Le premier feature flag Canonical Maths Terminale peut-il être préparé, désactivé par défaut, uniquement après les réponses positives précédentes ?

## 5. État du dépôt

- **Branche :** `docs/bilans-kit-integration`.
- **Phase B :** `13231de96` — `feat(bilans): FactSheet, validationFailures et validateurs V1-V7 — spec 08`.
- **Phase C :** `8319d371e` — `feat(bilans): pack DRAFT, agents contraints, rendu déterministe et recette — spec 08`.
- **Garde A53 post-M1 :** `91100b7fe` — `test(bilans): garantir la recette mock déterministe`.
- **Non commité volontairement :** `README.md`, `docs/adr/006-pm2-standalone-production-target.md` et `docs/audits/2026-07-31-audit-infra-et-prod-publique.md`, artefacts préexistants hors périmètre.
- **Publication :** la branche n'est ni poussée ni fusionnée. Aucun déploiement, aucune activation LLM et aucune migration de production n'ont été exécutés.
