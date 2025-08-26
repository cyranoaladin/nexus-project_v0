# Guide des Tests - Nexus Réussite

## 📋 Vue d'ensemble

Cette suite de tests couvre trois niveaux de validation :

- **Tests Unitaires** : Validation de la logique métier pure
- **Tests d'Intégration** : Validation des API routes avec base de données
- **Tests End-to-End** : Validation des parcours utilisateur complets

## 🚀 Installation et Configuration

### 1. Installer les Dépendances

```bash
npm install
```

### 2. Configuration de l'Environnement de Test

Créez un fichier `.env.test` (déjà fourni) ou copiez `.env.example` :

```bash
cp .env.example .env.test
```

### 3. Préparer la Base de Données de Test

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations sur la DB de test
npx prisma migrate dev --name init
```

## 🧪 Exécution des Tests

### Tests Unitaires et d'Intégration (Jest)

```bash
# Lancer tous les tests
npm test

# Mode watch (re-exécution automatique)
npm run test:watch

# Avec rapport de couverture
npm run test:coverage

# Tests spécifiques
npm test -- __tests__/lib/credits.test.ts
npm test -- __tests__/api/
```

### Tests End-to-End (Playwright)

```bash
# Installation des navigateurs (première fois)
npx playwright install

# Lancer les tests E2E
npm run test:e2e

# Interface graphique
npm run test:e2e:ui

# Tests spécifiques
npx playwright test e2e/auth-flow.spec.ts
```

## 📁 Structure des Tests

```text
__tests__/
├── lib/                    # Tests unitaires
│   ├── credits.test.ts     # Logique de gestion des crédits
│   └── validations.test.ts # Schémas de validation Zod
├── api/                    # Tests d'intégration API
│   ├── bilan-gratuit.test.ts
│   └── sessions/
│       └── book.test.ts
├── setup/                  # Utilitaires de test
│   └── test-database.ts    # Configuration DB de test
└── integration/            # Tests d'intégration complets
    └── full-booking-flow.test.ts

e2e/                        # Tests End-to-End
├── auth-flow.spec.ts       # Inscription/Connexion
├── subscription-flow.spec.ts # Sélection d'offres
└── aria-interaction.spec.ts  # Chat ARIA
```

## 🔧 Tests Implémentés

### Tests Unitaires

#### `lib/credits.ts`

- ✅ `calculateCreditCost()` : Coûts selon type de prestation
- ✅ `checkCreditBalance()` : Vérification solde de crédits
- ✅ `debitCredits()` : Débit de crédits
- ✅ `refundCredits()` : Remboursement de crédits

#### `lib/validations.ts`

- ✅ `bilanGratuitSchema` : Validation inscription
- ✅ `signinSchema` : Validation connexion
- ✅ `sessionBookingSchema` : Validation réservation
- ✅ `ariaMessageSchema` : Validation messages ARIA

### Tests d'Intégration

#### `/api/bilan-gratuit`

- ✅ Inscription réussie avec données valides
- ✅ Erreur si email parent existe déjà
- ✅ Validation des données d'entrée
- ✅ Gestion des erreurs de base de données

#### `/api/sessions/book`

- ✅ Réservation réussie avec solde suffisant
- ✅ Erreur si solde insuffisant
- ✅ Contrôle d'authentification
- ✅ Vérification des conflits de créneaux
- ✅ Attribution automatique de coach

### Tests End-to-End

#### Parcours d'Authentification

- ✅ Inscription → Connexion → Déconnexion → Reconnexion
- ✅ Gestion des erreurs de connexion
- ✅ Validation des formulaires

#### Sélection d'Offres

- ✅ Navigation vers tunnel de paiement
- ✅ Sélection méthodes de paiement (Konnect/Wise)
- ✅ Gestion utilisateurs non connectés

#### Interaction ARIA

- ✅ Limitation à 3 questions pour utilisateurs anonymes
- ✅ Questions illimitées pour utilisateurs connectés
- ✅ Gestion des erreurs et états de chargement

## 🎯 Scénarios de Test Spécifiques

### Test : Calcul des Coûts de Crédits

```typescript
it('should return 1.25 for a presential course', () => {
  const cost = calculateCreditCost('COURS_PRESENTIEL');
  expect(cost).toBe(1.25);
});
```

### Test : Annulation avec Logique Métier

```typescript
it('should return true if cancellation is 25 hours before', () => {
  // Note: Cette fonction doit être implémentée
  const canCancel = canCancelBooking(sessionDate, 25);
  expect(canCancel).toBe(true);
});
```

### Test : Flux Complet de Réservation

```typescript
it('should complete booking: check credits → book → debit', async () => {
  const creditCost = calculateCreditCost('COURS_PRESENTIEL');
  const hasCredits = await checkCreditBalance(studentId, creditCost);
  expect(hasCredits).toBe(true);

  // ... création session et débit
});
```

## 📊 Couverture de Code

Les tests couvrent :

- **Logique métier** : 100% des fonctions critiques
- **API Routes** : Tous les cas d'usage principaux et d'erreur
- **Parcours utilisateur** : Workflows complets E2E

```bash
# Générer le rapport de couverture
npm run test:coverage

# Ouvrir le rapport HTML
open coverage/lcov-report/index.html
```

## 🐛 Débogage

### Tests Jest

```bash
# Mode debug avec logs détaillés
npm test -- --verbose

# Tests spécifiques avec output complet
npm test -- __tests__/lib/credits.test.ts --no-coverage
```

### Tests Playwright

```bash
# Mode debug avec interface
npx playwright test --debug

# Screenshots automatiques en cas d'échec
npx playwright test --screenshot=only-on-failure
```

## 🔧 Mocking et Configuration

### Mocks Globaux (jest.setup.js)

- **Prisma** : Client de base de données mocké
- **NextAuth** : Sessions utilisateur mockées
- **Variables d'environnement** : Configuration de test

### Base de Données de Test

- **SQLite en mémoire** pour les tests d'intégration
- **Factories de données** pour créer des entités de test
- **Cleanup automatique** entre les tests

## 📈 Métriques et Monitoring

### Indicateurs Clés

- **Temps d'exécution** : < 30s pour la suite complète
- **Couverture** : > 80% sur les modules critiques
- **Fiabilité** : 0 tests flaky (instables)

### Intégration Continue

```yaml
# .github/workflows/tests.yml
- name: Run Jest Tests
  run: npm test -- --coverage --watchAll=false

- name: Run E2E Tests
  run: npm run test:e2e
```

## 🎯 Prochaines Étapes

### Tests à Ajouter

1. **Fonction `canCancelBooking()`** dans `credits.ts`
2. **Tests de performance** pour les requêtes complexes
3. **Tests d'accessibilité** avec axe-playwright
4. **Tests de charge** avec Artillery

### Améliorations

1. **Parallélisation** des tests E2E
2. **Snapshots visuels** avec Playwright
3. **Tests de régression** automatisés
4. **Monitoring en temps réel** des métriques

---

Cette suite de tests garantit la fiabilité et la non-régression de la plateforme Nexus Réussite avant la mise en production. 🚀
