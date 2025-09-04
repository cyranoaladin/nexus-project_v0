
import { embedTexts } from './apps/web/server/vector/embeddings';

// Configurer les variables d'environnement pour ce test
process.env.OPENAI_API_KEY = ''; // Force l'échec OpenAI pour tester HF
process.env.VECTOR_DIM = '3072';
process.env.HF_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
process.env.EMBEDDING_PROVIDER = 'huggingface'; // S'assurer que le provider est HF

(async () => {
    try {
        const out = await embedTexts(['Bonjour le monde', 'Algorithmes de graphes']);
        console.log('ok dims:', out.map(v => v.length));
    } catch (e) {
        console.error('embed test error', e);
        process.exit(1);
    }
})();
