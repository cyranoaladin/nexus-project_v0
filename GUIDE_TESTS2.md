Voici le cahier des charges détaillé pour la mise en place d'une suite de tests exhaustive pour votre application Next.js, au format Markdown.

---

# Cahier des Charges Détaillé pour la Suite de Tests Applicative

**Document :** Spécifications des Tests V1.0
**Date :** 21 août 2025
**Auteur :** [Votre Nom/Équipe]

---

## 1. Introduction et Contexte

Ce document a pour objectif de définir les exigences détaillées pour une suite de tests complète et rigoureuse de l'application Next.js. Des observations récentes ont révélé un décalage significatif entre les rapports de tests automatisés (indiquant 100% de succès) et l'état fonctionnel et visuel réel de l'application.

Des problèmes critiques tels que des pages incomplètes, des données erronées (placeholders), des boutons non fonctionnels et des lacunes majeures dans l'implémentation de fonctionnalités clés (Agenda, interface ARIA) ont été identifiés manuellement. Ce cahier des charges vise à combler ces lacunes en spécifiant des tests qui valident non seulement la fonctionnalité de base, mais aussi la **complétude et l'exactitude des données**, la **cohérence visuelle**, l'**état interactif** des éléments UI, et la **synchronisation bidirectionnelle complète avec la base de données**.

## 2. Objectifs des Tests

L'objectif principal est de garantir la qualité logicielle de l'application en :

*   **Validant l'intégrité fonctionnelle :** S'assurer que toutes les fonctionnalités se comportent comme attendu selon les spécifications.
*   **Vérifiant la conformité des données :** Confirmer que l'interface utilisateur affiche des données réelles, complètes et cohérentes avec la base de données.
*   **Assurant l'interactivité UI :** Tester que tous les éléments interactifs (boutons, liens, formulaires) sont actifs, réactifs et déclenchent les actions appropriées.
*   **Garantissant la cohérence visuelle :** S'assurer que les éléments UI critiques (notamment l'interface ARIA) sont rendus conformément aux attentes, y compris la présence de tous les composants graphiques et fonctionnels.
*   **Confirmant la synchronisation DB :** Valider que les opérations de lecture, écriture, mise à jour et suppression via l'API se reflètent correctement dans la base de données.
*   **Prévenant les régressions :** Établir une base de tests robuste pour détecter rapidement les bugs introduits par de nouvelles modifications.
*   **Fournissant des rapports clairs :** Offrir une visibilité précise sur l'état de l'application, avec des détails exploitables en cas d'échec.

## 3. Stratégie de Test et Outils

La suite de tests sera construite sur les frameworks et bibliothèques existants, avec un focus sur une couverture approfondie pour chaque type de test :

*   **Tests Unitaires :** `Jest` (pour la logique TypeScript/Node, avec mocks pour Prisma/HTTP).
*   **Tests d'Intégration API :** `Jest` (pour les appels directs à la logique serveur et vérification DB).
*   **Tests End-to-End (E2E) :** `Playwright` (pour les tests de parcours utilisateur sur Chromium, Firefox, WebKit, en utilisant `playwright.config.ts`).
*   **Bibliothèques UI :** `React Testing Library` n'est pas utilisée de manière systématique, l'accent est mis sur Jest pour la logique et Playwright pour l'E2E.

## 4. Exigences Générales des Tests

### 4.1. Environnement de Test

*   Tous les tests E2E et les tests d'intégration API Jest doivent s'exécuter contre une **instance Docker de l'application (Next.js + PostgreSQL)** dédiée aux tests.
*   **Réinitialisation et Seeding de la Base de Données :** Avant chaque exécution de la suite E2E ou des tests d'intégration API, une réinitialisation complète de la base de données et un re-seeding des données de test sont **impératifs**. La séquence suivante doit être exécutée pour garantir un état de données connu et frais :
    ```bash
    dotenv -e .env.local -- npx prisma db push --force
    dotenv -e .env.local -- tsx prisma/seed.ts
    ```
    (Alternativement, la tâche Docker `db_setup` si elle assure cette réinitialisation pour la suite de tests).

### 4.2. Idempotence des Tests

