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
| **N-9** | **Politique d'affectations publiées (D6)** | La production publie **salles + créneaux + rôles abstraits** ; la décision D4 côté jpo interdit de publier les affectations. **Décision direction requise.** **Position par défaut retenue** : on conserve la publication actuelle (salles + créneaux + rôles abstraits « Enseignant de SVT », aucun nom) — utile aux familles et déjà en ligne. |
| ~~N-10~~ | **Agrégé/certifié — RÉSOLU (R4)** | Formulation commerciale **restaurée** sur Tarifs + Flyer (position direction). Voir `ARBITRAGE_ENSEIGNANTS.md`, `P0_REGRESSIONS.md`. |
| ~~B-7~~ | **R1 — grille tarifs/effectifs — RÉSOLU** | **Arbitrage direction définitif** : on GARDE la **grille de production du 20/07** (Fondations **4-6**, Premium **3-5**, acomptes **30% exact 144/405…**, `commercial_exception` DIRECTION 2026-07-20). La grille 3-5/140 énoncée en audit est **NON retenue**. Scellé dans `publication-decisions.owner.json → commercialGridFinal`. Mes changements ont été revertés à cette grille. Je ne modifie plus l'offre. |
| **N-11** | **Conformité programmes maths 2026 (A)** | Modules Maths Seconde/Première à aligner sur le BO n°14 du 2 avril 2026 (stats/probabilités, valeur absolue, second degré en Seconde ; second degré/exponentielle + épreuve anticipée en Première). **PROPOSITIONS** scellées (`mathsProgramConformity2026`), non publiées — validation direction pédagogique requise. Détail : `CONFORMITE_PROGRAMMES.md`. SVT : thème « Corps humain et santé » sous-représenté. |
| **N-12** | **Second dépôt canonique divergent (C)** | `canonical-repo-a1192c8d` (→ aussi `cyranoaladin/Nexus`) ne contient pas la base `d0ce2241`/`e137009e8` de cette branche. Le push cible `cyranoaladin/nexus-project_v0` (ancêtre commun `e137009e8` confirmé). **Réconciliation des deux mainlines = décision direction.** |
