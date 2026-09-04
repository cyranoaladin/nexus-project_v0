# Nexus Planning Studio — 2026-2027

Planificateur pédagogique hebdomadaire de **Nexus Réussite** : cours collectifs pour élèves scolarisés et candidats individuels au baccalauréat français.

Application locale et autonome : aucun serveur, aucune installation, aucune connexion Internet.

---

## Utilisation

### Démarrage

Double-cliquer sur **`index.html`**.

Le planificateur s'ouvre dans le navigateur (Chrome, Edge, Firefox ou Safari récents). Le planning initial 2026-2027 est chargé automatiquement ; vos modifications sont ensuite sauvegardées dans le navigateur.

### Lire le planning

- **Semaine** : jours en colonnes, heures en lignes ; chaque carte est une séance (matière, niveau, horaire, enseignant, salle).
- Badge **SCO** = élèves scolarisés ; badge **CL** et bord double = candidats individuels.
- **Maths A** = parcours Maths → NSI ; **Maths B** = parcours Maths → Physique-Chimie.
- Une carte à bord rouge avec « ! » est en **conflit bloquant** ; un triangle orange signale un **avertissement**.
- Autres vues (sélecteur « Vue ») : **Enseignant** (charge et créneaux d'un professeur), **Salles** (une colonne par salle), **Public** (scolarisés / candidats individuels côte à côte), **Niveau**, **Liste** (tableau).
- Filtres : public, niveau, matière, enseignant, salle, jour, « Conflits » (seulement les séances problématiques), « Inactives ».
- **Confort / Compact** : densité d'affichage. Le bouton **Panneau** masque ou affiche le panneau latéral.

### Modifier une séance

1. Cliquer sur la carte : le panneau **Séance** s'ouvre à droite.
2. Modifier jour, heures, niveau, public, matière, groupe, enseignant, salle, notes, statut actif.
3. Le panneau indique **avant application** si le changement crée un conflit.
4. Cliquer sur **Appliquer**.

Le bloc **Créneaux disponibles** propose des créneaux standards libres pour l'enseignant, le groupe et une salle normale : un clic déplace la séance.

### Déplacer une séance

Glisser la carte vers un autre jour ou une autre heure (pas de 15 minutes). Pendant le glissement, la destination s'affiche et se colore en rouge ou orange si un conflit apparaît. Dans la vue **Salles**, déposer dans une autre colonne change aussi la salle.

Sur tablette et téléphone, utiliser le formulaire de la séance (pas de glisser-déposer tactile).

### Interchanger deux séances

1. Cliquer sur la première séance, puis **Ctrl + clic** sur la seconde (ou bouton **Interchanger avec…** dans le panneau, puis clic sur la seconde).
2. Une bannière récapitule les deux séances : cliquer **Interchanger les créneaux**.

Seuls jour, horaire et salle sont échangés ; matière, groupe et enseignant restent inchangés. Les conflits sont recalculés immédiatement.

### Ajouter, dupliquer, désactiver, supprimer

- **+ Séance** (barre supérieure) crée une séance sur le premier créneau standard libre.
- **Dupliquer** copie la séance (utile pour un second groupe).
- **Désactiver** conserve la séance sans qu'elle occupe salle ni enseignant ; elle reste visible avec le filtre « Inactives » et peut être réactivée.
- **Supprimer** demande confirmation ; l'opération reste annulable (Ctrl+Z).

### Modifier un enseignant

**Configuration → Enseignants → Modifier**. Remplacer le nom (par exemple `M1` → `Alaeddine Ben Rhouma`) : toutes les séances affichent immédiatement le nouveau nom. On y définit aussi le code court, les matières enseignées (une séance hors compétences déclenche un avertissement), la couleur, les **indisponibilités** (bloquantes) et le statut actif.

La suppression d'un enseignant encore affecté propose de réaffecter ses séances à un autre.

### Gérer les salles

**Configuration → Salles**. Nom, capacité, statut actif et case **Salle exceptionnelle**. Le fonctionnement normal est de 2 salles simultanées : une troisième séance simultanée ou l'usage d'une salle exceptionnelle est autorisé mais signalé par un avertissement ; au-delà de 3 cours simultanés, c'est une erreur bloquante. Ces seuils se règlent dans **Paramètres**.

### Matières et groupes

**Configuration → Matières** : ajouter librement une matière (Maths expertes, Grand Oral…), sa couleur et son abrégé.
**Configuration → Groupes** : un groupe = niveau + public (+ parcours Maths A/B). Deux séances d'un même groupe ne peuvent pas être simultanées ; les temps d'attente d'un groupe entre deux cours sont calculés.

### Exporter

- **Exporter JSON** : sauvegarde complète (`nexus-planning-2026-2027-AAAA-MM-JJ.json`), réimportable.
- **Exporter CSV** : tableau plat pour Excel (UTF-8 avec accents, séparateur `;`).

### Importer

**Importer** → choisir un fichier JSON. Le fichier est contrôlé, un résumé s'affiche, puis le remplacement doit être confirmé. Les fichiers de l'ancien prototype (format v1) sont convertis automatiquement. Un fichier invalide est refusé avec l'explication.

### Réinitialiser

**Réinitialiser** restaure le planning initial livré avec l'application (après confirmation). L'opération reste annulable tant que la page n'est pas rechargée.

### Imprimer

**Imprimer / PDF** ouvre la boîte d'impression du navigateur (choisir « Enregistrer au format PDF » pour un PDF). Format A4 paysage ; les boutons et panneaux sont retirés, le titre, la date, le planning et la légende sont conservés. La vue et les filtres actifs sont imprimés tels quels (par exemple un seul enseignant).

### Annuler / Rétablir

Boutons **Annuler** / **Rétablir** ou `Ctrl+Z` / `Ctrl+Shift+Z`. `Échap` ferme les fenêtres, annule un échange en cours ou efface une mise en évidence.

---

## Signification des alertes

| Niveau | Exemples | Effet |
|---|---|---|
| **Erreur bloquante** (rouge) | même enseignant sur deux séances simultanées ; même salle occupée deux fois ; même groupe en deux cours ; fin avant début ; plus de 3 cours simultanés ; enseignant, salle ou matière supprimés ; enseignant indisponible | à corriger avant de valider le planning |
| **Avertissement** (orange) | 3 cours simultanés ; salle exceptionnelle utilisée ; matière hors compétences ; collège hors mercredi après-midi ; Seconde hors mercredi ; cours tardif ; attente d'un groupe > 90 min ; amplitude > 10 h | permis, mais à vérifier |
| **Conseil** (bleu) | attente entre 45 et 90 min ; groupe non affecté ; enseignant sans séance ; séances désactivées | information |

Le panneau **Diagnostic** liste toutes les anomalies ; cliquer sur l'une d'elles met en évidence les séances concernées. Le panneau **Charge** donne le tableau de bord, la charge de chaque enseignant, l'occupation des salles et les heures par groupe.

---

## Sauvegarde

Les modifications sont enregistrées automatiquement dans le navigateur (`localStorage`) et retrouvées à la prochaine ouverture sur le même ordinateur et le même navigateur. Pour conserver une version datée ou passer sur un autre poste : **Exporter JSON**, puis **Importer**.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | point d'entrée |
| `assets/styles.css` | mise en page, thème Nexus, impression, responsive |
| `assets/core.js` | constantes métier, utilitaires temps/DOM |
| `assets/model.js` | modèle de données v2, normalisation, migration v1, exports, suggestions |
| `assets/validation.js` | moteur de diagnostic (conflits, règles pédagogiques, confort) |
| `assets/storage.js` | sauvegarde locale, historique annuler/rétablir |
| `assets/ui-grid.js` | grille hebdomadaire, vue liste, glisser-déposer |
| `assets/ui-panels.js` | éditeur, diagnostic, charge, configuration, modales, notifications |
| `assets/app.js` | état, actions, orchestration |
| `data/default-data.js` | planning initial (chargé en `file://`) |
| `data/planning.default.json` | même planning au format JSON importable |
| `data/planning.schema.json` | schéma du format |
| `data/legacy/` | planning v1 d'origine |
| `docs/AUDIT_AND_CHANGELOG.md` | audit du prototype, décisions, tests |
| `tests/` | tests unitaires (`node tests/unit.test.mjs`) et de bout en bout (`python3 tests/e2e.py`) |

Pour modifier le planning initial livré : éditer `data/planning.default.json` puis exécuter `node tests/build-default-data.mjs` (régénère `data/default-data.js`).

## Version en ligne (planning partagé)

L'outil est intégré au site Nexus Réussite à l'adresse `/planning`, réservée au personnel connecté. Dans cette version, **le planning est partagé** : il est enregistré sur le serveur Nexus, tout le monde voit la même version, et chaque enregistrement crée une révision datée et signée.

- **Direction (ADMIN)** : lecture, modification, import, historique, restauration, réinitialisation.
- **Assistante** : lecture, modification, import.
- **Enseignants (COACH)** : lecture seule (filtres, vues, impression, export).

Enregistrement : automatique 1,5 s après une modification, ou bouton **Enregistrer** (`Ctrl+S`). L'état s'affiche en haut : *Enregistré · rév. N*, *Modifications non enregistrées*, *Enregistrement…*, *Conflit de version*, *Non enregistré : conflits bloquants*, *Erreur d'enregistrement*.

- Un planning contenant un **conflit bloquant** (rouge) n'est pas accepté par le serveur : corrigez-le, le brouillon reste conservé dans le navigateur.
- **Conflit de version** : quelqu'un a enregistré entre-temps. Rechargez la version actuelle (bouton proposé) puis rejouez vos changements ; le brouillon peut être exporté en JSON pour comparaison. Aucune modification n'écrase silencieusement celle d'un autre.
- **Actualiser** recharge la dernière révision ; une version plus récente est aussi détectée automatiquement toutes les minutes.
- **Historique** (Configuration → Historique, direction) : liste des révisions avec date, auteur et résumé ; *Restaurer* crée une nouvelle révision, rien n'est effacé.

La source de l'outil est le dossier `tools/planning-studio` du dépôt du site ; `public/planning` en est généré (`npm run planning:build`). Le fichier `data/planning.default.json` n'est plus qu'un planning de démarrage : après la première ouverture, le serveur fait foi.
