# Bilan enseignant LLM, mentions RGPD, bouclage — rapport

**Date** : 2026-08-12 · **Branche** : `feat/bilan-enseignant-llm` (base `origin/main` = `9a119fc04`)
**Invariants intacts** : banques, scoring, snapshots append-only, candidat libre. Bilans élève et parents **100 % déterministes** (testé).

---

## A. Bilan enseignant enrichi (brief de séance)

### Contenu et ancrage
Pour chaque domaine prioritaire (2 à 4) : erreurs typiques **ancrées sur les items réellement ratés** (chaque erreur doit citer au moins un `itemId` fourni, sinon la sortie entière est rejetée — `TEACHER_BRIEF_UNGROUNDED_ERROR`), prérequis à vérifier, **une activité de séance avec déroulé phase par phase** (nom, durée, consigne lisible telle quelle, différenciation), un indicateur de progrès observable. Le LLM habille le diagnostic déterministe : profils et priorités lui sont fournis comme faits, jamais recalculés.

### Modèle — calcul comparatif (mesuré sur le besoin réel)
Besoin mesuré sur un bilan réel (pack seconde maths, 18 items, 4 domaines prioritaires) : **partie stable 1 631 jetons** (consignes + schéma + lexique), **faits de l'élève ≈ 1 060 jetons**, **sortie visée 1 500 jetons** ; session type : 20 bilans.

| Candidat OpenRouter | $/bilan sans cache | $/bilan avec cache | $/session (20, cache) | Cache | Appréciation qualité |
|---|---|---|---|---|---|
| **anthropic/claude-sonnet-4.5** (retenu) | 0,031 | 0,026 (1ᵉʳ : 0,032) | **0,53** | Oui (−14 %/bilan) | Rédaction didactique FR la plus fiable, respect strict des schémas |
| openai/gpt-4o | 0,022 | 0,020 | 0,40 | Automatique | Solide, un cran en dessous sur la finesse didactique FR |
| mistralai/mistral-large-2512 | 0,014 | 0,014 | 0,29 | Non | Bon FR, moins constant sur les consignes longues et le JSON strict |

**Décision** : à ≈ 0,03 $ le bilan, le coût est négligeable pour les trois candidats — le critère discriminant est la qualité (non négociable). **Sonnet 4.5 retenu** : meilleure fiabilité rédactionnelle et de format, cache supporté et réellement utile ; ce n'est pas le plus cher (Opus écarté d'office). Mistral Large reste en secours dans l'allowlist.

**Mécanique de cache vérifiée (OpenRouter → Anthropic)** : marquage par bloc `cache_control: {type:"ephemeral"}` dans un contenu multi-parties ; **seuil minimal 1 024 jetons par bloc** — notre bloc stable en fait 1 631, donc cacheable ✓ ; TTL glissant ≈ 5 minutes (les relectures en rafale de l'assistante en profitent ; une rafale espacée ré-écrit le cache au 1ᵉʳ appel, +25 % sur ce seul appel) ; écriture 3,75 $/M, lecture 0,30 $/M ; OpenRouter renvoie `usage.prompt_tokens_details.cached_tokens`, que nous enregistrons par brief (taux de cache effectif consultable dans le compteur d'usage).

