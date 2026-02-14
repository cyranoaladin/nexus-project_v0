# Question Bank - Modular Architecture

## 📁 Structure

```
lib/assessments/questions/
├── types.ts              # Question, QuestionModule, QuestionOption interfaces
├── loader.ts             # QuestionBank class with dynamic imports
├── index.ts              # Main export (Façade)
│
├── maths/
│   ├── terminale/
│   │   ├── combinatoire.ts    ✅ 6 questions (migrated)
│   │   ├── geometrie.ts       🚧 TODO: Migrate 6 questions
│   │   ├── analyse.ts         🚧 TODO: Migrate 8 questions
│   │   ├── log-exp.ts         🚧 TODO: Migrate 6 questions
│   │   └── probabilites.ts    🚧 TODO: Migrate 4 questions
│   └── premiere/
│       └── algebre.ts         🚧 TODO: Create questions
│
└── nsi/
    ├── terminale/
    │   ├── poo.ts             🚧 TODO: Migrate 3 questions
    │   ├── structures.ts      🚧 TODO: Migrate 4 questions
    │   ├── sql.ts             🚧 TODO: Migrate 5 questions
    │   ├── algorithmique.ts   🚧 TODO: Migrate 4 questions
    │   └── architecture.ts    🚧 TODO: Migrate 4 questions
    └── premiere/
        └── python.ts          🚧 TODO: Create questions
```

## 🚀 Usage

### Load all modules for a subject/grade

```typescript
import { QuestionBank, Subject, Grade } from '@/lib/assessments';

// Load all NSI Terminale modules
const modules = await QuestionBank.load(Subject.NSI, Grade.TERMINALE);
// Returns: [pooModule, structuresModule, sqlModule, algorithmiqueModule, architectureModule]

// Each module contains:
// - id: 'poo'
// - title: 'Programmation Orientée Objet'
// - subject: Subject.NSI
// - grade: 'TERMINALE'
// - category: 'POO'
// - questions: Question[]
```

### Load all questions (flattened)

```typescript
// Get all questions for Maths Terminale
const questions = await QuestionBank.loadAll(Subject.MATHS, Grade.TERMINALE);
// Returns: Question[] (flat array of all questions from all modules)
```

### Load a specific module

```typescript
// Load only the POO module
const pooModule = await QuestionBank.loadModule(Subject.NSI, Grade.TERMINALE, 'poo');

if (pooModule) {
  console.log(pooModule.title); // "Programmation Orientée Objet"
  console.log(pooModule.questions.length); // Number of questions
}
```

### Get available modules

```typescript
// Get list of module IDs for a subject/grade
const moduleIds = QuestionBank.getAvailableModules(Subject.MATHS, Grade.TERMINALE);
// Returns: ['combinatoire', 'geometrie', 'analyse', 'log-exp', 'probabilites']
```

## 📝 Question Structure

### Maths Question Example

```typescript
{
  id: 'MATH-COMB-01',
  subject: Subject.MATHS,
  category: 'Combinatoire',
  weight: 1,                    // 1=easy, 2=medium, 3=hard
  competencies: ['Restituer'],
  questionText: 'Que vaut $\\binom{5}{2}$ ?',
  latexFormula: '\\binom{5}{2}',  // Optional: LaTeX for rendering
  options: [
    { id: 'a', text: '10', isCorrect: true },
    { id: 'b', text: '20', isCorrect: false },
    { id: 'c', text: '25', isCorrect: false },
    { id: 'd', text: '5', isCorrect: false },
  ],
  explanation: '$\\binom{5}{2} = \\frac{5!}{2! \\times 3!} = 10$...',
  hint: 'Optional hint text',
}
```

### NSI Question Example (with code)

```typescript
{
  id: 'NSI-POO-01',
  subject: Subject.NSI,
  category: 'POO',
  weight: 2,
  competencies: ['Appliquer'],
  nsiErrorType: 'SYNTAX',       // SYNTAX | LOGIC | RUNTIME | OPTIMIZATION
  questionText: 'Quel est le résultat de ce code Python ?',
  codeSnippet: `class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

p = Point(3, 4)
print(p.x + p.y)`,
  options: [
    { id: 'a', text: '7', isCorrect: true },
    { id: 'b', text: '34', isCorrect: false },
    { id: 'c', text: 'Erreur', isCorrect: false },
    { id: 'd', text: 'None', isCorrect: false },
  ],
  explanation: 'Le code crée un objet Point avec x=3 et y=4...',
}
```

## 🎯 Benefits

### 1. **Code Splitting**
Only the necessary questions are loaded, reducing initial bundle size.

```typescript
// ❌ Bad: Load all 2000 questions at once
import { ALL_QUESTIONS } from './all-questions';

// ✅ Good: Load only what's needed
const questions = await QuestionBank.loadAll(Subject.NSI, Grade.TERMINALE);
// Only loads ~20 NSI Terminale questions
```

### 2. **Maintainability**
Each module is independent. Adding a new chapter is easy:

```typescript
// Just create a new file: maths/terminale/graphes.ts
export default {
  id: 'graphes',
  title: 'Théorie des Graphes',
  subject: Subject.MATHS,
  grade: 'TERMINALE',
  category: 'Graphes',
  questions: [/* ... */],
};

// Update loader.ts to include it
private static async loadMathsTerminale() {
  const [combinatoire, geometrie, analyse, logExp, probabilites, graphes] = await Promise.all([
    // ... existing imports
    import('./maths/terminale/graphes').then((m) => m.default),
  ]);
  return [combinatoire, geometrie, analyse, logExp, probabilites, graphes];
}
```

### 3. **Type Safety**
All questions are strongly typed with TypeScript:

```typescript
// TypeScript knows the exact structure
const question: Question = {
  id: 'MATH-01',
  subject: Subject.MATHS,  // ✅ Enum, not string
  category: 'Algèbre',
  weight: 2,               // ✅ Only 1 | 2 | 3
  competencies: ['Appliquer'],
  questionText: '...',
  options: [/* ... */],
  explanation: '...',
};
```

## 🔄 Migration Status

### Source: `lib/data/stage-qcm-structure.ts`

**Maths (30 questions total)**:
- ✅ Combinatoire: 6 questions (MIGRATED to `maths/terminale/combinatoire.ts`)
- 🚧 Géométrie: 6 questions (TODO)
- 🚧 Analyse: 8 questions (TODO)
- 🚧 Log/Exp: 6 questions (TODO)
- 🚧 Probabilités: 4 questions (TODO)

**NSI (20 questions total)**:
- 🚧 POO + Structures: 7 questions (TODO: split into poo.ts and structures.ts)
- 🚧 SQL: 5 questions (TODO)
- 🚧 Algorithmique: 4 questions (TODO)
- 🚧 Architecture: 4 questions (TODO)

## 📋 TODO

1. **Migrate remaining Maths questions** from `stage-qcm-structure.ts`
2. **Migrate NSI questions** from `stage-qcm-structure.ts`
3. **Create Première content** (algebre.ts, python.ts)
4. **Add code snippets** to NSI questions (use `codeSnippet` field)
5. **Add LaTeX formulas** to Maths questions (use `latexFormula` field)

## 🧪 Testing

```typescript
// Example test
import { QuestionBank, Subject, Grade } from '@/lib/assessments/questions';

describe('QuestionBank', () => {
  it('should load Maths Terminale modules', async () => {
    const modules = await QuestionBank.load(Subject.MATHS, Grade.TERMINALE);
    
    expect(modules).toHaveLength(5);
    expect(modules[0].id).toBe('combinatoire');
    expect(modules[0].questions.length).toBe(6);
  });
});
```
