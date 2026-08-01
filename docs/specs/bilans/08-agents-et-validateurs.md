# 08 — Agents LLM et validateurs
> [!IMPORTANT]
> **Arbitrage A2.** Après une reprise en échec, le rapport reste en REPORT_PENDING_REVIEW
> avec validationFailures[] non vide. Il ne peut jamais atteindre PUBLISHED.
> COACH_REJECTED reste réservé au rejet humain. Aucun nouvel état n’est créé.


Spec d'exécution de l'ADR-0013. Inspirée du pipeline éprouvé de
`Interface_NSI_Bilan_Support_Suivi`, adaptée aux contraintes Nexus Réussite.

---

## §1. Chaîne complète

```
Questionnaire en ligne (réponse + confiance par item)
        │
        ▼
[ COUCHE FAITS ]  lib/bilans/facts/compute-facts.ts     ← déterministe, 0 LLM
        │                                                  scores, profils, priorités
        ▼                                                  → FactSheet (immuable)
[ AGENT 0 ]  Pré-analyse des textes libres              ← LLM, JSON
        │
        ▼
[ AGENTS 1-3 ]  Rédacteur Élève · Parents · Nexus       ← LLM, JSON, prose seule
        │
        ▼
[ AGENT 4 ]  Vérificateur factuel                       ← LLM, JSON, filet secondaire
        │
        ▼
[ VALIDATEURS V1-V7 ]                                   ← déterministes, BLOQUANTS
        │
        ├── échec ──▶ reprise contrainte (1 fois) ──▶ échec ──▶ REPORT_PENDING_REVIEW
        │
        ▼
[ RENDU ]  React-PDF + web — insère les chiffres depuis la FactSheet
        │
        ▼
REPORT_PENDING_REVIEW → COACH_VALIDATED → PUBLISHED
```

Exécution asynchrone en worker (file `generate_bilans`), jamais dans la requête HTTP.
Modèle repris de `apps/worker` du dépôt NSI : `removeOnFail: false`,
`attempts: 3`, `backoff: { type: 'exponential', delay: 10000 }`.

---

## §2. Source unique par pack

Un fichier par matière et niveau : `data/bilans/banks/<matiere>.<niveau>.v<N>.json`.
Il contient **tout** : questionnaire, scoring, RAG, prompts, schéma de sortie, validation.
Aucun prompt écrit en dur dans le code TypeScript.

```jsonc
{
  "slug": "maths-terminale-v1",
  "level": "TERMINALE",
  "subject": "MATHS",
  "version": 1,
  "status": "DRAFT",
  "review": { "validatedBy": null, "validatedAt": null },

  "questionnaire": {
    "targetDurationMin": 25,
    "confidenceScale": { "levels": 4, "labels": ["je devine","peu sûr","plutôt sûr","certain"] },
    "items": [ /* voir spec 03 */ ]
  },

  "scoring": {
    "engine": "facts.v1",
    "domains": ["analyse","algebre","geometrie","probabilites","algorithmique"]
  },

  "reporting": {
    "rag": {
      "enabled": false,
      "decisionRef": "A56 — corpus RAG Terminale absent",
      "globalGuide": "data/bilans/rag/guide-pedagogique-nexus.md",
      "sources": ["programme_maths_terminale.pdf", "grille_bac_maths.pdf"],
      "topK": 5
    },
    "preAnalysis": {
      "id": "summarize_free_text",
      "inputs": {
        "objectifs": "{{answers.objectifs.value}}",
        "difficultes": "{{answers.difficultes_ressenties.value}}",
        "methode": "{{answers.methode_de_travail.value}}"
      },
      "outputVariable": "preAnalysis.summary"
    },
    "inputs": {
      "eleve": { "alias": "{{student.alias}}", "niveau": "{{context.level}}" },
      "facts": "{{facts}}",
      "preAnalyse": "{{preAnalysis.summary}}",
      "ragExtraits": "{{rag.chunks}}"
    },
    "prompts": {
      "systemPreAnalysis": "...",
      "systemEleve": "...",
      "systemParents": "...",
      "systemNexus": "...",
      "systemVerificateur": "..."
    },
    "outputSchema": { "eleve": {}, "parents": {}, "nexus": {} }
  },

  "validation": {
    "lexique": "data/bilans/lexique-interdit.json",
    "forbidDigits": ["eleve", "parents"]
  }
}
```

### RAG fail-closed

`reporting.rag.enabled` exprime une décision explicite du pack. Lorsqu'il vaut `false`,
aucune recherche n'est exécutée et `decisionRef` documente l'arbitrage. Lorsqu'il vaut
`true`, le gateway exige un retriever et au moins un extrait : zéro résultat provoque
`RAG_ENABLED_WITHOUT_EVIDENCE` avant le premier appel d'agent. Un corpus vide est une
erreur de configuration, jamais un mode dégradé silencieux.