- Allowlist versionnée (`data/bilans/model-policy.json` § `teacherBrief`) ; changeable sans redéploiement via `NEXUS_TEACHER_BRIEF_MODEL`, jamais hors liste.
- **Cache prompting activé** pour Sonnet (`cache_control: {type:"ephemeral"}` sur la partie stable : consignes didactiques + schéma + lexique interdit ; la partie variable = faits de l'élève). Support vérifié : OpenRouter relaie le cache Anthropic pour les modèles Claude et renvoie `prompt_tokens_details.cached_tokens` ; pour Mistral (2ᵉ modèle autorisé), pas de cache → marqué `false` dans la policy, le code n'envoie alors pas de bloc cache.
- `max_tokens` plafonné : défaut 2 000, borne dure 2 500 (`NEXUS_TEACHER_BRIEF_MAX_TOKENS`).
- **Cache applicatif** : un brief `PENDING_REVIEW` ou `APPROVED` ne se régénère jamais (`ALREADY_PRESENT`) ; seule une demande de correction rouvre la génération (nouvelle version, l'ancienne passe `SUPERSEDED`, historique conservé).
- **Compteur d'usage** consultable dans la page bilans : briefs du mois, jetons (cache inclus), coût estimé — grille de prix versionnée dans la policy.
- **Budget** : plafond mensuel (`NEXUS_TEACHER_BRIEF_MONTHLY_BUDGET_USD`, défaut 20 $) ; dépassé → repli, jamais d'erreur.

### Prompts versionnés
`data/bilans/prompts/teacher-brief.v1.md` (consignes complètes, dans Git, revues en PR) + schéma zod strict `lib/bilans/llm/teacher-brief-schema.ts`. Chaque génération enregistre `promptVersion` + `model` sur la ligne du brief. **Sortie non conforme = rejetée, jamais rafistolée** (zod strict + ancrage + lexique — testé).

### Relecture obligatoire
État `PENDING_REVIEW` distinct de tout état utilisable ; seul un brief `APPROVED` est présenté comme prêt. L'assistante peut : approuver (avec **correction manuelle facultative qui prime toujours** — `editedContent` affiché à la place du texte généré), ou annoter et demander une régénération (pattern de #124 : annotation append-only + statut `CORRECTION_REQUESTED`). Traçabilité complète : relecteur, date, motif, version, modèle — verrouillée par trigger SQL (relecture posée une fois, jamais réécrite ; contenu généré immuable ; DELETE interdit). **Prouvé sur clone.**

### Repli déterministe (PLANCHER par défaut)
Clé absente, réseau, HTTP 4xx/5xx, JSON invalide, schéma rejeté, lexique enfreint, budget dépassé, pack non résolu ou checksum divergent → **PLANCHER : aucun brief, aucune écriture, aucune erreur bloquante** ; le document interne Nexus déterministe reste la référence (message UI explicite). Testé cas par cas.

### Garde-fous prouvés (tests)
- **Pseudonymisation** : le payload ne contient que l'alias `ELEVE_…` et les faits pédagogiques ; scanner PII **fail-closed avant tout appel réseau** (une adresse e-mail glissée dans les faits → `TEACHER_BRIEF_PII_BOUNDARY`, rien ne part). La partie stable du prompt ne contient aucun fait élève.
- **Interne uniquement** : le brief vit dans sa propre table ; il n'entre jamais dans les matérialisations ni les liens signés — la contrainte SQL anti-NEXUS de #124 est inchangée, et le service brief **n'écrit jamais** dans révisions/matérialisations (test).
- **Verrou de narration familles** : découverte critique — poser `OPENROUTER_API_KEY` aurait fait basculer le worker A88 en narration LLM des bilans familles (FLIP POINT documenté, revue COACH non recâblée). Ajout d'un verrou : la narration familles exige désormais **en plus** `NEXUS_BILAN_FAMILY_NARRATION_ENABLED=true` — à ne pas poser. Clé présente ou non, **élève et parents restent 100 % déterministes** (test).

### Variables d'environnement attendues (à poser par le responsable, hors dépôt)
- `OPENROUTER_API_KEY` — clé OpenRouter (`sk-or-v1-…`), à poser dans le fichier d’environnement de production (0600, root uniquement — emplacement documenté dans le runbook privé du serveur). Jamais dans Git ni dans le chat.
- Optionnelles : `NEXUS_TEACHER_BRIEF_MODEL` (défaut Sonnet), `NEXUS_TEACHER_BRIEF_MAX_TOKENS` (2000), `NEXUS_TEACHER_BRIEF_MONTHLY_BUDGET_USD` (20).
- **Ne PAS poser** : `NEXUS_BILAN_FAMILY_NARRATION_ENABLED`.

### Exemples réels et coût mesuré — état honnête
La clé n'est posée ni en prod (vérifié : 0 occurrence) ni localement : **aucun exemple réel n'a pu être généré, et aucun coût réel mesuré** — rien n'a été inventé. Livré à la place :
1. `scripts/bilans/generate-teacher-brief-example.ts` — une commande, dès la clé posée : génère le brief d'un attempt réel (dry-run, zéro écriture) et **mesure le coût des deux appels successifs (sans puis avec cache)**.
2. Estimation théorique (grille versionnée, prompt stable ~4 500 jetons, faits ~1 500, sortie ~1 500) : **≈ 0,040 $ le premier bilan, ≈ 0,028 $ les suivants** (cache lu à 0,30 $/M au lieu de 3 $/M).
3. Le format exact du contenu est illustré par la fixture conforme au schéma dans `__tests__/bilans/teacher-brief.test.ts` (étiquetée : forme, non générée).

## B. Mentions RGPD — carte des notices et emplacement retenu

**Carte (rapportée avant insertion)** :
| Texte | Fichier | Ce que le parent accepte | Versionné ? |
|---|---|---|---|
| Politique de confidentialité | `app/politique-confidentialite/page.tsx` | Page publique de référence (contact, bilan gratuit, newsletter) | **Non** — statique, aucun consentement stocké ne s'y adosse |
| Case /bilan-gratuit | `app/bilan-gratuit/BilanStrategiqueClient.tsx` | « J'accepte d'être contacté … et la politique de traitement des données » — case obligatoire, **non persistée** | Non |
| Notice candidat libre | `lib/diagnostics/candidat-libre/privacy-notice.ts` | Notice v3 dédiée, consentement stocké par version | Oui — hors périmètre, intact |
| CGV paiement | migration `20260301_add_terms_acceptance` | Conditions commerciales au paiement | Oui — hors sujet |

**Emplacement retenu** : la politique de confidentialité (c'est la « notice » que référence la case du formulaire). **Les deux mentions y sont insérées verbatim** (« Transmission des bilans », « Production des bilans »). Seule adaptation : apostrophes typographiques ’ (exigence typographique du dépôt) — aucun mot changé ; un test verrouille leur présence.
**Versionnage** : la page n'est pas versionnée et aucun consentement enregistré ne s'y adosse — **l'insertion ne périme aucun consentement existant**, aucun incrément de version n'est requis (le seul mécanisme versionné, candidat libre, est intouché). Rien à signaler bloquant.
**Aucune mention d'IA côté familles** : test dédié — rendu élève et parents (deux packs) + littéraux des catalogues de prose : aucune occurrence d'IA/LLM/génératif/outil de rédaction. La traçabilité (version de prompt, modèle, relecteur) vit sur le brief interne uniquement.

## C. Bouclage

- Migration additive `20260812190000_add_teacher_briefs`, **clone-testée** (application propre, triggers exercés : contenu immuable, relecture unique, annotations append-only, statut inconnu refusé par CHECK).
- 26 nouveaux tests (brief 21 + mentions 4 + verrou) ; suites #123/#124 inchangées ; décompte complet dans la PR.
- Français : textes du prompt, de l'UI et des messages relus ; tests de typographie existants inchangés et verts.

## D'. Parties B, C, D, F (extension du 2026-08-12)

### B — Visualisations chiffrées côté familles
Nouvelle section « Repères en chiffres » (élève et parents) : questions traitées (« 18 sur 18 »), **calibration mise en valeur en carte or** (« des cas où votre enfant sait où il en est — c'est ce que nous mesurons en plus de la réussite »), répartition par profil en compte **et** proportion, barres de réussite par domaine avec pourcentage (SVG natif, charte lux). **Ce qui a été modifié, précisément** : la regex `score_visible_parent` du lexique interdit ne bannit plus les pourcentages nus mais toute forme de note (`…/20`, `…/100`) ; nouvelle catégorie `note_globale` (« score global », « note globale », « moyenne générale », « classement »…). La **validation structurelle est inchangée** : les chiffres viennent du FactSheet au rendu, le bundle public reste sans champ chiffré. Le mot « score » reste banni des documents familles (libellé « réussite »). **Test verrouillant** `no-global-score-family-documents` : sentinelle `globalScore=61` jamais rendue, chiffres autorisés présents, NEXUS conserve le score global.

### C — Dashboards parent et élève
- Parent (`/dashboard/parent/enfant/[studentId]`) : chaque bilan publié propose lecture en ligne + **deux PDF** — compte rendu parents et bilan remis à l'enfant (`?audience=ELEVE`, nouvellement autorisé au parent propriétaire, et à lui seul). Historique par enfant (liste existante).
- Élève : nouvelle page `/dashboard/eleve/mes-bilans` — historique des bilans publiés, lecture + PDF, charte lux.
- **Gardes testées** (6 tests) : NEXUS jamais servi à une famille (y compris en le demandant), un élève ne peut pas demander l'audience parents, **isolation croisée** entre familles (parent et élève d'une autre famille → introuvable).

### D — Captures (`captures/`)
Page « Mes bilans » élève, dashboard parent, et la section « Tes repères en chiffres » du bilan élève rendu (visible aussi dans les 3 PDF régénérés joints sous `pdf-regeneres/`).

### F — Adresse de contact unique
Audit du dépôt : expéditeur par défaut `contact@nexusreussite.academy` (le repli dev `no-reply@` corrigé) ; `dpo@` (mentions légales, CGV), `admin@` (mentions légales) et `callback@` (marketing) remplacés par `contact@`. Identités techniques conservées et documentées : `parent-technique@` (compte système, jamais de courrier), comptes de seed/QA (`audit.*@`, `admin@nexus-reussite.com`) hors champ courrier. **Test verrouillant** `single-contact-address` : expéditeur par défaut + aucune autre adresse Nexus dans le code applicatif suivi par Git.
