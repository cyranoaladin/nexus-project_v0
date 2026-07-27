# Audit qualité final — Périmètre Pré-rentrée 2026

**Date** : 2026-07-25 · **Branche** : `feat/pre-rentree-planning-scheduler` · **Objectif** : zéro dette, zéro
régression, zéro doublon, zéro code mort, zéro hardcoding, zéro incohérence, avant push/GO.

Méthode : lecture + tests d'abord, corrections en commits atomiques, aucune modification hors
périmètre pré-rentrée (`lib/campaigns/pre-rentree-2026/`, `components/pre-rentree-2026/`,
`scripts/pre-rentree/`, `tools/pdf-generator/`, `app/stages/pre-rentree-2026/`, `app/pre-rentree/`).

---

## A. Hardcoding

Détail complet, occurrence par occurrence : **`HARDCODING_AUDIT.md`**.

**Résumé** : 18 occurrences examinées sur 7 catégories (dates, tarifs, seuil d'ouverture, blocs
horaires, salles/rôles, listes matières/niveaux). **4 bugs réels corrigés**, le reste justifié ou
documenté comme dette mineure tolérée :

1. **Dossier d'accueil** affirmait « pas de cours les 22 et 23 août », faux (SVT et Physique-Chimie
   Première ont cours ces deux jours) — contredisait le même fichier ailleurs. Corrigé.
2. **5 occurrences** de « 3 à 6 »/« 3 à 5 » élèves codées en dur dans `generate_all_pdfs.py` —
   remplacées par des constantes dérivées de `pricing.canonical.json`, avec un helper qui échoue
   explicitement si les offres d'un tier divergent un jour (au lieu de dériver silencieusement).
3. **Texte de description des salles** (`getters.ts`) écrit à la main juste à côté de l'assertion
   qui valide les mêmes données — avait dérivé du libellé canonique (« Maths expertes » au lieu de
   « Mathématiques expertes »). Désormais dérivé de `campaign.roomRoles` + `campaign.subjects`.
4. **`HOURS_PER_SUBJECT = 10`** codé en dur dans `StagePlanningSelector.tsx` au lieu de lire
   `pack.totalHours` (déjà disponible, déjà dérivé du canonique). Corrigé.

Preuve : `git log --oneline bd4c23e7c..HEAD -- tools/pdf-generator/generate_all_pdfs.py
components/pre-rentree-2026/StagePlanningSelector.tsx lib/campaigns/pre-rentree-2026/getters.ts`.

---

## B. Doublons et sources multiples

- **Grille planning** : source unique confirmée — `data/campaigns/pre-rentree-2026.json` est le
  seul fichier du dépôt définissant une structure `windowId`/`schedule`/`slots`
  (`grep -rl '"windowId"' content/ data/campaigns/` → un seul résultat).
- **Incompatibilités matières** : calculées exclusivement par `computeSubjectIncompatibilities()`
  (`lib/campaigns/pre-rentree-2026/incompatibilities.ts`) ; tous les consommateurs (`getters.ts`,
  `ScheduleSection.tsx`, `StagePlanningSelector.tsx`, `full-coherence.test.ts`) l'importent, aucun
  ne recalcule.
