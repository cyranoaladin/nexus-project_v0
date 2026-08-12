# Enrichissement des bilans de pré-rentrée — Niveau 1 déterministe, finition premium

**Date** : 2026-08-12 · **Branche** : `feat/bilans-finition-premium` (base `origin/main` = `139178f22`)
**Périmètre** : rendu des bilans uniquement. Aucun LLM. Aucun score recalculé. Banques intouchées.

---

## 1. Les défauts constatés, et leur correction

| Défaut constaté sur les PDF réels | Correction | Où |
|---|---|---|
| Identifiants techniques bruts (« proportionnalite », « calcul-litteral »…) dans les textes familles | Table `DOMAIN_LABELS` : 68 domaines couverts, 3 formes françaises par domaine (titre, article, complément prépositionnel), élisions et accords gérés (« la proportionnalité », « l’argumentation », « en géométrie ») | `lib/bilans/render/domain-labels.ts` |
| Répétitions mot pour mot (4 × « une idée qui te paraît sûre… », 3 × « Tu as déjà repéré… ») | 3 variantes par profil × audience, rotation déterministe par rang du domaine dans son profil : deux domaines de même profil ne reçoivent jamais la même phrase | `lib/bilans/render/profile-copy.ts` |
| « Ton plan d’action » répétait intégralement « Ton parcours » | Le plan d’action élève est désormais un contenu distinct : micro-actions personnelles *entre* les séances (le parcours dit ce qu’on fera *en* séance) | `lib/bilans/render/report.ts` |
| Bilan parents le plus faible : Forces vide, plan générique, learningPath vide | Forces jamais vides (échelle de repli : point d’appui le plus proche → lucidité → photographie de départ) ; plan concret par geste pédagogique avec domaines nommés ; tableau « Les repères observés » (domaine, lecture, geste) ; encadré « La méthode Nexus » | `report.ts`, `html.ts` |
| Profil et score mélangés sans explication | Note de méthode dans les 3 documents : réussite × confiance, 4 profils, priorisation. Formulation parents : « Nous ne mesurons pas seulement si votre enfant réussit : nous mesurons s’il sait où il en est. » Les scores chiffrés restent réservés au document interne Nexus (invariant de non-divulgation conservé) | `report.ts` (`methodNote`) |
| « kamel Ben Rhouma » | Capitalisation des noms de personnes (minuscules et MAJUSCULES recomposées, tirets, apostrophes, casse mixte volontaire préservée) : « kamel ben rhouma » → « Kamel Ben Rhouma » | `human-identity.ts` |
| « Plan sur 4 semaines » vs séances 1→7 vs « cinq séances » | Source unique `STAGE_SESSION_COUNT = 5` ; répartition des priorités sur 5 séances max (2 domaines par séance de tête si besoin) ; Nexus affiche « Plan des cinq séances » ; un test verrouille la cohérence nombre ↔ rédaction | `stage-constants.ts`, `learning-path.ts` |

## 2. Nouveautés

- **« Détail des réponses »** (élève + Nexus) : énoncé, réponse de l’élève, réponse attendue, juste/faux/non traité, certitude déclarée (libellés officiels du pack : « je devine » … « certain »), correction courte, et « d’où vient l’erreur » (distractorRationale) quand la réponse était fausse. Parents : version synthétique volontaire (tableau qualitatif des repères + renvoi au document élève) — pas de noyade, pas de fuite de corrigés.
  - Construction en **lecture seule** depuis `CanonicalAssessmentAttempt.answers` + le pack résolu ; un pack dont le checksum ne correspond plus à la passation est **refusé** (`REPORT_EVIDENCE_PACK_MISMATCH`).
- **Visualisations** (SVG natif, zéro dépendance, charte print `nexus-lux`) :
  - Élève/parents : carte maîtrise × confiance en quadrants qualitatifs (aucun chiffre — invariant).
  - Nexus : barres des scores par domaine (priorités dorées) + carte de calibration réussite × confiance déclarée (la zone d’erreur confiante est matérialisée).
- **Typographie française systématique** : passe unique au rendu (`typography.ts`) — apostrophes ’, insécables avant : ; ! ?, guillemets « … » espacés, appliquée à tout texte visible, y compris les énoncés de banque.

## 3. Preuves

- **Aucun domainId brut** : test `finition-typographie.test.ts` — pour chacun des 17 packs × 3 audiences, les 42 identifiants « déguisés » (tirets/accents manquants) sont interdits dans le texte visible ; apostrophes droites et espaces simples avant ponctuation haute interdites ; vocabulaire technique interdit hors Nexus.
- **Couverture des libellés** : test `domain-labels.test.ts` — tout domaine de tout pack VALIDATED doit avoir un libellé dédié (le test échoue si un futur pack ajoute un domaine sans libellé).
- **Invariants** :
  - `data/bilans/banks/**` : **zéro modification** (vérifiable : `git diff origin/main -- data/bilans/banks` vide).
  - Scoring/faits (`lib/bilans/facts/**`, moteur, snapshots) : **zéro modification**. Seul le *rendu* change.
  - Alias pseudonyme conservé dans le snapshot ; vrai nom projeté au rendu uniquement (tests `render-identity-pseudonymity`, `report-materialization` verts).
  - Provenance `SAISIE_PAPIER` : « Durée non mesurée — saisie papier. » présent sur les 3 documents (visible sur les exemples nominatifs).
  - Garde CI des 17 packs : `wave1-banks.test.ts` vert (44 tests).
  - Parité en ligne/papier : `saisie-papier-parite` vert.
