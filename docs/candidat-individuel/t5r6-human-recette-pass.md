# T5R6 — INTERNAL_HUMAN_RECETTE = PASS (décision direction)

**Date de la décision** : 2026-08-28 (date système au moment de la revue).
**Baseline runtime** : `feec4a427` (worktree `.worktrees/t5r6-final-family-semantics-closeout`,
branche `fix/candidat-individuel-final-family-semantics-closeout`).

## Décision officielle

```
INTERNAL_HUMAN_RECETTE = PASS
```

Cette décision fait suite à l'inspection humaine réelle des artefacts du pack
V4 (`~/Téléchargements/NEXUS_V1_RECETTE_HUMAINE_FINAL_V4/`), après la
fermeture technique de T5R6 (FINDING_15/16).

## Résumé de clôture T5R6

- `T5R6 = CLOSED`
- `FINDING_15_FAMILY_SUBJECT_LABELS = RESOLVED`
- `FINDING_16_ABANDONED_SPECIALTY_WARNING = RESOLVED`
- `FINAL_E2E = PASS` — 66/66 (campagne Docker candidat-individuel complète,
  baseline T5R5 65/65 + 1 nouveau test T5R6)
- DB intégration — 320/320
- `P0 = NONE`
- `P1 = NONE`

## Réserves P2 non bloquantes (décision direction)

Ces deux points sont explicitement classés **non bloquants** pour la
recette V1 ; ils restent à traiter dans un futur lot, jamais dans ce
commit ni dans T6 (T6 est un lot de durcissement release, pas un lot
fonctionnel) :

1. **Console staff encore très technique** — l'espace de travail
   `CandidatIndividuelWorkspace.tsx` reste un outil de travail interne
   (JSON bruts pour `notesConservees`/`dispensesDeclarees`/
   `p3EligibiliteAudit`, terminologie technique), jamais un espace grand
   public — cohérent avec le scope V1 documenté, mais identifié comme
   piste d'amélioration ergonomique future.
2. **Redondance textuelle mineure "NSI ... NSI"** dans une ligne de la
   carte d'examen PDF (page 3) — quand `matiere` et `libelle` partagent le
   même préfixe sans être strictement identiques (ex. "NSI — Spécialité de
   première non poursuivie en terminale — NSI"), le dédoublonnage exact
   (`matiere !== libelle`) introduit par T5R4 §FINDING_10 ne couvre pas ce
   cas partiel. Cosmétique, aucune ambiguïté réglementaire ni commerciale.

## Portée de ce commit

Ce commit est **documentaire uniquement** — aucune ligne de code produit
n'est modifiée. Il enregistre la décision direction pour l'audit de
lignée et la traçabilité du dossier de release.

**Ce commit n'autorise PAS la mise en production.** `PUBLIC_RELEASE`
reste `NO_GO` tant que T6 (V1 Production Readiness & Release Candidate
Hardening) n'a pas produit son propre verdict, et tant qu'aucune revue
supplémentaire n'a explicitement levé ce statut.
