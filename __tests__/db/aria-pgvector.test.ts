import { canConnectToTestDb, testPrisma } from '../setup/test-database';

describe('ARIA Stress Test (Real DB + PGVector)', () => {
    let dbAvailable = false;

    beforeAll(async () => {
        dbAvailable = await canConnectToTestDb();
        if (!dbAvailable) {
            console.warn('⚠️  Skipping ARIA PGVector tests: test database not available');
            return;
        }
        // Insert content with a known vector for real nearest-neighbour queries.
        const vector = Array(1536).fill(0.1); 
        const vectorString = `[${vector.join(',')}]`;
        
        // Clean up previous test runs
        await testPrisma.$executeRaw`DELETE FROM "pedagogical_contents" WHERE id = 'stress-test-1'`;

        await testPrisma.$executeRaw`
            INSERT INTO "pedagogical_contents" (id, title, content, subject, "embedding_vector", "updatedAt")
            VALUES (
                'stress-test-1', 
                'Contenu Cible Vectoriel', 
                'Ce contenu doit être retrouvé par la recherche vectorielle grâce au vecteur [0.1...]', 
                'MATHEMATIQUES'::"Subject", 
                ${vectorString}::vector, 
                NOW()
            );
        `;
    }, 10000);

    it('should execute 10 parallel vector searches without crashing', async () => {
        if (!dbAvailable) return;
        const start = Date.now();
        const queryVector = `[${Array(1536).fill(0.1).join(',')}]`;
        const searches = [];
        for (let i = 0; i < 10; i++) {
            searches.push(testPrisma.$queryRaw<Array<{ id: string }>>`
                SELECT id
                FROM "pedagogical_contents"
                WHERE "embedding_vector" IS NOT NULL
                ORDER BY "embedding_vector" <=> ${queryVector}::vector
                LIMIT 1
            `);
        }
        
        const results = await Promise.all(searches);
        const duration = Date.now() - start;
        
        console.log(`⚡ 10 Parallel Requests took ${duration}ms (${duration/10}ms avg)`);

        results.forEach((matches) => {
            expect(matches).toEqual([{ id: 'stress-test-1' }]);
        });
    });
});
