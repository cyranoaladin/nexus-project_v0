# Runbook opérateur — Démonstrateur UTICA 2026

Ce document s'adresse à toute personne présentant le démonstrateur sur le
stand Nexus Réussite, développeur ou non. Aucune connaissance technique
n'est nécessaire pour l'utiliser au quotidien.

Le démonstrateur montre le parcours fictif de **Lina B.**, candidate
individuelle au Bac général, session 2027 — toutes les données sont
inventées, aucune n'est réelle.

---

## Avant le salon

### 1. Démarrer l'ordinateur et préparer l'application

Sur le poste de présentation, ouvrir un terminal dans le dossier du projet
et exécuter, dans l'ordre :

```bash
npm run build
npm run demo:utica
```

- La première commande prépare l'application (à faire une seule fois, ou
  après une mise à jour du code — compte quelques minutes).
- La seconde démarre le démonstrateur et affiche l'adresse à utiliser,
  par exemple :

  ```
  Démonstrateur UTICA 2026 — démarrage local
    URL : http://127.0.0.1:3000/demo/utica-2026
  ```

- **Laisser cette fenêtre de terminal ouverte** pendant toute la durée du
  salon — c'est elle qui fait tourner le démonstrateur.

### 2. Ouvrir le navigateur

Ouvrir un navigateur (Chrome, Firefox…) et se rendre sur l'URL affichée
(`http://127.0.0.1:3000/demo/utica-2026`).

- La page d'accueil doit apparaître, logo Nexus Réussite en en-tête, avec
  4 cartes : **Espace Parent**, **Espace Élève**, **ARIA**, **Vue 360°**.
- Aucun badge « démo » n'est affiché en permanence — c'est volontaire (le
  visiteur doit percevoir un vrai espace produit). La mention discrète sur
  la nature des données affichées reste accessible via le menu **Options**
  (icône engrenage, en haut à droite) → **« À propos des données
  affichées »**, à qui souhaite la consulter.
- **Vérifier que le zoom du navigateur est à 100 %** avant l'ouverture du
  stand (`Ctrl+0` sous Chrome/Firefox). Un zoom non standard n'est pas un
  défaut de l'application — mesuré et prouvé sans anomalie à 1366×768 et
  1920×1080 — mais reste la cause la plus probable d'un rendu qui
  paraîtrait anormalement petit.

### 3. Passer en plein écran / mode kiosque

**Option simple** — F11 (ou l'équivalent du navigateur) pour passer en
plein écran classique. Suffisant dans la plupart des cas.

**Option kiosque** (recommandée pour le stand, si Chrome/Chromium est
installé sur le poste) — lance le navigateur directement en plein écran,
sans onglets ni barre d'adresse visibles, uniquement avec des options
standards du navigateur (aucun mécanisme web ajouté) :

```bash
google-chrome --kiosk "http://127.0.0.1:3000/demo/utica-2026"
# ou, selon le navigateur installé :
chromium --kiosk "http://127.0.0.1:3000/demo/utica-2026"
```

Pour quitter le mode kiosque : **Alt+F4** (ou fermer le processus depuis un
terminal).

### 4. Vérifier le réseau

Le démonstrateur fonctionne **sans connexion Internet** pour tout son
contenu essentiel (voir « Que faire si Internet tombe » ci-dessous). Il
n'est donc pas nécessaire de dépendre du Wi-Fi du salon, mais vérifier que
l'ordinateur reste alimenté et que l'écran ne se met pas en veille.

### 5. Test rapide des cinq écrans

Avant l'ouverture du salon, cliquer une fois sur chacune des 4 cartes de
l'accueil (Parent, Élève, ARIA, Vue 360°), vérifier que chaque page
s'affiche correctement, puis revenir à l'accueil (bouton **Accueil** en
haut, ou lien du logo).

---

## Pendant le salon

### Retour à l'accueil

À tout moment, cliquer sur **« Accueil »** (menu du haut) ou sur le logo
**« Nexus Réussite »** ramène à la page d'accueil du démonstrateur.

### Réinitialiser entre deux visiteurs

- **Desktop** : menu **Options** (icône engrenage, en haut à droite) →
  **« Réinitialiser l'espace »**.
- **Mobile / petit écran** : menu ☰ (en haut à droite) → bouton
  **« Réinitialiser l'espace »**, directement visible dans le panneau.

Ramène instantanément à l'accueil et efface tout état local (aperçus
ouverts, etc.) — rien n'est jamais écrit ni envoyé nulle part.

### Réinitialisation automatique

Si l'écran reste inactif environ **5 minutes** (aucun clic, mouvement de
souris, touche ou geste tactile), le démonstrateur revient automatiquement
à l'accueil. C'est normal — il suffit de recliquer sur une carte pour
reprendre la présentation. Cela ne se déclenche jamais pendant une
présentation active (la moindre interaction réinitialise le délai).

### Que faire si Internet tombe