*   Chaque test doit être **indépendant** et **reproductible**.
*   Les tests ne doivent pas dépendre de l'ordre d'exécution des autres tests.
*   Si des données sont créées ou modifiées pendant un test, un mécanisme de nettoyage (ou la réinitialisation de la DB avant chaque suite/fichier de test) doit garantir que l'environnement est propre pour le test suivant.

### 4.3. Rapports d'Erreurs Détaillés

En cas d'échec de test, les rapports doivent inclure toutes les informations nécessaires pour une reproduction et une correction rapides :

*   Le nom exact du test ayant échoué.
*   La localisation précise du fichier de test (`__tests__/**` ou `e2e/*.spec.ts`).
*   Un message d'erreur clair, concis et descriptif.
*   **Pour les tests Playwright E2E :**
    *   Une **capture d'écran** de l'état de l'interface utilisateur au moment de l'échec.
    *   Les **logs de la console du navigateur** (`page.on('console', ...)`) pour identifier les erreurs JavaScript ou les avertissements.
    *   Le "diff" entre le résultat attendu et le résultat obtenu (particulièrement utile pour les vérifications de texte ou de structure).

## 5. Détail des Types de Tests

### 5.1. Tests Unitaires (Jest)

**Localisation :** Fichiers de tests dans le répertoire `__tests__/**`.

**Objectif :** Tester les plus petites unités de code (fonctions, hooks React, composants isolés, classes) de manière isolée, en mockant leurs dépendances externes (Prisma, appels HTTP, services externes).

**Couverture Attendue :**

*   **Composants React (isolés) :**
    *   Vérification du rendu correct avec diverses `props`.
    *   Test de la gestion de l'état interne du composant.
    *   Simulation des événements utilisateur (`click`, `change`, `submit`) et validation de leur impact sur l'état ou le rendu.
    *   Tests de la logique de rendu conditionnel (affichage/masquage d'éléments basés sur l'état ou les props).
*   **Fonctions Utilitaires et Logique Métier :**
    *   Toutes les fonctions helpers, de formatage, de validation (ex. modules sous `lib/*`, incluant `lib/aria/orchestrator.ts`, `lib/aria/services.ts`).
    *   Logique de validation des données côté client.
*   **API Route Handlers (`app/api/*`) :**
    *   Test de la logique de validation des requêtes entrantes.
    *   Vérification de la gestion des erreurs (réponses 4xx/5xx).
    *   Assurance de la préparation correcte des réponses JSON.
    *   **Mocker Prisma et les services externes** pour isoler la logique du handler.
*   **Logique Côté Serveur (hors DB) :**
    *   Toute logique qui prépare les données pour l'affichage ou qui les traite avant persistance.
    *   Exemple : transformation de données, calculs.

### 5.2. Tests d'Intégration API (Jest)

**Localisation :** Créer un répertoire `__tests__/api-integration/` pour ces tests afin de les distinguer clairement des tests unitaires purs.

**Objectif :** Valider la collaboration entre les modules côté serveur (API Route Handlers, services, Prisma) et une **vraie base de données PostgreSQL de test**.

**Exigence Spécifique : Synchronisation Bidirectionnelle avec la Base de Données :**

