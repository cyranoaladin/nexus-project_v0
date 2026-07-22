# feat: Intégration SVT — Stages pré-rentrée 2026

## Résumé
Intègre la SVT (Première et Terminale) à la campagne pré-rentrée 2026 : offre, grille, textes/SEO, documents PDF, sous les décisions direction D1–D5 scellées. **Aucun déploiement / envoi famille — en attente de GO.**

## Décisions appliquées (scellées dans `publication-decisions.owner.json`)
- **D1** rôles enseignants SVT abstraits (noms à injecter).
- **D2** programmes SVT en DRAFT filigrané jusqu'à validation pédagogique.
- **D3** plafond 4 matières — « 1 à 4 matières au choix parmi 5 ».
- **D4-final** grille jour : SVT Terminale S2/B/salle-1, SVT Première S2/C/salle-2, permutation 1ère NSI B→D, **bloc E (soir) refusé**, convention salle-1 levée.
- **D5** aucun merge/déploiement sans GO écrit.

## Contenu
- **Grille** : 4 blocs A–D, 4 gates verts (noRoom/noTeacher/noLevel/dailyLoad), snapshot régénéré.
- **Configurateur** : sélection plafonnée à 4 matières (corrige le crash « Missing canonical campaign pack » à 5) + tests de régression.
- **Textes/SEO** (hors `jpo-2026`, périmètre codex) : SVT + « au choix parmi 5 » ; nouvelle FAQ SVT.
- **PDF** (`assets/campaigns/pre-rentree-2026/documents-final/`) : 3 programmes par niveau, 2 programmes SVT DRAFT, Planning (cross-check horaires PDF↔JSON PASS), Tarifs, Dossier, Flyer. Générateur porté dans `tools/pdf-generator/`.
- **Cherry-pick** `-x c5f726fc0` (group_max Fondations 6→5 + Docker) + propagation « 4 à 6 »→« 4 à 5 ».

## Preuves
228/229 tests verts (le rouge = pin de provenance couplé à `origin/main`, dette N-2, orthogonal). `tsc` propre. Interdits PDF : aucun. Poids < 2 Mo.

## Dettes bloquantes avant GO (voir `DEBTS.md`)
- B-1 noms enseignants SVT · B-2 levée DRAFT D2 · B-6 calculatrice SVT.

## Hors périmètre
`content/pre-rentree-2026/jpo-2026/**` (agent codex) → chaînes à appliquer dans `COORDINATION_JPO.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
