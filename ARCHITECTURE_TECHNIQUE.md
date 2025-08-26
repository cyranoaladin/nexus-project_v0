# Documentation Technique d'Architecture - Projet Nexus Réussite

**Version :** 1.0
**Date :** Janvier 2025
**Auteur :** Alaeddine BEN RHOUMA

---

## 1. Vue d'Ensemble de l'Architecture Applicative

### Architecture Logicielle

**Application Next.js 14 Full-Stack avec App Router** - Architecture moderne
utilisant le nouveau système de routage basé sur les dossiers avec support
SSR/SSG intégré.

### Structure des Dossiers Principaux

```bash
/home/project/
├── app/                          # App Router Next.js 14 - Pages et API Routes
│   ├── api/                      # API Routes backend
│   │   ├── auth/                 # Authentification NextAuth
│   │   ├── aria/                 # Endpoints IA ARIA
│   │   ├── bilan-gratuit/        # Inscription parents/élèves
│   │   ├── messages/             # Système de messagerie
│   │   └── sessions/             # Gestion des réservations
│   ├── auth/                     # Pages d'authentification
│   ├── bilan-gratuit/            # Formulaire d'inscription
│   ├── dashboard/                # Tableaux de bord (à implémenter)
│   └── (pages publiques)/        # Pages marketing
├── components/                   # Composants React réutilisables
│   ├── ui/                       # Composants UI de base (shadcn/ui)
│   ├── layout/                   # Header, Footer, Navigation
│   └── sections/                 # Sections de pages (Hero, Piliers, etc.)
├── lib/                          # Utilitaires et logique métier
│   ├── auth.ts                   # Configuration NextAuth
│   ├── prisma.ts                 # Client Prisma singleton
│   ├── aria.ts                   # Logique IA ARIA
│   ├── credits.ts                # Système de crédits
│   ├── badges.ts                 # Gamification
│   └── validations.ts            # Schémas Zod
├── prisma/                       # Base de données
│   └── schema.prisma             # Modèle de données complet
├── types/                        # Types TypeScript
└── public/                       # Assets statiques
```

**Rôle de chaque dossier :**

- **`/app`** : Routage et API backend Next.js 14
- **`/components`** : Interface utilisateur modulaire
- **`/lib`** : Logique métier centralisée et utilitaires
- **`/prisma`** : Gestion de la base de données
- **`/types`** : Définitions TypeScript partagées

---

## 2. Base de Données & Modèle de Données (Prisma)

### Schéma Final Complet

Le schéma Prisma final implémenté se trouve dans `prisma/schema.prisma` avec
les modèles suivants :

**Modèles Principaux :**

- `User` : Utilisateurs système (tous rôles)
- `ParentProfile`, `StudentProfile`, `CoachProfile` : Profils spécialisés
- `Student` : Entité métier élève (liée au parent)
- `Subscription` : Abonnements mensuels
- `CreditTransaction` : Système de crédits
- `Session` : Cours et ateliers
- `AriaConversation`, `AriaMessage` : IA ARIA
- `Badge`, `StudentBadge` : Gamification
- `Payment` : Transactions financières

### Logique des Relations Clés

**Parent -> Élève(s) (un-à-plusieurs) :**

```prisma
model ParentProfile {
  children Student[] // Un parent peut avoir plusieurs enfants
}

model Student {
  parentId String
  parent   ParentProfile @relation(fields: [parentId], references: [id])
}
```

**Élève -> Coach(s) (plusieurs-à-plusieurs) :**

```prisma
model Session {
  studentId String
  student   Student @relation(fields: [studentId], references: [id])
  coachId   String
  coach     CoachProfile @relation(fields: [coachId], references: [id])
}
```

_Relation gérée via la table de liaison `Session` qui représente les cours._

**Réservation -> Élève et Coach :**

```prisma
model Session {
  id        String @id @default(cuid())
  studentId String // FK vers Student
  coachId   String // FK vers CoachProfile
  // Détails de la session (date, durée, coût, statut)
}
```

### Processus de Migration

**Commande de déploiement confirmée :**

```bash
npx prisma migrate deploy
```

Cette commande applique toutes les migrations en production sans interaction utilisateur.

---

## 3. Authentification & Gestion des Rôles (NextAuth.js)

### Fournisseurs d'Authentification

**Provider configuré :**

- **Credentials Provider** : Email/Password uniquement
- Configuration dans `lib/auth.ts` avec validation bcrypt

### Logique des Rôles et Permissions

**Attribution des rôles :**

- **Lors de l'inscription** : Le formulaire "Bilan Gratuit" crée automatiquement :
  - User parent avec `role: 'PARENT'`
  - User élève avec `role: 'ELEVE'`
- **Création manuelle** : Les autres rôles (ADMIN, ASSISTANTE, COACH) sont
  créés manuellement en base

**Protection des routes :**