*   **Pré-requis :** Chaque test d'intégration API doit s'exécuter contre une base de données **fraîchement seedée** (via la procédure de réinitialisation/seeding globale décrite en section 4.1).
*   **Scénarios Cruciaux à Tester :**
    *   **Opérations de Création (C de CRUD) :**
        *   Effectuer une requête `POST` vers un `app/api/*` endpoint (ex: `POST /api/users` pour créer un utilisateur, `POST /api/agenda/events` pour un événement).
        *   Après une réponse réussie (`200 OK` ou `201 Created`), **requêter directement la base de données PostgreSQL** (en utilisant le Prisma Client configuré pour les tests) pour vérifier que l'entité a été correctement insérée avec *toutes les données attendues* (y compris les types, les relations, les valeurs précises).
    *   **Opérations de Lecture (R de CRUD) :**
        *   Seeder une entité spécifique dans la DB de test avant le test.
        *   Effectuer une requête `GET` vers l'endpoint `app/api/*` correspondant.
        *   Vérifier que la réponse JSON contient les données exactes, complètes et cohérentes de l'entité attendue depuis la base de données.
    *   **Opérations de Mise à Jour (U de CRUD) :**
        *   Créer ou seeder une entité dans la DB de test.
        *   Effectuer une requête `PUT` ou `PATCH` pour mettre à jour l'entité.
        *   Après la réponse, **requêter la DB de test** pour vérifier que les champs appropriés ont été modifiés et que les champs non affectés sont restés inchangés.
    *   **Opérations de Suppression (D de CRUD) :**
        *   Créer ou seeder une entité dans la DB de test.
        *   Effectuer une requête `DELETE` pour supprimer l'entité.
        *   Après la réponse, **requêter la DB de test** pour confirmer que l'entité n'existe plus.
    *   **Validation des Schémas et Erreurs :**
        *   Tester que les requêtes avec des données invalides (types incorrects, champs manquants, violations de contraintes) sont rejetées avec des codes d'erreur HTTP appropriés (`400 Bad Request`, `404 Not Found`, `409 Conflict`, etc.) et des messages d'erreur pertinents.
    *   **Relations entre Entités :** Vérifier que les relations définies dans Prisma sont correctement gérées et respectées lors de toutes les opérations CRUD.

### 5.3. Tests End-to-End (E2E) (Playwright)

**Localisation :** Fichiers de tests dans le répertoire `e2e/*.spec.ts`.

**Objectif :** Simuler des parcours utilisateur réels dans un navigateur (Chromium, Firefox, WebKit) pour vérifier que l'application complète (front-end, back-end, base de données) fonctionne comme un tout intégré, avec un accent particulier sur la fidélité visuelle et la complétude des données.

**Configuration :** Utiliser la configuration `playwright.config.ts` existante. La suite E2E complète sera lancée séquentiellement sur WebKit, Chromium, puis Firefox pour garantir une compatibilité cross-navigateur.

**Stratégie de Sélection d'Éléments :**
*   Privilégier les sélecteurs sémantiques de Playwright : `getByRole`, `getByText`, `getByLabelText`, `getByPlaceholderText`.
*   Pour les éléments critiques ou ambigus, et **particulièrement sur les pages d'administration (`app/dashboard/admin/*`)**, ajouter et utiliser des attributs `data-testid` si les sélecteurs sémantiques ne sont pas suffisants ou stables.

**Couverture Détaillée (Exemples et Exigences) :**