Rien de spécial : le contenu essentiel du démonstrateur (les 5 écrans,
toute la navigation, tous les CTA) fonctionne sans aucune requête externe
critique. Seul un petit script de mesure d'audience (invisible pour le
visiteur) peut échouer silencieusement — cela n'a aucun impact sur ce qui
est présenté.

### Que faire si le navigateur est fermé par erreur

Rouvrir le navigateur et retourner sur `http://127.0.0.1:3000/demo/utica-2026`
(à noter sur un post-it près du poste, ou en favori navigateur).

### Que faire si une page semble cassée

1. Menu **Options** (ou ☰ sur mobile) → **« Réinitialiser l'espace »**.
2. Si le problème persiste, recharger la page (F5).
3. Si le problème persiste encore, voir « Comment relancer localement »
   ci-dessous.

### Comment relancer localement

Dans le terminal qui fait tourner le démonstrateur :

1. Appuyer sur **Ctrl+C** pour l'arrêter.
2. Relancer `npm run demo:utica`.
3. Si le terminal a été fermé par erreur et qu'un ancien processus semble
   encore actif (l'URL répond mais plus aucun terminal ne le contrôle) :
   ```bash
   pkill -f "standalone/server.js"
   npm run demo:utica
   ```

---

## Fin de journée

1. Dans le terminal du démonstrateur : **Ctrl+C** pour l'arrêter.
2. Fermer le navigateur.
3. Décision opérateur : le démonstrateur n'est accessible que sur ce poste
   local — aucune désactivation supplémentaire n'est nécessaire tant qu'il
   n'a pas été rendu accessible publiquement (voir section Urgence pour la
   procédure si une exposition publique a été décidée séparément).

---

## Urgence

### Désactiver immédiatement le démonstrateur

Le démonstrateur est **désactivé par défaut** (variable
`UTICA_DEMO_ENABLED`). En local, il suffit d'arrêter le terminal
(**Ctrl+C**) — le démonstrateur redevient alors totalement inaccessible.

Si le démonstrateur a été exposé publiquement (décision distincte, hors
salon — voir le rapport de déploiement), sa désactivation se fait en
retirant/mettant à `false` cette même variable sur l'environnement
concerné, puis en redémarrant l'application via le mécanisme habituel de
cet environnement.

### Contact / process interne

Se référer au responsable technique désigné par Nexus Réussite pour toute
question dépassant ce document.

### Rollback technique

Aucune modification de production n'est requise pour l'usage local salon
décrit ci-dessus (le démonstrateur ne tourne que sur le poste de
présentation). Si une exposition publique a été décidée séparément, la
procédure de rollback est celle du dépôt (`README.md` §16 — modèle
release-dir + symlink, désactivation du flag en priorité, retour à la
release précédente sinon).

---

## Script de démonstration — 2 minutes

**0:00–0:20 — Accueil.** « Nexus Réussite ne propose pas seulement des
cours. Nous pilotons tout le parcours du candidat individuel. » Montrer les
4 cartes : Parent / Élève / ARIA / Vue 360°.

**0:20–0:45 — Parent.** Montrer *Cette semaine*, le point d'attention, le
dossier administratif. « Le parent voit immédiatement où en est son
enfant, les échéances et ce qui demande notre attention. »

**0:45–1:05 — Élève.** Montrer *À faire maintenant*, la compétence
concernée, la ressource associée. « L'élève sait ce qu'il doit faire
maintenant et pourquoi. »

**1:05–1:25 — ARIA.** Montrer l'objectif, la preuve utilisée, l'étape
suivante. « Entre deux séances avec ses enseignants, le travail autonome
reste structuré. » (Ne jamais présenter une capacité scénarisée comme un
moteur algorithmique réel.)

**1:25–2:00 — Vue 360°.** Montrer priorité, organisation, administratif,
autonomie, Nexus Pulse. Conclusion : « Parent, élève, enseignants,
administratif et travail autonome reposent sur un seul parcours
coordonné. »

## Script de démonstration — 5 minutes

Même fil que la version 2 minutes, approfondi :

1. Accueil ;
2. Parent (fold complet) ;
3. Carte Bac candidate-spécifique (« Ma carte du Bac 2027 ») ;
4. Dossier candidat ;
5. Planning de la semaine ;
6. Élève (fold complet) ;
7. Ma maîtrise — compétences ;
8. Mes preuves de progression ;
9. Mes ressources ;
10. ARIA (objectif, preuve, cycle) ;
11. Vue 360° ;
12. Nexus Pulse et prochaine action Nexus.

Fil conducteur à toujours reformuler, jamais une liste de fonctionnalités :
**difficulté identifiée → action élève → autonomie → reprise Nexus →
visibilité parent.**

---

## Rappel — ce que ce démonstrateur n'est pas

- Aucune donnée réelle, aucun compte réel, aucun paiement.
- Aucune information n'est jamais envoyée à un serveur externe.
- Les capacités présentées comme scénarisées (ARIA notamment) sont des
  illustrations, jamais un moteur réel en fonctionnement.