Le contexte RAG transmis aux agents provient exclusivement du retriever contraint du
gateway. Aucun agent ne lance lui-même une recherche et aucune sortie n'est générée en
prétendant être ancrée si la recherche n'a fourni aucune preuve.

---

## §3. La FactSheet

Produite par `computeFacts(input): FactSheet`. C'est **le seul objet portant des grandeurs**.

```ts
interface FactSheet {
  readonly engineVersion: string;
  readonly bankSlug: string; readonly bankVersion: number;
  readonly student: { alias: string; level: Level };   // alias, jamais le nom réel
  readonly globalScore: number;
  readonly coverage: number;
  readonly calibrationIndex: number | null;
  readonly domains: ReadonlyArray<{ id: string; score: number; profile: NodeProfile }>;
  readonly nodes: readonly NodeResult[];               // triés par priorité
  readonly flags: readonly ResultFlag[];
  readonly groupBand: GroupBand;
}
```

**Invariant contrôlé par test** : le nombre de domaines dans `FactSheet.domains` est égal
au nombre de domaines évalués par le pack. C'est le garde-fou du bug de perte de
`prob_stats` et `algorithmic` relevé par l'audit.

---

## §4. Pseudonymisation par conception

`student.alias` vaut `ELEVE_A`, `ELEVE_B`… Le prénom et le nom réels **n'entrent dans
aucun prompt**. Le rendu les réinsère à l'affichage, depuis la base.

Conséquences directes :

- Un fournisseur externe devient activable sans travail supplémentaire de conformité.
- La pseudonymisation est **testable** : le validateur V6 échoue si le nom réel apparaît
  dans une sortie d'agent. Ce n'est plus une promesse, c'est une assertion.
- Le blocage « ne pas brancher OpenRouter avant pseudonymisation » est levé par
  l'architecture, pas contourné.

---

## §5. Les cinq agents

| # | Agent | Entrée | Sortie | Rôle |
|---|---|---|---|---|
| 0 | Pré-analyse | textes libres | JSON `{synthese, forces_percues[], craintes[]}` | structurer le déclaratif |
| 1 | Rédacteur Élève | FactSheet + préanalyse + RAG | JSON, tutoiement | prose élève |
| 2 | Rédacteur Parents | idem | JSON, vouvoiement | prose parents |
| 3 | Rédacteur Nexus | idem | JSON, technique | analyse interne |
| 4 | Vérificateur | FactSheet + les 3 JSON | JSON `{ok, violations[]}` | relecture factuelle |

Modèle par défaut : Ollama local, piloté par `OLLAMA_MODEL` — **jamais codé en dur**.
Le défaut `llama3.2:latest` en dur dans `lib/assessments/generators/index.ts:221` est
précisément le défaut à supprimer.

### Schémas de sortie

```ts
// ELEVE — aucun chiffre autorisé dans les chaînes
{
  accroche: string,
  forces: string[3],
  priorites: Array<{ titre: string; pourquoi: string; comment: string }>,  // 1..3
  microPlan: Array<{ action: string; dureeMin: number }>,                  // 1..5
  motDeFin: string
}
// dureeMin est un entier, rendu par le composant. Jamais écrit dans `action`.

// PARENTS — aucun chiffre autorisé
{
  cadre: string,
  pointsAppui: string[2..3],
  priorites: Array<{ titre: string; ceQuiSeraFait: string }>,              // 2..3
  etapeSuivante: { texte: string; cta: string }   // cta ∈ liste approuvée
}

// NEXUS — chiffres autorisés
{
  syntheseProfil: string,
  diagnosticPedagogique: string,
  planQuatreSemaines: string,
  alertes: string[],
  ragReferences: string[]
}
```

### Squelette de prompt système — Rédacteur Parents

```
Tu rédiges un compte rendu de positionnement pour les parents d'un élève,
au nom de Nexus Réussite, centre de soutien au programme français à Tunis.

CE QUE TU REÇOIS
Un objet FACTS contenant toutes les mesures, déjà calculées. Elles sont exactes.
Des extraits de programme officiel (RAG). Une pré-analyse des réponses libres.

RÈGLES ABSOLUES
1. N'écris AUCUN chiffre. Ni score, ni pourcentage, ni note, ni durée.
   Les grandeurs sont affichées par le document, pas par toi.
2. Ne recopie, ne reformule et ne commente aucune valeur numérique de FACTS.
   Utilise-les seulement pour choisir QUOI dire, jamais pour dire COMBIEN.
3. Un seul élève. Toujours le singulier. Jamais « les élèves », jamais « vos enfants ».
4. Vouvoiement. Ton exigeant, sobre, professionnel, rassurant.
5. Aucune promesse de résultat, aucun taux de réussite, aucun ressort anxiogène.
6. Aucun nom d'enseignant, aucun tarif.
7. Formule les priorités comme du contenu de séance, jamais comme des manques.
8. Si FACTS.flags contient COUVERTURE_INSUFFISANTE ou PASSATION_EXPRESS, dis
   explicitement dans `cadre` que la passation est partielle et les conclusions provisoires.

SORTIE
JSON strict, uniquement les clés du schéma fourni. Aucun texte hors JSON.
```

