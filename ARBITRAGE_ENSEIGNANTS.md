# ARBITRAGE ÉDITORIAL — Mention « certifiés / agrégés » (à trancher)

## Ce qui a été retiré et pourquoi
Lors du contrôle qualité des PDF, la mention du statut enseignant « certifié / agrégé » a été **retirée** de 3 emplacements, au titre de la règle *« aucune affirmation de statut enseignant non prouvée en public »* (gate `remainingReleaseGates.teacher_qualification_evidence = to_confirm`, et interdits du paquet : « chiffres invérifiables / statut non prouvé »).

| Fichier | Ligne | Phrase d'origine (préservée) | Remplacée par |
|---|---|---|---|
| `tools/pdf-generator/generate_all_pdfs.py` | ~586 | « …avec un **enseignant certifié ou agrégé** de l'Éducation nationale française, en exercice » | « …avec un enseignant en exercice dans le système français » |
| `tools/pdf-generator/generate_all_pdfs.py` | ~602 | « …un **enseignant certifié ou agrégé** en exercice dans le système français, un programme écrit… » | « …un enseignant en exercice dans le système français, un programme écrit… » |
| `tools/pdf-generator/essentiel.html` | ~197 | « Enseignants : **certifiés ou agrégés** de l'Éducation nationale française » | « Enseignants : en exercice dans le système français » |

> Formulation commerciale de référence conservée pour restauration : **« enseignants certifiés ou agrégés de l'Éducation nationale française, en exercice »**. Elle est aussi préservée en **commentaire désactivé** dans le générateur (constante `ENSEIGNANT_STATUT_COMMERCIAL`).

> Hors périmètre de cette PR : `data/Nexus_Reussite_Accueil.html` (page d'accueil) conserve la mention « certifiés et agrégés » — **non modifiée**.

## Deux options — décision direction

**Option 1 — Restaurer** (le statut est le différenciateur commercial central, la preuve relève de la direction) :
- Réactiver `ENSEIGNANT_STATUT_COMMERCIAL` dans le générateur + restaurer la ligne du flyer.
- Prérequis : lever le gate `teacher_qualification_evidence` (preuve de statut détenue par la direction).

**Option 2 — Maintenir la suppression** : aucun support n'affirme le statut tant que la preuve n'est pas actée.

## En attente d'arbitrage
Aucun support publié n'affirme le statut (état actuel = Option 2), **mais** la formulation n'est pas détruite : elle est conservée ici et en variante désactivée dans le code. À toi de trancher.
