# BRIEF STRETCH — Câblage OpenRouter + Golden-path E2E
### Destinataire : Claude CLI · Fenêtre : d'ici le cutoff · Objectif : atteindre GATE 2

> Suite du triage (verdict `A_RISQUE`) et du `RUNBOOK-FINAL-go-live-bilan.md`. Worktree : `nexus-bilans-p0d-release-quality`, branche `chore/bilans-p0d-release-quality-s5`, HEAD `91b296bc4`. Socle déjà prouvé : scoring déterministe **exact** (vérifié à la main), chaîne `réponses → facts → FactSheet → révision → publication → accès` **verte en Postgres**, outbox drainer + worker-review fonctionnels. Tu ne réécris pas ce socle : tu y **greffes** la génération LLM et tu prouves le parcours complet.

## Objectif GATE 2
1. `REAL_LLM_GENERATION=PASS` : un vrai appel OpenRouter produit un rapport conforme au schéma, à partir du FactSheet.
2. **Golden-path E2E vert** : un pack réel, 18 réponses → scoring → rapport → publication → accès parent + élève, en un scénario piloté par le manifeste.

## Invariants (non négociables)
1. **Le LLM narre, il ne calcule pas.** Le rapport est généré **à partir du FactSheet / domain-scores déterministes déjà prouvés exacts**. Le modèle n'a pas le droit de recalculer, modifier ou contredire un score. Les chiffres du rapport = ceux du moteur, injectés, pas régénérés.
2. **Jamais de rapport vide ou halluciné publié.** En cas d'échec LLM, de JSON invalide, ou de données insuffisantes → statut `FAILED`/en attente explicite, **pas** de publication. Le fallback est un état d'échec marqué, jamais un texte inventé.
3. **Clé depuis l'env** (`OPENROUTER_API_KEY`), jamais en dur, jamais loggée, jamais affichée en output. Vérifier `.env` gitignoré + absent de l'historique avant tout commit/push.
4. **Chemin canonique unique.** La génération s'insère dans l'**outbox + worker** existants (idempotents, `SKIP LOCKED`, verrouillage transactionnel déjà prouvés). Pas de chemin parallèle. Idempotence par `aiJobId` (l'index unique `copy_submissions_aiJobId_key` refuse déjà les doublons — respecte-le : un `aiJobId` = une génération, ré-exécution = no-op).
5. **E2E hermétique.** Le golden-path de gate ne dépend pas d'un appel réseau live (flaky/coûteux) : LLM **stubbé par une réponse enregistrée**. L'appel réel OpenRouter est prouvé séparément (voir Partie A §5), une fois, sur fixture.

---

## PARTIE A — Câblage OpenRouter

### A.1 Emplacement & config
- Service dédié dans `lib/bilans/` (là où le grep n'a rien trouvé). Un client fin, testable, injectable.
- Config **par env**, rien en dur :
  - `OPENROUTER_API_KEY` (déjà dans `.env`) ;
  - `OPENROUTER_MODEL` (chaîne modèle **configurable** — choisis un modèle solide en **français** et fiable en sortie structurée ; **confirme la chaîne exacte et sa disponibilité contre la doc OpenRouter courante**, ne pin pas une valeur au hasard) ;
  - base URL `https://openrouter.ai/api/v1` ;
  - `max_tokens`, `temperature` (basse, pour la stabilité), timeout, budget.

### A.2 Appel (API OpenAI-compatible)
- `POST https://openrouter.ai/api/v1/chat/completions`, header `Authorization: Bearer $OPENROUTER_API_KEY`, `Content-Type: application/json`. Ajoute les headers d'attribution OpenRouter (`HTTP-Referer`, `X-Title`) si pertinents — **vérifie la doc courante**.
- Corps OpenAI-compatible (`model`, `messages`, `max_tokens`, `temperature`). Réponse lue via `choices[0].message.content`.
- Batch (pas de streaming nécessaire pour un rapport).

### A.3 Prompt & sortie structurée
- **Entrée** : le FactSheet / domain-scores calculés (globalScore, calibrationIndex, agrégats par nœud, priorisation), injectés tels quels. Consigne système : « tu rédiges un compte-rendu pédagogique en français **à partir de ces données uniquement**, sans recalculer ni inventer de chiffre ; si une donnée manque, signale-le, n'invente pas. »
- **Sortie** : JSON strict conforme au schéma de rapport attendu (reprends le schéma existant si présent, sinon définis-le : synthèse, forces, axes de progrès priorisés, recommandations de stage). Utilise `response_format` JSON si le modèle choisi le supporte ; dans tous les cas **parse défensivement + valide contre le schéma**. JSON invalide → retry borné puis `FAILED`.

### A.4 Garde-fous
- Timeout + retries bornés (ex. 2, backoff). Au-delà → `FAILED`.
- Plafond `max_tokens` + budget par requête (garde-fou de coût).
- Aucun secret dans les logs. Logue l'`aiJobId`, le modèle, la latence, le statut — **pas** le contenu clé.
- Déterminisme raisonnable : température basse ; le rapport doit rester cohérent pour un même FactSheet.

### A.5 Preuve d'appel réel (une fois, hors E2E hermétique)
- Un script/test « live » gardé derrière un flag exécute **un** vrai appel OpenRouter sur un FactSheet-fixture, valide le schéma, confirme qu'aucun chiffre n'a été altéré vs le moteur, et n'écrit rien en prod.
- **C'est ce qui fait passer `REAL_LLM_GENERATION` à PASS.**

### A.6 Tests unitaires/intégration
- Client mocké (HTTP) : succès, timeout, 4xx/5xx, JSON invalide → chemins corrects.
- Vérifie : entrée = FactSheet (pas les réponses brutes) ; scores du rapport == scores moteur ; échec → `FAILED` non publié ; idempotence par `aiJobId` (second passage = no-op).

---

## PARTIE B — Golden-path E2E

### B.1 Scénario (piloté par le manifeste)
Un pack réel signé, un scénario navigateur unique de bout en bout :
`inscription parent → création enfant → activation élève → passation (18 réponses réelles) → scoring → génération rapport (LLM stubbé) → publication (outbox/worker) → accès parent + accès élève.`

### B.2 Stub LLM
- Réponse LLM **enregistrée** (fixture JSON conforme au schéma), injectée à la place de l'appel réseau. Le test prouve **le câblage et la chaîne**, pas la variabilité du modèle.

### B.3 Assertions
- Score persisté/affiché **== moteur déterministe** (réutilise un cas doré connu : entrée → score attendu).
- Rapport généré, **conforme au schéma**, publié via le worker.
- Parent accède au rapport ; élève accède au rapport ; un pack non signé/non activé reste **inaccessible**.
- Idempotence : rejouer la soumission ne duplique pas la génération (`aiJobId`).

### B.4 Généralisation
- Paramètre le scénario pour tourner sur **les packs signés/activés** (pas seulement un). Comble ainsi le trou identifié au triage (« aucun E2E ne fait tourner un pack réel de bout en bout »).

---

## GATE 2 — critère de sortie
- ✅ `REAL_LLM_GENERATION=PASS` (appel réel sur fixture, schéma OK, chiffres intacts).
- ✅ Golden-path E2E **vert** sur au moins le(s) pack(s) à activer ce soir.
- ✅ Aucun secret commité/loggé ; `.env` gitignoré + historique propre.
- ✅ Chemin canonique (worker/outbox) respecté, idempotence `aiJobId` prouvée.

## Comportement au cutoff
- **GATE 2 atteint avant cutoff** → le rapport LLM peut être allumé sur les packs signés (mode STRETCH du runbook).
- **GATE 2 non atteint au cutoff** → **stop propre** : tu remontes l'état exact (ce qui est vert, ce qui bloque, effort restant), tu **ne forces pas**, et on bascule sur le PLANCHER (bilan sans LLM, enseignants sur scores vérifiés), LLM en fast-follow. Ne masque aucun échec pour « tenir » le gate.

## À rendre en fin de fenêtre
Table courte : `REAL_LLM_GENERATION` (PASS/état), golden-path (vert/rouge + packs couverts), contrôle secret (.env gitignore + historique), respect worker/idempotence, et — si rouge — le bloquant précis + l'effort restant estimé. C'est ce qui déclenche la décision stretch vs plancher.