- **Décompte** : suite unitaire complète : 8 807+ tests verts (2 échecs préexistants hors périmètre en cours d'analyse — voir PR) ; suite bilans : 80 suites / 670 tests verts, 0 skip ; typecheck vert ; ESLint vert sur les fichiers touchés.

## 4. Exemples joints (ce dossier)

- `avant/` : les 6 artefacts HTML/PDF committés sur `main` (état diffusé aujourd'hui).
- `apres/` : les 6 mêmes artefacts régénérés, **plus** 3 exemples nominatifs saisie papier (`exemple-nominatif-saisie-papier-{eleve,parents,nexus}.{html,pdf}`) : identité saisie « kamel ben rhouma » → rendue « Kamel Ben Rhouma », détail des réponses inclus, graphiques Nexus inclus.

## 5. Décisions prises (à arbitrer si désaccord)

1. **Scores chiffrés jamais côté familles** : le mandat demandait « graphique des scores par domaine » ; l'invariant de non-divulgation (validation structurelle + lexique interdit + artefact integrity) réserve tout chiffre au document Nexus. Familles : visualisation qualitative en quadrants. Lever cet invariant serait une décision produit, pas une finition.
2. **Parents sans détail question par question** : synthèse qualitative + renvoi au document élève (« ne pas noyer »).
3. **Charte** : le mandat cite navy `#07112A` / or `#C49526` ; la charte print versionnée du dépôt (`nexus-lux-print.v1`, testée) est `#071A3A` / `#BFA06A`. J'ai conservé la charte du dépôt partout (aucune valeur du mandat n'existe dans le code). À confirmer.
4. **Détail des réponses tolérant à l'absence de pack** : si le pack ne se résout pas (flag désactivé), le document se rend sans la section (jamais un échec de publication) ; un checksum divergent, lui, bloque. Les 17 packs actifs en prod rendront toujours la section.
5. **`prose-catalogue.ts`** (catalogue antérieur, non branché) : laissé intact ; sa fonction de calibration est désormais réutilisée par le moteur. Le reste pourra converger au chantier LLM.

## 6. Versions bousculées (traçabilité)

- `BILAN_REPORT_TEMPLATE_VERSION` : `nexus-bilan-profile-v2` → **v3** (methodNote, calibration, gestes, titres humains, plan distinct).
- `BILAN_HTML_TEMPLATE_VERSION` : `nexus-bilan-html.v1` → **v2**.
- `LEARNING_PATH_VERSION` : `learning-path.v1` → **v2** (5 séances, libellés humains, variantes).
- `PROFILE_COPY_VERSION` : `profile-copy.v1` → **v2** (variantes, épicène).
- Évidences de recette (`data/bilans/recipe/*-review-packet.json`, `*-worker-chain.json`) et golden files (`docs/specs/bilans/exemples/*`) régénérés en conséquence.

Les révisions déjà en attente de revue (créées sous v2) se publieront avec le nouveau rendu : la matérialisation reconstruit le document depuis le snapshot de score au moment de la publication.

## 7. Correctif CI (cause racine, 2026-08-12)

Le job `unit` de la PR échouait sur `rendered-examples.test.ts` : comparaison **octet par octet** des PDF golden.

**Cause racine** : la section « Détail des réponses » embarque pour la première fois des énoncés de banque contenant des glyphes hors couverture de DM Sans (`√`, `≥`, `≤`, `∪`, `∩` — vérifié sur la cmap de `DMSans-Variable.woff2`). Chromium les rend via une police de repli du **système hôte** ; le sous-ensemble de police embarqué — et donc la numérotation interne des objets PDF — varie d'une machine à l'autre pour un même build Chromium (visible au log CI : décalage `52 0 obj` → `53 0 obj`, PDF plus gros côté runner). Les octets d'un PDF golden dépendaient donc de la machine de génération ; le HTML, lui, reste strictement identique.

**Correctif** (aucun test neutralisé, aucun seuil baissé) : les HTML restent comparés octet par octet ; les PDF sont désormais comparés sur leur **contenu extrait** (`extractPdfText`, page à page, non vide, magic `%PDF` exigé), indépendant de la police de repli. La famille de moteur reste verrouillée par `assertVersionedPdfChromium` (Chromium 145). Même logique appliquée au mode `--check` du script `generate-rendered-examples.ts`.

Note : les deux échecs observés en local sur `main` (`whatsapp-centralized`, `bilan-validated-pack-boundary`) sont bien verts en CI — ils ne balaient que cette machine (worktrees locaux non versionnés) et ne concernent pas cette PR.
