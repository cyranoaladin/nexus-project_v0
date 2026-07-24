# GO-LIVE CHECKLIST — Pré-rentrée 2026

**Branche :** `feat/pre-rentree-planning-scheduler` · **Statut release :** `BLOCKED` (fail-closed)
**Règle :** aucun merge / déploiement / diffusion sans le GO écrit propriétaire rattaché au SHA (voir bloc EN ATTENTE, point e).
Mise à jour : 2026-07-24. Deux blocs nets, comme demandé : tout ce qui est technique et validé par les tests est dans PRÊT ; **seules** les décisions qui nécessitent un humain (direction) restent en attente.

---

## ✅ PRÊT (technique, validé par tests)

1. **Planning sans conflit** — grille fenêtres + week-end (dates explicites, samedi/dimanche), conflit salle 2/bloc A résolu (PC Terminale → bloc D). 4 gates opérationnels (noTeacherConflict, noRoomConflict, noLevelConflict, dailyLoadValid) + complétude (14 modules × 5 séances = 70) + disponibilité Terminale (aucune séance avant le 24 août) verts — `pre-rentree-2026-schedule-gates.test.ts`.
2. **Sélecteur de planning parents** — `StagePlanningSelector` intégré à `ScheduleSection` : niveau → matières → planning chronologique → détection de conflit non bloquante → récap → pré-inscription. Rendu serveur, a11y (ARIA, clavier), mobile-first. Captures desktop + mobile vérifiées sur les 4 états (vide, 1 matière, plusieurs, conflit).
3. **Étanchéité stages/annuel** — preuve complète dans `SEPARATION_STAGES_ANNUEL.md` (matières par niveau, tarifs cloisonnés par clé JSON, planning borné 17-28 août, vocabulaire croisé sans fusion, aucun import transverse composant). `SUBJECT_THEMES` confirmé spécifique aux stages (grep des imports).
4. **Philosophie purgée intégralement** — zéro occurrence résiduelle dans le code, les schémas Zod, les données, le PDF et les scripts (grep exhaustif à l'appui). Maths expertes strictement limitée à la Terminale (test dédié + garde-fou permanent anti-régression contre toute réintroduction future d'une matière hors grille).
5. **Anonymat total** — 4 rôles enseignants strictement abstraits (A/C/D/E), `assigned: false`, aucun nom propre nulle part (test anti-noms).
6. **Seuil d'ouverture unique à 3** — constante unique `PRE_RENTREE_MIN_COHORT_OPENING`, aucune valeur dupliquée par offre/niveau/matière : `data/campaigns/pre-rentree-2026.json`, `schema.ts`, `offers.json`, `pricing.canonical.json` (`group_min_open` + `commercial_exception` PRE2026-3E-350 mis à jour), PDF, contenus marketing (WhatsApp, communication, JPO). Tests dédiés verts.
7. **Fichier d'incompatibilités** — calculé depuis la grille (date + bloc réels, pas seulement la lettre de bloc), jamais saisi à la main. Tests dédiés verts.
8. **PDF régénérés** — 9 documents, migration `weeks → windows` sur les deux pipelines (`scripts/pre-rentree/document_templates.py` et `tools/pdf-generator/generate_all_pdfs.py`), vues par niveau / fenêtre-salle / jour. Crosscheck JSON↔PDF et cohérence sélecteur↔PDF verts.
9. **Salles** — 2 salles, rôles abstraits, grille actée.

## ⏳ EN ATTENTE DIRECTION (les SEULES lignes bloquant le GO)

a. **Validation pédagogique Maths Seconde + Première**, conformité BO n°14 du 2 avril 2026 — relecture écrite d'un agrégé/direction.
b. **Validation contenus SVT** (Première + Terminale) — validation pédagogique + qualification enseignant si affectation nominative envisagée ; lève le watermark DRAFT des 2 PDF SVT.
c. **Validation contenus 3e** (Mathématiques, Français) — relecture pédagogique écrite, même exigence que (a).
d. **Date de mise en ligne** — date de lancement écrite du propriétaire (`releaseStatus` → `PUBLIC_READY`).
e. **GO écrit rattaché au SHA** — autorisation écrite, datée, rattachée au SHA exact du tip de la branche au moment du GO. **Ce point débloque le merge/déploiement.**

---

**Dette hors GO (Seconde, non bloquante pour ce chantier planning/sélecteur) :** `content/pre-rentree-2026/commercial-contract.fr.json` vend encore Physique-Chimie et Informatique-SNT pour la Seconde (2 SKU déjà approuvés le 2026-07-20), alors que la grille de stage n'a que Maths + Français pour ce niveau. Prouvé et isolé par `pre-rentree-2026-full-coherence.test.ts` (3 niveaux sur 4 verts, seul Seconde rouge). Décision commerciale distincte (retirer des offres déjà approuvées) — voir `DEBTS.md` #6.
