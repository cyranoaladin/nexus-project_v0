import { pipeline } from '@xenova/transformers';

// Désactive le besoin de télécharger les modèles pré-quantifiés qui posent problème.
// On utilisera les modèles standards.
import { env } from '@xenova/transformers';
env.allowQuantized = false;

async function downloadModels() {
  const models = [
    "sentence-transformers/all-MiniLM-L6-v2",
    // Ajoutez ici d'autres modèles que vous pourriez vouloir pré-charger
  ];

  console.log("Starting download of Hugging Face models...");

  for (const modelName of models) {
    try {
      console.log(`Downloading and caching model: ${modelName}`);
      // Le simple fait d'appeler `pipeline` avec un modèle le télécharge et le met en cache.
      await pipeline('feature-extraction', modelName, {
        progress_callback: (progress) => {
          console.log(`  - ${progress.file} (${Math.round(progress.progress)}%)`);
        }
      });
      console.log(`✓ Model ${modelName} cached successfully.`);
    } catch (error) {
      console.error(`✗ Failed to download model ${modelName}:`, error);
    }
  }

  console.log("Model download process finished.");
}

downloadModels();
