# Audit et journal des modifications — Nexus Planning Studio 2026-2027

Date : 3 septembre 2026.

## 1. État initial

Le dossier contenait trois fichiers :

| Fichier | Contenu |
|---|---|
| `index(20260903-131635).html` | page HTML du prototype (7,6 Ko) |
| `README(20260903-131640).md` | README du prototype |
| `planning.default.json` | données du planning (45 séances, 10 enseignants, 3 salles, 14 matières) |

Architecture observée : la page référençait `assets/styles.css`, `assets/app.js` et `data/default-data.js`. **Aucun de ces fichiers n'existait.** Le README citait également `serve.py` et `data/planning.schema.json`, absents. Ouvert en `file://`, le prototype affichait une page brute sans style et sans aucun comportement : aucune fonctionnalité n'était opérationnelle.

Le modèle de données v1 était plat : chaque séance référençait l'enseignant par son code (`"teacher": "M1"`), la salle par `S1`, la matière par son id, et le groupe par une chaîne libre (`"group": "T-SCO-A"`). L'identifiant d'un enseignant était son code : renommer le code aurait cassé toutes les références. Aucune notion de groupe, de parcours Maths A/B, de disponibilité, de paramètres ni de version de schéma.

## 2. Défauts constatés

1. Application non fonctionnelle (fichiers CSS/JS manquants), noms de fichiers horodatés au lieu de `index.html`.
2. Identifiant d'enseignant confondu avec son code affiché (renommage destructeur).
3. Groupes réduits à des chaînes libres, parcours Maths A/B encodé dans le suffixe du nom de groupe.
4. Champ `exceptional` dupliqué sur la séance alors que la salle porte déjà cette information.
5. Aucun schéma, aucune version de données, aucune migration.
6. Couleurs de matières Tailwind par défaut, peu adaptées à l'identité Nexus et à l'impression.
7. Données pédagogiques cohérentes : aucun conflit enseignant/salle/groupe dans les 45 séances. Deux points d'attention réels, désormais signalés par le diagnostic : attente de 2 h 30 du groupe Troisième le mercredi (l'étude encadrée prévue en Salle 3 est désactivée) et amplitude de 12 h 15 de l'enseignante Français/Philosophie le samedi et le dimanche.

## 3. Décisions techniques

- **Architecture** : HTML + CSS + JavaScript vanilla, scripts classiques partageant l'espace de noms `window.Nexus` (les modules ES sont bloqués en `file://` par Chrome). Sept fichiers JS de responsabilité distincte (`core`, `model`, `validation`, `storage`, `ui-grid`, `ui-panels`, `app`).
- **Données** : schéma v2 normalisé (enseignants, salles, matières, groupes, séances, paramètres). Les séances référencent par identifiant stable (`teacherId`, `roomId`, `subjectId`, `groupId`). Les enseignants ont `id` + `code` + `name` séparés. Les groupes portent `level`, `audience` et `variant` (A/B). Migration automatique v1 → v2 à l'import et au chargement.
- **Chargement `file://`** : `data/default-data.js` (généré depuis `data/planning.default.json` par `tests/build-default-data.mjs`) est chargé en fallback, `fetch()` n'étant pas fiable en `file://`.
- **Moteur de validation centralisé** (`validation.js`) : règles C1 à C9 + règles de confort, trois niveaux (erreur, avertissement, conseil), index par séance, aperçu des conflits d'un candidat (édition et glisser-déposer).
- **État unique** dans `app.js` ; le DOM est une projection. Toute mutation passe par `commit()` : snapshot pour l'historique, normalisation, validation, sauvegarde locale, rendu.
- **Sécurité** : aucun `innerHTML` dynamique, tout le DOM est construit via `textContent` / `createElement` (`h()`), pas d'`eval`, imports JSON parsés et contrôlés structurellement avant confirmation.
- **Grille** : cartes positionnées proportionnellement (pas de 15 min), répartition automatique en colonnes des séances qui se chevauchent, lanes fixes par salle ou par public selon la vue. Paliers de densité des cartes par container queries CSS.
- **Glisser-déposer** : pointer events souris/stylet avec aperçu de destination et conflits en direct ; le dépôt est toujours permis, le conflit est signalé immédiatement (comportement prévisible, annulable). Pas de glisser-déposer tactile (formulaire + suggestions de créneaux à la place).
- **Choix documentés sur les données** : les 45 séances sont conservées à l'identique (jour, heures, niveau, public, matière, groupe, enseignant, salle, statut, intitulé, notes). Seuls les identifiants techniques ont été renommés (`M1` → `teacher-m1`, `S1` → `room-1`), les couleurs de matières ajustées à la palette Nexus, et les groupes explicités (libellés, parcours A/B). Le planning v1 d'origine est conservé dans `data/legacy/`.

