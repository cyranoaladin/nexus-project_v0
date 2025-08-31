# services/pdf_generator_service/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict
import os
import subprocess

# Import de la logique LaTeX premium
try:
    # Import du module pour permettre le patch dans les tests (main.pdf_logic...)
    from . import pdf_logic as pdf_logic
except Exception:
    import pdf_logic as pdf_logic
from pdf_logic import GenerateurTemplatesLaTeX

app = FastAPI(
    title="ARIA PDF Generator Service",
    description="Microservice pour la génération de documents PDF à partir de contenu LaTeX.",
    version="1.1.0"
)

# Prometheus instrumentation
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app)
except Exception as e:
    print(f"WARN: Prometheus instrumentation not enabled: {e}")

# --- Pydantic Models ---
class PDFRequest(BaseModel):
    contenu: str
    type_document: str
    matiere: str
    nom_fichier: str
    nom_eleve: str = Field(..., description="Nom complet de l'élève pour la personnalisation.")
    # Personnalisation de pied de page (schéma étendu)
    footer_brand: str | None = Field(None, description="Nom de marque à afficher (ex: ARIA/Nexus)")
    footer_coach: str | None = Field(None, description="Nom du coach à afficher si pertinent")
    footer_show_date: bool = Field(True, description="Afficher la date dans l'en-tête")
    footer_extra: str | None = Field(None, description="Texte additionnel pour le pied de page")
    options: Dict[str, Any] = Field(default_factory=dict)

class PDFResponse(BaseModel):
    message: str = "PDF généré avec succès."
    url: str = Field(..., description="L'URL publique (simulée) pour accéder au PDF.")

# --- Logic ---
# Chemin de sortie configurable (tests peuvent définir OUTPUT_DIR)
OUTPUT_DIR = os.getenv('OUTPUT_DIR', "/app/generated_pdfs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.post("/generate", response_model=PDFResponse, status_code=200)
async def generate_pdf(request: PDFRequest):
    """
    Reçoit des données, produit un LaTeX personnalisé via le générateur Premium,
    puis compile le PDF via une boucle itérative robuste.
    """
    file_path = os.path.join(OUTPUT_DIR, request.nom_fichier)
    tex_file = f"{file_path}.tex"

    try:
        # 0. Génération du LaTeX via l'usine "Nexus Premium"
        generator = GenerateurTemplatesLaTeX()
        # Fusionner les options explicites de personnalisation dans le dict options
        opts = dict(request.options or {})
        if request.footer_brand is not None:
            opts['footer_brand'] = request.footer_brand
        if request.footer_coach is not None:
            opts['footer_coach'] = request.footer_coach
        opts['footer_show_date'] = bool(request.footer_show_date)
        if request.footer_extra is not None:
            opts['footer_extra'] = request.footer_extra

        contenu_latex = generator.generer_document(
            type_document=request.type_document,
            contenu=request.contenu,
            matiere=request.matiere,
            nom_eleve=request.nom_eleve,
            options=opts,
        )

        # 1. Écrire le contenu LaTeX dans un fichier .tex
        with open(tex_file, "w", encoding="utf-8") as f:
            f.write(contenu_latex)

        # 2. Compiler avec corrections itératives (robustesse)
        ok, log = generator._compiler_avec_corrections_iteratives(contenu_latex, OUTPUT_DIR)
        if not ok:
            raise RuntimeError(f"Échec de la compilation après corrections. Log: {log}")

        print(f"INFO: Compilation LaTeX réussie pour {request.nom_fichier}.pdf")

        # 3. Retourner une URL simulée
        simulated_url = f"/pdfs/{request.nom_fichier}.pdf"
        return PDFResponse(url=simulated_url)

    except Exception as e:
        print(f"ERREUR: Échec de la génération PDF - {e}")
        raise HTTPException(
            status_code=500,
            detail="Une erreur interne est survenue lors de la génération du PDF."
        )

@app.get("/health")
def health_check():
    return {"status": "ok"}
