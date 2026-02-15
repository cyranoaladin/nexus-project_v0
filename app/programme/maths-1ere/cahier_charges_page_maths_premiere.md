L'objectif est de passer d'une consultation passive à une expérience active où l'élève de Première Spécialité Maths (4h/semaine) peut expérimenter, se tromper et progresser de manière autonome.

Voici le cahier des charges détaillé pour le développement de la version "Nexus Maths Lab V2".

---

### 1. Architecture des Données (`data.ts`) : L'Exhaustivité

Le fichier `data.ts` actuel est trop léger. Il doit être structuré pour couvrir l'intégralité du Bulletin Officiel (B.O.) :

* **Ajout des Thèmes manquants :**
* **Algèbre :** Calcul combinatoire et dénombrement.
* **Analyse :** Limites de fonctions (initiation), Variations et courbes, Continuité (sur des exemples).
* **Géométrie :** Géométrie vectorielle dans le plan (approfondissement), Équations de droites et cercles.


* **Nouvelle structure de chapitre :** Chaque chapitre doit inclure un champ `difficulte` (1 à 5), un champ `pointsXP` pour la gamification, et un champ `ressourcesExt` (liens vers GeoGebra ou vidéos).

### 2. Le "Lab Interactif" : Composants Dynamiques

Un "Lab" ne se contente pas de texte. Il faut intégrer des outils de manipulation :