Les autres prompts suivent la même forme. Ils vivent dans le JSON du pack, versionnés
avec lui, et **toute modification de prompt incrémente la version du pack**.

---

## §6. Validateurs déterministes — l'autorité

Exécutés après les agents, avant tout rendu. Un échec bloque. Ils ne font appel à aucun modèle.

| # | Validateur | Règle | Sévérité |
|---|---|---|---|
| V1 | Schéma | Zod strict sur le schéma de sortie, clés exactes, cardinalités respectées | bloquant |
| V2 | Zéro chiffre | aucun `[0-9]` dans les champs prose des audiences ÉLÈVE et PARENTS | bloquant |
| V3 | Lexique | aucun terme de `lexique-interdit.json` (promesse, anxiogène, jugement, « professeur IA ») | bloquant |
| V4 | Domaines | `FactSheet.domains.length` == domaines du pack, et chacun couvert par au moins une priorité ou un point d'appui | bloquant |
| V5 | Singularité | aucun marqueur pluriel de la liste ; l'alias est cohérent | bloquant |
| V6 | Pseudonymat | le nom, le prénom et l'e-mail réels n'apparaissent dans **aucune** sortie d'agent | bloquant |
| V7 | CTA | `etapeSuivante.cta` appartient à la liste approuvée | bloquant |

**V2 est le validateur qui rend « 12/100 » impossible.** Il ne détecte pas l'erreur :
il interdit la classe entière de sorties où elle peut apparaître.

### Reprise sur échec

1. Premier échec → nouvel appel du seul agent fautif, avec un prompt correctif listant
   les violations exactes. Une seule reprise.
2. Second échec → statut `REPORT_PENDING_REVIEW`, alerte Telegram avec `attemptId` seul,
   passage en revue humaine. **Jamais `COMPLETED`.**
3. Toute violation est journalisée par règle et par pack, pour piloter l'ouverture
   éventuelle de l'auto-publication.

---

## §7. Publication

`REPORT_PENDING_REVIEW → COACH_VALIDATED → PUBLISHED`.

- Un parent ou un élève ne voit que `PUBLISHED`.
- Revue humaine à 100 % au démarrage de chaque pack.
- L'auto-publication d'un pack ne s'ouvre que sur décision explicite, après une série
  d'au moins 50 bilans consécutifs sans violation de validateur et sans correction
  substantielle en revue. Le seuil se mesure, il ne se suppose pas.
- Les packs restent `REVIEW_REQUIRED` dans le catalogue tant que
  `review.validatedBy` et `review.validatedAt` sont nuls.

---

## §8. Tests

**Couche faits** — inchangée : cas dorés contractuels, 100 % de branches, déterminisme.

**Couche agents** — non déterministe, donc testée autrement :

| Test | Nature |
|---|---|
| Validateurs V1-V7 sur sorties fabriquées | unitaire, exhaustif, une sortie fautive par règle |
| Agents avec LLM simulé | intégration, sortie figée, vérifie le câblage |
| Zéro appel réseau avec `LLM_MODE=mock` | intégration |
| Aucun nom réel dans les prompts émis | intégration, interception des appels sortants |
| Jeu de recette : 20 FactSheets représentatives × 3 audiences | statistique, taux de violation par règle, exécuté à chaque changement de prompt ou de modèle |
| Le nombre de domaines rendus == domaines évalués | unitaire, permanent |

Le jeu de recette est un **artefact versionné**, pas un script jetable. Il constitue la
preuve à produire lors de la validation pédagogique nominative.

---

## §9. Exploitation

Repris de l'architecture NSI, adapté :

- File `generate_bilans` (BullMQ + Redis), worker séparé du processus web.
- Métriques Prometheus : `llm_latency_seconds{agent}`, `bilan_validation_failures{rule,pack}`,
  `bullmq_jobs{queue,status}`.
- Alertes : latence p95 LLM, jobs en échec, file en attente, taux de violation anormal.
- Journalisation : `attemptId` seul. Jamais de prompt, de réponse brute, de nom, d'e-mail.
- Reprise manuelle d'un job par `attemptId`, idempotente.
