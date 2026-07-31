# Plan d'implémentation C1.4

> **For Codex:** suivre ce plan par petits cycles test rouge → correction
> minimale → test vert. Ne jamais commencer C2.

**Objectif :** durcir #91 puis créer une PR benchmark séparée, sans donnée
réelle, état Prisma, route, worker, UI ou activation.

**Architecture :** #91 transforme les fixtures en entrées locales avec
provenance dataset, sépare le texte brut du contexte transportable, valide PII
et grounding, chaîne les artefacts, charge une attestation privée et qualifie
la diversité fournisseur. La branche benchmark ajoute les prompts, schémas,
runner OpenRouter synthétique, validation automatique et paquet aveugle.

**Stack :** TypeScript, Zod, `zod-to-json-schema`, Jest, `fetch` serveur natif,
fichiers JSON canoniques et scripts `tsx`.

---

## Tâche 1 — Contractualiser le scan PII

**Fichiers :**

- créer `lib/bilans/local-first/pii.ts`
- créer `__tests__/lib/bilans/local-first-pii.test.ts`
- modifier `lib/bilans/local-first/contracts.ts`

1. Écrire les tests rouges des quatre statuts, des catégories minimales, du
   téléphone tunisien local, date de naissance, URL, identifiants, valeur
   ambiguë bloquée, checksum et absence de valeur détectée.
2. Exécuter :
   `npm test -- --runInBand __tests__/lib/bilans/local-first-pii.test.ts`.
3. Implémenter les schémas fermés, la canonicalisation des catégories et
   chemins, la redaction et le checksum.
4. Rejouer le test ciblé et vérifier qu'il passe.
5. Commit :
   `feat(bilans): add explicit local PII contract`.

## Tâche 2 — Séparer les textes locaux des textes transportables

**Fichiers :**

- modifier `lib/bilans/local-first/contracts.ts`
- modifier les douze fichiers
  `content/bilans/benchmarks/synthetic-v1/*.json`
- modifier `__tests__/lib/bilans/local-first.test.ts`

1. Écrire les tests rouges prouvant que `rawEvidenceLocalOnly` et
   `rawInternalNotesLocalOnly` ne sont pas dans le contexte, que
   `approvedEvidenceForLlm` exige un scan transportable et qu'une donnée
   `UNTRUSTED_QUOTED_DATA` non approuvée est refusée.
2. Remplacer `sourceSha` par `datasetVersion`, introduire les deux niveaux de
   preuve et recalculer les checksums des fixtures.
3. Retirer les notes internes brutes du contexte Nexus et ajouter le contrat
   optionnel `llmApprovedInternalNotes`.
4. Rejouer les tests local-first.
5. Commit :
   `fix(bilans): isolate raw evidence from LLM contexts`.

## Tâche 3 — Renforcer le grounding

**Fichiers :**

- créer `content/bilans/recommendations/catalog-v1.json`
- créer `lib/bilans/local-first/grounding.ts`
- créer `__tests__/lib/bilans/local-first-grounding.test.ts`
- modifier `lib/bilans/local-first/contracts.ts`
- modifier les douze fixtures synthétiques

1. Écrire des tests rouges pour identifiants dupliqués, références dupliquées,
   preuve d'une autre compétence, cohérence `UNMEASURED`, priorité haute sans
   preuve et recommandation hors catalogue.
2. Créer le catalogue local versionné et ajouter `competencyId` aux
   recommandations.
3. Implémenter un validateur pur retournant des erreurs localisées, puis le
   raccorder aux schémas Zod.
4. Rejouer les tests PII/local-first/grounding.
5. Commit :
   `fix(bilans): enforce semantic grounding invariants`.

## Tâche 4 — Prouver la frontière anti-injection

**Fichiers :**

- créer `content/bilans/security/prompt-injection-synthetic-v1.json`
- créer `__tests__/lib/bilans/local-first-injection.test.ts`
- modifier `lib/bilans/local-first/contracts.ts`