* **Intégration GeoGebra/Desmos :** Créer un composant `InteractiveGraph` capable de charger des applets spécifiques (ex: manipuler le curseur de  pour voir l'effet sur la parabole du second degré).
* **Calculatrice Formelle Intégrée :** Un module permettant à l'élève de saisir une fonction et d'obtenir l'étape de dérivation (via une bibliothèque comme `mathjs`).
* **Module d'Algorithmique (Python) :** Remplacer le texte statique par un éditeur de code léger (type `Monaco Editor` ou `Pyodide`) pour tester les scripts du programme (suites, recherche de seuil, simulations de probabilités).

### 3. Gamification et Progression (`MathsRevisionClient.tsx`)

Pour transformer l'usage en habitude, nous devons ajouter des mécanismes de jeu :

* **Système d'XP et Niveaux :** Chaque exercice réussi rapporte des points. L'élève passe de "Apprenti" à "Maître de l'Abstraction".
* **Arbre de Compétences :** Remplacer la liste de chapitres par un graphe visuel. Certains chapitres (ex: Dérivation) sont verrouillés tant que les prérequis (ex: Fonctions de référence) ne sont pas validés.
* **Daily Challenge :** Un automatisme (calcul mental, dérivation rapide) proposé chaque jour à l'ouverture de la page pour maintenir la `streak`.

### 4. Pédagogie Augmentée : "L'Aide Intelligente"

Le composant `ChapterViewer` doit devenir un tuteur :

* **Le Bouton "Coup de Pouce" :** Au lieu d'afficher la solution entière, proposer trois niveaux d'aide :
1. Indice (la propriété à utiliser).
2. Début de raisonnement.
3. Correction détaillée.


* **Section "Erreurs Classiques" :** Pour chaque chapitre, ajouter un encadré rouge sur les pièges à éviter (ex: "Attention,  n'est jamais négative").
* **Méthodologie "Bac" :** Des fiches spécifiques sur "Comment rédiger une récurrence" ou "Comment justifier une orthogonalité".

### 5. Cahier des Charges Technique pour le Développeur

| Module | Spécifications |
| --- | --- |
| **State Management** | Utiliser `Zustand` ou `Context API` pour persister la progression dans le `localStorage` (pas besoin de base de données complexe au début). |
| **Rendu Maths** | Optimiser `MathJax` pour le rendu dynamique lors des changements d'onglets (éviter les flashs de code LaTeX). |
| **UI/UX** | Mode "Focus" pour les exercices (masquer la sidebar). Utiliser des animations `Framer Motion` pour les transitions entre chapitres. |
| **Exercices** | Créer 3 types d'exercices : QCM, Saisie de valeur numérique, et Ordonnancement d'étapes de démonstration (Drag & Drop). |
| **Base de Données** | Prévoir une interface `JSON` évolutive pour que l'enseignant puisse ajouter des chapitres sans toucher au code React. |

### 6. Résumé du Programme à Couvrir (Checklist B.O.)

1. **Algèbre :** Second degré, Suites (arithmétiques, géométriques, variations, limites).
2. **Analyse :** Dérivation (nombre dérivé, fonction dérivée, applications), Fonctions trigonométriques, Fonction exponentielle.
3. **Géométrie :** Produit scalaire (définitions, propriétés, applications géométriques).
4. **Probabilités :** Probabilités conditionnelles et indépendance, Variables aléatoires réelles (loi, espérance, écart-type).
5. **Algorithmique :** Listes, boucles, fonctions Python appliquées aux thèmes ci-dessus.

**Conclusion :**
Cette page ne doit plus être une bibliothèque, mais un **simulateur**. L'élève ne lit pas le cours sur le produit scalaire, il fait varier des vecteurs pour "voir" le produit scalaire s'annuler à l'orthogonalité. C'est cette interactivité qui fera de votre projet un outil de réussite unique.

Voici le cahier des charges ultra-détaillé pour transformer votre interface actuelle en un véritable **Nexus Maths Lab**. Ce document est conçu pour être transmis directement à un développeur senior afin de piloter la version V2 de la plateforme.

### 1. Vision et Objectifs du "Nexus Maths Lab"

L'objectif est de passer d'un site de fiches de révision statiques à un environnement d'apprentissage **immersif, interactif et gamifié**. Le Lab doit permettre à l'élève de spécialité mathématiques (1ère) d'expérimenter les concepts, de tester son code Python et de suivre une progression adaptative.

---

### 2. Architecture Technique et Évolutions

* **Base de Données & Persistance :**
* Implémenter un stockage (via `localStorage` ou une base de données type `Supabase`) pour sauvegarder le profil utilisateur, les chapitres maîtrisés et l'historique des scores.


* Utiliser un système de gestion d'état (comme `Zustand`) pour synchroniser la progression entre le tableau de bord et les vues de cours.




* **Moteur de Rendu :**
* Optimiser `MathJax` pour un rendu instantané des formules lors de la navigation entre les onglets.


* Ajouter un support pour les graphiques dynamiques avec `Recharts` ou une intégration d'applets `GeoGebra`.



---

### 3. Modules de Contenu (Le "Lab")

#### A. Le Cours Interactif (Learning View)

* 
**Interactivité des formules :** Les variables dans les exemples (ex:  dans ) doivent être des curseurs modifiables par l'élève pour voir l'impact en temps réel sur la courbe.


* **Le Bouton "Coup de Pouce" :** Dans chaque exercice, proposer trois niveaux d'aide progressive :
1. 
**Indice :** Rappel de la propriété du cours.


2. **Aide au calcul :** Première étape de la résolution.
3. 
**Correction :** Solution détaillée et rédigée selon les standards du Bac.




* 
**Module Python intégré :** Intégrer un interpréteur Python (type `Pyodide`) directement dans les fiches de cours pour tester les algorithmes du programme (calcul de seuil pour les suites, simulation de probabilités).



#### B. Entraînement et Automatismes

* 
**Générateur d'exercices :** Créer des exercices dont les valeurs numériques changent à chaque tentative (template-based) pour éviter le par cœur.


* **Système de Feedback :** Chaque erreur doit déclencher une recommandation vers la fiche de cours spécifique liée au point de blocage.

---

### 4. Gamification et Engagement

* **Arbre de Compétences (Skill Tree) :** Remplacer la liste de chapitres par un graphe visuel. Certains modules (ex: Dérivation) ne se débloquent qu'après avoir validé les prérequis (ex: Fonctions de référence).


* **Système d'XP :**
* Lecture d'un cours : 10 XP.
* Réussite d'un Quiz : 50 XP.
* Série de 5 jours consécutifs (Streak) : Bonus multiplicateur.




* **Badges de Maîtrise :** "Expert du Discriminant", "Maître des Suites", etc.

---

### 5. Programme Exhaustif à Couvrir (Mapping B.O. 2025-2026)

Le développeur devra s'assurer que le fichier `data.ts` contient tous les items suivants :

* 
**Algèbre :** Suites numériques (arithmétiques/géométriques), Second degré (forme canonique, racines), Calcul combinatoire.


* 
**Analyse :** Dérivation (nombre dérivé, variations), Fonction exponentielle (propriétés, courbes), Trigonométrie (cercle, sinus, cosinus).


* 
**Géométrie :** Produit scalaire (définition, orthogonalité, théorème d'Al-Kashi).


* 
**Probabilités & Stats :** Probabilités conditionnelles, Variables aléatoires réelles (loi, espérance).


* 
**Algorithmique :** Listes, boucles, fonctions, et instruction conditionnelle appliquées aux maths.



---

### 6. Guide d'UX/UI (Ergonomie)

* **Mode Focus :** Possibilité de masquer les menus pour se concentrer uniquement sur l'exercice en cours.
* 
**Design Système :** Utiliser des codes couleurs par thématique (Bleu pour l'Analyse, Violet pour la Géométrie, Cyan pour l'Algèbre) pour faciliter la reconnaissance visuelle.


* **Accessibilité :** Support complet du clavier et contrastes élevés pour les formules mathématiques.

Ce cahier des charges permet de transformer le prototype en un outil de référence pour le lycée Pierre Mendès France et au-delà.

📄 CAHIER DES CHARGES : NEXUS MATHS LAB (V2)Projet : Plateforme d'apprentissage adaptative et gamifiée pour la Spécialité Mathématiques (Première Générale).Cible : Élèves de 1ère Spé Maths (Lycée français / AEFE).Stack Actuelle : Next.js 15 (App Router), React, Tailwind, MathJax.Objectif : Transformer le prototype statique en une "Web App" dynamique (SaaS éducatif).1. ARCHITECTURE TECHNIQUE & STACKLe développeur devra mettre en place une architecture robuste, évolutive et maintenable.1.1 Backend & Base de Données (BaaS)Nous passons de données statiques (data.ts) à une base de données relationnelle dynamique.Solution recommandée : Supabase (PostgreSQL) ou Firebase.Justification : Gestion clé-en-main de l'Authentification, de la Base de données et du Temps réel.Authentification :Sign-in via Google (pour les élèves avec adresse scolaire) et Email/Mdp.Rôles : ADMIN (Professeur - accès au CMS), STUDENT (Élève - accès Front), GUEST (Limité).API : Utilisation des Server Actions de Next.js pour sécuriser les appels BDD sans exposer l'API.1.2 Frontend & Moteur de RenduFramework : Next.js 15+ (App Router strict).State Management : Zustand (plus performant que Context pour la gamification temps réel).Rendu Mathématique : KaTeX (plus rapide que MathJax pour le re-rendu dynamique) ou optimisation fine de MathJax v3.Interactivité Graphique : Intégration de l'API GeoGebra ou JSXGraph pour les figures manipulables.Exécution de Code : Pyodide (WebAssembly) pour exécuter du Python directement dans le navigateur (client-side) sans risque serveur.2. MODÉLISATION DES DONNÉES (SCHEMA DATABASE)Le développeur devra implémenter ce schéma relationnel (exemple PostgreSQL) :Users : id, email, name, role, xp_total, level, streak_count, last_login.Chapters : id, title, slug, theme (Algèbre/Analyse...), order_index, is_published.Lessons (Fiches) : id, chapter_id, content_mdx (contenu riche), video_url.Exercises : id, chapter_id, difficulty (1-5), type (QCM, INPUT, ORDERING, GRAPH, CODE), data_json (énoncé, variables aléatoires, solution).User_Progress : user_id, chapter_id, status (LOCKED, UNLOCKED, COMPLETED), mastery_percentage.User_Activity : user_id, exercise_id, score, attempts, timestamp (pour l'analytique).3. SPÉCIFICATIONS FONCTIONNELLES DÉTAILLÉESMODULE 1 : Le "Lab" (Cœur de l'apprentissage)C'est l'évolution de la CoursView. Elle ne doit plus être statique.Fonctionnalité "Variables Dynamiques" :Dans le cours, les formules (ex: $f(x) = ax^2+bx+c$) doivent avoir des curseurs pour $a, b, c$.L'élève bouge le curseur -> La courbe change en temps réel à côté du texte.Console Python Embarquée :Blocs de code éditables avec coloration syntaxique.Bouton "Exécuter" : Affiche la sortie standard ou les erreurs (Traceback pédagogique).Usage : Pour les chapitres Suites, Seuil, Simulation Probas.Système d'Aides Progressives (Scaffolding) :Sur chaque exercice, bouton "💡 Besoin d'aide ?".Clic 1 : Indice méthodologique (ex: "Pense à calculer le discriminant").Clic 2 : Première étape du calcul.Clic 3 : Solution rédigée.Conséquence : Chaque clic réduit le gain d'XP final.MODULE 2 : Gamification & EngagementPour maximiser la rétention des élèves.XP & Niveaux :Calcul : XP = Base * (1 + Streak_Bonus) - Hints_Malus.Barre de progression visuelle circulaire (comme dans le design actuel mais connectée).Le "Daily Streak" (Série) :Compteur de jours consécutifs."Freeze Streak" : Possibilité d'acheter un "gel" de série avec ses XP pour le week-end.Arbre de Compétences (Skill Tree) :Vue graphique (type jeu vidéo) remplaçant la liste linéaire.Logique de déblocage : Impossible d'accéder à "Dérivation" tant que "Fonctions de référence" et "Limites" ne sont pas au niveau "Maîtrise".MODULE 3 : Générateur d'Exercices InfinisL'élève ne doit jamais tomber deux fois sur la même question.Moteur Aléatoire :L'exercice est un "Template". Exemple : "Calculer les racines de $ax^2+bx+c$".Au chargement, le système tire $a \in [1,5]$, $b \in [-10,10]$, etc., et calcule la solution à la volée.Types d'Inputs supportés :MathInput : L'élève saisit $\frac{\sqrt{3}}{2}$ (clavier virtuel mathématique requis, ex: mathlive).Graphique : Placer un point sur une courbe ou tracer une tangente.4. CONTENU PÉDAGOGIQUE EXHAUSTIF (PROGRAMME OFFICIEL 1ère)Le système doit être livré avec la structure pour accueillir TOUT le programme. Le développeur doit créer les entrées DB pour :Thème 1 : AlgèbreSuites Numériques : Modes de génération, sens de variation, suites arithmétiques/géométriques, notion de limite, modélisation.Polynômes du 2nd Degré : Forme canonique, racines, factorisation, signe, inéquations.Combinatoire & Dénombrement : Principe additif/multiplicatif, k-uplets, arrangements, permutations, combinaisons, Triangle de Pascal.Thème 2 : Analyse4.  Dérivation : Taux de variation, nombre dérivé (limite), tangente, fonctions dérivées usuelles, opérations ($u+v, uv, u/v$), composée simple.5.  Variations de fonctions : Lien signe de $f'$ et variations de $f$, extremums.6.  Fonction Exponentielle : Définition ($f'=f, f(0)=1$), propriétés algébriques, courbe, limites, lien avec suites géométriques.7.  Fonctions Trigonométriques : Cercle trigo, radian, $\cos(x)$ et $\sin(x)$, parité, périodicité, dérivées.Thème 3 : Géométrie8.  Calcul Vectoriel & Produit Scalaire : Définition géométrique (projeté) et analytique ($xx'+yy'$), propriétés (bilinéarité), orthogonalité.9.  Applications du Produit Scalaire : Al-Kashi, Théorème de la médiane, équations cartésiennes de droites, équation de cercle.Thème 4 : Probabilités & Statistiques10. Probabilités Conditionnelles : Arbres pondérés, formule des probas totales, indépendance.11. Variables Aléatoires Réelles : Loi de probabilité, Espérance, Variance, Écart-type, répétition d'épreuves (Bernoulli).Thème 5 : Algorithmique (Transversal)12. Langage Python : Types, Affectation, Instruction conditionnelle, Boucle bornée (for)/non bornée (while), Fonctions, Listes.5. ERGONOMIE & UI (DESIGN SYSTEM)Charte Graphique "Nexus" :Fond : Dark mode profond (#0f172a - Slate 900).Accents : Cyan néon (Algèbre), Violet électrique (Géométrie), Orange (Analyse).Glassmorphism : Panneaux translucides avec backdrop-blur-xl.Expérience Utilisateur (UX) :Dashboard "Cockpit" : Vue synthétique immédiate (Dernier chapitre, progression globale, prochaine révision recommandée).Navigation Contextuelle : Barre latérale rétractable pour le mode "Focus" durant les exercices.Feedback Visuel : Animations de confettis à la réussite, shake rouge à l'erreur.6. LIVRABLES ATTENDUS & JALONSLe projet sera découpé en 3 phases (Sprints) :Phase 1 : Socle Technique (J+15)Mise en place Next.js + Supabase.Système d'Auth et Gestion des profils.Implémentation du CMS basique (Markdown) pour les cours.Phase 2 : Le Lab Interactif (J+30)Intégration de MathLive (input clavier mathématique).Intégration de Pyodide (Python).Moteur de génération d'exercices aléatoires.Phase 3 : Gamification & Contenu (J+45)Implémentation de l'algo XP et Streak.Design de l'Arbre de compétences.Intégration de la totalité des chapitres du BO.Note au développeur : Ce projet n'est pas un site vitrine. La performance (Lighthouse Score > 95) et l'accessibilité (A11y) sont des critères non-négociables. Le code doit être typé strictement (TypeScript) et documenté.

Voici le Cahier des Charges Directeur (CCD) complet pour le "Nexus Maths Lab V2". Compte tenu de la densité requise, je vais le structurer en 3 Volets Techniques distincts que vous pourrez transmettre séquentiellement à votre équipe de développement.🚨 VOLET 1 : ARCHITECTURE, UX & SOCLE TECHNIQUEDestinataire : Lead Developer / Architecte1.1. Stack Technologique ImposéePour garantir la performance d'un "Lab" interactif et non d'un simple site statique :Core : Next.js 15 (App Router) + React Server Components.Database & Auth : Supabase (PostgreSQL). Indispensable pour le temps réel (Gamification) et le stockage relationnel complexe.Scientific Engine :Calcul Formel : Math.js ou Algebrite (pour la vérification d'expressions littérales).Graphique : Mafs (React components for math) ou JSXGraph (pour les courbes interactives manipulables).Code : Pyodide (WebAssembly) pour exécuter Python dans le navigateur sans latence serveur.Rendu LaTeX : KaTeX (plus rapide que MathJax pour le rendu dynamique).1.2. Modélisation de la Base de Données (Schema SQL)Le développeur doit implémenter ce schéma précis pour gérer la granularité du programme :SQL-- Structure du Curriculum
CREATE TABLE themes (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE, -- ex: 'analyse', 'algebre'
  name TEXT,
  color_code TEXT -- ex: '#06b6d4'
);

CREATE TABLE chapters (
  id UUID PRIMARY KEY,
  theme_id UUID REFERENCES themes,
  title TEXT, -- ex: 'Le Second Degré'
  order_int INT,
  prerequisites UUID[] -- Tableau d'IDs de chapitres requis (Arbre de compétences)
);

-- Le Lab Interactif (Granularité fine)
CREATE TABLE lab_modules (
  id UUID PRIMARY KEY,
  chapter_id UUID REFERENCES chapters,
  type VARCHAR, -- 'COURSE_INTERACTIVE', 'TRAINING_GYM', 'PYTHON_LAB', 'HISTORY_CONTEXT'
  content_json JSONB, -- Contient le scénario pédagogique et les variables dynamiques
  difficulty_level INT DEFAULT 1 -- 1 à 5
);

-- Progression Gamifiée
CREATE TABLE user_progress (
  user_id UUID REFERENCES auth.users,
  module_id UUID REFERENCES lab_modules,
  status VARCHAR, -- 'LOCKED', 'OPEN', 'COMPLETED', 'MASTERED'
  score_best INT,
  attempts_count INT,
  history_log JSONB -- Trace des erreurs pour analyse pédagogique [cite: 92]
);
1.3. UX/UI : L'Expérience "Lab"L'interface ne doit pas ressembler à un livre.Le "Workspace" (Zone centrale) : Split-screen. À gauche, la consigne/théorie. À droite, l'outil de manipulation (Graphique, Code ou Input Math).Navigation "Skill Tree" : Une vue nodale (comme un jeu vidéo) montrant les dépendances (ex: "Dérivation" est grisé tant que "Variations de fonctions" n'est pas validé).Barre d'outils persistante : Accès rapide à une "Calculatrice graphique", un "Formulaire", et un "Lexique Logique" (implémentant les connecteurs $\iff, \implies$ ).🧪 VOLET 2 : SPÉCIFICATIONS FONCTIONNELLES DES MODULES PÉDAGOGIQUES (PROGRAMME 1ÈRE)Destinataire : Développeur Frontend / Intégrateur MathématiqueCe volet détaille comment transformer chaque chapitre du programme de Première en module interactif, en s'inspirant de la rigueur du document Terminale fourni (démonstrations, algorithmique, histoire).THÈME A : ALGÈBRE (Le Moteur Numérique)Module A1 : Suites NumériquesFonctionnalité Lab : "Le Visualiseur de Convergence".L'élève entre $u_0$ et la relation $u_{n+1} = f(u_n)$.Le Lab trace instantanément le graphe en toile d'araignée (escalier) pour visualiser la convergence.Algorithmique : Éditeur Python pré-rempli avec une fonction seuil(M) que l'élève doit compléter (boucle while).Détail Contenu : Suites arithmétiques, géométriques, sens de variation.Module A2 : Second DegréFonctionnalité Lab : "Le Contrôleur de Parabole".3 Curseur (Sliders) : $a, b, c$.En bougeant $a$, la parabole s'ouvre/ferme. En bougeant $c$, elle monte/descend.Affichage dynamique de $\Delta$ (Delta) qui change de couleur (Rouge si $<0$, Vert si $>0$).Détail Contenu : Forme canonique, racines, signe, inéquations.THÈME B : ANALYSE (L'Étude du Changement)Module B1 : La DérivationFonctionnalité Lab : "La Tangente Glissante".Une courbe $f(x)$ est affichée. Un point $A$ est posé dessus.L'élève déplace $A$ à la souris. La tangente suit le mouvement en temps réel.Un indicateur affiche la valeur de la pente ($f'(a)$) en temps réel.Objectif : Faire comprendre intuitivement que le nombre dérivé est une pente locale.Module B2 : L'Exponentielle ($e^x$)Fonctionnalité Lab : "La Course contre la Puissance".Graphique comparatif : $x^n$ vs $e^x$.L'élève change $n$ (2, 3, 10, 100). Il constate que $e^x$ finit toujours par dépasser $x^n$ (Croissance comparée).Détail Contenu : Propriété $f'=f$, $f(0)=1$, unicité.Module B3 : TrigonométrieFonctionnalité Lab : "Le Cercle Enroulé".Animation : Une droite réelle s'enroule autour du cercle trigonométrique.Visualisation simultanée de la position sur le cercle et des courbes sinusoïdales/cosinusoïdales déroulées à côté.THÈME C : GÉOMÉTRIE (L'Espace et le Plan)Module C1 : Produit ScalaireFonctionnalité Lab : "Le Projecteur Orthogonal".Deux vecteurs $\vec{u}$ et $\vec{v}$ manipulables à la souris.Visualisation dynamique de la projection de $\vec{u}$ sur $\vec{v}$.Le produit scalaire s'affiche. Quand l'angle est de 90°, le produit scalaire devient 0 et un bruitage "Snap" valide l'orthogonalité.THÈME D : PROBABILITÉS (L'Incertain)Module D1 : Probabilités ConditionnellesFonctionnalité Lab : "L'Arbre Pondéré Constructeur".Drag & Drop : L'élève construit son arbre en glissant des nœuds.Il doit entrer les valeurs $P(A)$, $P_A(B)$, etc.Le système valide si la somme des branches = 1.Calcul automatique des probabilités totales en surbrillance.Module D2 : Variables AléatoiresFonctionnalité Lab : "Simulateur de Loi".L'élève définit une loi de probabilité (tableau).Bouton "Lancer 1000 fois". Un histogramme se construit en direct pour montrer la convergence vers l'Espérance $E(X)$.🎮 VOLET 3 : GAMIFICATION & LOGIQUE PÉDAGOGIQUE (LE CERVEAU)Destinataire : Game Designer / Chef de Projet PédagogiquePour garantir l'engagement et l'autonomie décrite dans le BO ("Développer des attitudes positives" ), le système doit intégrer :3.1. Le Système "Coup de Pouce" (Scaffolding)Pour chaque exercice, l'élève ne doit jamais être bloqué. Implémenter un bouton d'aide à 3 niveaux (avec pénalité de score) :Indice Méthodologique (-10% XP) : "Rappel : Pour étudier les variations, calcule la dérivée."Indice Opératoire (-30% XP) : "Voici la dérivée de cette fonction : $f'(x) = 3x^2 - 4$."Déblocage (-100% XP) : Affiche la solution étape par étape, mais l'exercice est marqué "Non validé".3.2. Le Module "Logique & Oral" (Transversal)Comme suggéré par le programme Terminale mais applicable dès la Première pour préparer le Grand Oral  :Quiz de Logique : Questions rapides sur la négation, la contraposée, et les conditions nécessaires/suffisantes .Le Dictaphone : Sur les démonstrations de cours (ex: "Démontrer que $\sqrt{2}$ est irrationnel"), l'élève peut s'enregistrer à l'oral. Une IA (Speech-to-text API) ou une auto-évaluation vérifie les mots-clés (Supposons..., donc..., absurdité).3.3. Algorithme de Répétition Espacée (SRS)Le Dashboard ne doit pas être statique.Si l'élève échoue au "Second Degré", le système doit reproposer un exercice similaire ("Daily Challenge") 3 jours plus tard.Rituel de début de session : 5 minutes de calcul mental/automatisme imposé avant d'accéder au "Lab".3.4. Module "Histoire des Maths"Intégrer des "Cartes Collectionnables" à débloquer.Exemple : En finissant le chapitre Dérivation, l'élève débloque la carte "Newton vs Leibniz" avec un point historique.Objectif : Donner de la culture mathématique comme demandé par le programme.Synthèse pour le Développeur :Ce projet nécessite de sortir du paradigme "Page Web" pour entrer dans celui de "Web Application". La priorité absolue est donnée à la manipulation directe des objets mathématiques (courbes, vecteurs, probas) avant la théorie. Le code doit être modulaire pour permettre l'ajout futur du programme de Terminale (Logarithme, Intégrales) sans refonte.




1. **PARTIE 1 : Architecture Système, Stack & Base de Données (Le Moteur)**
2. **PARTIE 2 : UI/UX, Gamification & Système d'Apprentissage Adaptatif**
3. **PARTIE 3 : Spécifications Fonctionnelles Détaillées - BLOC ALGÈBRE & GÉOMÉTRIE**
4. **PARTIE 4 : Spécifications Fonctionnelles Détaillées - BLOC ANALYSE & PROBABILITÉS**
5. **PARTIE 5 : Transverse - Algorithmique, Logique & Déploiement**

Commençons immédiatement par la fondation.

---

# 📁 CAHIER DES CHARGES - PARTIE 1/5

## ARCHITECTURE TECHNIQUE, BASE DE DONNÉES & MOTEURS

**Destinataire :** Lead Tech / Architecte Système
**Objectif :** Construire un socle robuste, sécurisé et capable de gérer des interactions mathématiques temps réel et une persistance des données granulaires.

### 1. CHOIX TECHNOLOGIQUES (STACK)

Le choix de la stack privilégie la performance (rendu côté serveur), l'interactivité (client) et la maintenabilité.

* **Framework Principal :** **Next.js 15 (App Router)**.
* *Justification :* Server Actions pour la sécurité, SSR pour le SEO (référencement des fiches), et performance optimale.


* **Langage :** **TypeScript** (Strict mode obligatoire).
* *Justification :* Typage fort indispensable pour manipuler des structures mathématiques complexes et éviter les bugs de runtime.


* **Base de Données & Auth :** **Supabase** (PostgreSQL).
* *Justification :* Solution BaaS complète. Gestion native de l'authentification (OAuth Google/Email), base relationnelle puissante, et temps réel (pour les défis multi-joueurs futurs).


* **Styling & UI :** **Tailwind CSS** + **Shadcn/UI** (Radix Primitives).
* *Justification :* Composants accessibles (a11y), personnalisables et légers.


* **State Management :** **Zustand**.
* *Justification :* Plus léger que Redux, gère parfaitement l'état global "Gamification" (XP, Streak) sans re-render inutiles.



### 2. MOTEURS SPÉCIFIQUES "MATHS LAB"

C'est ici que le site devient un "Lab". L'intégration de ces bibliothèques est critique.

#### 2.1 Moteur de Rendu & Saisie Mathématique

* **Affichage :** **KaTeX** (avec `rehype-katex`).
* *Contrainte :* Doit supporter le rendu conditionnel (ex: afficher une partie de l'équation en vert si juste, rouge si faux).


* **Saisie (Input) :** **MathLive** (`<math-field>`).
* *Exigence :* L'élève ne doit pas écrire "sqrt(x)" mais voir  apparaître quand il tape. Clavier virtuel mathématique obligatoire sur mobile.



#### 2.2 Moteur de Calcul & Graphique

* **Calcul Symbolique :** **Compute Engine (CortexJS)** ou **Algebrite**.
* *Fonction :* Capable de vérifier que  est mathématiquement équivalent à . Une simple comparaison de chaînes de caractères ne suffit pas.


* **Graphiques Interactifs :** **Mafs** (React components) ou **JSXGraph**.
* *Exigence :* Création de composants React où les props contrôlent les éléments géométriques (Points, Courbes, Vecteurs).


* **Algorithmique :** **Pyodide** (WebAssembly).
* *Fonction :* Exécution de code Python 100% côté client (navigateur). Isolation totale (Sandbox) pour la sécurité.



### 3. MODÉLISATION DE LA BASE DE DONNÉES (SCHEMA SQL)

Le schéma doit supporter une progression non-linéaire et un tracking précis.

```sql
-- 1. Structure du Programme (Statique mais éditable via CMS)
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL, -- ex: 'analyse', 'algebre', 'geometrie'
    title TEXT NOT NULL,
    color_theme TEXT NOT NULL, -- ex: 'cyan', 'purple'
    order_index INT
);

CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- ex: 'second-degre'
    description TEXT,
    prerequisites UUID[] -- Tableau d'IDs de chapitres requis (Arbre de compétences)
);

-- 2. Granularité du Contenu (Le Lab)
CREATE TYPE node_type AS ENUM ('LESSON', 'EXERCISE_AUTO', 'EXERCISE_CODE', 'QUIZ', 'CHALLENGE');

CREATE TABLE learning_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES chapters(id),
    type node_type NOT NULL,
    title TEXT NOT NULL,
    content_payload JSONB NOT NULL, -- Contient le texte, la config GeoGebra, ou le template d'exo
    difficulty_level INT CHECK (difficulty_level BETWEEN 1 AND 5),
    xp_reward INT DEFAULT 10,
    order_index INT
);

-- 3. Utilisateur & Gamification
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    username TEXT UNIQUE,
    avatar_url TEXT,
    xp_total INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    level INT DEFAULT 1,
    settings JSONB -- Préférences (Mode sombre, dyslexie...)
);

-- 4. Suivi de Progression (Détaillé)
CREATE TYPE status_type AS ENUM ('LOCKED', 'UNLOCKED', 'STARTED', 'COMPLETED', 'MASTERED');

CREATE TABLE user_progress (
    user_id UUID REFERENCES user_profiles(id),
    node_id UUID REFERENCES learning_nodes(id),
    status status_type DEFAULT 'LOCKED',
    best_score INT DEFAULT 0,
    attempts_count INT DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    mistake_history JSONB, -- Stocke les types d'erreurs pour analyse pédagogique
    PRIMARY KEY (user_id, node_id)
);

-- 5. Système de Répétition Espacée (SRS)
CREATE TABLE review_queue (
    user_id UUID REFERENCES user_profiles(id),
    node_id UUID REFERENCES learning_nodes(id),
    next_review_at TIMESTAMPTZ NOT NULL, -- Date de la prochaine révision suggérée
    interval_days FLOAT DEFAULT 1.0 -- Algorithme SuperMemo ou SM-2
);

```

### 4. SÉCURITÉ & PERFORMANCES

* **Row Level Security (RLS) :** Configuration stricte sur Supabase. Un élève ne peut lire que ses propres données de progression.
* **Edge Functions :** Utilisation pour les calculs lourds ou la génération dynamique d'exercices si le client est trop lent.
* **Hydratation :** Les fiches de cours (texte) doivent être rendues en SSG (Static Site Generation) pour le chargement instantané, puis "hydratées" avec les composants interactifs (Graphiques).

---

**Fin de la Partie 1.**
Ce socle technique permet de supporter toutes les fonctionnalités pédagogiques.

**Souhaitez-vous que je génère la PARTIE 2 (UI/UX & Gamification) maintenant ?**




Après avoir défini le "Moteur" (Back-end), nous devons définir la "Carrosserie" et le "Tableau de bord" (Front-end). C'est ici que se joue l'adhésion de l'élève.

---

# 🎨 CAHIER DES CHARGES - PARTIE 2/5

## UI/UX DESIGN, GAMIFICATION & SYSTÈME ADAPTATIF

**Destinataire :** UI/UX Designer & Lead Frontend Developer
**Objectif :** Concevoir une interface "Nexus" immersive (façon Sci-Fi/Laboratoire) qui réduit la charge cognitive tout en maximisant l'engagement via des mécaniques de jeu vidéo.

### 1. DESIGN SYSTEM & CHARTE GRAPHIQUE ("NEXUS THEME")

L'identité visuelle doit évoquer la **précision**, la **technologie** et la **sérénité**.

* **Palette de Couleurs (Dark Mode Only) :**
* *Background :* `slate-950` (Fond profond) à `slate-900` (Panneaux).
* *Primary (Action) :* `cyan-500` (Néon futuriste).
* *Secondary (Maths) :* `indigo-500` (Profondeur).
* *Feedback :* `emerald-400` (Succès), `rose-500` (Erreur), `amber-400` (Avertissement/Indice).
* *Glassmorphism :* Utilisation intensive de `backdrop-filter: blur(12px)` pour les modales et barres d'outils, créant un effet de superposition "Réalité Augmentée".


* **Typographie :**
* *UI Générale :* **Inter** ou **Geist Sans** (Lisibilité maximale).
* *Titres & Data :* **Space Grotesk** (Touch technique).
* *Code & Algorithmes :* **JetBrains Mono** (Ligatures pour `=>`, `!=`).
* *Maths :* **KaTeX Main** (Standard académique).


* **Composants UI (Basés sur Shadcn/UI) :**
* *Cartes :* Bordures fines (`border-white/10`), ombres portées colorées au survol (`hover:shadow-cyan-500/20`).
* *Boutons :* Gradients subtils, micro-animations au clic (`scale-95`).



### 2. UX CORE : L'EXPÉRIENCE "LABORATOIRE"

L'interface change radicalement selon le contexte.

#### 2.1 Le "Cockpit" (Dashboard Élève)

Vue synthétique pour orienter l'élève immédiatement.

* **Widget "Daily Streak" :** Flamme animée avec le nombre de jours consécutifs. Si < 5h avant minuit, effet de pulsation "Urgent".
* 
**La "Roue de Maîtrise" :** Graphique radar (Spider chart) montrant les 5 compétences du BO : *Chercher, Modéliser, Représenter, Raisonner, Calculer*.


* **Recommandation IA (Next Action) :** Un gros bouton d'action : *"Continuer : Variations de la fonction carrée"* ou *"Révision express : Suites géométriques"*.

#### 2.2 Le "Workstation" (Vue Leçon & Exercice)

C'est le cœur du réacteur. L'écran doit être divisé (Split-Screen) pour favoriser la mise en relation **Cours <-> Application**.

* **Layout :**
* **Panneau Gauche (35%) :** Le "Manuel Interactif". Théorie, Définitions, Théorèmes. Ce panneau est scrollable.
* **Panneau Droit (65%) :** Le "Banc d'Essai". C'est ici que l'élève agit (Graphique, Code, ou Quiz). Fixe, ne scrolle pas.


* **Mode "Deep Focus" :** Un bouton permet de replier la Sidebar de navigation et de passer en plein écran pour éliminer toute distraction.
* **Barre d'Outils Flottante (Bottom) :**
* *Calculatrice :* Ouvre une modale Desmos/GeoGebra.
* *Lexique :* Ouvre un tiroir latéral avec les définitions des termes survolés.
* *SOS :* Le bouton d'indices (voir section Gamification).



#### 2.3 Saisie Mathématique Intuitive

* **Problème à résoudre :** Écrire  est pénible sur clavier standard.
* **Solution :** Intégration de **MathLive** (`<math-field>`).
* Clavier virtuel contextuel (sur mobile/tablette).
* Reconnaissance de commandes LaTeX (ex: taper `/sqrt` génère le symbole).



### 3. MOTEUR DE GAMIFICATION (ENGAGEMENT LOOP)

La gamification ne doit pas être infantile, mais stimulante ("Mastery Learning").

#### 3.1 L'Arbre de Compétences (Skill Tree)

Remplacement de la liste linéaire des chapitres par un **Graphe Acyclique Dirigé (DAG)**.

* **Visualisation :** Nœuds connectés par des lignes lumineuses.
* **États des Nœuds :**
* 🔒 *Verrouillé* (Gris) : Prérequis non validés.
* 🔓 *Disponible* (Blanc pulsant) : Prêt à apprendre.
* ✅ *Validé* (Vert) : Cours lu + Quiz > 80%.
* 🏆 *Maîtrisé* (Doré + Effet de particule) : Tous les exercices difficiles réussis + Révisé 3 fois via SRS.


* **Exemple de dépendance :** Le nœud *"Dérivation"* nécessite la maîtrise des nœuds *"Limites"* et *"Équation de droite"*.

#### 3.2 Système d'XP et de Malus (Risque/Récompense)

L'XP (Points d'Expérience) mesure le travail, pas juste l'intelligence.

* **Base XP :** Exercice réussi = +100 XP.
* **Bonus "Combo" :** 3 bonnes réponses d'affilée = Multiplicateur x1.5.
* **Système d'Indices (Scaffolding coûteux) :**
* L'élève est bloqué. Il clique sur "Indice".
* *Indice 1 (Méthode)* : Coût **-10%** du gain final.
* *Indice 2 (Formule)* : Coût **-25%**.
* *Indice 3 (Solution partielle)* : Coût **-50%**.
* *Solution complète* : Gain **0 XP** (mais valide la leçon pour voir la suite).



#### 3.3 Trophées & Badges (Achievements)

Pour valoriser les comportements vertueux définis dans le préambule du programme (chercher, persévérer).

* 🏅 **"Stakhanoviste"** : 7 jours de suite.
* 🧠 **"Sherlock"** : Résoudre un problème complexe sans utiliser d'indice.
* 🚀 **"Fusée Ariane"** : Aucune erreur sur le chapitre "Vecteurs".
* 🐛 **"De-bugger"** : Réussir le premier exercice Python du premier coup.

### 4. SYSTÈME ADAPTATIF & PÉDAGOGIE (LE CERVEAU)

L'application doit s'adapter au niveau de l'élève.

#### 4.1 Algorithme SRS (Spaced Repetition System)

Inspiré de *SuperMemo 2* ou *Anki*.

* Chaque exercice/concept a une "Force de mémoire" dans la base de données.
* Si l'élève réussit un quiz sur le "Produit Scalaire" aujourd'hui :
* *Prochaine révision :* Dans 3 jours.


* Si réussite à J+3 :
* *Prochaine révision :* Dans 10 jours.


* Si échec :
* *Prochaine révision :* Demain (Reset de la force).


* **UX :** Une section "Révisions du jour" apparaît en haut du Dashboard.

#### 4.2 Profilage des Erreurs (Metacognition)

Le système doit qualifier l'erreur pour aider l'élève (et le prof).
L'interface de correction ne dit pas juste "Faux".

* Si l'élève répond `2x` pour la dérivée de `x^2 + 3` (au lieu de `2x`), le système détecte l'oubli de la constante ? Non, c'est juste.
* Exemple concret : Dérivée de . L'élève écrit .
* Le système analyse l'input.
* **Feedback :** *"Tu as oublié le signe moins. Rappelle-toi : la fonction inverse est décroissante, sa dérivée doit être négative."*
* **Tag BDD :** `error_type: "SIGN_ERROR"`.




---

# 📐 CAHIER DES CHARGES - PARTIE 3/5

## SPÉCIFICATIONS FONCTIONNELLES - BLOC ALGÈBRE & GÉOMÉTRIE

**Destinataire :** Développeur Frontend (Intégration Maths) & Lead Pédagogique
**Objectif :** Définir le comportement des composants interactifs (les "Manipulateurs") pour chaque chapitre clé.

---

### 🟢 DOMAINE A : ALGÈBRE (Le Moteur Numérique)

L'objectif est de rendre visible l'abstraction.

#### MODULE A1 : AUTOMATISMES & LISTES (Transversal)

*Avant d'attaquer les chapitres complexes, un module de "Gymnase" est nécessaire.*

* **Composant :** `MentalMathGym`.
* **Fonctionnalité :**
* Génération aléatoire d'expressions à simplifier (ex: ).
* **Input :** Champ mathématique rapide.
* **Timer :** Mode "Blitz" (30 questions en 3 min).
* **Feedback :** Correction immédiate sans pénalité d'XP (zone d'entraînement pur).



