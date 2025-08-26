# Cahier des Charges Global & Technique

## Projet: Plateforme Nexus Réussite v4.1

**Version :** 3.0(Finale pour Développement);

---

### 1. Vision & Principes Directeurs

#### 1.1.Mission

Déployer la plateforme de **pédagogie augmentée** de référence pour les lycéens du système français en Tunisie, en fusionnant un accompagnement humain d'élite, une plateforme numérique intelligente et une assistance IA révolutionnaire.

#### 1.2.Principes Directeurs

1. **Confiance Absolue:** Chaque aspect du site doit rassurer le parent sur le fait qu'il fait le meilleur choix pour son enfant.;
2. **Clarté Radicale:** Notre offre est riche.Notre mission est de la présenter de manière si simple que l'utilisateur se sent guidé et non submergé.;
3. **Expérience "WOW" :** Le site doit être un plaisir à utiliser, avec des interactions fluides et une esthétique premium.

---

### 2. Architecture du Site & Parcours Utilisateur

#### 2.1.Plan du Site(Pages Publiques)

- `/` : **Page d'Accueil** (Hub de conversion stratégique)
  - `/equipe` : **Notre Équipe**
- `/offres` : **Offres & Tarifs** (Détail complet du modèle)
- `/notre-centre` : **Le Centre de Tunis**
- `/contact` : **Contact & FAQ**
- `/blog` : **Blog**
- `/bilan-gratuit` : **Formulaire de Diagnostic**

#### 2.2.Parcours Utilisateur Cible(Conversion Parent)

1. **Découverte(Accueil) :** Captivé par la promesse de la "pédagogie augmentée".
2. **Compréhension(Accueil) :** Comprend les piliers(IA, Coachs), le modèle(`Abonnement + Crédits`) et les offres.
3. **Confiance(Page Équipe) :** Rassuré par l'expertise des coachs.;
4. **Action(CTA) :** Clique sur **"Commencer mon Bilan Stratégique Gratuit"**.
5. **Engagement(Formulaire) :** Crée son compte et celui de son enfant, initiant son entrée dans l'écosystème.;

---

### 3. Spécifications Techniques

- **Stack Technique:** **Next.js 14 Full - Stack(App Router)**.
- **Langage :** TypeScript.
- **Styling :** Tailwind CSS.
- **Animations :** Framer Motion.
- **Icônes :** `lucide-react`.
- **Base de Données:** **PostgreSQL**.
- **ORM :** **Prisma**.
- **Authentification :** **NextAuth.js**.
- **Paiements :** Double intégration
- **Konnect** pour les paiements locaux(Tunisie).
  - **Processus semi - automatisé** pour les virements internationaux(Wise).
- **Déploiement Cible:** **VPS Dédié(Ubuntu) via Docker & Docker Compose**, avec Nginx en reverse proxy.
- **Emailing Transactionnel:** SMTP(via Hostinger).

---

### 4. Architecture de l'Agent IA "ARIA"

- **Modèle :** `GPT-4` ou version supérieure d'OpenAI.
  **\*Architecture :** **RAG(Retrieval - Augmented Generation)**.
  - ARIA ne répond pas de manière générique.Ses réponses sont basées sur une **base de données vectorielle** (`pgvector` dans PostgreSQL) contenant nos propres contenus pédagogiques(fiches, cours, exercices).
- **Fonctionnalités Clés:**
  - **Historique des Conversations:** Chaque conversation est sauvegardée et accessible par l'élève, et utilisée pour profiler l'élève et améliorer le contexte des futures interactions.
  - **Feedback Utilisateur:** Un système de notation binaire(👍/👎) doit être implémenté sur chaque réponse d'ARIA pour l'amélioration continue.