1. Ajouter au moins trente injections synthétiques en français, arabe
   translittéré, anglais, JSON/HTML et Unicode.
2. Écrire les tests rouges vérifiant qu'elles restent exclusivement dans les
   champs locaux et qu'aucune n'apparaît dans le DTO.
3. Supprimer la regex d'injection comme frontière d'autorisation ; conserver
   seulement un signal de scan bloquant pour le texte brut.
4. Rejouer les tests ciblés.
5. Commit :
   `test(bilans): prove prompt injection stays local`.

## Tâche 5 — Chaîner les artefacts immuables

**Fichiers :**

- créer `lib/bilans/local-first/artifacts.ts`
- créer `__tests__/lib/bilans/local-first-artifacts.test.ts`

1. Écrire les tests rouges pour checksum racine, parent obligatoire,
   modification de chaîne, SHA différent, horodatage de création, lecture et
   overwrite.
2. Implémenter l'enveloppe stricte, le calcul hors `artifactChecksum`, la
   vérification de parent et l'écriture temporaire privée suivie d'un lien
   atomique sans overwrite.
3. Vérifier qu'un faux SHA fourni face au SHA attendu est refusé.
4. Rejouer le test ciblé.
5. Commit :
   `feat(bilans): add immutable local artifact chain`.

## Tâche 6 — Remplacer les attestations codées en dur

**Fichiers :**

- créer `lib/llm/openrouter/privacy-attestation.ts`
- créer `scripts/bilans/record-openrouter-privacy-attestation.ts`
- créer `__tests__/lib/llm/openrouter/privacy-attestation.test.ts`
- modifier `scripts/bilans/openrouter-preflight.ts`
- modifier `__tests__/lib/llm/openrouter/preflight-command.test.ts`
- modifier `package.json`
- modifier `docs/runbooks/bilan-openrouter-preflight.md`

1. Écrire les tests rouges : fichier absent, permissions, symlink, JSON
   inconnu, checksum, date future, expiration et durée supérieure à trente
   jours.
2. Implémenter le lecteur `O_NOFOLLOW` et le schéma strict.
3. Faire lire l'attestation par le preflight et ne persister dans la preuve que
   source, dates, checksum et empreintes.
4. Ajouter un enregistreur interactif qui lit les déclarations depuis stdin,
   dérive des empreintes non réversibles et écrit le fichier privé en `0600`.
5. Rejouer les tests OpenRouter ciblés.
6. Commit :
   `fix(llm): bind preflight to private owner attestation`.

## Tâche 7 — Qualifier la diversité fournisseur

**Fichiers :**

- créer `scripts/bilans/openrouter-provider-resilience.ts`
- créer `__tests__/lib/llm/openrouter/provider-resilience.test.ts`
- modifier `lib/llm/openrouter/client.ts`
- modifier `lib/llm/openrouter/types.ts`
- modifier `package.json`
- créer `docs/audits/2026-07-31-openrouter-provider-resilience.md`

1. Écrire un fake server avec catalogue ZDR et endpoints multiples.
2. Tester la sélection d'un slug officiel non Azure, la conservation ZDR/data
   deny/require params, deux appels maximum, absence d'alternative et rapport
   expurgé.
3. Ajouter une option de routage uniquement à la méthode de preflight, jamais
   au chemin produit.
4. Exécuter l'audit privé sur le SHA final propre avec au plus deux appels
   synthétiques et documenter la concentration constatée.
5. Commit :
   `feat(llm): audit compliant provider diversity`.

## Tâche 8 — Requalifier et publier la nouvelle tête #91

1. Lancer les suites ciblées local-first et OpenRouter.
2. Lancer `npm ci`, audits, tests globaux, DB/intégration/E2E, typecheck, lint,
   sécurité, build et contrôles de secret selon les scripts disponibles.
3. Créer l'attestation privée à partir de la déclaration owner sans afficher la
   clé.
4. Exécuter le preflight réel final et l'audit résilience depuis un checkout
   propre du SHA exact.
