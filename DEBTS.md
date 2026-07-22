# DEBTS — Intégration SVT Pré-rentrée 2026 (`feat/svt-integration-final`)

Dettes consolidées en fin de mission. Chaque item indique s'il est **bloquant** pour le GO.

## Bloquantes (décision ou source manquante)

| # | Dette | Nature | Débloqué par |
|---|---|---|---|
| B-1 | **Noms enseignants SVT** | `SVT_TEACHER_A` (Première) et `SVT_TEACHER_B` (Terminale) restent des rôles abstraits (`assigned:false`). Points d'injection : `data/campaigns/pre-rentree-2026.json → teacherRoles.SVT_TEACHER_A/B`. Aucun support public n'expose de nom. | Direction (D1) |
| B-2 | **Levée du DRAFT programmes SVT (D2)** | Programmes `premiere-svt`/`terminale-svt` validés « sous réserve » ; les PDF programmes SVT devront être générés en **filigrane DRAFT** jusqu'à validation pédagogique. | Direction pédagogique (D2) |
| B-3 | **Programmes SVT — pas de générateur PDF** | Aucun script du dépôt ne génère les PDF `programmes/*.pdf` (seuls Maths+NSI existent, produits hors dépôt). 5e non réalisable sans chaîne de génération programme. | Fournir/confirmer le générateur |
| B-4 | **Programmes Français & Physique-Chimie (5f)** | Source `doc1-programmes-pre-rentree-2026.md` **absente du dépôt** et chemin non confirmé. Extraction fidèle impossible sans le fichier. | Déposer le `.md` (B2) |
| B-5 | **Planning_InfosPratiques (5a)** | Aucun PDF « planning » avec grilles par niveau + vue par salle n'existe dans `parent-documents/` ; le calendrier `full-campaign` est un marketing rasterisé sans grille horaire. Générateur dédié à créer. | Confirmer l'attendu/le générateur |

## Non bloquantes (constats / harmonisation)

| # | Dette | Nature |
|---|---|---|
| N-1 | **Charge Terminale 6 h** | Un Terminale NSI+PC+SVT = blocs B+C+D = 6 h/jour (plafond `dailyLoadValid`=6 h, accepté au maximum). Actée dans `scheduleGridFinal.terminaleLoadNote`. Décision possible : plafonner à 2 sciences/jour. |
| N-2 | **Test `publication-snapshot › provenance`** | Rouge : `git rev-parse origin/main` (reçu `a0db57a7…`) ≠ pin figé `a1192c8…`. Cause : `origin/main` a avancé sous le travail multi-agents. **Stratégie proposée** : découpler le pin de `origin/main` — soit figer le sha attendu via un tag de release, soit comparer au `merge-base` figé de la campagne, plutôt que `git rev-parse origin/main` (l.10 du test). Non corrigé ici pour ne pas réécrire silencieusement un pin de provenance. |
| N-3 | **Dette codex (jpo-2026)** | `content/pre-rentree-2026/jpo-2026/master.fr.json` porte 6 énumérations Première/Terminale sans SVT et « 1 à 4 » sans « parmi 5 » (lignes ~227, 250, 364, 734, 742, 790). Périmètre codex — **constaté, non corrigé**. Détail dans `content/pre-rentree-2026/COORDINATION_JPO.md`. |
| N-4 | **SNT en Seconde vs `secondeSubjects`** | La grille conserve un créneau Seconde NSI/SNT alors que `decisions.secondeSubjects` exclut la SNT. Hors périmètre SVT — réconciliation sur la branche JPO. |
| N-5 | **Harmonisation marketing full-campaign/week-one** | Slides marketing (`full-campaign.fr.json`, `week-one-campaign.fr.json`) utilisent « 1 à 4 matières » générique (factuellement correct, disponibilité SVT implicite). Harmonisation « au choix parmi 5 » + mention SVT possible mais non critique. |
| N-6 | **Archive PDF** | La régénération WeasyPrint écrase en place ; les versions antérieures sont préservées dans git au commit `44b50059c` (fait office d'archive datée). Pas de dossier `archive/` binaire dupliqué (évite le gonflement du dépôt). |