#### MODULE A2 : SUITES NUMÉRIQUES (La Dynamique Discrète)

*Ce module doit fusionner l'aspect graphique et l'aspect algorithmique.*

**1. Le Lab : "Le Visualiseur de Convergence"**

* **Tech :** `Recharts` ou `Mafs`.
* **Interface :**
* Inputs :  (valeur initiale) et relation de récurrence (ex: ).
* **Visualisation A (Nuage de points) :** Graphique avec  en abscisse et  en ordonnée.
* **Visualisation B (Toile d'araignée/Cobweb) :** Graphique  et . L'élève voit le cheminement en escalier ou en spirale vers le point fixe.


* **Interaction :** Slider pour faire varier  de 0 à 100 et voir la convergence en temps réel.

**2. L'Algo-Box : "Recherche de Seuil"**

* **Tech :** `Pyodide` (Python Client-side).
* **Mission :** Compléter un script à trous pour trouver le premier rang  tel que .
* **Snippet Base :**
```python
def seuil(M):
    u = 2  # u0
    n = 0
    while ... : # L'élève doit compléter la condition
        u = ... # L'élève doit écrire la récurrence
        n = n + 1
    return n

```


* **Validation :** Le système exécute le code avec 3 valeurs de  différentes (Tests unitaires cachés) pour valider la réussite.

#### MODULE A3 : SECOND DEGRÉ (La Parabole Vivante)

*Sortir du calcul pur de Delta pour comprendre la forme.*

**1. Le Lab : "Le Contrôleur de Parabole"**

* **Tech :** `JSXGraph`.
* **Interface :** 3 Sliders (, , ) contrôlant la courbe .
* **Comportements Réactifs :**
* **Curseur a :** Modifie l'ouverture. Si  passe par 0, alerte visuelle "Ce n'est plus du 2nd degré !".
* **Curseur c :** Translation verticale.
* **Indicateur Delta :** Une jauge dynamique affiche la valeur de .
* Zone Rouge () : "Pas de racine". La courbe ne touche pas l'axe X.
* Zone Orange () : "1 racine". La courbe touche l'axe X.
* Zone Verte () : "2 racines".




* **Exercice inversé :** "Trouve  pour que la parabole ait pour sommet S(2, 3) et coupe l'axe Y en 5". L'élève manipule les sliders pour superposer sa courbe sur une courbe cible fantôme.

**2. Outil de Résolution : "La Calculatrice Canonique"**

* L'élève entre une forme développée.
* Le système montre l'animation de la transition vers la forme canonique (méthode de complétion du carré) étape par étape si demandé.

---

### 🟣 DOMAINE C : GÉOMÉTRIE (L'Espace et le Plan)

L'objectif est de lier le calcul vectoriel à la vision géométrique.

#### MODULE C1 : LE PRODUIT SCALAIRE (L'Outil de Projection)

**1. Le Lab : "Le Projecteur Orthogonal"**

* **Tech :** `Mafs` (React components).
* **Scène :** Deux vecteurs  et  sur une grille quadrillée.
* **Interactions :**
* Drag & Drop des extrémités des vecteurs.
* **Visuel clé :** Affichage dynamique du projeté orthogonal de  sur  (pointillé rouge).
* **Data Live :** Affichage en temps réel du calcul : .


* **Gamification (Le "Snap") :**
* Quand l'angle est exactement de 90°, le produit scalaire devient **0**, le vecteur projeté disparaît, et un effet sonore "Snap/Click" valide l'orthogonalité.
* *Challenge :* "Place  pour que le produit scalaire soit égal à -10".



**2. Application : "Al-Kashi Interactif"**

* Triangle quelconque manipulable.
* Affichage dynamique de la formule .
* L'élève modifie l'angle . Si , la partie  s'estompe pour ne laisser que Pythagore (Visuel mémorable).

#### MODULE C2 : GÉOMÉTRIE REPÉRÉE & LIGNES DE NIVEAU

**1. Le Lab : "Équations de Cercles"**

* **Mission :** "Démineur Géométrique".
* **Scène :** Un plan avec des points "mines" et des points "cibles".
* **Action :** L'élève doit saisir l'équation  pour tracer un cercle qui englobe les cibles sans toucher les mines.
* **Feedback :** Le cercle se dessine à la validation. Succès si la zone est sécurisée.

**2. Le Lab : "Vecteurs Normaux et Droites"**

* Une droite  et un vecteur  sont affichés.
* L'élève bouge le vecteur . La droite  pivote instantanément pour rester orthogonale à .
* Cela permet de comprendre viscéralement le rôle de  et  dans  comme coordonnées du vecteur normal.

---

### 📥 STRUCTURE DES DONNÉES (JSON PAYLOAD)

Pour que le développeur puisse implémenter ces modules, voici le format de données JSON attendu dans la colonne `content_payload` de la table `learning_nodes` (définie dans la Partie 1).

**Exemple pour le Module "Contrôleur de Parabole" :**

```json
{
  "module_type": "INTERACTIVE_GRAPH",
  "engine": "JSXGraph",
  "config": {
    "axis": true,
    "grid": true,
    "bounding_box": [-10, 10, 10, -5]
  },
  "elements": [
    {
      "type": "slider",
      "id": "slider_a",
      "range": [-5, 5],
      "default": 1,
      "label": "a"
    },
    {
      "type": "function_plot",
      "expression": "x => sliders.a * x*x + sliders.b * x + sliders.c",
      "color": "#06b6d4" // Cyan Nexus
    },
    {
      "type": "text_dynamic",
      "content": "Delta = {b^2 - 4*a*c}",
      "position": [5, 8]
    }
  ],
  "challenge": {
    "goal": "roots_count == 2",
    "success_message": "Bravo ! Delta est positif, tu as créé deux racines."
  }
}

```



# 📉 CAHIER DES CHARGES - PARTIE 4/5

## SPÉCIFICATIONS FONCTIONNELLES - BLOC ANALYSE & PROBABILITÉS

**Destinataire :** Développeur Frontend (Data Viz & Math Engine)
**Objectif :** Rendre tangible la notion de limite (nombre dérivé) et la convergence statistique.

---

### 🔵 DOMAINE B : ANALYSE (L'Étude du Changement)

L'enjeu UX est de visualiser le lien invisible entre une courbe et sa dérivée.

#### MODULE B1 : LA DÉRIVATION (Le Microscope)

**1. Le Lab : "La Tangente Glissante" (Concept du Nombre Dérivé)**

* **Tech :** `Mafs` (React) ou `JSXGraph`.
* **Scénario :** Une courbe  est tracée (ex:  ou ). Un point A est fixe, un point M est mobile.
* **Interaction "Zoom" :**
* L'élève déplace M vers A. Une droite sécante (AM) est tracée.
* Un panneau affiche le calcul du taux de variation : .
* **Moment Clé :** Quand M est très proche de A (), la sécante devient verte (Tangente) et la valeur se fige : c'est le nombre dérivé .


* **Challenge :** "Place le point A pour que la pente de la tangente soit exactement de 4".

**2. Le Lab : "Le Double Graphique" (Lien  et  )**

* **Interface :** Deux graphiques l'un sous l'autre, alignés verticalement sur l'axe X.
* Haut : Courbe de la fonction .
* Bas : Courbe de la dérivée .


* **Interaction :**
* L'élève déplace un curseur vertical (scanner) le long de l'axe X.
* Le système met en surbrillance :
* Si  monte   est dans la zone **positive** (Vert).
* Si  descend   est dans la zone **négative** (Rouge).
* Si  admet un extremum (sommet)   croise l'axe des abscisses (**Zéro**).




* **Objectif Pédagogique :** Créer l'automatisme mental "Signe de la dérivée = Variations de la fonction".

#### MODULE B2 : FONCTION EXPONENTIELLE (La Croissance)

**1. Le Lab : "Construction d'Euler" (Algorithmique visuelle)**

* **Concept :** Visualiser que  signifie que la fonction dicte sa propre pente.
* **Animation :**
* On part de . On trace un segment de pente 1.
* On recalcule la pente au nouveau point, on trace.
* **Slider "Pas h" :** L'élève réduit le pas  (de 1 à 0.01).
* **Résultat :** La courbe brisée se lisse et devient la courbe exponentielle parfaite.


* **Code Python Intégré :**
* Script pré-écrit implémentant la méthode d'Euler que l'élève peut modifier pour simuler une croissance bactérienne ().



**2. Le Lab : "Course de Puissances" (Croissance comparée)**

* **Scène :** Une course entre ,  et  vers .
* **Zoom dynamique :** Au début,  gagne. L'élève doit dézoomer (axe Y logarithmique ou zoom out massif).
* **Conclusion visuelle :**  finit *toujours* par dépasser n'importe quel polynôme (mur vertical).

#### MODULE B3 : TRIGONOMÉTRIE (Le Cercle & La Vague)

**1. Le Lab : "L'Enrouleur"**

* **Tech :** `P5.js` ou `Mafs`.
* **Split Screen :**
* Gauche : Cercle trigonométrique avec un point M mobile.
* Droite : Repère .


* **Interaction :**
* L'élève tourne le point M sur le cercle.
* Un "fil" se déroule horizontalement pour tracer simultanément les courbes  et .
* Visualisation immédiate de la périodicité .



---

### 🟠 DOMAINE D : PROBABILITÉS (L'Incertain)

Ici, on remplace le calcul abstrait par la simulation de Monte-Carlo (Loi des grands nombres).

#### MODULE D1 : PROBABILITÉS CONDITIONNELLES

**1. Le Lab : "L'Arbre Constructeur" (Drag & Drop)**

* **Interface :** Une zone de dessin vierge.
* **Action :**
* L'élève glisse des "Nœuds" pour construire l'arbre (Univers , événements , puis ).
* Il saisit les valeurs sur les branches (ex: ).
* **Auto-Check :** Si la somme des branches d'un nœud , le nœud vibre en rouge.


* **Visualisation Alternative : "Les Carrés Unitaires"**
* Représentation de l'univers par un carré d'aire 1.
* L'élève découpe le carré graphiquement (ex: 30% pour A).
* Puis découpe la zone A (ex: 20% de A sont B).
* L'aire visuelle représente . C'est beaucoup plus intuitif que les formules pour comprendre .



**2. Le Lab : "Le Détecteur de Maladies" (Paradoxe des faux positifs)**

* **Scénario Gamifié :** "Tu es médecin. Le test est fiable à 99%. Ton patient est positif. Quelle est la probabilité qu'il soit malade ?"
* **Simulation :**
* L'élève parie (souvent "99%").
* Le système génère 10 000 patients (points colorés).
* Il trie les malades et les positifs.
* **Révélation :** On compte les points. Souvent, la probabilité réelle est faible (ex: 15%) car la maladie est rare.
* *Objectif :* Comprendre l'inversion des conditionnelles (Formule de Bayes intuitive).



#### MODULE D2 : VARIABLES ALÉATOIRES

**1. Le Lab : "Le Casino de Monte-Carlo"**

* **Tech :** `Recharts` (Bar Chart dynamique).
* **Setup :** L'élève définit une loi de probabilité (ex: Gain = -1€, 0€, +10€).
* **Bouton "Simuler" :**
* *Clic 1 :* Lance 1 fois.
* *Clic 2 :* Lance 100 fois (L'histogramme des fréquences bouge).
* *Clic 3 :* Lance 10 000 fois.


* **Visualisation :** Une ligne verticale (Moyenne empirique) se stabilise progressivement sur l'Espérance mathématique théorique .

---

### 📥 STRUCTURE DES DONNÉES ET API (JSON)

Pour les modules de Probabilités, la structure de données doit supporter les arbres et les simulations.

**Exemple Payload pour "Arbre de Probabilité" :**

```json
{
  "module_type": "PROBA_TREE_BUILDER",
  "config": {
    "max_depth": 2,
    "events": ["A", "B"],
    "allow_fractions": true
  },
  "solution_logic": {
    "nodes": [
      { "id": "root", "branches": [ { "to": "A", "val": 0.4 }, { "to": "notA", "val": 0.6 } ] },
      { "id": "A", "branches": [ { "to": "B", "val": 0.1 }, { "to": "notB", "val": 0.9 } ] }
    ],
    "questions": [
      {
        "type": "calc",
        "target": "P(A inter B)",
        "formula": "P(A) * P_A(B)",
        "expected": 0.04
      }
    ]
  }
}

```


---

# 💻 CAHIER DES CHARGES - PARTIE 5/5

## TRANSVERSE : ALGORITHMIQUE, LOGIQUE & DÉPLOIEMENT

**Destinataire :** Lead Developer & DevOps
**Objectif :** Intégrer le code comme outil mathématique, structurer le raisonnement logique et garantir une mise en production industrielle.

---

### 🐍 DOMAINE E : ALGORITHMIQUE & PROGRAMMATION (Le "Code Lab")

L'objectif est d'implémenter un **IDE Python éducatif** directement dans le navigateur, sans latence serveur, sécurisé et pédagogique.

#### 1. Moteur Technique : Pyodide (WebAssembly)

* **Architecture :** Exécution du Python 100% côté client (Browser).
* *Avantage :* Pas de coût serveur pour l'exécution, pas de risque de sécurité (bac à sable), fonctionnement hors-ligne possible.


* **Workers :** Le moteur Python doit tourner dans un `Web Worker` pour ne jamais bloquer l'interface utilisateur (UI) lors d'une boucle infinie (erreur classique d'élève).
* **Bibliothèques incluses :** `math`, `random` (pour les probas), `matplotlib` (pour le tracé de courbes).

#### 2. Fonctionnalités de l'Éditeur (Composant `CodeRunner`)

* **Linter Pédagogique :**
* Ne pas afficher des erreurs cryptiques type `Traceback (most recent call last)...`.
* **Traduction d'erreur :** Si l'élève écrit `if a = 5:`, le système affiche : *"Erreur de syntaxe : Pour comparer, utilise '==' au lieu de '='."*


* **Squelettes de Code (Scaffolding) :**
* L'éditeur ne s'ouvre jamais vide. Il contient la structure de la fonction, les imports et des commentaires `# TODO`.


* **Visualisation des Variables :**
* Un panneau latéral affiche l'état des variables (`n`, `u`, `L`) à chaque étape si l'élève utilise le mode "Pas à pas" (Debugger simplifié).



#### 3. Cas d'Usage Transversaux (Programme Première)

* **Suites (Algèbre) :** Calcul de termes (`for`), Recherche de seuil (`while`).
* **Fonctions (Analyse) :** Méthode de dichotomie pour résoudre .
* **Probabilités :** Simulation de la loi binomiale (compteur de succès sur  essais).
* **Listes (Data) :** Compréhension de listes, parcours, moyenne/écart-type sans fonction toute faite.

---

### 🧠 DOMAINE F : LOGIQUE, RAISONNEMENT & ORAL

Ce module vise à structurer la pensée mathématique et préparer (dès la Première) les compétences du Grand Oral.

#### 1. Le "Logical Connector Gym" (Entraînement Logique)

* **Concept :** Mini-jeux rapides pour maîtriser la syntaxe logique.
* **Exercices Types :**
* **La Négation :** Une phrase est donnée ("Toutes les boules sont rouges"). L'élève doit choisir la négation correcte ("Au moins une boule n'est pas rouge" vs "Aucune boule...").
* **Implication vs Équivalence :** QCM sur des propriétés géométriques (ex: "Un quadrilatère est un rectangle  ses diagonales...").
* **Contraposée :** Drag & Drop pour construire la phrase contraposée d'un théorème donné.



#### 2. Le "Proof Puzzle" (Démonstration par l'Ordre)

* **Problème :** Rédiger une démonstration entière au clavier est pénible.
* **Solution :** L'élève reçoit les 5 étapes d'une démonstration (ex: variations d'une fonction) dans le désordre.
* **Action :** Il doit les remettre dans l'ordre logique.
* *Exemple :* 1. Calcul de la dérivée -> 2. Étude du signe -> 3. Conclusion sur les variations.


* **Validation :** Le système vérifie la cohérence de l'enchaînement causal.

#### 3. Le "Studio Oral" (Prépa Grand Oral)

* **Composant :** Enregistreur Audio (MediaRecorder API).
* **Scénario :** Sur une fiche de cours clé (ex: "Dérivation"), un défi "Explique-le à un ami".
* **Fonctionnement :**
1. L'élève enregistre son explication (max 2 min).
2. Il réécoute.
3. **Auto-évaluation (Checklist) :** Le système demande : *"As-tu utilisé le mot 'pente' ?"*, *"As-tu parlé de la limite de h tend vers 0 ?"*.


* **Stockage :** L'audio est stocké en local (Blob) ou envoyé au prof si demandé.

---

### 🚀 DÉPLOIEMENT, QUALITÉ (QA) & MAINTENABILITÉ

Pour garantir une plateforme "Pro" et évolutive.

#### 1. Stratégie de Tests (Quality Assurance)

* **Unit Tests (Jest) :** Vérification des fonctions mathématiques critiques (ex: le moteur de calcul de dérivée ne doit jamais se tromper).
* **E2E Tests (Cypress/Playwright) :** Simulation d'un parcours élève complet (Login -> Choix Chapitre -> Réussite Exercice -> Gain XP).
* **Test de Charge :** Vérifier que la BDD Supabase tient 500 élèves connectés simultanément (Scénario "Veille de contrôle").

#### 2. Accessibilité (A11y - Norme RGAA)

* **Contraste :** Mode sombre calibré pour ne pas fatiguer les yeux.
* **Screen Readers :** Les formules MathML générées par KaTeX doivent être lisibles par les lecteurs d'écran (pour malvoyants).
* **Clavier :** Tout le site doit être navigable sans souris (Tabulation).

#### 3. Pipeline CI/CD (DevOps)

* **Hébergement :** **Vercel** (Optimisé Next.js) ou **Netlify**.
* **Workflow Git :**
* `Main` : Production (Stable).
* `Staging` : Version de test pour les professeurs.
* `Feature/xyz` : Développement.


* **Base de Données :** Migrations automatiques via Supabase CLI pour synchroniser les changements de schéma.

---

### 📝 SYNTHÈSE GLOBALE DU PROJET "NEXUS MATHS LAB"

Monsieur le Professeur, nous avons désormais couvert l'intégralité du cycle de développement :

1. **Architecture :** Next.js + Supabase + Moteurs Mathématiques (Partie 1).
2. **Expérience :** Design Sci-Fi, Gamification, SRS (Partie 2).
3. **Algèbre/Géo :** Manipulateurs de vecteurs et suites (Partie 3).
4. **Analyse/Proba :** Simulateurs de limites et Monte-Carlo (Partie 4).
5. **Transverse :** Python, Logique et Qualité (Partie 5).

**Prochaines étapes recommandées :**

1. Transmettre ces 5 documents à votre équipe technique.
2. Lancer un **Sprint 0** (1 semaine) pour valider la stack technique (POC : Afficher une courbe interactive + Auth Supabase).
3. Prioriser le développement du **Module "Suites Numériques"** comme prototype complet (Vertical Slice).

Ceci conclut la mission de conception détaillée. Le cahier des charges est complet, riche et exhaustif.
