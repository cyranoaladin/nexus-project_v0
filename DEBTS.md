# DEBTS — Intégration SVT Pré-rentrée 2026 (`feat/svt-integration-final`)

## Résolues avec le paquet de transfert
- ✅ **B-3** — Programmes SVT Première/Terminale générés depuis les données du dépôt (`modules.json`), **filigrane DRAFT pleine page** piloté par la décision D2.
- ✅ **B-4** — Programmes Français & Physique-Chimie (3 niveaux) : contenus livrés dans les PDF « Programme_{Niveau} » (source charte v3, contenu pédagogique valide).
- ✅ **B-5** — PDF Planning généré (grilles par niveau AVEC SVT + vue semaine×bloc×salle + repères + organisation en rôles abstraits) ; **cross-check horaires PDF↔JSON = PASS**.

## Bloquantes restantes (décision direction)

| # | Dette | Nature |
|---|---|---|
| B-1 | **Noms enseignants SVT** | `SVT_TEACHER_A` (Première), `SVT_TEACHER_B` (Terminale) abstraits (`assigned:false`). Injection : `data/campaigns/pre-rentree-2026.json → teacherRoles.SVT_TEACHER_A/B`. Aucun support public n'expose de nom. |
| B-2 | **Levée du DRAFT SVT (D2)** | Programmes SVT en filigrane « DOCUMENT DE TRAVAIL » tant que `decisions.svtProgramValidation.status = "draft_until_owner_validation"`. **Commande de régénération sans filigrane** : passer ce statut à `"approved_for_publication"` puis relancer `python tools/pdf-generator/generate_all_pdfs.py` (les PDF SVT sortiront sans filigrane et sans suffixe `_DRAFT`). |
| B-6 | **Matériel SVT — calculatrice** | Le PDF Planning liste le matériel par matière. Pour la SVT : cahier + trousse ; **calculatrice oui/non = décision direction** (à trancher avant impression). |

## Non bloquantes (constats / harmonisation)

| # | Dette | Nature |
|---|---|---|
| N-1 | **Charge Terminale 6 h** | Terminale NSI+PC+SVT = B+C+D = 6 h/jour (plafond `dailyLoadValid`=6, accepté au max). Actée `scheduleGridFinal.terminaleLoadNote`. Option : plafonner à 2 sciences/jour. |
| N-2 | **Test `publication-snapshot › provenance`** | Rouge : `git rev-parse origin/main` (`a0db57a7…`) ≠ pin `a1192c8…` (origin/main a avancé sous le multi-agents). **Stratégie** : découpler le pin de `origin/main` (l.10 du test) — pin sur tag de release ou merge-base figé. **Non corrigé** ici (pin de provenance orthogonal à la SVT) → à traiter en PR `fix/publication-snapshot-provenance`. |
| N-3 | **Dette codex (jpo-2026)** | 6 énumérations Première/Terminale sans SVT + « 1 à 4 » sans « parmi 5 » dans `jpo-2026/master.fr.json` (l. ~227, 250, 364, 734, 742, 790). **Constaté, non corrigé** — chaînes exactes dans `content/pre-rentree-2026/COORDINATION_JPO.md`. |
| N-4 | **SNT en Seconde vs `secondeSubjects`** | Grille conserve un créneau Seconde NSI/SNT vs `decisions.secondeSubjects` (exclut SNT). Hors périmètre SVT — réconciliation branche JPO. |
| N-7 | **Granularité programmes** | Les programmes Français/PC sont livrés dans des PDF **par niveau** (tous sujets d'un niveau) et non par-matière isolée ; les programmes SVT sont, eux, en PDF dédiés (filigrane DRAFT). Choix de format à confirmer si des PDF mono-matière Français/PC sont exigés. |
| N-8 | **c5f726fc0 (group_max 6→5 + Docker)** | Commit codex cherry-pické (`00204ac6c`, `-x`) car il touche `data/pricing.canonical.json` (donnée de campagne). Sa **propagation textuelle** « 4 à 6 »→« 4 à 5 » a été appliquée (25 remplacements, hors jpo-2026). Les changements Docker/RELEASE_SHA embarqués sont infra (orthogonaux) mais indissociables du commit. |
| N-6 | **Archive PDF** | Régénération WeasyPrint écrase en place ; versions antérieures préservées en git (commits `44b50059c`, `fb6ab5cae`) — fait office d'archive datée. Pas de dossier `archive/` binaire dupliqué. |
