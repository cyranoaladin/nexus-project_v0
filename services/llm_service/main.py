# services/llm_service/main.py
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Dict, Any, List
import json

# Client OpenAI
from typing import Optional
import os
OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
OPENAI_ORG: Optional[str] = os.getenv("OPENAI_ORG")
OPENAI_PROJECT: Optional[str] = os.getenv("OPENAI_PROJECT")
_openai_client = None
try:
    # SDK v1.x recommandé
    from openai import OpenAI  # type: ignore
    if OPENAI_API_KEY:
        client_kwargs = {"api_key": OPENAI_API_KEY}
        if OPENAI_ORG:
            client_kwargs["organization"] = OPENAI_ORG
        if OPENAI_PROJECT:
            client_kwargs["project"] = OPENAI_PROJECT
        _openai_client = OpenAI(**client_kwargs)  # type: ignore[arg-type]
    else:
        # Pas de clé -> on laisse l'exception gérée plus bas pour éviter toute réponse simulée
        _openai_client = None
except Exception as e:
    # Impossible d'importer le SDK -> on forcera une erreur contrôlée au runtime
    _openai_client = None

app = FastAPI(
    title="ARIA LLM Service",
    description="Microservice pour la génération de réponses par le LLM.",
    version="1.1.0"
)

# Configuration du modèle et des paramètres d'inférence
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o")
try:
    LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.2"))
except ValueError:
    LLM_TEMPERATURE = 0.2

# Prometheus instrumentation
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app)
except Exception as e:
    print(f"WARN: Prometheus instrumentation not enabled: {e}")

# --- Pydantic Models ---
class LLMRequest(BaseModel):
    contexte_eleve: Dict[str, Any]
    requete_actuelle: str
    requete_type: str
    system_prompt: str | None = Field(
        None,
        description="Prompt système optionnel. Si non fourni, un prompt maître par défaut est utilisé."
    )

class ChatResponse(BaseModel):
    response: str = Field(..., description="La réponse textuelle générée par le LLM.")
    contenu_latex: str | None = Field(None, description="Le contenu formaté en LaTeX pour la génération de PDF (si applicable).")

