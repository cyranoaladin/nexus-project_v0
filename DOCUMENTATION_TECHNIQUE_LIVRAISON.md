# DOCUMENTATION TECHNIQUE DE LIVRAISON - NEXUS RÉUSSITE

**Version :** 1.0
**Date :** 3 août 2025
**Status :** Production Ready
**Auteur :** Alaeddine BEN RHOUMA

---

## Table des Matières

- [Partie I : Architecture & Environnement](#partie-i--architecture--environnement)
- [Partie II : Base de Données (Prisma)](#partie-ii--base-de-données-prisma)
- [Partie III : Logique Métier & API](#partie-iii--logique-métier--api)
- [Partie IV : Guide pour les Tests et le Déploiement](#partie-iv--guide-pour-les-tests-et-le-déploiement)

---

## Partie I : Architecture & Environnement

### 1.1. Schéma d'Architecture Final

```plaintext
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE NEXUS RÉUSSITE                 │
└─────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
    │   UTILISATEURS  │       │      NGINX      │       │   VPS SERVEUR   │
    │                 │◄─────►│   Reverse Proxy │◄─────►│                 │
    │ • Parents       │       │   Load Balancer │       │ • Docker        │
    │ • Élèves        │       │   SSL/TLS       │       │ • PostgreSQL    │
    │ • Coachs        │       │                 │       │ • Redis (opt.)  │
    │ • Assistantes   │       └─────────────────┘       └─────────────────┘
    └─────────────────┘                │                         │
                                       │                         │
              ┌────────────────────────┼─────────────────────────┼──────────────────────────┐
              │                        ▼                         ▼                          │
              │              ┌─────────────────┐       ┌─────────────────┐                  │
              │              │   NEXT.JS APP   │       │   POSTGRESQL    │                  │
              │              │                 │       │                 │                  │
              │              │ • Frontend SSR  │◄─────►│ • Base Données  │                  │
              │              │ • API Routes    │       │ • Prisma ORM    │                  │
              │              │ • NextAuth      │       │ • Migrations    │                  │
              │              │ • Middleware    │       │                 │                  │
              │              └─────────────────┘       └─────────────────┘                  │
              │                        │                         ▲                          │
              │                        ▼                         │                          │
              │              ┌─────────────────┐                 │                          │
              │              │  SERVICES TIERS │                 │                          │
              │              │                 │                 │                          │
              │              │ • OpenAI API    │─────────────────┘                          │
              │              │ • SMTP (Email)  │                                            │
              │              │ • Konnect Pay   │                                            │
              │              │ • Wise API      │                                            │
              │              │ • Jitsi Meet    │                                            │
              │              └─────────────────┘                                            │
              └────────────────────────────────────────────────────────────────────────────┘

FLUX DE DONNÉES PRINCIPAUX :
1. Authentification : NextAuth ↔ PostgreSQL
2. Paiements : Frontend → API Routes → Konnect/Wise → Webhooks → PostgreSQL
3. IA ARIA : Frontend → API Routes → OpenAI → PostgreSQL (conversations)
4. Visioconférence : Frontend → Jitsi Meet (iframe/redirect)
5. Emails : API Routes → SMTP → Utilisateurs
```

### 1.2. Variables d'Environnement Définitives

**Fichier `.env.example` (RECTIFIÉ - Directives CTO) :**

```bash
# =============================================================================
# CONFIGURATION DATABASE (PostgreSQL Production)
# =============================================================================
DATABASE_URL="postgresql://username:password@localhost:5432/nexus_reussite?schema=public"

# =============================================================================
# CONFIGURATION NEXTAUTH
# =============================================================================
NEXTAUTH_URL="https://nexusreussite.academy"
NEXTAUTH_SECRET="your-super-secret-key-min-32-chars-for-production"

# =============================================================================
# CONFIGURATION SMTP (Hostinger - Rectification CTO)
# =============================================================================
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="contact@nexusreussite.academy"
SMTP_PASSWORD="your-hostinger-smtp-password"
SMTP_FROM="Nexus Réussite <contact@nexusreussite.academy>"

# =============================================================================
# CONFIGURATION OPENAI (IA ARIA)
# =============================================================================
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"

# =============================================================================
# CONFIGURATION PAIEMENTS KONNECT
# =============================================================================
KONNECT_API_KEY="your-konnect-api-key"
KONNECT_WALLET_ID="your-wallet-id"
KONNECT_BASE_URL="https://api.konnect.network"
KONNECT_WEBHOOK_SECRET="your-webhook-secret"

# =============================================================================
# CONFIGURATION PAIEMENTS WISE (Affichage Manuel - Rectification CTO)
# =============================================================================
NEXT_PUBLIC_WISE_BENEFICIARY_NAME="Nexus Réussite SARL"
NEXT_PUBLIC_WISE_IBAN="TN59 1234 5678 9012 3456 7890 12"
NEXT_PUBLIC_WISE_BIC="BANKTNTT"
NEXT_PUBLIC_WISE_ADDRESS="123 Avenue Habib Bourguiba, Tunis 1000, Tunisie"
NEXT_PUBLIC_WISE_BANK_NAME="Banque Internationale Arabe de Tunisie"

# =============================================================================
# CONFIGURATION JITSI MEET
# =============================================================================
JITSI_DOMAIN="meet.jit.si"
# ou instance privée : "jitsi.nexusreussite.academy"

# =============================================================================
# CONFIGURATION ENVIRONNEMENT
# =============================================================================
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://nexusreussite.academy"
```

### 1.3. Procédure de Build & Démarrage

**✅ Configuration Confirmée :**

- `next.config.mjs` : `output: 'standalone'` **ACTIVÉ**
- `experimental.serverComponentsExternalPackages: ['@prisma/client']` **ACTIVÉ**

**Commandes de Production :**

```bash
# 1. Installation des dépendances
npm ci --only=production

# 2. Génération du client Prisma
npx prisma generate

# 3. Migrations de la base de données
npx prisma migrate deploy

# 4. Build de l'application
npm run build

# 5. Démarrage en production
npm run start
```

**Scripts package.json confirmés :**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

---

## Partie II : Base de Données (Prisma)

### 2.1. Schéma Prisma Final

#### ✅ RECTIFICATION CTO : Configuration PostgreSQL par défaut

```prisma
// Configuration Production PostgreSQL (RECTIFIÉE)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Énumérations
enum UserRole {
  ADMIN
  ASSISTANTE
  COACH
  PARENT
  ELEVE
}

enum SubscriptionStatus {
  ACTIVE
  INACTIVE
  CANCELLED
  EXPIRED
}

enum ServiceType {
  COURS_ONLINE
  COURS_PRESENTIEL
  ATELIER_GROUPE
}

enum Subject {
  MATHEMATIQUES
  NSI
  FRANCAIS
  PHILOSOPHIE
  HISTOIRE_GEO
  ANGLAIS
  ESPAGNOL
  PHYSIQUE_CHIMIE
  SVT
  SES
}

enum SessionStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum PaymentType {
  SUBSCRIPTION
  CREDIT_PACK
  SPECIAL_PACK
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

// Modèles principaux (voir fichier complet dans prisma/schema.prisma)
```

### 2.2. Description des Tables Métier Clés

| Table | Rôle Principal | Colonnes Importantes |
|-------|----------------|---------------------|
| **User** | Utilisateur principal avec authentification | `email` (unique), `password` (bcrypt), `role` (ADMIN/PARENT/ELEVE/COACH/ASSISTANTE) |
| **Student** | Entité métier élève liée au parent | `parentId` (FK), `userId` (FK), `grade` (classe scolaire) |
| **Subscription** | Abonnement mensuel de l'élève | `planName` (ACCES_PLATEFORME/HYBRIDE/IMMERSION), `status` (ACTIVE/INACTIVE/CANCELLED), `creditsPerMonth` |
| **CreditTransaction** | Historique des crédits | `type` (MONTHLY_ALLOCATION/PURCHASE/USAGE/REFUND), `amount` (peut être négatif), `expiresAt` |
| **Session** | Cours/ateliers planifiés | `status` (SCHEDULED/COMPLETED/CANCELLED), `creditCost`, `scheduledAt`, `location` (visio URL) |
| **Payment** | Transactions financières | `status` (PENDING/COMPLETED/FAILED), `method` (konnect/wise), `externalId` (ID externe) |
| **AriaConversation** | Conversations avec l'IA | `studentId` (FK), `subject` (matière), `messages` (relation vers AriaMessage) |
| **CoachProfile** | Profil des enseignants | `pseudonym` (Hélios/Zénon), `subjects` (JSON array), `availableOnline` |

### 2.3. Logique de Migration

**Production - Procédure d'initialisation :**

```bash
# 1. Mettre à jour le schema.prisma (sqlite → postgresql)
# 2. Générer une nouvelle migration
npx prisma migrate dev --name init-postgresql

# 3. Déployer en production
npx prisma migrate deploy

# 4. Vérifier le statut
npx prisma migrate status
```

**Commandes de maintenance :**

```bash
# Réinitialiser la DB (DEV uniquement)
npx prisma migrate reset

# Seed initial (données de base)
npx prisma db seed
```

---

## Partie III : Logique Métier & API

### 3.1. Authentification & Rôles

#### Flux d'Inscription ("Bilan Gratuit")

**API Route :** `POST /api/bilan-gratuit`

**Étapes techniques :**

1. **Validation Zod :** `bilanGratuitSchema.parse(body)`
2. **Vérification unicité :** `prisma.user.findUnique({ where: { email } })`
3. **Hash mot de passe :** `bcrypt.hash(password, 12)`
4. **Transaction Prisma :**

   ```typescript
   await prisma.$transaction(async (tx) => {
     // Créer User parent (role: PARENT)
     const parentUser = await tx.user.create({...})

     // Créer ParentProfile
     const parentProfile = await tx.parentProfile.create({...})

     // Créer User élève (role: ELEVE, email auto-généré)
     const studentUser = await tx.user.create({
       email: `${firstName}.${lastName}@nexus-student.local`
     })

     // Créer StudentProfile
     const studentProfile = await tx.studentProfile.create({...})

     // Créer Student (entité métier)
     const student = await tx.student.create({
       parentId: parentProfile.id,
       userId: studentUser.id
     })
   })
   ```

5. **Email de bienvenue :** `sendWelcomeParentEmail()`

#### Flux de Connexion (Login)

**API Route :** `GET/POST /api/auth/callback/credentials` (NextAuth)

**Configuration :** `lib/auth.ts`

**Étapes techniques :**

1. **Récupération utilisateur :** `prisma.user.findUnique({ where: { email } })`
2. **Vérification mot de passe :** `bcrypt.compare(password, user.password)`
3. **Création session :** NextAuth génère JWT avec `user.id`, `user.role`
4. **Retour utilisateur :** Objet avec `id`, `email`, `role`, `firstName`, `lastName`

#### Protection des API

**Middleware :** `middleware.ts`

```typescript
// Protection des routes par rôle
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/admin/:path*',
    '/api/sessions/:path*'
  ]
}
```

**Vérification de session dans chaque route protégée :**

```typescript
const session = await getServerSession(authOptions)
if (!session || session.user.role !== 'ELEVE') {
  return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
}
```

### 3.2. Abonnements, Packs & Crédits

#### Souscription à une Formule

**API Route :** `POST /api/subscriptions/change`

**Workflow technique :**

1. **Authentification :** Vérification session parent
2. **Validation :** Schema Zod avec `planName`, `ariaSubjects`
3. **Récupération tarifs :** Mapping des plans (ACCES_PLATEFORME: 79 TND, HYBRIDE: 179 TND, IMMERSION: 299 TND)
4. **Création Subscription :**

   ```typescript
   await prisma.subscription.create({
     data: {
       studentId,
       planName,
       monthlyPrice,
       creditsPerMonth,
       status: 'ACTIVE',
       startDate: new Date(),
       ariaSubjects: JSON.stringify(ariaSubjects)
     }
   })
   ```

5. **Allocation crédits initiaux :**

   ```typescript
   await prisma.creditTransaction.create({
     data: {
       studentId,
       type: 'MONTHLY_ALLOCATION',
       amount: creditsPerMonth,
       description: `Crédits mensuels - ${planName}`
     }
   })
   ```

#### Achat de Pack

**API Route :** `POST /api/payments/validate`

**Workflow "Pack Grand Oral" :**

1. **Création Payment :** `type: 'SPECIAL_PACK'`, `status: 'PENDING'`
2. **Traitement paiement :** Konnect ou Wise
3. **Webhook confirmation :** Mise à jour `status: 'COMPLETED'`
4. **Attribution crédits :** `CreditTransaction` avec `type: 'PURCHASE'`

#### Logique des Crédits

**Décrémentation lors d'une réservation :**

- **API :** `POST /api/sessions/book`
- **Logique :**

  ```typescript
  // Vérifier solde
  const totalCredits = await calculateTotalCredits(studentId)
  if (totalCredits < sessionCreditCost) {
    throw new Error('Solde insuffisant')
  }

  // Décrémenter
  await prisma.creditTransaction.create({
    data: {
      type: 'USAGE',
      amount: -sessionCreditCost,
      sessionId: newSession.id
    }
  })
  ```

**Report mensuel et expiration :**

- **Cron Job :** `lib/cron-jobs.ts` (exécution quotidienne)
- **Logique :**

  ```typescript
  // Expirer les crédits > 12 mois
  const expiredCredits = await prisma.creditTransaction.findMany({
    where: {
      expiresAt: { lt: new Date() },
      type: 'MONTHLY_ALLOCATION'
    }
  })

  // Créer transactions d'expiration
  for (const credit of expiredCredits) {
    await prisma.creditTransaction.create({
      type: 'EXPIRATION',
      amount: -credit.amount
    })
  }
  ```

### 3.3. Paiements

#### Konnect

**API Routes créées :**

- `POST /api/payments/konnect` : Initier paiement
- `POST /api/webhooks/konnect` : Webhook de confirmation

**Cycle de vie :**

1. **Initialisation :** Création Payment `status: PENDING` + appel API Konnect
2. **Redirection :** Utilisateur vers gateway Konnect
3. **Webhook :** Konnect notifie `/api/webhooks/konnect`
4. **Validation :** Vérification signature + mise à jour `status: COMPLETED`
5. **Attribution :** Crédits ou activation abonnement

#### Wise

**API Routes :**

- `POST /api/payments/wise` : Générer instructions de virement
- `POST /api/payments/wise/confirm` : Validation manuelle assistante

**Logique backend :**

1. **Création Payment :** `status: PENDING`, `method: 'wise'`
2. **Instructions virement :** Génération référence unique
3. **Validation manuelle :** Assistante confirme réception via back-office
4. **Mise à jour :** `status: COMPLETED` + attribution crédits

### 3.4. Agenda & Réservations

#### Création de Session (Booking)

**API Route :** `POST /api/sessions/book`

**Logique technique :**

1. **Validation données :** Date, heure, coach, matière
2. **Vérification crédits :**

   ```typescript
   const totalCredits = await calculateTotalCredits(studentId)
   if (totalCredits < CREDIT_COSTS[serviceType]) {
     return NextResponse.json({ error: 'Solde insuffisant' })
   }
   ```

3. **Vérification disponibilité coach :**

   ```typescript
   const conflictingSessions = await prisma.session.findMany({
     where: {
       coachId,
       scheduledAt: { gte: startTime, lt: endTime },
       status: { not: 'CANCELLED' }
     }
   })
   ```

4. **Transaction atomique :**

   ```typescript
   await prisma.$transaction([
     // Créer session
     prisma.session.create({...}),
     // Décrémenter crédits
     prisma.creditTransaction.create({
       type: 'USAGE',
       amount: -creditCost
     })
   ])
   ```

5. **Génération lien visio :** URL Jitsi unique
6. **Email confirmation :** Notification élève + coach

#### Annulation de Session

**API Route :** `POST /api/sessions/cancel`

**Logique d'annulation :**

1. **Vérification délais :**

   ```typescript
   const hoursUntilSession = differenceInHours(session.scheduledAt, new Date())
   const canCancel = hoursUntilSession >= 24 // ou 48h selon règle
   ```

2. **Remboursement conditionnel :**

   ```typescript
   if (canCancel) {
     await prisma.creditTransaction.create({
       type: 'REFUND',
       amount: session.creditCost
     })
   }
   ```

3. **Mise à jour statut :** `status: 'CANCELLED'`
4. **Notifications :** Email coach + élève

### 3.5. Agent IA "ARIA"

#### API de Chat

**API Route :** `POST /api/aria/chat`

**Séquence technique :**

1. **Authentification :** `session.user.role === 'ELEVE'`
2. **Vérification droits d'accès :**

   ```typescript
   const activeSubscription = await prisma.subscription.findFirst({
     where: { studentId, status: 'ACTIVE' }
   })
   const ariaSubjects = JSON.parse(activeSubscription.ariaSubjects)
   if (!ariaSubjects.includes(requestedSubject)) {
     return NextResponse.json({ error: 'Accès non autorisé à cette matière' })
   }
   ```

3. **Recherche contextuelle :**

   ```typescript
   const relevantContent = await prisma.pedagogicalContent.findMany({
     where: {
       subject: requestedSubject,
       grade: student.grade
     },
     take: 5
   })
   ```

4. **Construction prompt :**

   ```typescript
   const systemPrompt = `Tu es ARIA, l'assistant IA de Nexus Réussite spécialisé en ${subject}.
   Contexte pédagogique : ${relevantContent.map(c => c.content).join('\n')}
   Niveau élève : ${student.grade}`
   ```

5. **Appel OpenAI :**

   ```typescript
   const response = await openai.chat.completions.create({
     model: 'gpt-4o-mini',
     messages: [
       { role: 'system', content: systemPrompt },
       { role: 'user', content: userMessage }
     ]
   })
   ```

6. **Sauvegarde conversation :**

   ```typescript
   await prisma.ariaConversation.create({
     data: {
       studentId,
       subject,
       messages: {
         create: [
           { role: 'user', content: userMessage },
           { role: 'assistant', content: aiResponse }
         ]
       }
     }
   })
   ```

#### API de Feedback

**API Route :** `POST /api/aria/feedback`

**Logique :**

```typescript
await prisma.ariaMessage.update({
  where: { id: messageId },
  data: { feedback: isPositive } // true = 👍, false = 👎
})
```

### 3.6. Visioconférence (Jitsi)

**Génération salle unique :**

```typescript
// Dans /api/sessions/book
const roomName = `nexus-${sessionId}-${Date.now()}`
const jitsiUrl = `https://${process.env.JITSI_DOMAIN}/${roomName}`

await prisma.session.update({
  where: { id: sessionId },
  data: { location: jitsiUrl }
})
```

**Intégration frontend :**

```typescript
// Redirection ou iframe vers session.location
window.open(session.location, '_blank')
```

### 3.7. Emails Transactionnels

**Liste complète des emails automatiques :**

| Email | Déclencheur | Destinataire | API Route |
|-------|-------------|--------------|-----------|
| **Bienvenue Parent** | POST /api/bilan-gratuit | Parent | `sendWelcomeParentEmail()` |
| **Confirmation Réservation** | POST /api/sessions/book | Élève + Coach | `sendBookingConfirmationEmail()` |
| **Rappel Cours 24h** | Cron quotidien | Élève + Coach | `sendSessionReminderEmail()` |
| **Annulation Session** | POST /api/sessions/cancel | Élève + Coach | `sendCancellationEmail()` |
| **Paiement Confirmé** | Webhook Konnect/Wise | Parent | `sendPaymentConfirmationEmail()` |
| **Abonnement Activé** | POST /api/subscriptions/change | Parent | `sendSubscriptionConfirmationEmail()` |
| **Crédits Expirés** | Cron mensuel | Parent | `sendCreditExpirationEmail()` |
| **Rapport Mensuel** | Cron mensuel | Parent | `sendMonthlyReportEmail()` |

**Configuration SMTP :** `lib/email.ts` avec nodemailer

---

## Partie IV : Guide pour les Tests et le Déploiement

### 4.1. Scénarios de Test Utilisateur (Workflow)

#### Scénario 1 : Inscription et Premier Achat

**Acteur :** Nouveau parent
**Objectif :** Valider le parcours complet d'onboarding

**Étapes :**

1. **Page d'accueil :** Clic "Bilan Stratégique Gratuit"
2. **Formulaire inscription :** Saisie données parent + élève
3. **Validation :** Email de bienvenue reçu + accès dashboard
4. **Choix formule :** Sélection "HYBRIDE" (179 TND/mois)
5. **Paiement Konnect :** Transaction test avec CB
6. **Vérification :** 4 crédits ajoutés au compte élève

**Résultat attendu :** Parent connecté, abonnement actif, crédits disponibles

#### Scénario 2 : Réservation et Annulation

**Acteur :** Élève avec crédits
**Objectif :** Tester la logique de réservation/annulation

**Étapes :**

1. **Dashboard élève :** Accès "Réserver un cours"
2. **Sélection :** Coach "Hélios", Mathématiques, Cours online
3. **Planification :** Créneau J+3 à 14h (1 crédit)
4. **Confirmation :** Email reçu + événement dans agenda
5. **Annulation J+2 :** Demande annulation (remboursement OK)
6. **Test limite :** Tentative annulation 2h avant (refus)

**Résultat attendu :** Crédits correctement déduits/remboursés selon règles

#### Scénario 3 : Session IA ARIA

**Acteur :** Élève avec add-on ARIA activé
**Objectif :** Valider l'assistant IA pédagogique

**Étapes :**

1. **Dashboard élève :** Accès "Assistant ARIA"
2. **Sélection matière :** NSI (add-on activé)
3. **Question :** "Explique-moi l'algorithme de tri à bulles"
4. **Vérification réponse :** Contenu pédagogique adapté
5. **Feedback :** Test 👍/👎 sur la réponse
6. **Historique :** Conversation sauvegardée

**Résultat attendu :** Réponses pertinentes + historique conservé

#### Scénario 4 : Gestion des Paiements Wise

**Acteur :** Parent international
**Objectif :** Tester le workflow de paiement manuel

**Étapes :**

1. **Choix paiement :** Sélection "Virement Wise"
2. **Instructions :** Génération référence unique
3. **Simulation virement :** (côté parent)
4. **Validation assistante :** Connexion back-office + confirmation
5. **Attribution :** Crédits/abonnement activé automatiquement

**Résultat attendu :** Workflow manuel fonctionnel + traçabilité complète

#### Scénario 5 : Workflow Coach

**Acteur :** Coach Hélios
**Objectif :** Tester l'interface enseignant

**Étapes :**

1. **Dashboard coach :** Vue agenda + sessions planifiées
2. **Préparation cours :** Accès fiche élève + historique
3. **Session live :** Lancement Jitsi depuis l'interface
4. **Compte-rendu :** Saisie rapport post-cours
5. **Suivi :** Mise à jour progression élève

**Résultat attendu :** Interface coach complète + outils pédagogiques

#### Scénario 6 : Engagement et Conversion par Micro-CTA (NOUVEAU - Directive CTO)

**Acteur :** Visiteur non connecté
**Objectif :** Valider le tunnel de conversion via les nouveaux modules marketing

**Étapes :**

1. **Page d'accueil :** Scroll jusqu'à la section "Curieux de voir ARIA en action ?"
2. **Widget ARIA :** Clic sur "Testez notre IA : Quel est mon profil d'apprenant ?"
3. **Interaction IA :** Échange de 2-3 messages avec ARIA
4. **Capture de Lead :** ARIA propose : "Pour vous donner une recommandation personnalisée, j'ai besoin de votre email"
5. **Saisie Email :** L'utilisateur entre son email
6. **Validation :** Email enregistré en base avec tag "Prospect via Quiz IA"
7. **Recommandation :** ARIA propose le bilan stratégique gratuit

**Résultat attendu :** Visiteur engagé + lead qualifié capturé + redirection naturelle vers conversion

### 4.2. Instructions Spécifiques au Déploiement

#### Étapes Première Mise en Production

**1. Configuration Serveur :**

```bash
# Installation Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installation PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Configuration base de données
sudo -u postgres createdb nexus_reussite
sudo -u postgres createuser --interactive nexus_user
```

**2. Variables d'Environnement :**

```bash
# Copier et configurer .env
cp .env.example .env
# Éditer avec les vraies valeurs de production
nano .env
```

**3. Installation Application :**

```bash
# Clone du repository
git clone [REPO_URL] /var/www/nexus-reussite
cd /var/www/nexus-reussite

# Installation dépendances
npm ci --only=production

# Configuration Prisma
npx prisma generate
npx prisma migrate deploy
```

**4. Seed Initial (OBLIGATOIRE) :**

```bash
# Création du premier compte ADMIN
npm run seed:admin
# ou manuellement :
npx prisma db seed
```

**Script de seed (`prisma/seed.ts`) :**

```typescript
// Créer compte ADMIN par défaut
const admin = await prisma.user.create({
  data: {
    email: 'admin@nexus-reussite.tn',
    password: await bcrypt.hash('AdminSecure2025!', 12),
    role: 'ADMIN',
    firstName: 'Super',
    lastName: 'Admin'
  }
})

// Créer profils coaches initiaux (Hélios, Zénon, etc.)
const coaches = [
  { pseudonym: 'Hélios', subjects: ['MATHEMATIQUES', 'NSI'] },
  { pseudonym: 'Zénon', subjects: ['PHILOSOPHIE', 'FRANCAIS'] }
]
// ... création des profils
```

**3. Configuration Nginx :**

```bash
# RECTIFICATION CTO : Domaine officiel nexusreussite.academy
server {
    listen 80;
    server_name nexusreussite.academy;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**4. Configuration SSL (Let's Encrypt) :**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d nexusreussite.academy
```

**5. Déploiement Docker (RECTIFICATION CTO - Procédure Dockerisée) :**

```bash
# Cloner le repository
git clone [REPO_URL] /var/www/nexus-reussite
cd /var/www/nexus-reussite

# Configurer les variables d'environnement
cp env.example .env
nano .env  # Configurer avec les vraies valeurs

# Lancer avec Docker Compose
docker compose up --build -d

# Les commandes npm ci, npx prisma generate sont exécutées
# automatiquement dans le Dockerfile lors du build
```

**6. Service Docker Compose (remplace systemd) :**

```yaml
# docker-compose.yml avec restart: always
services:
  app:
    build: .
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
```**8. Cron Jobs (Optionnel) :**
```bash
# Ajouter à crontab
0 2 * * * cd /var/www/nexus-reussite && npm run cron:daily
0 0 1 * * cd /var/www/nexus-reussite && npm run cron:monthly
```

#### Commandes de Maintenance

```bash
# Vérifier statut application
sudo systemctl status nexus-reussite

# Logs en temps réel
sudo journalctl -f -u nexus-reussite

# Mise à jour application
git pull origin main
npm ci --only=production
npx prisma migrate deploy
sudo systemctl restart nexus-reussite

# Backup base de données
pg_dump -U nexus_user -h localhost nexus_reussite > backup_$(date +%Y%m%d).sql
```

#### Checklist Pré-Production

- [ ] ✅ Variables d'environnement configurées
- [ ] ✅ Base de données PostgreSQL créée et migrée
- [ ] ✅ Compte ADMIN créé (seed)
- [ ] ✅ Profils coaches initialisés
- [ ] ✅ SMTP configuré et testé
- [ ] ✅ API OpenAI configurée (clé valide)
- [ ] ✅ Webhooks Konnect/Wise configurés
- [ ] ✅ SSL activé (HTTPS)
- [ ] ✅ Nginx reverse proxy fonctionnel
- [ ] ✅ Service systemd actif
- [ ] ✅ Tests des 5 scénarios utilisateur validés
- [ ] ✅ Monitoring et logs configurés

---

## Conclusion

Cette documentation technique de livraison fournit une vision exhaustive de l'architecture et de l'implémentation de la plateforme Nexus Réussite. L'application est prête pour la validation fonctionnelle et le déploiement en production.

### Points d'attention critiques

1. **Configuration PostgreSQL** ✅ RECTIFIÉE - par défaut dans schema.prisma
2. **Configuration SMTP Hostinger** ✅ RECTIFIÉE - smtp.hostinger.com:465
3. **Variables Wise manuelles** ✅ RECTIFIÉES - affichage coordonnées bancaires
4. **Domaine officiel** ✅ RECTIFIÉ - nexusreussite.academy
5. **Déploiement Docker** ✅ RECTIFIÉ - docker compose au lieu de systemd
6. **Micro-engagements marketing** ✅ AJOUTÉS - Widget ARIA + capture leads
7. **Hero Section optimisée** ✅ MODIFIÉE - "Obtenez le Bac avec Mention. Sans Stress."
8. **Nouveau scénario de test 6** ✅ AJOUTÉ - Tunnel conversion micro-CTA

**Équipe de développement :** Alaeddine BEN RHOUMA
**Status :** Prêt pour déploiement avec enrichissements marketing ✅
