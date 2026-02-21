import { generateAriaResponse } from '@/lib/aria';
import { Subject } from '@/types/enums';
import { canConnectToTestDb, testPrisma } from '../setup/test-database';

// Mock lib/prisma to use testPrisma for real DB tests
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

// Mock OpenAI to simulate embedding generation
jest.mock('openai', () => {
  return class OpenAI {
      embeddings = {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }] // Fake vector matching DB data
        })
      };
      chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: "Réponse générée par IA" } }]
          })
        }
      };
  };
});

describe('ARIA Stress Test (Real DB + PGVector)', () => {
    let dbAvailable = false;

    beforeAll(async () => {
        dbAvailable = await canConnectToTestDb();
        if (!dbAvailable) {
            console.warn('⚠️  Skipping ARIA PGVector tests: test database not available');
            return;
        }
        process.env.OPENAI_API_KEY = 'sk-fake-key-for-test'; // Force vector path
        // Insert a content with a KNOWN vector that matches our OpenAI mock
        const vector = Array(1536).fill(0.1); 
        const vectorString = `[${vector.join(',')}]`;
        
        // Clean up previous test runs
        await testPrisma.$executeRaw`DELETE FROM "pedagogical_contents" WHERE id = 'stress-test-1'`;

        await testPrisma.$executeRaw`
            INSERT INTO "pedagogical_contents" (id, title, content, subject, "embedding_vector", "updatedAt", "embedding")
            VALUES (
                'stress-test-1', 
                'Contenu Cible Vectoriel', 
                'Ce contenu doit être retrouvé par la recherche vectorielle grâce au vecteur [0.1...]', 
                'MATHEMATIQUES'::"Subject", 
                ${vectorString}::vector, 
                NOW(),
                '[]'::jsonb
            );
        `;
    }, 10000);

    it('should execute 10 parallel vector searches without crashing', async () => {
        if (!dbAvailable) return;
        const start = Date.now();
        const promises = [];
        for(let i=0; i<10; i++) {
            promises.push(generateAriaResponse('student-stress', Subject.MATHEMATIQUES, 'Question ?'));
        }
        
        const results = await Promise.all(promises);
        const duration = Date.now() - start;
        
        console.log(`⚡ 10 Parallel Requests took ${duration}ms (${duration/10}ms avg)`);

        results.forEach(res => {
            // We verify that the function returned a string (the answer)
            expect(res).toBeTruthy();
            expect(res).not.toContain("difficulté technique");
        });
    });
});