```typescript
// Stratégie implémentée dans les API Routes
const session = await getServerSession(authOptions);
if (!session || session.user.role !== 'REQUIRED_ROLE') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Middleware de protection :** À implémenter pour protéger les pages dashboard
selon le rôle.

### Gestion de la Session

**Stratégie JWT confirmée :**

```typescript
session: {
  strategy: 'jwt'; // Tokens signés, pas de stockage en base
}
```

---

## 4. Flux d'Inscription et de Paiement (Logique Métier Critique)

### Flux "Bilan Gratuit"

**Séquence d'événements dans `/api/bilan-gratuit/route.ts` :**

1. **Validation** : Schéma Zod `bilanGratuitSchema`
2. **Vérification unicité** : Email parent n'existe pas
3. **Transaction Prisma** :

   ```typescript
   // 1. Création User parent
   const parentUser = await tx.user.create({
     data: { email, password: hashedPassword, role: 'PARENT', ... }
   })

   // 2. Création ParentProfile
   const parentProfile = await tx.parentProfile.create({
     data: { userId: parentUser.id }
   })

   // 3. Création User élève
   const studentUser = await tx.user.create({
     data: { email: generatedEmail, role: 'ELEVE', ... }
   })

   // 4. Création StudentProfile
   const studentProfile = await tx.studentProfile.create({
     data: { userId: studentUser.id, grade, school, ... }
   })

   // 5. Création Student (entité métier)
   const student = await tx.student.create({
     data: { parentId: parentProfile.id, userId: studentUser.id, ... }
   })
   ```

4. **Email de bienvenue** : Envoi via `lib/email.ts`

### Flux de Paiement

**Konnect (Local) - Architecture préparée :**

```bash
1. Frontend → POST /api/payments/konnect
2. API interne → Création session Konnect
3. Redirection → Page paiement Konnect
4. Retour → Webhook /api/webhooks/konnect
5. Validation → Mise à jour statut commande
```

**Wise (International) - Processus semi-automatisé :**

```bash
1. Affichage coordonnées bancaires Wise
2. Création Payment avec status: 'PENDING'
3. Back-office assistante → Validation manuelle
4. Mise à jour status: 'COMPLETED'
```

---

## 5. Architecture de l'Agent IA "ARIA"

### Appel à l'API OpenAI

**Sécurité confirmée :**

- `OPENAI_API_KEY` utilisée **uniquement côté backend** dans `/api/aria/chat/route.ts`
- **Jamais exposée côté client**
- Appels via `lib/aria.ts` avec client OpenAI sécurisé

### Architecture RAG (Retrieval-Augmented Generation)

**État actuel :**

- **Base vectorielle** : Préparée avec modèle `PedagogicalContent` incluant
  champ `embedding Float[]`
- **Recherche textuelle** : Implémentée comme MVP avec recherche PostgreSQL classique
- **Migration pgvector** : Code structuré pour intégration future facile

**Fonction de recherche actuelle :**

```typescript
// lib/aria.ts - searchKnowledgeBase()
const contents = await prisma.pedagogicalContent.findMany({
  where: {
    subject,
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { content: { contains: query, mode: 'insensitive' } },
    ],
  },
});
```

### Logique de l'Offre

**Vérification des droits ARIA :**

```typescript
// Dans /api/aria/chat/route.ts
const activeSubscription = student.subscriptions[0];
if (!activeSubscription.ariaSubjects.includes(validatedData.subject)) {
  return NextResponse.json({ error: 'Accès ARIA non autorisé' }, { status: 403 });
}
```

---

## 6. Préparation au Déploiement sur VPS

### Variables d'Environnement Exhaustives

**Liste définitive pour production :**

```bash
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/nexusdb?schema=public"

# NextAuth.js
NEXTAUTH_URL="https://nexus-reussite.tn"
NEXTAUTH_SECRET="your-super-secret-jwt-key-min-32-chars"

# OpenAI (IA ARIA)
OPENAI_API_KEY="sk-your-openai-api-key"

# Email SMTP
SMTP_HOST="mail.hostinger.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="contact@nexus-reussite.tn"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="contact@nexus-reussite.tn"

# Paiements Konnect (Tunisie)
NEXT_PUBLIC_KONNECT_API_KEY="your-public-konnect-key"
KONNECT_API_SECRET="your-private-konnect-secret"

# Paiements Wise (International)
NEXT_PUBLIC_WISE_BENEFICIARY_NAME="Nexus Réussite SARL"
WISE_ACCOUNT_DETAILS="your-wise-account-info"

# Environnement
NODE_ENV="production"
```

### Commandes de Build & Démarrage

**Build (dans Dockerfile) :**

```bash
npm ci --omit=dev
npx prisma generate
npm run build
```

**Démarrage production :**

```bash
node server.js
```

_Le fichier `server.js` est généré automatiquement par Next.js 14 avec la
configuration `output: 'standalone'`._

### Dépendances Externes

**Environnement serveur requis :**

- **Node.js v18+** (confirmé dans Dockerfile `FROM node:18-alpine`)
- **PostgreSQL v15+** (pour Prisma et pgvector futur)
- **Docker & Docker Compose** (orchestration)

---

## 7. Points d'Attention pour le Déploiement

### Sécurité

- Toutes les API Routes sont protégées par vérification de session
- Mots de passe hashés avec bcrypt (12 rounds)
- Variables sensibles jamais exposées côté client

### Performance

- Images optimisées avec Next.js Image component
- Composants React optimisés avec Framer Motion
- Base de données indexée sur les requêtes fréquentes

### Monitoring

- Logs structurés dans les API Routes
- Gestion d'erreurs centralisée
- Prêt pour intégration monitoring (Sentry, etc.)

---

**Cette architecture garantit une application robuste, sécurisée et prête pour
la mise en production sur votre VPS dédié.**

---

_Document généré par Alaeddine BEN RHOUMA_
_Contact technique : Disponible pour clarifications et support déploiement_