@app.post("/chat", response_model=ChatResponse)
async def generate_chat_response(request: LLMRequest):
    """
    Génère une réponse basée sur le LLM en construisant un "Master System Prompt" en français.
    """
    # Construction du prompt système (utilise celui fourni si présent, sinon défaut)
    contexte_eleve = request.contexte_eleve or {}

    # Harmoniser les clés possibles provenant de l'orchestrateur
    profil = contexte_eleve.get('profil') or contexte_eleve.get('profile')
    historique = contexte_eleve.get('historique') or contexte_eleve.get('history')
    mastery = contexte_eleve.get('mastery')
    documents = contexte_eleve.get('documents') or contexte_eleve.get('docs')
    decision_hints = contexte_eleve.get('decision_hints') or {}

    default_prompt = f"""
    Tu es ARIA, le coach pédagogique expert de Nexus Réussite. Ta mission est d'agir comme le meilleur professeur particulier pour l'élève.

    CONTEXTE COMPLET DE L'ÉLÈVE (JSON sérialisé)
    - Profil: {json.dumps(profil, ensure_ascii=False)}
    - Mastery: {json.dumps(mastery, ensure_ascii=False)}
    - Historique: {json.dumps(historique, ensure_ascii=False)}
    - Indices décisionnels: {json.dumps(decision_hints, ensure_ascii=False)}
    - Documents: {json.dumps(documents, ensure_ascii=False)}

    RÈGLES IMPÉRATIVES (Anti-hallucination et qualité)
    1) Personnalise: tutoie l'élève et utilise son prénom si disponible.
    2) Ancrage: base tes réponses UNIQUEMENT sur les informations du contexte fourni et sur des connaissances scolaires générales de niveau adapté. Si l'information n'est pas disponible, dis clairement "Je ne sais pas avec certitude" et propose une question de clarification ou une démarche pour la trouver.
    3) Exactitude: ne fabrique JAMAIS de faits (noms, chiffres, théorèmes) sans fondement. Préfère une réponse partielle mais correcte à une réponse complète mais spéculative.
    4) Traçabilité: quand tu utilises un élément issu d'une source (documents RAG ou web), cite-la en fin de réponse sous la forme [source: titre ou url courte]. Si aucune source n'est fournie dans le contexte, n'invente pas de référence.
    5) Pédagogie: approche socratique. Pose des questions guidées, donne des indices progressifs, puis la solution détaillée si l'élève bloque.
    6) Étapes suivantes: propose systématiquement une action concrète (exercice, quiz, fiche de révision).
    7) Sécurité et style: pas de code ou de commandes potentiellement dangereux. Sois clair, structuré, et concis.

    Consignes spéciales selon requete_type:
    - Si requete_type == "PDF_GENERATION": produit également (en plus de la réponse) un contenu LaTeX propre et autonome (documentclass présent) sans \\write18 ni \\input externes. Echappe correctement les caractères spéciaux.
    """

    # Personnalisation conditionnelle selon le statut du profil
    try:
        statut = str(((profil or {}).get('status') or (profil or {}).get('statut') or '')).lower()
    except Exception:
        statut = ''
    if statut == 'candidat_libre':
        default_prompt += "\nConsigne spéciale: cible un enseignement autonome, propose un planning hebdomadaire et des ressources libres."
    elif statut == 'scolarise':
        default_prompt += "\nConsigne spéciale: ancre les explications sur le programme officiel et les attendus d’examen."

    # Ajustements en fonction des decision_hints
    try:
        if decision_hints:
            intervention = decision_hints.get('interventionMode') or decision_hints.get('intervention_mode')
            if intervention == 'REMEDIATION_GUIDEE':
                default_prompt += "\nConsigne spéciale: privilégie une remédiation guidée avec des étapes explicites, vérifications fréquentes, et au moins deux questions ouvertes en fin de réponse."
            focus = decision_hints.get('focusConcepts') or []
            if focus:
                default_prompt += f"\nFocus: concentre l'explication et les exemples sur ces notions: {', '.join([str(x) for x in focus])}."
            if decision_hints.get('requireStepByStep'):
                default_prompt += "\nExige un raisonnement pas-à-pas avec des étapes numérotées."
            if decision_hints.get('requireChecks'):
                default_prompt += "\nAjoute des checks de compréhension (mini-quiz) après chaque grande étape."
    except Exception:
        pass

    prompt_systeme = request.system_prompt or default_prompt

    # Préparation des contenus pour l'API Responses (OpenAI v1)
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": prompt_systeme},
        {"role": "user", "content": request.requete_actuelle},
    ]

    # Appel OpenAI (mode production-like obligatoire)
    if _openai_client is None:
        raise RuntimeError("OPENAI non configuré: vérifiez OPENAI_API_KEY et le SDK OpenAI.")

    # Découverte des modèles disponibles (si autorisé), puis essai séquentiel pour compatibilité
    last_error: Exception | None = None
    content = None
    discovered: list[str] = []
    try:
        # Découvre les modèles accessibles par la clé projet (peut lever PermissionDenied)
        model_page = _openai_client.models.list()
        discovered = [m.id for m in getattr(model_page, "data", [])]
    except Exception:
        discovered = []

    preferred_order = [
        LLM_MODEL,
        "gpt-4o-search-preview-2025-03-11",
        "gpt-4.1-mini-2025-04-14",
        "gpt-4.1-nano-2025-04-14",
        "gpt-4o-audio-preview-2025-06-03",
        "gpt-4.1",
        "gpt-4o",
        "gpt-4.1-mini",
        "gpt-4o-mini",
    ]
    candidate_models: list[str] = []
    seen: set[str] = set()
    # Si on a découvert des modèles, prioriser l'intersection, sinon prendre l'ordre par défaut
    if discovered:
        for m in preferred_order:
            if m and (m in discovered) and m not in seen:
                candidate_models.append(m)
                seen.add(m)
    # Ajoute les restants même s'ils n'apparaissent pas dans discovered (au cas où listing est restreint)
    for m in preferred_order:
        if m and m not in seen:
            candidate_models.append(m)
            seen.add(m)

    for model_name in candidate_models:
        try:
            # Essai 1: API Responses (recommandée pour modèles Omni)
            try:
                resp = _openai_client.responses.create(
                    model=model_name,
                    input=f"{prompt_systeme}\n\nUtilisateur: {request.requete_actuelle}",
                    temperature=LLM_TEMPERATURE,
                )
                try:
                    content = getattr(resp, "output_text", None)
                except Exception:
                    content = None
                if not content:
                    # Extraction manuelle si besoin
                    try:
                        # Certaines versions exposent "output_text" uniquement
                        content = getattr(resp, "output_text", None)
                    except Exception:
                        pass
            except Exception as e_resp:
                # Essai 2: fallback Chat Completions (anciens modèles)
                completion = _openai_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": prompt_systeme},
                        {"role": "user", "content": request.requete_actuelle},
                    ],  # type: ignore[arg-type]
                    temperature=LLM_TEMPERATURE,
                )
                try:
                    content = completion.choices[0].message.content  # type: ignore[attr-defined]
                except Exception:
                    content = str(getattr(getattr(getattr(completion, 'choices', [{}])[0], 'message', {}), 'content', ''))
            if content:
                break
        except Exception as e:
            # Si le modèle n'est pas accessible, on tente le suivant
            err_text = str(e)
            if "model_not_found" in err_text or "PermissionDeniedError" in err_text:
                last_error = e
                continue
            # Autres erreurs: remonter immédiatement
            raise

    if not content:
        raise RuntimeError(f"Echec d'appel OpenAI avec les modèles {candidate_models}: {last_error}")

    # Si PDF demandé, fournir aussi un contenu LaTeX minimal
    latex_content = None
    if request.requete_type == "PDF_GENERATION":
        profil_obj = profil or {}
        # Supporte prénom/firstName
        prenom = profil_obj.get('prenom') or profil_obj.get('firstName') or "élève"
        latex_content = f"\\section*{{Sujet}}\nDocument préparé pour {prenom}.\n"

    # Post-traitement socratique minimal
    try:
        min_questions = 2 if (decision_hints.get('interventionMode') == 'REMEDIATION_GUIDEE') else 1
        content = content or ""
        appended_questions = 0
        if not content.strip().endswith('?'):
            content = content.rstrip() + "\n\nQuestion: Peux-tu m'expliquer où tu bloques précisément pour que je t'aide étape par étape ?"
            appended_questions += 1
        while appended_questions < min_questions:
            content += "\nQuestion: Quelles notions te paraissent les plus difficiles dans cet exercice ?"
            appended_questions += 1
    except Exception:
        pass

    return ChatResponse(response=content or "", contenu_latex=latex_content)

@app.get("/health")
def health_check():
    return {"status": "ok"}
