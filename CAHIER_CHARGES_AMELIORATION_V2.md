<!-- markdownlint-disable MD013 MD007 MD030 MD034 -->
# Cahier des charges — Nexus Réussite (site et plateforme)

**Date:** 30 août 2025

## 1. Introduction et Contexte du Projet

Nexus Réussite est une plateforme éducative innovante qui propose une "pédagogie augmentée par l'IA" pour préparer les élèves au Baccalauréat et à Parcoursup. Notre ambition est de conjuguer l'excellence académique de professeurs agrégés et certifiés avec la puissance de l'intelligence artificielle ARIA pour offrir une expérience d'apprentissage unique, sans stress et axée sur la réussite.

Le présent cahier des charges a pour objectif de détailler les améliorations structurelles, visuelles, fonctionnelles et éditoriales à apporter au site web actuel ([nexusreussite.academy](https://nexusreussite.academy/)) et à sa plateforme. L'objectif est de transformer le site en un outil digital premium, professionnel, hautement optimisé pour la conversion, et d'une crédibilité irréprochable. Ce document servira de base pour la phase de développement et d'intégration, en fournissant des instructions concrètes et des propositions de contenu exactes.

## 2. Objectifs Généraux du Projet

* **Renforcer la Crédibilité et le Professionnalisme:** Finaliser les pages inachevées, corriger les incohérences et s'assurer que toutes les informations sont factuelles et à jour.
* **Optimiser l'Expérience Utilisateur (UI/UX):** Rendre la navigation plus intuitive, le contenu plus digeste et l'interface plus moderne et agréable.
* **Améliorer l'Optimisation de la Conversion (CRO):** Guider plus efficacement les visiteurs vers les appels à l'action principaux, augmenter le taux de génération de leads qualifiés et les inscriptions.
* **Moderniser la Charte Graphique et les Styles:** Affiner l'esthétique pour refléter une image premium, innovante et inspirante.
* **Optimiser le Référencement Naturel (SEO):** Préparer l'architecture pour une meilleure visibilité sur les moteurs de recherche.

## 3. Améliorations Détaillées par Section et Page

---

### 3.1. Corrections et Mises à Jour Urgentissimes (Crédibilité)

#### 3.1.1. Page d'Accueil (`/`) – Correction des Chiffres & Placeholders

* **Localisation actuelle:** Section "Chiffres Clés" (probablement sous la première section hero ou services).
* **Problème:** Affichage de "0+ Années d'Expérience Cumulées", "0+ Experts Certifiés", "0% Taux de Réussite".
* **Action requise:** Remplacer ces placeholders par des chiffres réels et à jour fournis par Nexus Réussite (ex: "+150 Années d'Expérience Cumulée" tel qu'indiqué ailleurs, "20+ Experts Certifiés", "98% Taux de Réussite"). S'assurer que les chiffres sont cohérents sur tout le site.

#### 3.1.2. Page "Notre Centre" (`/notre-centre`) – Finalisation

* **Problème:** "Page en construction".
* **Action requise:** Concevoir et intégrer le contenu suivant :
  * **Titre:** "Notre Centre Nexus Réussite"
  * **Introduction (Texte):** "Découvrez notre environnement d'apprentissage stimulant et propice à l'excellence. Chez Nexus Réussite, nous combinons des installations modernes avec une ambiance studieuse pour offrir le cadre idéal à la réussite de votre enfant."
  * **Section "Nos Installations":**
    * **Contenu:** Texte descriptif des salles de classe, espaces de travail collaboratifs, bibliothèque, zones de détente.
    * **Visuels:** Intégration de 3 à 5 photos de haute qualité des locaux (salles de classe, espaces de travail, entrée, etc.).
  * **Section "Où nous trouver ?":**
    * **Adresse Exacte:** "Rue du Lac Windermere, Immeuble Golden Tower, Bloc C, Bureau B 5-1, Les Berges du Lac 1, Tunis 1053, Tunisie."
    * **Carte Interactive:** Intégration d'une carte Google Maps centrée sur l'adresse de Nexus Réussite, avec un marqueur clair.
  * **Section "Horaires d'Ouverture":**
    * **Contenu:**
      * "Lundi – Vendredi : 9h00 – 19h00"
      * "Samedi : 9h00 – 14h00"
      * "Dimanche : Fermé"
    * **CTA:** "Prenez rendez-vous pour une visite de nos locaux !" (Bouton menant vers un formulaire de contact ou un outil de prise de RDV).

#### 3.1.3. Page "Contact" (`/contact`) – Finalisation

* **Problème:** "Page en construction" et numéro de téléphone placeholder.
* **Action requise:** Concevoir et intégrer le contenu suivant :
  * **Titre:** "Contactez Nexus Réussite"
  * **Introduction (Texte):** "Nous sommes là pour répondre à toutes vos questions et vous accompagner. N'hésitez pas à nous contacter par téléphone, e-mail ou via le formulaire ci-dessous."
  * **Section "Nos Coordonnées":**
    * **Téléphone:** "+216 28 300 200" (Rendre le numéro cliquable pour appel direct sur mobile).
    * **E-mail:** "contact@nexusreussite.academy" (Rendre l'adresse cliquable pour ouvrir un client de messagerie).
    * **Adresse:** "Rue du Lac Windermere, Immeuble Golden Tower, Bloc C, Bureau B 5-1, Les Berges du Lac 1, Tunis 1053, Tunisie."
    * **Carte Interactive:** Intégration de la même carte Google Maps que sur la page "Notre Centre".
  * **Section "Envoyez-nous un message":**
    * **Formulaire de contact:**
      * Champs requis : Nom Complet, Adresse E-mail, Numéro de Téléphone (optionnel), Sujet, Votre Message.
      * Bouton d'envoi : "Envoyer votre message"
      * Message de confirmation après envoi.

---

### 3.2. Architecture de l'Information et Navigation (Menu)

#### 3.2.1. Refonte du Menu Principal (Header)

* **Action requise:** Mettre à jour la structure du menu de navigation pour qu'elle soit plus logique et complète.
* **Nouvelle structure du menu principal:**
  * **Accueil** (Lien vers `/`)
  * **Nos Offres** (Lien vers `/offres`, et menu déroulant au survol/clic)
    * *Menu déroulant (liens):*
      * Nexus Cortex (Lien vers `/offres/nexus-cortex` - Nouvelle page)
      * Studio Flex (Lien vers `/offres/studio-flex` - Nouvelle page)
      * Académies Nexus (Lien vers `/offres/academies-nexus` - Nouvelle page)
      * Programme Odyssée (Lien vers `/offres/programme-odyssee` - Nouvelle page)
  * **Notre Équipe** (Lien vers `/equipe`)
  * **Notre Centre** (Lien vers `/notre-centre`)
  * **Blog & Ressources** (Lien vers `/blog` - Nouvelle page, à créer)
  * **Contact** (Lien vers `/contact`)
* **CTAs dans le Header:**
  * **Bouton 1 (Principal):** "Bilan Stratégique Gratuit" (Bouton coloré et proéminent, lien vers un formulaire de bilan).
  * **Bouton 2 (Secondaire):** "Se Connecter" (Lien vers `/auth/signin`).

#### 3.2.2. Footer

* **Action requise:** S'assurer de la présence des liens légaux indispensables et des informations de contact mises à jour.
* **Contenu minimal:**
  * Mentions Légales (lien vers `/mentions-legales` - à créer)
  * Politique de Confidentialité (lien vers `/politique-confidentialite` - à créer)
  * Conditions Générales de Vente (lien vers `/cgv` - à créer)
  * Coordonnées de contact (numéro de téléphone, e-mail, adresse physique).
  * Liens vers les réseaux sociaux (si existants et actifs).
  * Copyright © [Année Actuelle] Nexus Réussite. Tous droits réservés.

---

### 3.3. Refonte des Pages Clés et Création de Nouvelles Pages

#### 3.3.1. Page d'Accueil (`/`) – Contenu & UX

*   **Section Hero:**
    *   **Titre actuel:** "Pédagogie Augmentée pour Réussir son Bac. Sans Stress."
    *   **Sous-titre / Accroche:** "L'alliance unique de l'expertise de professeurs d'élite et de l'intelligence artificielle ARIA pour transformer le potentiel de votre enfant en réussite concrète et en un avenir choisi."
    *   **CTA Principal:** "Obtenez Votre Bilan Stratégique Gratuit" (Bouton).
    *   **CTA Secondaire:** "Découvrez Nos Méthodes" (Bouton, ancre vers section "Notre Approche").
    *   **Visuel:** Remplacer l'image statique par un carrousel d'images de haute qualité ou une courte vidéo en arrière-plan (looping, sans son par défaut) illustrant des élèves studieux, des professeurs interagissant, ou une interface ARIA simplifiée.
*   **Section "Découvrez Nos Univers" (Remplacement ou refonte des blocs actuels):**
    *   **Titre:** "Trouvez le Parcours Idéal pour la Réussite de Votre Enfant"
    *   **Description:** "Quelle que soit la situation de votre enfant, Nexus Réussite propose une solution adaptée pour viser l'excellence au Baccalauréat et l'entrée à Parcoursup."
    *   **Affichage:** Utiliser des "cards" (blocs visuels) pour présenter chacun des 4 univers majeurs. Chaque card inclura :
        *   **Icône pertinente.**
        *   **Titre de l'univers:** Ex: "Nexus Cortex - L'Intelligence Artificielle au Service de l'Apprentissage"
        *   **Phrase d'accroche courte:** Ex: "Le tuteur personnel intelligent, disponible 24/7 pour des révisions sur mesure."
        *   **CTA:** "Découvrir Nexus Cortex" (Lien vers la page détaillée de l'univers).
    *   **Ordre des cartes:** Nexus Cortex, Studio Flex, Académies Nexus, Programme Odyssée.
*   **Intégration du "Constructeur de Parcours":**
    *   **Placement:** Une section dédiée et proéminente, idéalement à mi-parcours de la page d'accueil.
    *   **Titre:** "Vous ne savez pas par où commencer ? Laissez-nous vous guider !"
    *   **Description:** "Répondez à quelques questions rapides pour découvrir le programme Nexus Réussite le plus adapté aux besoins et aux objectifs de votre enfant."
    *   **CTA:** "Lancer le Constructeur de Parcours" (Bouton, lien vers `/constructeur-parcours` - nouvelle page ou modal).
*   **Section "Ils nous font confiance" (Preuve Sociale):**
    *   **Titre:** "Plus de 1000 familles nous ont fait confiance"
    *   **Contenu:** Intégrer un carrousel de 3 à 5 témoignages (citations) de parents et/ou d'élèves, avec leur photo et leur prénom/initiale. Idéalement, intégrer un lien vers des témoignages vidéo plus complets si disponibles sur une page dédiée (`/temoignages`).

#### 3.3.2. Page "Nos Offres" (`/offres`) – Page Portail (Refonte majeure)

*   **Action requise:** Simplifier drastiquement la page actuelle pour en faire un portail clair vers les différentes solutions.
*   **Titre:** "Nos Programmes d'Excellence pour la Réussite Scolaire"
*   **Introduction (Texte):** "Chez Nexus Réussite, nous proposons une gamme complète de solutions pédagogiques, de l'accompagnement individualisé par l'IA à des programmes annuels complets, conçues pour s'adapter à chaque profil et chaque objectif. Explorez nos univers pour trouver le parcours idéal."
*   **Contenu principal:** Présenter visuellement les **quatre univers principaux** sous forme de "cards" (comme sur la homepage, mais avec plus de détails et de cohérence). Chaque card inclura :
    *   **Titre de l'Univers:** (Ex: "Nexus Cortex")
    *   **Icône ou illustration emblématique.**
    *   **Description concise (4-5 lignes):** Mettant en avant les bénéfices clés de cet univers.
    *   **Points forts (3-4 puces):** Ex: "Tuteur IA 24/7", "Diagnostic Prédictif", "Personnalisation Adaptative".
    *   **CTA:** "Découvrir [Nom de l'Univers]" (Lien vers la page détaillée de l'univers).
*   **Disposition:** Utiliser une grille (2x2 ou 1x4) pour présenter clairement les 4 univers.

#### 3.3.3. Pages Détaillées par Univers (Nouveaux contenus, 4 pages)

*   **Action requise:** Créer une page dédiée et riche pour chacun des 4 univers.
*   **Structure Générale de Chaque Page d'Univers (Exemple pour `/offres/nexus-cortex`):**
    *   **Titre de l'Univers:** "Nexus Cortex : Le Tuteur IA Réinventé pour le Bac"
    *   **Accroche:** "Optimisez vos révisions, comblez vos lacunes et visez l'excellence avec ARIA, notre Intelligence Artificielle pédagogique conçue spécifiquement pour le Baccalauréat."
    *   **Section "Qu'est-ce que Nexus Cortex ?":**
        *   **Texte descriptif détaillé:** Explication de la philosophie, des technologies utilisées (ARIA), et des bénéfices (personnalisation, disponibilité, diagnostic).
        *   **Visuels:** Schéma explicatif du fonctionnement d'ARIA, captures d'écran de l'interface ARIA.
    *   **Section "Comment ça marche ?":**
        *   **Processus étape par étape:** (Ex: 1. Diagnostic initial, 2. Parcours d'apprentissage personnalisé, 3. Suivi et ajustements, 4. Révisions ciblées).
        *   **Points clés / Fonctionnalités:** (Ex: "Diagnostic prédictif des lacunes", "Génération d'exercices personnalisés", "Réponses instantanées et explications détaillées", "Simulation d'épreuves du Bac").
    *   **Section "Pour quels résultats ?":**
        *   **Bénéfices concrets:** "Gain de temps, réduction du stress, amélioration des notes, confiance accrue."
        *   **Témoignages spécifiques:** 2-3 témoignages (texte + photo) d'élèves ayant utilisé Nexus Cortex.
    *   **Section "Nos Formules / Tarifs" (Présentation Générale):**
        *   **Texte:** "Accédez à Nexus Cortex via nos différents programmes ou en tant qu'option individuelle. [Explication succincte du modèle de crédits si applicable]"
        *   **CTA:** "Découvrez les Tarifs et Formules" (Lien vers une section tarifs spécifique ou un tableau comparatif sur cette page, ou vers la page "Offres" plus générale si la tarification est unifiée). *N.B. : Les tarifs exacts et les structures de formules seront fournis par Nexus Réussite.*
    *   **FAQ spécifique à l'univers:** 3-5 questions-réponses fréquentes.
    *   **CTA Final:** "Lancez votre Bilan Stratégique Gratuit" (Bouton).

*   **Idem pour les pages:**
    *   `/offres/studio-flex` (Accompagnement à la carte, cours particuliers, packs thématiques).
    *   `/offres/academies-nexus` (Stages intensifs pendant les vacances scolaires).
    *   `/offres/programme-odyssee` (Programmes annuels complets avec garanties).

#### 3.3.4. Page "Notre Équipe" (`/equipe`) – Améliorations

*   **Action requise:** Maintenir l'excellent contenu actuel mais envisager des ajouts visuels ou interactifs.
*   **Suggestion:** Ajouter un court texte d'introduction sur la philosophie d'enseignement de l'équipe. Envisager d'ajouter de très courtes vidéos de présentation de chaque professeur (15-20 secondes) à terme, ou une section "Le Mot des Professeurs".

#### 3.3.5. Page "Blog & Ressources" (`/blog`) – Création

*   **Action requise:** Créer une section blog pour le contenu informatif et le SEO.
*   **Structure:**
    *   **Titre:** "Blog & Ressources | Nexus Réussite"
    *   **Introduction:** "Découvrez nos articles, guides et conseils d'experts pour optimiser vos chances de réussite au Bac, maîtriser Parcoursup et mieux comprendre le système éducatif."
    *   **Catégories d'Articles:** (Ex: Préparation Bac, Parcoursup, Méthodologie, IA & Éducation, Actualités Nexus).
    *   **Liste d'Articles:** Affichage des articles par ordre chronologique inversé, avec miniature, titre, date de publication, catégorie et courte description.
    *   **Fonctionnalité:** Possibilité de filtrer par catégorie et/ou une barre de recherche.
    *   **CTA:** "Abonnez-vous à notre newsletter" (Pour capturer des leads).

#### 3.3.6. Page "Authentification / Connexion" (`/auth/signin`) – Amélioration UI/UX

*   **Action requise:** Améliorer l'esthétique et l'expérience utilisateur de la page de connexion.
*   **Améliorations:**
    *   **Branding:** Intégrer le logo Nexus Réussite de manière proéminente.
    *   **Contexte:** Ajouter un court texte de bienvenue : "Connectez-vous à votre espace personnel Nexus Réussite pour accéder à vos cours, votre tuteur ARIA et votre suivi personnalisé."
    *   **Esthétique:** Design épuré, centré, avec des couleurs en accord avec la charte graphique.
    *   **Liens utiles:** "Mot de passe oublié ?", "Créer un compte" (si la création est possible directement ici, sinon rediriger vers un processus d'inscription).

---

### 3.4. Charte Graphique, Styles et Mise en Page (Premium & Attirants)

*   **Couleurs d'Accentuation:**
    *   **Action requise:** Introduire 1-2 couleurs d'accentuation vives pour dynamiser le site tout en maintenant son professionnalisme.
    *   **Proposition:** Un orange dynamique (Hex: `#FF7F00` ou similaire) ou un turquoise (Hex: `#00CED1` ou similaire) pour les éléments suivants :
        *   Boutons d'Appel à l'Action (CTA).
        *   Icônes clés.
        *   Éléments interactifs (barres de progression, indicateurs).
        *   Surlignages importants.
*   **Iconographie:**
    *   **Action requise:** Utiliser un set d'icônes stylisé, moderne et cohérent sur l'ensemble du site.
    *   **Thème:** Les icônes doivent évoquer l'innovation, la technologie (IA), la connaissance, l'apprentissage et la réussite.
    *   **Style:** Lignes épurées, de préférence monochromes avec l'une des couleurs d'accentuation.
*   **Imagerie et Visuels:**
    *   **Action requise:** Privilégier des photos de haute qualité, authentiques et inspirantes.
    *   **Thèmes:**
        *   Élèves concentrés et souriants, en situation d'apprentissage.
        *   Professeurs passionnés en interaction.
        *   Interfaces épurées et intuitives (mockups de l'IA ARIA).
        *   Environnements d'apprentissage modernes et lumineux.
    *   **Éviter:** Les images de stock génériques sans âme.
    *   **Illustrations:** Utiliser des illustrations modernes et stylisées pour compléter les photos et rendre les concepts abstraits plus compréhensibles.
*   **Typographie:**
    *   **Action requise:** S'assurer d'une hiérarchie typographique claire et cohérente (tailles, graisses, couleurs).
    *   **Lisibilité:** Optimiser la taille du texte pour le corps de la page et les contrastes pour une lisibilité maximale sur tous les appareils.
*   **Mise en Page Générale:**
    *   **Aération:** Utiliser généreusement l'espace blanc pour éviter la surcharge visuelle et améliorer la lisibilité.
    *   **Blocs de Contenu:** Structurer le contenu en blocs clairs avec des titres (H2, H3) et des sous-titres, des listes à puces et des paragraphes courts.
    *   **Responsive Design:** S'assurer que toutes les modifications s'adaptent parfaitement à toutes les tailles d'écran (mobile, tablette, desktop).

---

### 3.5. Optimisation de la Conversion (CRO) et Appels à l'Action (CTAs)

*   **Standardisation et Personnalisation des CTAs:**
    *   **Action requise:** Utiliser un langage clair, incitatif et varier les formulations selon le contexte.
    *   **Exemples de CTAs:**
        *   "Obtenez Votre Bilan Stratégique Gratuit" (CTA principal, page d'accueil, pied de page).
        *   "Découvrez Nos Formules" (Page d'offres).
        *   "En savoir plus sur [Nom de l'Univers]" (Sur les cartes d'univers).
        *   "Je m'inscris à l'Académie de [Nom de la session]" (Sur la page Académies).
        *   "Demandez votre démo gratuite d'ARIA" (Sur la page Nexus Cortex).
        *   "Contactez un conseiller" (Page contact, bas de page).
        *   "Lancer le Constructeur de Parcours" (Homepage, page d'offres).
*   **Placement Contextuel des CTAs:**
    *   **Action requise:** Intégrer les CTAs de manière stratégique à la fin de chaque section pertinente, dans des barres flottantes (sticky bars) pour les pages longues, et en pop-ups intelligents (exit intent ou temporisé).
*   **Amélioration du "Constructeur de Parcours":**
    *   **Action requise:** Développer un outil interactif et ludique.
    *   **Fonctionnalités:**
        *   **Questions guidées:** (Ex: "Quel est le niveau de votre enfant ?", "Quels sont ses objectifs (mention, intégration Parcoursup) ?", "Quelles matières posent problème ?", "Quel est votre budget indicatif ?").
        *   **Interface visuelle:** Utiliser des sliders, des boutons radio stylisés, des coches, etc.
        *   **Feedback instantané:** Indiquer la progression de l'utilisateur.
        *   **Résultat personnalisé:** À la fin du questionnaire, afficher une recommandation de programme (ex: "Le Programme Odyssée Terminale est idéal pour [Nom de l'élève] !") avec une explication concise.
        *   **CTA de suivi:** "Je souhaite un Bilan Stratégique pour affiner cette recommandation" (bouton menant au formulaire de bilan avec pré-remplissage des informations du questionnaire si possible).

*   **Renforcement de la Preuve Sociale:**
    *   **Témoignages Vidéo:**
        *   **Action requise:** Intégrer des blocs vidéo sur la page d'accueil et les pages d'offres clés.
        *   **Contenu:** Courtes vidéos (60-90 secondes) de parents et d'élèves racontant leur expérience et les résultats obtenus avec Nexus Réussite.
    *   **Études de Cas:**
        *   **Action requise:** Créer une section ou une page dédiée aux "Success Stories".
        *   **Contenu:** Récits détaillés du parcours d'élèves (défis initiaux, mise en œuvre du programme Nexus, résultats finaux, citations).
    *   **Logos de Partenaires / Accréditations:** Si applicable, afficher les logos d'éventuels partenaires éducatifs ou accréditations pour renforcer la confiance.

*   **Lead Magnets Stratégiques:**
    *   **Action requise:** Développer et intégrer des ressources gratuites téléchargeables.
    *   **Exemples:**
        *   "Guide Ultime pour Réussir son Bac [Année]" (PDF)
        *   "Checklist Parcoursup : Les Étapes Essentielles" (PDF)
        *   "5 Stratégies pour Vaincre le Stress des Examens" (PDF)
    *   **Intégration:** Proposer ces ressources via des formulaires d'opt-in (e-mail requis) sur le blog, les pages d'offres pertinentes, ou des pop-ups ciblés.

---

### 3.6. Aspects Techniques et SEO

*   **Optimisation de la Vitesse de Chargement:**
    *   **Action requise:** S'assurer que le site se charge rapidement sur toutes les plateformes (optimisation des images, minification des CSS/JS, mise en cache).
*   **Structure SEO Friendly:**
    *   **Action requise:** Implémenter une structure URL claire et logique, utiliser des balises H1, H2, H3 correctement, optimiser les meta-titres et descriptions.
*   **Schémas de Données Structurées (Schema Markup):**
    *   **Action requise:** Implémenter des schémas pertinents (ex: Organization, Course, Review) pour améliorer la visibilité dans les résultats de recherche.
*   **Sécurité (HTTPS):**
    *   **Action requise:** S'assurer que tout le site utilise HTTPS.

---

## 4. Livrables Attendus

* designs des pages principales et des nouvelles pages proposées.
*   Intégration front-end et développement back-end des fonctionnalités décrites.
*   Contenu texte intégré selon les propositions de ce cahier des charges (et ajustements validés).
*   Mise en place de la nouvelle structure de navigation.
*   Intégration des éléments visuels (icônes, photos, vidéos).
*   Développement du "Constructeur de Parcours" interactif.
*   Mise en œuvre des optimisations techniques (vitesse, SEO, responsive).
*   Tests complets (fonctionnels, UI/UX, compatibilité navigateurs/appareils).
*   Documentation technique du projet.

---

## 5. Calendrier et Étapes (Proposition)

*   **Phase 1: Audit Approfondi & Spécifications Détaillées**
    *   Analyse technique et fonctionnelle du site actuel.
    *   Validation des points du présent CdC et proposition d'éventuels affinements.
*   **Phase 2: Design**
    *   Création des  nouvelles pages/sections.
    *   Validation par Nexus Réussite.
*   **Phase 3: Développement & Intégration**
    *   Développement front-end et back-end.
    *   Intégration des contenus et fonctionnalités.
*   **Phase 4: Tests & Recette**
    *   Tests internes.
    *   Corrections et ajustements.
*   **Phase 5: Mise en Production & Suivi**
    *   Déploiement du nouveau site.
    *   Suivi post-lancement.

---
Notre objectif est de créer une plateforme qui non seulement répond aux attentes de nos utilisateurs mais les dépasse, en reflétant l'excellence et l'innovation que Nexus Réussite incarne.
