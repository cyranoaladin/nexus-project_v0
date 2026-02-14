# Migration Guide - Tests d'Intégration

Ce guide explique comment migrer les tests existants pour utiliser le nouveau setup automatique et éviter les violations de contraintes.

## Problèmes Résolus

### 1. "role 'root' does not exist"
✅ **Résolu** : Configuration DATABASE_URL mise à jour pour utiliser `postgres:postgres`

### 2. Duplicate Key Violations
✅ **Résolu** : Helpers pour données uniques + cleanup automatique

### 3. Exclusion Constraint (Session Overlap)
✅ **Résolu** : Helper `generateNonOverlappingSlots()`

## Migration Rapide

### Avant (Tests qui échouent)

```typescript
describe('User Tests', () => {
  it('should create user', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com', // ❌ Duplicate key!
        name: 'Test User',
        role: 'STUDENT',
        password: 'password123',
      }
    });
    expect(user).toBeDefined();
  });
});
```

### Après (Tests qui passent)

```typescript
import { prisma } from '../setup';
import { createUniqueUserData } from '../helpers/test-data';

describe('User Tests', () => {
  // ✅ Database automatically cleaned before each test
  
  it('should create user', async () => {
    const userData = createUniqueUserData('STUDENT');
    const user = await prisma.user.create({ data: userData });
    expect(user).toBeDefined();
  });
});
```

## Étapes de Migration

### 1. Importer le Setup et les Helpers

```typescript
import { prisma } from '../setup';
import { 
  createUniqueUserData,
  createUniquePaymentData,
  createUniqueSessionData,
  uniqueEmail,
  uniqueExternalId,
} from '../helpers/test-data';
```

### 2. Supprimer les Cleanup Manuels

```typescript
// ❌ AVANT - Cleanup manuel
beforeEach(async () => {
  await prisma.user.deleteMany({});
  await prisma.payment.deleteMany({});
});

// ✅ APRÈS - Cleanup automatique (rien à faire!)
// Le setup.ts s'en charge automatiquement
```

### 3. Utiliser les Helpers pour Données Uniques

#### Utilisateurs

```typescript
// ❌ AVANT
const user = await prisma.user.create({
  data: {
    email: 'test@example.com', // Duplicate!
    name: 'Test User',
    role: 'STUDENT',
  }
});

// ✅ APRÈS
const userData = createUniqueUserData('STUDENT');
const user = await prisma.user.create({ data: userData });
```

#### Paiements

```typescript
// ❌ AVANT
const payment = await prisma.payment.create({
  data: {
    userId: user.id,
    externalId: 'pay_123', // Duplicate!
    method: 'konnect',
    amount: 100,
  }
});

// ✅ APRÈS
const paymentData = createUniquePaymentData(user.id, 'konnect');
const payment = await prisma.payment.create({ data: paymentData });
```

#### Sessions (éviter overlaps)

```typescript
// ❌ AVANT
const session1 = await prisma.sessionBooking.create({
  data: {
    studentId: student.id,
    coachId: coach.id,
    startTime: new Date('2026-02-15T09:00:00'),
    endTime: new Date('2026-02-15T10:00:00'),
    // ... autres champs
  }
});

const session2 = await prisma.sessionBooking.create({
  data: {
    studentId: student.id,
    coachId: coach.id,
    startTime: new Date('2026-02-15T09:30:00'), // ❌ Overlap!
    endTime: new Date('2026-02-15T10:30:00'),
  }
});

// ✅ APRÈS
for (let i = 0; i < 2; i++) {
  const sessionData = createUniqueSessionData(student.id, coach.id, i);
  await prisma.sessionBooking.create({ data: sessionData });
}
```

## Helpers Disponibles

### Génération de Données Uniques

| Helper | Usage | Exemple Output |
|--------|-------|----------------|
| `uniqueEmail(prefix)` | Email unique | `test_1234567890_abc@test.nexus.com` |
| `uniquePseudonym(prefix)` | Pseudonyme coach | `Coach_1234567890_abc` |
| `uniqueExternalId(prefix)` | External ID paiement | `pay_1234567890_abc` |
| `uniquePhone()` | Téléphone | `+21612345678` |
| `uniquePublicShareId()` | Share ID | `share_1234567890_abc` |

### Création d'Objets Complets

