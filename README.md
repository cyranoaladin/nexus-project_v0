# Bienvenue sur le Projet Nexus Réussite

**Auteur :** Alaeddine BEN RHOUMA
**Objet :** Guide Complet pour le Développement de la Plateforme Nexus Réussite

---

## 1. Notre Vision : Au-delà du Site Web, une Expérience

Bonjour l'équipe, et bienvenue dans ce projet passionnant.

Notre objectif est de construire la **plateforme de référence pour l'excellence éducative en Tunisie**. Nous ne visons pas un simple site web, mais une expérience utilisateur si fluide, professionnelle et rassurante qu'elle devient un argument de vente à elle seule. Chaque interaction, chaque animation, chaque pixel doit refléter la qualité premium et l'innovation de notre approche pour créer un **effet "WOW"**.

### Directive Impérative : Zéro Coquille Vide

Ce projet est une commande pour une **application web de production, 100% fonctionnelle**. Chaque fonctionnalité, chaque logique métier et chaque interaction décrite dans notre documentation doit être **réellement codée, implémentée et opérationnelle**. Le livrable final doit être une plateforme prête à accueillir et à servir de vrais clients.

---

## 2. Votre Source Unique de Vérité : Le Dossier `/feuille_route`

L'intégralité de la vision du projet, de la stratégie business à la charte de design, a été méticuleusement documentée. Avant d'écrire la moindre ligne de code, veuillez prendre connaissance de l'ensemble des documents présents dans le dossier `/feuille_route` à la racine de ce projet.

**Considérez ce dossier comme la "Constitution" du projet.** Chaque décision de développement doit être alignée avec les spécifications qu'il contient.

* **`Cahier des Charges Global & Technique.md`** : La vision d'ensemble et la stack technique.
* **`Logique Metier_Business Model.md`** : Les règles complexes des abonnements, crédits et paiements. **Lecture capitale.**
* **`Systeme_de_Design_Exp_Utilisa.md`** : Le look & feel, les animations et la charte graphique.
* **`Specifications-Fonctionnelles-par-Role.md`** : Le détail des dashboards et des permissions.
* **`Profils_Equipe_Gamification.md`** : Le contenu brut pour la page Équipe et la logique de gamification.

---

## 3. Démarrage Rapide de l'Environnement de Développement Local

Ce projet est configuré pour un développement local robuste et cohérent via **Docker** et **Docker Compose**.

### Pré-requis

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et en cours d'exécution sur votre machine.
* Avoir `npm` comme gestionnaire de paquets par défaut.

### Étapes de Lancement

1. **Créez vos Variables d'Environnement Locales :**
   * Créez une copie du fichier `.env.local.example` (s'il existe) ou créez un nouveau fichier nommé `.env.local` à la racine du projet.
   * Remplissez ce fichier avec vos clés d'API de **TEST**, vos mots de passe de base de données locale, etc. Ce fichier est ignoré par Git et ne doit jamais être partagé.
2. **Lancez les Conteneurs Docker :**
   * Ouvrez un terminal à la racine du projet et exécutez la commande suivante :

     ```bash
     docker compose up --build -d
     ```

   * Cette commande va construire l'image de l'application Next.js et démarrer un conteneur de base de données PostgreSQL en arrière-plan.
3. **Appliquez les Migrations de la Base de Données :**
   * Une fois les conteneurs lancés, exécutez cette commande pour créer les tables dans votre base de données locale en fonction du schéma Prisma :

     ```bash
     npx prisma migrate dev
     ```

4. **Accédez à l'Application :**
   * Ouvrez votre navigateur et allez sur [**http://localhost:3000**](http://localhost:3000). Vous devriez voir la page d'accueil de l'application. La page se mettra à jour automatiquement à chaque modification du code.

---

## 4. Lignes Directrices Techniques & Attentes

* **Stack Technique :** Le projet est solidement ancré sur **Next.js 14 (App Router), TypeScript, et Tailwind CSS**. Merci de respecter cette stack.
* **Qualité du Code :** Nous attendons un code propre, bien structuré, commenté si nécessaire, et suivant les meilleures pratiques de l'écosystème React/Next.js. La maintenabilité est une priorité.
* **Animations & Micro-interactions :** L'utilisation de **Framer Motion** est fortement encouragée pour créer les effets décrits dans la charte de design.
* **Ressources Graphiques :** Les assets (logos, mascotte) sont disponibles dans `/public/images/`. Veuillez les intégrer de manière optimisée via le composant `<Image>` de Next.js.

---

Nous sommes convaincus que vous avez le talent et l'expertise pour transformer cette vision en une réalité exceptionnelle. Nous restons à votre disposition pour toute clarification, mais les documents du dossier `/feuille_route` doivent rester votre référence principale.

Construisons ensemble une plateforme dont nous serons fiers.

---

## Contenus RAG (Ingestion de documents Markdown)

Une interface d’ingestion est disponible pour les rôles `ADMIN`, `ASSISTANTE` et `COACH` via la page `/dashboard/admin/rag-management` (liens accessibles depuis leurs tableaux de bord). Les fichiers Markdown doivent contenir un front‑matter YAML en tête.

Vous pouvez déposer vos sources dans un dossier local `rag_sources/` à la racine (créez‑le si absent) puis les ouvrir via l’interface.

Exemple de fichier:

```md
---
titre: "Dérivées – rappels essentiels"
matiere: "MATHEMATIQUES"
niveau: "Première"
mots_cles: ["dérivée", "tangente", "limite"]
---

Contenu principal en Markdown…
```