*   **5.3.1. Navigation et Redirections (Validation Complète et Données Réelles)**
    *   **Parcours Exhaustif des Boutons/Liens :** Chaque bouton interactif et chaque lien de navigation sur *toutes les pages* et *tous les dashboards* doit être cliqué. Inclure spécifiquement les éléments de navigation du `components/layout/header.tsx` et `components/layout/footer.tsx`.
    *   **Validation des URL :** Après chaque clic, vérifier que `page.url()` correspond précisément à l'URL attendue de la page cible.
    *   **Validation du Contenu de la Page Cible (Crucial) :**
        *   **Absence de Placeholder :** Sur chaque page chargée suite à une navigation, s'assurer de l'absence du texte générique de construction : `expect(page.getByText('Cette page est en cours de construction.')).not.toBeVisible();`.
        *   **Données Réelles et Complètes :** Pour toutes les pages qui présentent des données issues de la base de données (ex: pages d'utilisateurs, abonnements, statistiques, tableaux de bord), vérifier que les éléments UI correspondants (`table`, `p`, `span`, etc.) affichent des **données spécifiques, complètes et cohérentes issues du seed de la base de données**. Ex: si un utilisateur "Alice Smith" avec un abonnement "Premium" est seedé, s'assurer que "Alice Smith" et "Premium" apparaissent correctement sur la page de l'utilisateur ou le tableau des utilisateurs.
        *   **Cohérence des Données :** Valider la cohérence des données affichées avec les relations de la DB (ex: un produit doit afficher le bon prix, la bonne description, les bonnes images).
        *   **Absence d'Erreurs Visibles :** Vérifier l'absence de messages d'erreur HTTP (`404`, `500`), d'erreurs JavaScript visibles dans la console du navigateur ou d'autres messages d'erreur inattendus à l'écran.
        *   **Chargement Complet des Éléments :** S'assurer que tous les éléments visuels (images, graphiques, tableaux de données) sont entièrement chargés, visibles et interactifs. Aucun spinner ou état de chargement ne doit persister de manière injustifiée.
        *   **Logos :** Vérifier que l'image `/public/images/logo_nexus_reussite.png` est chargée et visible dans le header et le footer.

*   **5.3.2. État et Interactivité des Boutons/Éléments**
    *   **Actif / Inactif :** Pour chaque bouton et élément interactif, vérifier qu'il est actif (`.toBeEnabled()`) lorsqu'il devrait l'être et inactif (`.toBeDisabled()`) lorsqu'il devrait l'être (ex: bouton de soumission désactivé si le formulaire est invalide).
        *   Pour les éléments HTML autres que `<button>` mais se comportant comme des boutons (ex: `div` cliquable), vérifier la présence de l'attribut `aria-disabled="true"` en cas d'inactivité, et s'assurer que `page.click(selector, { force: true })` ne déclenche aucune action.
    *   **Réponse au Clic :** Vérifier que le clic sur un bouton déclenche l'action attendue (redirection, ouverture de modale, changement d'état UI, soumission de données, affichage/masquage d'éléments, etc.).

*   **5.3.3. Fonctionnalités Spécifiques (Tests Détaillés)**
    *   **Implémentation de l'Agenda :**
        *   Naviguer vers la page de l'agenda.
        *   Vérifier le chargement correct des événements seedés dans la base de données de test.
        *   Tester l'**ajout** d'un nouvel événement : remplir le formulaire, soumettre, vérifier que l'événement apparaît visuellement dans l'agenda et qu'il est persistant après un rechargement de page ou une navigation.
        *   Tester la **modification** d'un événement existant : ouvrir l'événement, modifier les détails, sauvegarder, vérifier les mises à jour visuelles et la persistance.
        *   Tester la **suppression** d'un événement.
        *   Tester la navigation entre les vues de l'agenda (jour, semaine, mois) et la persistance des événements dans chaque vue.
        *   Vérifier les validations de formulaire spécifiques à l'agenda.
    *   **Interface ARIA (Assistant IA) - (`app/aria` & `components/aria/ChatWindow.tsx`) :**
        *   **Présence de la Mascotte ARIA :** Vérifier que l'image de la mascotte ARIA est chargée et affichée correctement (spécifier le sélecteur ou le chemin de l'image si différent de `/public/images/logo_nexus_reussite.png`).
        *   **Sélecteur de matière (`Subject`) :** Tester que le sélecteur de matière est présent, cliquable, et que toutes les valeurs `Subject` attendues sont listées. Changer de matière et vérifier que cela affecte le comportement du chat.
        *   **Saisie message et Bouton Envoi :** Tester la saisie d'un message dans le champ de texte et l'envoi via le bouton d'envoi. Vérifier que le message apparaît correctement dans la fenêtre de chat.
        *   **Upload de Fichiers/Images (`/api/uploads/analyse`) :**
            *   Simuler un upload de fichier/image via l'interface.
            *   Vérifier que la requête est correctement envoyée à l'endpoint `/api/uploads/analyse`.
            *   Vérifier que la réponse de l'API (qu'elle soit mockée ou réelle) est correctement gérée par l'interface utilisateur (ex: affichage d'un message de succès/échec, indicateur de progression, ou affichage du résultat d'analyse).
        *   **Lien PDF (`documentUrl`) :** Simuler une réponse de l'API où un `documentUrl` est renvoyé. Vérifier qu'un lien cliquable vers le PDF apparaît dans le chat et que le clic sur ce lien ouvre une nouvelle fenêtre/onglet avec l'URL correcte du PDF.
        *   **Hydration-Safe :** Vérifier l'absence d'erreurs d'hydration dans la console du navigateur lors du chargement initial de la page ARIA.
        *   **Boutons supplémentaires et Fonctionnalités Avancées :** Inspecter minutieusement l'interface d'ARIA. Pour chaque bouton ou fonctionnalité avancée qui était *prévue* selon les spécifications initiales (même si elle est actuellement manquante ou non fonctionnelle), créer un test E2E qui assert sa **présence, son état actif et sa fonctionnalité prévue**. Cela inclut, par exemple, des boutons comme "copier la réponse", "modifier le prompt", "partager la conversation", "nouveau chat", etc. Si ces éléments sont absents ou ne fonctionnent pas, le test doit échouer.
        *   **Cohérence Visuelle Générale :** Bien qu'il n'y ait pas de Figma/Storybook direct, les tests E2E doivent s'assurer d'une présentation visuellement stable : pas de chevauchements d'éléments, pas de texte tronqué, des espacements cohérents, et une disposition générale conforme à une utilisation normale.
    *   **Formulaires :**
        *   Validation des champs : Tester les messages d'erreur affichés pour les champs vides, les formats invalides (e-mail, numéro de téléphone, etc.).
        *   Soumission réussie : Remplir le formulaire avec des données valides, soumettre, vérifier le message de succès, la redirection ou l'impact sur les données affichées (et potentiellement persistance en DB via re-requête).
        *   Soumission échouée : Remplir le formulaire avec des données invalides ou simuler un échec API, vérifier les messages d'erreur appropriés.
    *   **Authentification et Autorisation (NextAuth) :**
        *   Tester le processus complet de connexion (`login`) avec des utilisateurs seedés dans la base de données.
        *   Tester le processus de déconnexion (`logout`).
        *   Tests d'accès basés sur les rôles : Vérifier qu'un utilisateur non-administrateur ne peut pas accéder aux pages et fonctionnalités sous `app/dashboard/admin/*`. Tenter d'accéder à ces pages et vérifier la redirection vers la page de connexion ou l'affichage d'un message d'accès refusé.
        *   Tester le comportement des pages protégées si l'utilisateur n'est pas authentifié.
    *   **Performance Basique (E2E) :**
        *   Bien que ce ne soient pas des tests de performance dédiés, les tests E2E devraient inclure des vérifications de temps de chargement pour les pages critiques (ex: `page.waitForLoadState('networkidle')` ou `expect(page.getByText('...')).toBeVisible()` dans un délai raisonnable) pour détecter des régressions majeures de performance.