5. Mettre à jour la description #91 avec faits, coûts, statut fournisseur et
   absence de données réelles.
6. Pousser sans force et attendre CI, CodeQL, GitGuardian et documents.

## Tâche 9 — Créer la branche benchmark

1. Depuis la tête #91 poussée et propre, créer un worktree
   `feat/bilan-openrouter-model-benchmark`.
2. Vérifier branche, base et propreté.
3. Ne modifier aucun fichier Prisma, route, worker, UI ou report-service.

## Tâche 10 — Créer prompts et schémas réels

**Fichiers :**

- créer `content/bilans/prompts/report-{parent,student,nexus}-v1.md`
- créer `content/bilans/schemas/report-{parent,student,nexus}-v1.schema.json`
- créer les schémas de brouillon narratif nécessaires
- créer `lib/bilans/benchmark/report-contracts.ts`
- créer `__tests__/lib/bilans/benchmark-report-contracts.test.ts`

1. Écrire les tests rouges pour checksums, métadonnées, champs fermés, absence
   HTML/Markdown, claims interdits et séparation d'audience.
2. Créer les prompts versionnés et les schémas fermés.
3. Assembler localement `scoreEcho` depuis le contexte, jamais depuis le
   brouillon.
4. Rejouer les tests.
5. Commit :
   `feat(bilans): add canonical report prompts and schemas`.

## Tâche 11 — Implémenter le runner synthétique

**Fichiers :**

- créer `content/bilans/model-policies/bilan-model-benchmark-policy-v1.json`
- créer `lib/bilans/benchmark/runner.ts`
- créer `scripts/bilans/openrouter-model-benchmark.ts`
- créer `__tests__/lib/bilans/benchmark-runner.test.ts`
- modifier `package.json`

1. Écrire les tests rouges avec fake server : Luna explicite, zéro retry,
   randomisation déterministe, hard stop, warning, trois erreurs consécutives,
   fuite PII/audience, score ou preuve inventée.
2. Implémenter un plan modèle explicite et les limites coût/appels.
3. Écrire uniquement des preuves privées sans prompt/completion bruts dans les
   logs ou Git.
4. Rejouer les tests.
5. Commit :
   `feat(bilans): add bounded synthetic model benchmark`.

## Tâche 12 — Créer le paquet de revue aveugle

**Fichiers :**

- créer `lib/bilans/benchmark/human-review.ts`
- créer `__tests__/lib/bilans/benchmark-human-review.test.ts`
- créer `docs/specs/bilan-openrouter-human-review.md`

1. Tester permutation par fixture, absence de slug/fournisseur/coût dans les
   feuilles à noter, mapping privé séparé et statut
   `HUMAN_REVIEW_PENDING`.
2. Générer les critères 1–5 et décisions sans jamais préremplir une note.
3. Commit :
   `feat(bilans): add blind human review package`.

## Tâche 13 — Preflight Luna et benchmark réel

1. Requalifier clé, attestation, SHA propre, schémas et budgets.
2. Exécuter un seul preflight Luna synthétique.
3. Si Luna ou le guardrail bloque, ne pas modifier le guardrail et arrêter le
   benchmark avec le statut exact.
4. Si les préconditions passent, exécuter les 36 appels sans retry avec hard
   stop.
5. Valider chaque sortie automatiquement et générer le paquet humain privé.
6. Ne pas produire de choix v1.2 avant les notes humaines.

## Tâche 14 — Validation et PR benchmark

1. Lancer tests ciblés, audits, typecheck, lint, sécurité, build et CI locale.
2. Vérifier secret leak, absence de données réelles et périmètre Git.
3. Commit documentation/métriques expurgées si elles ne contiennent aucun
   contenu privé.
4. Pousser sans force et ouvrir une draft PR vers la branche #91.
5. Attendre CI, CodeQL, GitGuardian et documents ; laisser la revue humaine en
   attente et C2 interdit.