- **Deux pipelines PDF** (`tools/pdf-generator/generate_all_pdfs.py` — production publique — et
  `scripts/pre-rentree/document_templates.py` — paquet de revue gouvernance) : confirmés dériver
  des mêmes sources canoniques, testés indépendamment, servant des finalités distinctes.
  **Documenté comme dette P1 dans `DEBTS.md`** plutôt que fusionné à chaud : consolider deux moteurs
  de rendu HTML/CSS indépendants dépasse le périmètre d'un correctif atomique et risquerait la
  chaîne de gouvernance reproductible (`pre-rentree:ci`). Nom « legacy » signalé comme trompeur
  (c'est le pipeline de production actif).
  **Décision direction (2026-07-25) : garder les deux pipelines, dette confirmée ouverte, consolidation
  reportée post-go-live.** Ambiguïté de nommage résolue **sans renommage** (option la moins risqueuse,
  telle que demandée) : renommer `pre-rentree:legacy-pdfs` aurait touché `package.json`, le nom du
  fichier pytest `test_legacy_pdf_generator_contract.py`, et 3 mentions markdown — dont une archive
  historique figée (`archive/pre-rentree-2026/pdf-2026-07-24-pre-r2-r4/README.md`) qu'il aurait été
  incorrect de réviser rétroactivement. À la place, un commentaire d'en-tête explicite a été ajouté
  dans les deux fichiers Python, précisant sans ambiguïté lequel est production-publique et lequel
  est revue-gouvernance, quel que soit celui ouvert en premier.

---

## C. Code mort

| Élément | Statut | Preuve | Action |
|---|---|---|---|
| `ARCHIVE_DIR = TOOL_DIR / "archive"` (`generate_all_pdfs.py`) | Constante jamais utilisée, pointe vers un dossier inexistant | `grep -n ARCHIVE_DIR` → 1 seule occurrence (la définition) ; `ls tools/pdf-generator/archive` → n'existe pas | **Supprimée** (zéro doute, zéro risque). Commit de cette session. |
| `content/pre-rentree-2026/jpo-2026/master.fr.json` (dossier entier) + `assets/campaigns/pre-rentree-2026/review/jpo-2026/` (30 fichiers générés, même résidu Philosophie trouvé au moment de l'exécution) | Orphelins confirmés (zéro référence dans le code après nouvelle vérification), contenaient encore des mentions de Philosophie | `grep -rln "jpo-2026/master\|review/jpo-2026"` sur tout le dépôt (hors `.artifacts`) → **aucun résultat** avant suppression | **SUPPRIMÉS — décision direction 2026-07-25.** Grep philosophie sur le périmètre pré-rentrée re-exécuté après suppression : ne restent que le commentaire de purge, la mention factuelle du Bac Philo dans `parent-guide.fr.json`, les assertions de test qui prouvent l'absence, et `content/pre-rentree-2026/COORDINATION_JPO.md` (doc de coordination historique, non consommé par le code, non nommé dans la décision — laissé en l'état, signalé). |
| `content/pre-rentree-2026/publication-decisions.owner.json → decisions.scheduleGridFinal` (champs `week1`, `week2TargetGrid`, `authorizedPermutationWeek2`, placements « Semaine 2 ») | Décrit un modèle « semaine 1/2 » obsolète, remplacé par le modèle fenêtres + week-end | `grep -rln "scheduleGridFinal\|week2TargetGrid"` dans `lib/`, `scripts/`, `tools/` → **aucun résultat** (jamais lu par le code) | **Non modifié — registre de décisions scellé.** C'est un historique d'audit, pas du code exécutable ; le champ `knownCrossBranchItem` a déjà été annoté « SUPERSEDED » lors d'un commit antérieur. Signalé pour information, pas d'action supplémentaire proposée (rouvrir un registre de décisions direction n'est pas à ma main). |
| Philosophie (code/données/PDF) | **Zéro résidu fonctionnel** | `grep -rniE "philosophie"` sur le périmètre pré-rentrée (re-exécuté après suppression de jpo-2026) → seules occurrences : (a) commentaire expliquant la purge, (b) `parent-guide.fr.json` (mention factuelle du Bac Philo *futur*, pas une matière de stage — exception documentée), (c) assertions de test prouvant l'absence, (d) `COORDINATION_JPO.md` (doc historique non consommé) | Aucune action supplémentaire : purge complète, exceptions documentées dans `SEPARATION_STAGES_ANNUEL.md`. |
| SKU Seconde retirés (Physique-Chimie, Informatique-SNT) | **Zéro résidu** | `grep -rn "pre2026-seconde-physique-chimie\|pre2026-seconde-informatique-snt\|seconde-informatique-snt"` sur le périmètre + données → aucun résultat hors `DEBTS.md`/`SEPARATION_STAGES_ANNUEL.md` (historique, attendu) | Aucune action. |
| Modèle « weeks » (pré-migration « windows ») | **Zéro résidu de code**, 1 résidu de donnée (`scheduleGridFinal.week1`, ci-dessus) | `grep -rn "weekLabel\|weekStart\|weekEnd\|'week1'\|'week2'"` sur code + données → un seul résultat (le champ de décision déjà traité ci-dessus) | Aucune action supplémentaire. |

**Aucune suppression risquée effectuée sans validation.** `ARCHIVE_DIR` (zéro doute) a été retiré
directement ; jpo-2026 (doute réel, campagne distincte pouvant redevenir active) a été listé,
signalé, puis supprimé **après validation explicite de la direction** — jamais tranché seul. Le
registre de décisions scellé (`scheduleGridFinal`) reste non modifié : ce n'est pas du code mort au
sens fonctionnel, c'est un historique d'audit hors de ma juridiction.

---

## D. Cohérence finale end-to-end

Extension de `__tests__/campaigns/pre-rentree-2026-full-coherence.test.ts` (déjà 7 surfaces
matières) à 3 nouveaux blocs de test :

1. **Par niveau (×4)** : ajout du contrôle « PDF Programme du niveau » — chaque matière de la
   grille doit apparaître dans le PDF programme détaillé de SON niveau (pas seulement dans le
   Planning global). C'est ce type de trou qui avait laissé `Programme_3e.pdf` totalement absent
   du pipeline (voir §A/C ci-dessous — root cause partagée).
2. **Salles** : chaque créneau planifié est affecté à une salle autorisée pour sa matière
   (`campaign.roomRoles`) — invariant qui tenait déjà par construction, désormais gardé en
   permanence plutôt que par coïncidence.
3. **Tarifs** : les 12 offres commerciales (`commercial-contract.fr.json`) ont un prix/acompte/solde
   qui correspond exactement au produit canonique référencé par leur `pricingId` — auparavant
   vérifié seulement par échantillon (4 offres sur 12).

**Sortie complète (dernière exécution, branche vérifiée stable avant/après)** :

```
PASS __tests__/campaigns/pre-rentree-2026-full-coherence.test.ts
  Pré-rentrée 2026 — cohérence intégrale par niveau (JSON / catalogue / contrat commercial / sélecteur / PDF / page)
    ✓ niveau TROISIEME : grille JSON, offers.json, contrat commercial, incompatibilités, sélecteur, PDF et page s'accordent sur les mêmes matières (26 ms)
    ✓ niveau SECONDE : grille JSON, offers.json, contrat commercial, incompatibilités, sélecteur, PDF et page s'accordent sur les mêmes matières (26 ms)
    ✓ niveau PREMIERE : grille JSON, offers.json, contrat commercial, incompatibilités, sélecteur, PDF et page s'accordent sur les mêmes matières (45 ms)
    ✓ niveau TERMINALE : grille JSON, offers.json, contrat commercial, incompatibilités, sélecteur, PDF et page s'accordent sur les mêmes matières (47 ms)
    ✓ salles : chaque créneau de la grille est affecté à une salle autorisée pour sa matière (campaign.roomRoles)
    ✓ tarifs : chaque offre commerciale (price/deposit/balance) correspond exactement au produit canonique référencé par pricingId, pour les 12 offres (2 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

---

## E. Hygiène

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit` (dépôt entier) | ✅ 0 erreur |
| `eslint` (périmètre pré-rentrée : `lib/campaigns/pre-rentree-2026`, `components/pre-rentree-2026`, `app/stages/pre-rentree-2026`, `app/pre-rentree`) | ✅ 0 warning (2 warnings pré-existants — imports morts `useMemo`/`formatPresenceRange`, présents depuis le tout premier commit du chantier, confirmé par `git show e3d23fe34:...` — nettoyés au passage) |
| 9 modules sans statut → `publicationStatus` | ✅ Confirmé : les 14 modules de `modules.json` portent tous un `publicationStatus` explicite (`PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION` ×12, `DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION` ×2 pour SVT) — **aucun module ne peut passer public sans bandeau/filigrane de validation direction.** |

---

## F. Régression

| Suite | Résultat |
|---|---|
| jest pré-rentrée (45 suites) | ✅ 45/45 suites, 305/305 tests |
| jest complet | ✅ 7073/7078 — **seul échec : `whatsapp-centralized`** (pré-existant, `.artifacts` de checkouts PR antérieurs, hors périmètre de cette PR) |
| pytest `scripts/pre-rentree/tests` | ✅ 97/97 (96 précédents + `test_troisieme_programme_pdf_exists_and_is_rendered_from_canonical_modules`, nouveau) |
| build/audit/package/verify | ✅ reproductible (0 mismatch sur 33 fichiers), fail-closed (`MERGE: NOT_PERFORMED`, `DEPLOYMENT: NOT_PERFORMED`, `PUBLIC_DISTRIBUTION: NOT_AUTHORIZED`) |

---

## Commits atomiques de cette session

| SHA | Objet |
|---|---|
| `bde4de960` | Programme_3e.pdf manquant, date contradictoire, effectifs dérivés du canonique |
| `95ac58163` | Salle/heures dérivées du canonique au lieu du hardcoding front |
| `aa153a35d` | Régénération des 10 PDF (dont le nouveau Programme_3e.pdf) |
| `f1ca99344` | Extension full-coherence : salles, tarifs, PDF programme par niveau |
| `a734117c3` | 2 imports morts pré-existants supprimés (hygiène lint) |
| `2f631fcde` | Documentation de la dette « deux pipelines PDF » dans DEBTS.md |
| `12d39b0fd` | Suppression `ARCHIVE_DIR` mort |
| `a54d56f27` | `HARDCODING_AUDIT.md` + `AUDIT_QUALITE_FINAL.md` (rapport initial) |
| `fe1f05c0c` | Suppression jpo-2026 (source + artefact généré), décision direction |
| `203f7c965` | Clarification en-tête des deux pipelines PDF (production vs. gouvernance), décision direction |
| *(ce commit)* | Mise à jour DEBTS.md + AUDIT_QUALITE_FINAL.md §C suite aux décisions direction |

---

## Incident hors-sujet (transparence)

Pendant les vérifications, un diagnostic `git stash`/`git stash pop` a accidentellement récupéré le
stash WIP d'une autre session (`fix/lot1-bundle-regression`), créant des conflits sur 9 fichiers
totalement étrangers au périmètre pré-rentrée. Résolu immédiatement par `git reset --hard HEAD`
(le stash de l'autre session a été vérifié intact dans `git stash list` avant et après — rien
perdu) ; les 2 correctifs pré-rentrée en cours ont été refaits à l'identique. Branche et HEAD
vérifiés stables (`git branch --show-current` + `git rev-parse HEAD`) avant et après chaque
commande longue tout au long de cette session, suite à l'incident de concurrence signalé
précédemment (agent `aria-agent`, désormais fermé de votre côté).

STOP — en attente de votre lecture avant tout push.
