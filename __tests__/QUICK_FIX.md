# Quick Fix - Tests d'Intégration CI/CD

## Problème Actuel

Les tests d'intégration échouent avec 3 types d'erreurs :

1. ❌ **"role 'root' does not exist"** - Configuration DATABASE_URL incorrecte
2. ❌ **Duplicate key violations** - Données hardcodées non-uniques
3. ❌ **Exclusion constraint violations** - Sessions qui se chevauchent

## Solution Immédiate

### ✅ Déjà Corrigé

1. **DATABASE_URL** - Configuré pour utiliser `postgres:postgres`
2. **Setup automatique** - Cleanup avant chaque test
3. **Helpers** - Fonctions pour données uniques

### 🔧 Action Requise

**Les tests existants doivent être migrés pour utiliser les nouveaux helpers.**

## Migration Express (5 min par test)

### Exemple Rapide

**Avant (échoue):**
```typescript
const user = await prisma.user.create({
  data: {
    email: 'test@example.com', // ❌ Duplicate!
    name: 'Test User',
    role: 'STUDENT',
  }
});
```

**Après (passe):**
```typescript
import { prisma } from '../setup';
import { createUniqueUserData } from '../helpers/test-data';

const userData = createUniqueUserData('STUDENT');
const user = await prisma.user.create({ data: userData });
```

## Helpers Disponibles

| Problème | Helper | Usage |
|----------|--------|-------|
| Email duplicate | `uniqueEmail()` | `email: uniqueEmail('test')` |
| User duplicate | `createUniqueUserData()` | `data: createUniqueUserData('STUDENT')` |
| Payment duplicate | `createUniquePaymentData()` | `data: createUniquePaymentData(userId, 'konnect')` |
| Session overlap | `createUniqueSessionData()` | `data: createUniqueSessionData(studentId, coachId, 0)` |

## Script de Migration Automatique

```bash
# Analyser les tests qui nécessitent une migration
npx tsx scripts/migrate-integration-tests.ts

# Lire le rapport
cat __tests__/MIGRATION_REPORT.md

# Lire le guide complet
cat __tests__/MIGRATION_GUIDE.md
```

## Tests Prioritaires à Migrer

Basé sur les erreurs CI, migrer en priorité :

1. **Tests User** - Duplicate email
2. **Tests Payment** - Duplicate externalId
3. **Tests Coach** - Duplicate pseudonym
4. **Tests Session** - Overlap violations
5. **Tests CreditTransaction** - Duplicate session_usage_key

## Vérification

Après migration de chaque test :

```bash
# Tester un fichier spécifique
npm run test:integration -- path/to/file.test.ts

# Tester tous les tests integration
npm run test:integration

# Vérifier CI
git add . && git commit -m "fix(test): Migrate test to use helpers" && git push
```

## État Actuel

✅ **Infrastructure prête** :
- Setup automatique cleanup
- Helpers données uniques
- Configuration DATABASE_URL
- Documentation complète

⚠️ **Tests existants** :
- Utilisent encore données hardcodées
- Nécessitent migration vers helpers
- Script d'analyse disponible

## Prochaines Étapes

1. **Analyser** : `npx tsx scripts/migrate-integration-tests.ts`
2. **Migrer** : Utiliser guide migration pour chaque test
3. **Tester** : `npm run test:integration`
4. **Commit** : Push et vérifier CI

## Support

- Guide complet : `__tests__/MIGRATION_GUIDE.md`
- Exemples : `__tests__/README.md`
- Script analyse : `scripts/migrate-integration-tests.ts`