| Helper | Paramètres | Retour |
|--------|-----------|--------|
| `createUniqueUserData(role)` | 'STUDENT' \| 'PARENT' \| 'COACH' \| 'ADMIN' | Objet user complet |
| `createUniquePaymentData(userId, method)` | userId: string, method: string | Objet payment complet |
| `createUniqueSessionData(studentId, coachId, slot)` | studentId, coachId, slotIndex | Objet session complet |

### Utilitaires

| Helper | Usage |
|--------|-------|
| `generateNonOverlappingSlots(count)` | Génère N créneaux non-chevauchants |
| `wait(ms)` | Attente async |

## Exemples Complets

### Test Utilisateur Simple

```typescript
import { prisma } from '../setup';
import { createUniqueUserData } from '../helpers/test-data';

describe('User CRUD', () => {
  it('should create and find user', async () => {
    const userData = createUniqueUserData('STUDENT');
    const created = await prisma.user.create({ data: userData });
    
    const found = await prisma.user.findUnique({
      where: { id: created.id }
    });
    
    expect(found).toBeDefined();
    expect(found?.email).toBe(userData.email);
  });
});
```

### Test Paiement avec Relations

```typescript
import { prisma } from '../setup';
import { createUniqueUserData, createUniquePaymentData } from '../helpers/test-data';

describe('Payment Tests', () => {
  it('should create payment for user', async () => {
    // Create user first
    const userData = createUniqueUserData('PARENT');
    const user = await prisma.user.create({ data: userData });
    
    // Create payment
    const paymentData = createUniquePaymentData(user.id, 'konnect');
    const payment = await prisma.payment.create({ data: paymentData });
    
    expect(payment.userId).toBe(user.id);
    expect(payment.externalId).toContain('pay_');
  });
});
```

### Test Sessions Multiples

```typescript
import { prisma } from '../setup';
import { createUniqueUserData, createUniqueSessionData } from '../helpers/test-data';

describe('Session Booking', () => {
  it('should create multiple non-overlapping sessions', async () => {
    const student = await prisma.user.create({
      data: createUniqueUserData('STUDENT')
    });
    
    const coach = await prisma.user.create({
      data: createUniqueUserData('COACH')
    });
    
    // Create 5 sessions without overlap
    for (let i = 0; i < 5; i++) {
      const sessionData = createUniqueSessionData(student.id, coach.id, i);
      await prisma.sessionBooking.create({ data: sessionData });
    }
    
    const sessions = await prisma.sessionBooking.findMany({
      where: { studentId: student.id }
    });
    
    expect(sessions).toHaveLength(5);
  });
});
```

## Configuration CI/CD

Les tests d'intégration dans CI utilisent maintenant :

```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nexus_test
  NODE_ENV: test
```

Le script npm est configuré pour utiliser ces variables :

```json
{
  "scripts": {
    "test:integration": "NODE_ENV=test DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexus_test jest --config jest.config.integration.js --runInBand"
  }
}
```

## Troubleshooting

### Erreur: "role 'root' does not exist"
✅ Résolu - DATABASE_URL utilise maintenant `postgres:postgres`

### Erreur: "duplicate key value violates unique constraint"
✅ Utiliser les helpers `uniqueEmail()`, `createUniqueUserData()`, etc.

### Erreur: "conflicting key value violates exclusion constraint"
✅ Utiliser `createUniqueSessionData()` avec différents `slotIndex`

### Tests échouent localement mais pas en CI
Vérifier que votre PostgreSQL local utilise les mêmes credentials :
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexus_test npm run test:integration
```

## Checklist de Migration

- [ ] Importer `prisma` depuis `../setup`
- [ ] Importer helpers depuis `../helpers/test-data`
- [ ] Supprimer cleanup manuel (`beforeEach`, `afterEach`)
- [ ] Remplacer emails hardcodés par `uniqueEmail()` ou `createUniqueUserData()`
- [ ] Remplacer externalIds hardcodés par `uniqueExternalId()` ou `createUniquePaymentData()`
- [ ] Utiliser `createUniqueSessionData()` pour sessions
- [ ] Vérifier que tests passent localement
- [ ] Vérifier que tests passent en CI

## Support

Pour plus d'informations, voir :
- `__tests__/README.md` - Documentation complète
- `__tests__/setup.ts` - Code du setup automatique
- `__tests__/helpers/test-data.ts` - Code des helpers
- `__tests__/integration/example.integration.test.ts` - Exemple complet
