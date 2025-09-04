from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from typing import List
import os

# --- Configuration ---
# Récupérer le nom du modèle depuis les variables d'environnement, avec une valeur par défaut.
# Cela rend le service plus flexible.
MODEL_NAME = os.getenv("HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

print(f"Loading Hugging Face embedding model: {MODEL_NAME}...")

# Charger le modèle une seule fois au démarrage de l'application.
# Il sera ainsi gardé en mémoire pour des performances optimales.
try:
    model = SentenceTransformer(MODEL_NAME)
    print("Model loaded successfully.")
except Exception as e:
    print(f"FATAL: Could not load the embedding model. Error: {e}")
    # Si le modèle ne peut pas être chargé, l'application ne doit pas démarrer.
    model = None

# Créer l'instance de l'application FastAPI
app = FastAPI(
    title="Embedding Service",
    description="A simple microservice to generate sentence embeddings using Hugging Face models."
)

# Définir le format des données attendues dans le corps de la requête POST
class EmbeddingRequest(BaseModel):
    texts: List[str]

# --- API Endpoints ---

@app.post("/embed", 
    summary="Generate embeddings for a list of texts",
    response_description="A list of embedding vectors."
)
def create_embeddings(request: EmbeddingRequest):
    """
    Prend une liste de chaînes de caractères en entrée et retourne
    une liste de vecteurs d'embedding correspondants.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Embedding model is not available.")

    if not request.texts:
        return {"embeddings": []}

    try:
        print(f"Generating embeddings for {len(request.texts)} text(s)...")
        # Utilise le modèle chargé pour encoder les textes.
        # .tolist() convertit le résultat (un array numpy) en une liste Python standard, sérialisable en JSON.
        embeddings = model.encode(request.texts).tolist()
        print("Embeddings generated successfully.")
        return {"embeddings": embeddings}
    except Exception as e:
        print(f"Error during embedding generation: {e}")
        # En cas d'erreur pendant le processus, renvoyer une erreur 500.
        raise HTTPException(status_code=500, detail=f"An error occurred during embedding: {str(e)}")


@app.get("/health",
    summary="Health Check",
    response_description="Service status."
)
def health_check():
    """
    Endpoint simple pour vérifier que le service est démarré et fonctionnel.
    """
    return {"status": "ok", "model_loaded": model is not None}
