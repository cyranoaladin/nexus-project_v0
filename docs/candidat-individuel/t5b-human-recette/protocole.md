# Candidat individuel — V1 Human Internal Recette (T5B) — Protocole

**Ce fichier documente le protocole T5B et pointe vers le pack d'artefacts binaires (captures/PDF),
volontairement hors Git : `/tmp/nexus-candidat-individuel-v1-human-recette-ea7a86d88/` (généré
localement — reproductible via `e2e/t5b/human-recette.spec.ts`, non committé, voir §19 de la mission
T5B). Ce dossier `docs/` ne contient que les livrables documentaires autorisés par la mission (§19) :
ce protocole, `manifest.json` (inventaire), `t5b-human-verdict.md` (template de verdict),
`direction-checklist.md`, `t5b-findings.md` et `production-build-analysis.md`.**

Baseline : `ea7a86d88` (T5R2 CLOSED/PASS). Worktree : `.worktrees/t5b-human-recette`, branche
`release/candidat-individuel-v1-human-recette`. Environnement : build de production local, base de
données disposable (docker-compose.e2e.yml, `nexus_e2e`), comptes staff synthétiques (`assistante`,
`admin` — identités déjà utilisées dans toute la campagne E2E T1-T5R2), candidats synthétiques
(profils candidat-individuel anonymes par construction — aucun champ nominatif n'existe dans ce
formulaire : pas de nom d'élève, de responsable, ni de contact — cohérent avec
`docs/candidat-individuel/shadow-corpus-synthetique-resultats.md`). Aucune donnée réelle, aucun email
réel, aucun environnement production.

**Ce pack n'est PAS un verdict.** Il documente ce qui a été observé techniquement pour permettre à la
direction de juger. `t5b-human-verdict.md` et les colonnes humaines de `direction-checklist.md` restent
`PENDING_HUMAN_REVIEW` jusqu'à ce que la direction les remplace elle-même.

## Structure

```
README.md                        — ce fichier
manifest.json                    — inventaire exact des artefacts
t5b-human-verdict.md             — matrice de verdict (colonnes humaines PENDING_HUMAN_REVIEW)
direction-checklist.md           — checklist synthèse A-E (PENDING_HUMAN_REVIEW)
t5b-findings.md                  — défauts observés (2, tous deux préexistants — voir document)
R1-standard/                     — R1a (PREMIERE : EAF_ECRIT_ORAL+EAM+Pilotage) + R1b (TERMINALE :
                                    EDS1+EDS2+Philosophie+Grand Oral+Pilotage) — voir note ci-dessous
R2-headcount/                    — LVA=1(SOLO)/LVB=2(DUO)/spécialité abandonnée=3(GROUPE)
R3-group-pending/                — effectif LVB volontairement omis -> GROUP_PENDING, aucun devis
R4-accelere/                     — P3 (dérogation même session) -> hard block, aucun devis
R5-deferred/                     — scope différé jamais vendable (doc + 1 capture UI représentative)
R6-family-publication/           — cycle complet du lien famille (émission, copie, renouvellement)
technical/                       — logs de preuve (build, DB, freeze), texte extrait des PDF (pdftotext)
```

## Note sur R1 (couverture du cœur V1)

La directive demande une seule "R1" couvrant `MOD_EAF_ECRIT_ORAL, MOD_EAM, MOD_EDS1, MOD_EDS2,
MOD_PHILOSOPHIE, MOD_GRAND_ORAL, SVC_PILOTAGE`. Réglementairement, `EAF_ECRIT_ORAL`/`EAM` sont des
épreuves **anticipées** (profil `PREMIERE`) et `EDS1/EDS2/PHILOSOPHIE/GRAND_ORAL` sont des épreuves
**terminales** (profil `TERMINALE`) — un seul profil ne peut structurellement pas être les deux à la
fois (`level` est `PREMIERE` XOR `TERMINALE`). Ce n'est pas un défaut : c'est la même distinction déjà
actée dans `docs/candidat-individuel/v1-recette-protocol.md` (R1a/R1b, depuis T5A). R1 a donc été exécuté
comme deux parcours complets et réels (R1a PREMIERE, R1b TERMINALE), chacun couvrant intégralement son
sous-ensemble du cœur V1, tous deux dans `R1-standard/`.

## Limite technique connue (captures PDF page 1)

`R*-07-pdf-page-1.png` / `R2-05-pdf.png` n'ont pas pu être générés : le rendu PDF intégré de Chromium
(PDFium) n'a pas produit de rendu exploitable dans cet environnement headless conteneurisé (data: URL).
Le PDF réel (`R*-pdf-original.pdf`) est fourni intégralement dans chaque dossier — ouvrable directement
pour l'inspection humaine — ainsi que son texte extrait via `pdftotext` dans `technical/`.

## Sécurité des artefacts (§5)

Aucun raw token n'apparaît dans ce pack — vérifié par recherche automatique (`grep` motif hex 40+
caractères et `familyUrl`/`/devis/`) sur tous les fichiers JSON/Markdown avant livraison : zéro
occurrence. Les captures d'écran montrant le lien famille (`*-redacted.png`) ont le champ URL
explicitement masqué (`[REDACTED-TOKEN]`) avant capture — jamais après. Le lien complet n'a été utilisé
qu'en mémoire, côté navigateur, pour la navigation réelle prouvant le cycle de vie du lien (émission,
consultation, renouvellement, révocation de l'ancien lien).
