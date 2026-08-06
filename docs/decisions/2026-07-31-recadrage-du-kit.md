# NOTE 02 — Recadrage du kit de positionnement

Le kit livré précédemment supposait un chantier vierge. L'audit montre qu'il existe
**deux pipelines concurrents déjà en place**. Créer un troisième système serait exactement
l'erreur interdite par `AGENTS.md` : ajouter une seconde source de vérité.

Cette note dit ce qui reste valable, ce qui est annulé, et ce qui remplace.

---

## 1. État réel : deux pipelines

| | **Pipeline A — « historique »** | **Pipeline B — « Assessment »** |
|---|---|---|
| Entrée | Formulaire déclaratif (maîtrise, confiance, friction auto-évaluées) | Banque de questions objectives (QCM) |
| Route publique | `/bilan-pallier2-maths` | `/bilan-gratuit/assessment` |
| API | — | `/api/assessments/submit` |
| Scoring | `lib/bilan-scoring.ts` (V1) + `lib/diagnostics/score-diagnostic.ts` (V2) | `ScoringFactory` |
| Génération | `lib/bilan-generator.ts` → 3 audiences | `lib/assessments/generators/index.ts` → 3 audiences |
| Contenu | définitions v1.3, chapitres, compétences | 50 questions Maths Tle ; 0 ailleurs |
| État | **s'exécute**, produit un texte faux | **échoue** sur `llama3.2:latest` |
| Raccordé à l'API réelle | non | **oui** |

Chacun détient une moitié de la solution. A a le modèle pédagogique riche (domaines, readiness,
riskIndex, confiance déclarée). B a les questions objectives et la machine à états.

## 2. Décision d'architecture

**Le runtime retenu est B (Assessment).** C'est celui que l'API sert réellement, il possède une
banque de questions objectives et un cycle de vie.

**Le modèle pédagogique retenu est celui de A**, porté dans B : `computeScoringV2` et ses domaines
sont la référence, pas V1.

**A cesse d'être un parcours public.** Il n'est ni supprimé ni réécrit : il est fermé au public
et conservé comme référence pédagogique jusqu'à ce que son apport soit intégré à B.

**La confiance déclarée de A est portée dans B**, par question. C'est ce croisement
réussite objective × confiance déclarée qui produit `ERREUR_CONFIANTE` — le seul indicateur
du dispositif qu'un formulaire déclaratif seul ne peut pas produire, puisqu'un élève
qui se croit compétent se déclare compétent.

## 3. Corrections au kit précédent

### 3.1 Annulé

| Élément | Motif |
|---|---|
| `prisma/schema.positionnement.prisma` — modèles `PositioningTest/Attempt/Answer/Result/Bilan` | Le modèle `Assessment` existe déjà. **Ne créer aucun modèle parallèle.** Le fragment devient une liste de champs à ajouter à l'existant. |
| Spec 01 §5 (entités) | Remplacée par une analyse d'écart sur `Assessment`, à produire en mission M1. |
| Spec 04 — routes `/api/positionnement/**` | Remplacées par les routes existantes `/api/assessments/**`. Aucune nouvelle famille d'endpoints. |
| Spec 01 §5.6 — champs `reviewedBy` / `reviewedAt` inventés | Le cycle canonique existe déjà : `REPORT_PENDING_REVIEW → COACH_VALIDATED → PUBLISHED`. C'est lui qui fait foi. |
| Kit §Hypothèses — « passation sans compte, rattachement à un `Lead` » | À reconsidérer : la contrainte réelle est l'inverse — le rattachement `Assessment → Student → Parent` est **requis** par `lib/security/ownership.ts:48` pour que le parent puisse consulter. Le lead-capture-first reste valable pour la **demande**, pas pour la passation. |

### 3.2 Maintenu, et désormais appuyé par la preuve

| Élément | Statut |
|---|---|
| ADR-0012 — moteur déterministe, sans LLM sur le chemin critique | **Renforcé.** L'erreur 12/20 → 12/100 est la démonstration empirique. |
| `lib/positionnement/scoring.ts` — croisement réussite × confiance, 4 profils | Valable. À intégrer comme **couche de scoring de B**, pas comme moteur autonome. |
| Spec 05 — restitution 3 audiences, cloisonnement des données | Valable. Correspond déjà aux trois sorties existantes (élève, parents, Nexus). |
| `lexique-interdit.json` + test de garde éditoriale | Valable et urgent. Aurait intercepté « les élèves » au pluriel et « 12/100 » via la règle `score_visible_parent`. |
| Spec 07 — sécurité et pseudonymisation | Valable, mais **déplacé hors chemin critique** : sans LLM dans la génération, la pseudonymisation ne conditionne plus le bilan. |
| Spec 06 — plan de tests, cas dorés | Valable. Les cas dorés deviennent le filet de sécurité de la migration V1 → V2. |

### 3.3 Ajouté par l'audit

| Constat | Traduction |
|---|---|
| V1 en entrée du générateur perd `prob_stats` et `algorithmic` | **Bug de perte de données, P0, indépendant du LLM.** Un domaine évalué mais absent du bilan est une faute pédagogique, pas un défaut de rédaction. |
| Résultat visible dès `COMPLETED` (`app/api/assessments/[id]/result/route.ts:66`) | Contournement du cycle de revue. P0. |
| `Assessment` créé sans relation `student` (`app/api/assessments/submit/route.ts:118`) | Le parent ne peut jamais consulter. P0. |
| `/bilan-gratuit` redirige vers la confirmation, jamais vers le questionnaire (`BilanStrategiqueClient.tsx:164,176`) | Le questionnaire est orphelin. P0 fonctionnel. |
| Échec LLM → `COMPLETED` malgré tout (`lib/assessments/generators/index.ts:143`) | Un échec silencieux marqué comme succès. P0 de conception. |
| Modèle codé en dur (`:221`), `OLLAMA_MODEL` ignoré | À traiter **après** M2, jamais avant. |

## 4. Ordre imposé des missions

```
M0  Périmètre public : fermer ce qui peut émettre un bilan non validé   ← ce week-end
M1  Convergence : rattachement studentId, tunnel, cycle de revue, V2    ← après le 3 août
M2  Rendu déterministe : le générateur LLM sort du chemin critique
M3  Banques de questions par matière + validation pédagogique nominative
M4  Configuration LLM et pseudonymisation — pour ARIA uniquement
```

**M4 ne peut pas précéder M2.** C'est la règle d'ordonnancement la plus importante du dossier :
réparer le LLM avant de l'avoir retiré du chemin critique publie des bilans faux.

## 5. Ce qui reste à décider avant M1

1. **`computeScoring` V1 est-il encore utilisé ailleurs ?** Si oui, la bascule vers V2 n'est pas
   un simple remplacement. Analyse d'écart à produire en lecture seule, première tâche de M1.
2. **Le formulaire déclaratif de A survit-il** comme complément de contexte du questionnaire B,
   ou est-il abandonné ? Recommandation : le conserver, réduit, en fin de passation — il alimente
   les blocs « profil de travail » et « ambition » que les QCM ne produisent pas.
3. **Qui valide pédagogiquement, nommément.** Sans un nom et une date dans le catalogue,
   aucun pack ne sort de `REVIEW_REQUIRED`, quelle que soit la qualité du code.