## 6. Critères de Succès et Rapports

*   **Taux de Réussite :** Une suite de tests réussie signifie que 100% des tests automatisés (Unitaires, Intégration API, E2E) passent sans échec.
*   **Visibilité des Rapports :** Fournir un tableau de bord de rapport clair et concis, indiquant le nombre total de tests passés et échoués pour chaque catégorie.
*   **Détails d'Échec :** Pour chaque test échoué, un rapport détaillé doit être généré, incluant toutes les informations spécifiées en section 4.3 pour faciliter la reproduction et la correction du bug.
*   **Historique des Tests :** Maintenir un historique des exécutions de tests pour permettre le suivi des régressions et l'analyse des tendances de qualité au fil du temps.

## 7. Définitions Clés

*   **"Page valide et complétée" :**
    *   Absence du texte de placeholder "Cette page est en cours de construction.".
    *   Toutes les sections et tables sont alimentées avec des données réelles et spécifiques, issues du seed de la base de données (ex. utilisateurs, abonnements, données analytics, événements d'agenda), et non des données génériques ou vides.
    *   Les endpoints API associés à la page renvoient des réponses `200 OK` avec le format JSON attendu.
    *   Le rendu est stable : aucune erreur console/hydration visible.
    *   Les tests E2E ne sont pas "flaky" (non reproductibles).

*   **"Bouton inactif" :**
    *   **Technique :** L'élément possède l'attribut HTML `disabled`. Idéalement, il possède aussi l'attribut `aria-disabled="true"` pour l'accessibilité.
    *   **Style :** Le bouton présente un style visuel cohérent d'inactivité (ex. opacité réduite, couleur grisée, `pointer-events: none`).
    *   **Comportement :** Un clic sur le bouton n'entraîne aucune action ou redirection.
    *   **Test :** Utilisation de `expect(page.getByRole('button', { name: '...' })).toBeDisabled()` avec Playwright. Pour les éléments non-`<button>`, vérifier `aria-disabled` et l'absence d'action au clic.

---
**Fin du document.**
