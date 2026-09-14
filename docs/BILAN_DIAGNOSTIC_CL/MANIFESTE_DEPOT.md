# Diagnostics Nexus Réussite — diagnostics-v2

*Manifeste produit le 2026-09-14 par `scripts/release.py` depuis le dépôt, au-delà du commit `bc787ebb610b`.*

Aucun état n'est recopié : chaque champ de ce manifeste est calculé depuis les fichiers du dépôt au moment du build.

« commit_precedent » est le dernier commit au moment du build. Le manifeste ne peut pas nommer le commit qui le contient — il est écrit avant lui. Ce qui fait foi n'est donc pas ce SHA mais les empreintes ci-dessous : elles décrivent exactement les fichiers mesurés, et se recalculent.

Toute métadonnée créée par cette release porte la date de l'horloge, 2026-09-11. Des occurrences de « 2026-09-12 » subsistent : elles étaient déjà enregistrées au commit de départ et appartiennent à la passe précédente, qui avait daté son travail du lendemain. Une décision déjà enregistrée ne se réécrit pas ; elle se classe. Le classement est recalculé par scripts/dates_anterieures.py et reporté ci-dessous.

## Critère de fin

| Compteur | Valeur |
|---|---|
| `INSTRUMENTS_METIER` | 20 |
| `DIFFUSABLES` | 20 |
| `NON_DIFFUSABLES` | 0 |
| `PLACEHOLDERS_INSTRUMENTS` | 0 |
| `VALIDATION_ERRORS` | 0 |
| `PDF_PREFLIGHT_ERRORS` | 0 |
| `MISSING_RENDERS` | 0 |
| `SOURCE_TEXT_HASH_COLLISIONS` | 0 |
| `CANDIDATE_CORRECTION_LEAKS` | 0 |
| `PDF_PREFLIGHT_ERRORS_DISTRIBUTION` | 0 |
| `PROFILE_COMBINATIONS` | 118 |
| `ACTIVE_CANDIDATES` | 0 |
| `UNEXPECTED_DUPLICATE` | 0 |
| `VERSION_COLLISION` | 0 |
| `PROFILE_PACKS_INCOMPLETS` | 0 |
| `CANDIDATES_WITH_MISSING_REQUIRED_TESTS` | 0 |
| `UNEXPLAINED_FUTURE_DATES` | 0 |

**Résultat : 20/20 diffusables — conforme.**

## Instruments

| Instrument | Versions | Profils | Durée | Items | État | Textes sources |
|---|---|---|---|---|---|---|
| **EDS-HGGSP** | N1, NT | P1/P2/P3 | 75, 90 min | 24, 31 | diffusable | — |
| **EDS-HLP** | N1, NT | P1/P2/P3 | 75, 90 min | 21, 28 | diffusable | montaigne |
| **EDS-MATH** | N1, NT | P1/P2/P3 | 75, 90 min | 33, 44 | diffusable | — |
| **EDS-NSI** | N1, NT | P1/P2/P3 | 75, 90 min | 30, 33 | diffusable | — |
| **EDS-PC** | N1, NT | P1/P2/P3 | 75, 90 min | 28, 32 | diffusable | — |
| **EDS-SES** | N1, NT | P1/P2/P3 | 75, 90 min | 25, 26 | diffusable | — |
| **EDS-SVT** | N1, NT | P1/P2/P3 | 75, 90 min | 29, 33 | diffusable | — |
| **FR-EAF** | ecrit, ecrit_2028, oral, oral_2028, standard, standard_2028 | P1/P2/P3 | 80, 80, 50, 50, 90, 90 min | 34, 34, 29, 29, 42, 42 | diffusable | balzac, laboetie, zola |
| **FR-EAF-ORAL** | standard | P1/P2/P3 | 20 min | — | diffusable | moliere |
| **FR-MAI** | standard | P2/P3 | 60 min | 18 | diffusable | condorcet |
| **FR-POS** | standard | P1/P2/P3 | 45 min | 23 | diffusable | fr_pos_adolescents |
| **FR-POS-ORAL** | standard | P1/P2/P3 | 10 min | — | diffusable | — |
| **GO** | standard | P2/P3 | 15 min | — | diffusable | — |
| **MATH-EA** | SPE, SPECIFIQUES | P1/P2/P3 | 75, 75 min | 35, 36 | diffusable | — |
| **MET** | standard | P1/P2/P3 | 20 min | — | diffusable | — |
| **PHI** | standard | P2/P3 | 60 min | 23 | diffusable | descartes |
| **QP** | standard | P1/P2/P3 | 20 min | — | diffusable | — |
| **TC-EMC** | 1RE, ETENDUE, TLE | P1/P2/P3 | 20, 25, 20 min | —, —, — | diffusable | — |
| **TC-ES** | 1RE, ETENDUE, TLE | P1/P2/P3 | 40, 55, 40 min | 20, 30, 20 | diffusable | — |
| **TC-HG** | 1RE, ETENDUE, TLE | P1/P2/P3 | 45, 60, 45 min | 18, 23, 18 | diffusable | — |

## Textes sources

| Clé | Auteur, œuvre | Édition | Mots | Lignes PDF | Empreinte |
|---|---|---|---|---|---|
| `laboetie` | Étienne de La Boétie, *Discours de la servitude volontaire* | texte établi par Paul Bonnefon, Bossard, 1922 | 441 | 25 | `f9ed7f46d0b80368…` |
| `balzac` | Honoré de Balzac, *La Peau de chagrin* | Charpentier, libraire-éditeur, 1839 | 265 | 17 | `6612ede1f783dd48…` |
| `zola` | Émile Zola, *Pot-Bouille* | G. Charpentier, 1883 | 326 | 23 | `2a754febca37a8f7…` |
| `montaigne` | Michel de Montaigne, *Essais* | texte établi par l'abbé Musart, Périsse Frères, 1847 | 248 | 18 | `6370a293520f1cf5…` |
| `condorcet` | Condorcet, *Sur l'instruction publique* | Œuvres de Condorcet, Firmin Didot frères, 1847, tome 7 | 395 | 28 | `70f8a889ae61b432…` |
| `descartes` | René Descartes, *Discours de la méthode* | Œuvres de Descartes, publiées par Victor Cousin, Levrault, 1824, tome I | 322 | 20 | `830f04d104b5e4ac…` |
| `moliere` | Molière, *Le Misanthrope* | Œuvres complètes, texte établi par Charles Louandre, Charpentier, 1910, tome II | 82 | 12 | `3f29ae278b4b5452…` |
| `fr_pos_adolescents` | Enseignante de français Nexus Réussite, *Test de positionnement — Français scolaire* | Test_positionnement_source_enseignante.pdf, document de conception interne Nexus | 266 | 20 | `72624d2dcdc2842d…` |

Chaque texte provient d'une édition publique identifiée, confrontée à son fac-similé. Deux supports ne portent jamais le même passage : les empreintes ci-dessus sont deux à deux distinctes, et le build échoue si elles cessent de l'être.

## Empreintes des rendus

Le manifeste JSON porte, pour chaque version de chaque instrument, l'empreinte de sa banque, de son assemblage, de chacun de ses rendus et de chacun de ses PDF. Il fait foi ; ce document le résume.
