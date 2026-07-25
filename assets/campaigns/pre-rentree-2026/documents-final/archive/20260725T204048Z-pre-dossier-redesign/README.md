# Archive — état des PDF parents avant refonte "dossier complet par niveau"

Date de l'archive : 2026-07-25 (juste avant la refonte éditoriale/technique menée sur
la branche `feat/pre-rentree-2026-parent-pdf-redesign`, depuis `BASELINE_SHA
202cd06fd3aff7762820a5953d60deaad6835283` de `feat/pre-rentree-planning-scheduler`).

## Contenu

Les 10 PDF tels que produits par `tools/pdf-generator/generate_all_pdfs.py` avant la
refonte, avec leurs checksums SHA-256 dans `CHECKSUMS.sha256`.

Notamment :
- `NexusReussite_PreRentree2026_Programme_{3e,Seconde,Premiere,Terminale}.pdf` —
  anciens programmes par matière (tableau dense 4 colonnes), remplacés par les
  4 nouveaux "dossiers complets parents" du même nom (planning + programmes +
  infos pratiques + guidance de combinaison, en une seule ouverture par niveau).
- `NexusReussite_PreRentree2026_Programme_SVT_{Première,Terminale}.pdf` — anciens
  PDF SVT autonomes. **Retirés du jeu de documents parents** à partir de cette
  refonte : leur contenu est désormais un chapitre à part entière des dossiers
  Première/Terminale ci-dessus. Ces 2 fichiers ne sont plus régénérés ni proposés
  au téléchargement public ; conservés ici uniquement pour l'historique.

## Pourquoi cet archivage

Conserver une trace intègre (checksums) de l'état exact du jeu de documents avant
la refonte, conformément à la règle "aucune perte d'historique" appliquée à
l'ensemble de la campagne pré-rentrée 2026 (voir DEBTS.md, residual-debt.fr.json).