## 4. Fonctionnalités livrées

- Vues : semaine, enseignant (bannière de charge + indisponibilités hachurées), salles (lanes Salle 1 / Salle 2 / Salle 3), public (scolarisés / candidats individuels), niveau, liste.
- Filtres : public, niveau, matière, enseignant, salle, jour, conflits seulement, inactives ; densité confort/compact ; panneau latéral repliable ; vue journée sur mobile.
- Édition de séance (panneau latéral) avec aperçu des conflits avant application, suggestions de créneaux disponibles, diagnostic de la séance.
- Glisser-déposer (15 min), interchange de deux séances (Ctrl + clic ou bouton), ajout, duplication, désactivation, suppression avec confirmation.
- Configuration : enseignants (code, nom, matières, couleur, indisponibilités, actif, suppression avec réaffectation), salles (capacité, exceptionnelle, active), matières (ajout libre, couleur, abrégé, niveaux), groupes (niveau, public, parcours A/B), paramètres du centre (plage horaire, seuils de salles, seuils d'attente, pause).
- Diagnostic : résumé par gravité, liste cliquable mettant en évidence les séances, filtre « conflits ». Charge : tableau de bord, charge par enseignant (heures, séances, jours, temps morts), occupation des salles, heures par groupe.
- Persistance locale versionnée avec récupération d'une sauvegarde corrompue ; annuler/rétablir (80 opérations) avec raccourcis ; import JSON contrôlé (v1 et v2) ; export JSON et CSV (UTF-8 BOM, `;`) ; impression A4 paysage ; réinitialisation au planning initial.
- Accessibilité : labels, focus visible, `aria-pressed`/`aria-selected`, cartes activables au clavier, conflits signalés par symbole et non seulement par couleur, `prefers-reduced-motion`.

## 5. Tests effectués

### Unitaires (Node 22, sans dépendance)

```
node tests/unit.test.mjs
31 réussis, 0 échoués
```

Couvrent : préservation des 45 séances et migration v1 → v2, temps invalides (vide, `25:99`, fin avant début, durée nulle), séances consécutives vs chevauchement de 15 min, séance inactive, conflits enseignant/salle/groupe, 3 puis 4 cours simultanés, compétences, indisponibilités, références supprimées, ID dupliqué, règles pédagogiques, attentes, aperçu de conflits, imports corrompus/anciens, normalisation de données partielles, export JSON réimportable, CSV, suggestions de créneaux, statistiques, échange, historique.

### Bout en bout (Playwright + Chromium, `file://index.html`)

```
python3 tests/e2e.py
48/48 tests réussis
```

Scénarios A à T de la mission : chargement en `file://` sans erreur console, 44 cartes visibles, renommage d'enseignant propagé, glisser-déposer, conflit enseignant, conflit de salle (aperçu avant application puis carte marquée), interchange, annuler/rétablir (boutons et clavier), persistance après rechargement, export JSON puis réimport identique, import v1, import corrompu refusé, export CSV, filtres Terminale et candidats individuels, Salle 3 signalée, 4 cours simultanés bloquants, filtre conflits, diagnostic cliquable, cinq vues, ajout/duplication/désactivation/suppression, suppression d'enseignant référencé, feuille de style d'impression, tablette (tiroir), mobile (vue journée, pas de défilement horizontal), largeur 1152 px (zoom 125 %), `localStorage` corrompu.

### Performance et navigateurs

Avec 500 séances injectées (Chromium, poste de développement) : validation complète 23 ms, rendu complet 28 ms, opération complète (historique + validation + sauvegarde + rendu) 65 ms. Chargement en `file://` vérifié sans erreur dans Chromium, Firefox et WebKit (Playwright), container queries actives dans les trois.

### Inspection visuelle

Captures à 1440, 1366, 1152, 1024 et 390 px, PDF A4 paysage. Corrections apportées après inspection : seuils de densité des cartes (container queries mesurant la boîte de contenu), barre d'outils sur deux rangées maîtrisées, bannière d'échange dans la zone planning, étiquettes d'heures à l'impression, onglets de la modale non compressibles, marque masquée sur mobile, filtres repliables sur mobile.

## 6. Limitations résiduelles

- Pas de glisser-déposer tactile (déplacement par formulaire ou suggestions de créneaux).
- La sauvegarde locale est propre au navigateur et au poste : l'export JSON reste la sauvegarde de référence.
- Les niveaux (4e à Terminale) et les jours sont des constantes de l'application ; enseignants, salles, matières et groupes sont entièrement configurables.
- Les container queries CSS nécessitent un navigateur de 2023 ou plus récent (Chrome 105+, Firefox 110+, Safari 16+) ; sur un navigateur plus ancien, les cartes affichent la version longue des libellés sans adaptation.
