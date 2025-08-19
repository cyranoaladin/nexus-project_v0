# services/rag_service/main.py
import os
import json
import uuid
import math
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Tuple

try:
    from .rag_logic import AnalyseurContenuPedagogique, DocumentPedagogique, rag_index
except Exception:
    from rag_logic import AnalyseurContenuPedagogique, DocumentPedagogique, rag_index

# --- Configuration ---
# Chemin de stockage configurable via variable d'environnement pour les tests
STORAGE_PATH = os.getenv('STORAGE_PATH', "/app/storage")
os.makedirs(STORAGE_PATH, exist_ok=True)

ENABLE_EMBEDDINGS = os.getenv("ENABLE_EMBEDDINGS", "false").lower() == "true"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_EMBEDDINGS_MODEL = os.getenv("OPENAI_EMBEDDINGS_MODEL", "text-embedding-3-small")

SEARCH_PROVIDER = os.getenv("SEARCH_PROVIDER", "").lower()  # e.g., serpapi
SEARCH_API_KEY = os.getenv("SEARCH_API_KEY")

app = FastAPI(
    title="ARIA RAG Service",
    description="Microservice pour l'ingestion et la consultation de documents dans la base de connaissances d'ARIA.",
    version="1.2.0"
)

# Prometheus instrumentation
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app)
except Exception as e:
    print(f"WARN: Prometheus instrumentation not enabled: {e}")

# --- Pydantic Models ---
class IngestRequest(BaseModel):
    contenu: str = Field(..., description="Le contenu principal du document à ingérer.")
    metadata: Dict[str, Any] = Field(..., description="Les métadonnées associées au document (titre, matière, etc.).")

class IngestResponse(BaseModel):
    message: str = "Document ingéré avec succès."
    document_id: str

class Document(BaseModel):
    document_id: str
    contenu: str
    metadata: Dict[str, Any]

class DocumentListResponse(BaseModel):
    documents: List[Document]

class SearchResponse(BaseModel):
    query: str
    count: int
    documents: List[Document]

class QueryRequest(BaseModel):
    question: str = Field(..., description="Question de l'utilisateur")
    k: int = Field(3, description="Nombre de documents à considérer")

class QueryResponse(BaseModel):
    answer: str
    sources: List[Document]

class WebSearchResponse(BaseModel):
    query: str
    results: List[Dict[str, Any]]


# --- In-Memory Cache ---
# Le cache est chargé au démarrage à partir des fichiers stockés.
document_cache: Dict[str, Dict[str, Any]] = {}

def load_documents_from_disk():
    """Charge tous les documents du dossier de stockage dans le cache mémoire."""
    print("INFO: Chargement des documents depuis le disque...")
    for filename in os.listdir(STORAGE_PATH):
        if filename.endswith(".json"):
            file_path = os.path.join(STORAGE_PATH, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    doc_id = data.get("document_id")
                    if doc_id:
                        document_cache[doc_id] = data
            except Exception as e:
                print(f"WARN: Impossible de charger le document {filename}: {e}")
    print(f"INFO: {len(document_cache)} documents chargés en mémoire.")

@app.on_event("startup")
async def startup_event():
    load_documents_from_disk()


# --- Utilitaires de chunking ---
def _split_into_chunks(text: str, max_chars: int = 1200) -> List[str]:
    text = text or ""
    if len(text) <= max_chars:
        return [text]
    chunks: List[str] = []
    current = []
    current_len = 0
    for para in text.split("\n\n"):
        para = para.strip()
        if not para:
            continue
        if current_len + len(para) + 2 > max_chars and current:
            chunks.append("\n\n".join(current))
            current = [para]
            current_len = len(para)
        else:
            current.append(para)
            current_len += len(para) + 2
    if current:
        chunks.append("\n\n".join(current))
    return chunks


@app.post("/ingest", response_model=IngestResponse, status_code=201)
async def ingest_document(request: IngestRequest):
    """
    Analyse le contenu pédagogique et ajoute un DocumentPedagogique à l'index RAG,
    tout en le persistant localement. Le contenu est découpé en chunks pour un meilleur rappel.
    """
    try:
        # 1) Analyse pédagogique
        analyseur = AnalyseurContenuPedagogique()
        doc = analyseur.analyser(request.contenu, request.metadata)

        # 2) Découpage en chunks
        chunks = _split_into_chunks(doc.contenu)
        parent_id = str(uuid.uuid4())
        titre = (doc.metadata or {}).get("titre") or (doc.metadata or {}).get("title") or "Document"

        created_id = parent_id
        for idx, chunk in enumerate(chunks):
            # Enrichir les métadonnées de chunk
            chunk_meta = dict(doc.metadata or {})
            chunk_meta.update({
                "parent_document_id": parent_id,
                "chunk_index": idx,
                "titre": f"{titre} (partie {idx+1}/{len(chunks)})"
            })

            # 3) Ajouter à l'index (base)
            _ = rag_index.ajouter_document(DocumentPedagogique(contenu=chunk, metadata=chunk_meta))

            # 4) Persistance disque + cache (id par chunk)
            chunk_id = str(uuid.uuid4())
            document_data = {
                "document_id": chunk_id,
                "contenu": chunk,
                "metadata": chunk_meta,
            }
            file_path = os.path.join(STORAGE_PATH, f"{chunk_id}.json")
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(document_data, f, ensure_ascii=False, indent=4)
            document_cache[chunk_id] = document_data

        print(f"INFO: Document '{parent_id}' ({titre}) ingéré en {len(chunks)} partie(s) et ajouté à l'index.")
        return IngestResponse(document_id=created_id)

    except Exception as e:
        print(f"ERREUR: Échec de l'ingestion - {e}")
        raise HTTPException(
            status_code=500,
            detail="Une erreur interne est survenue lors de l'ingestion du document."
        )


@app.get("/documents", response_model=DocumentListResponse)
async def get_ingested_documents():
    """
    Retourne la liste de tous les documents actuellement dans le cache.
    """
    try:
        documents_list = [
            Document(
                document_id=doc_id,
                contenu=data.get("contenu", ""),
                metadata=data.get("metadata", {})
            )
            for doc_id, data in document_cache.items()
        ]
        return DocumentListResponse(documents=documents_list)
    except Exception as e:
        print(f"ERREUR: Échec de la récupération des documents - {e}")
        raise HTTPException(
            status_code=500,
            detail="Une erreur interne est survenue lors de la récupération des documents."
        )


@app.get("/search", response_model=SearchResponse)
async def search_documents(q: str, limit: int = 10):
    """
    Recherche par sous-chaîne dans le contenu et le titre (metadata.titre).
    """
    try:
        q_lower = (q or '').strip().lower()
        if not q_lower:
            return SearchResponse(query=q, count=0, documents=[])
        results: List[Document] = []
        for doc_id, data in document_cache.items():
            contenu = (data.get("contenu") or "")
            meta = (data.get("metadata") or {})
            titre = (meta.get("titre") or "")
            hay = f"{titre}\n{contenu}".lower()
            if q_lower in hay:
                results.append(Document(document_id=doc_id, contenu=contenu, metadata=meta))
                if len(results) >= max(1, min(limit, 50)):
                    break
        return SearchResponse(query=q, count=len(results), documents=results)
    except Exception as e:
        print(f"ERREUR: Échec de la recherche - {e}")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue lors de la recherche.")


# --- TF-IDF et embeddings (fallback) ---
def _tokenize(text: str) -> List[str]:
    return [t for t in (text or '').lower().replace("\n", " ").split() if t]


def _tfidf_rank(question: str, candidates: List[Tuple[str, Dict[str, Any]]], top_k: int) -> List[str]:
    q_terms = _tokenize(question)
    if not q_terms:
        return []
    # Construire DF sur le corpus
    N = max(1, len(candidates))
    df: Dict[str, int] = {}
    docs_tokens: Dict[str, List[str]] = {}
    for doc_id, data in candidates:
        texte = f"{(data.get('metadata') or {}).get('titre','')}\n{data.get('contenu','')}"
        tokens = list(set(_tokenize(texte)))
        docs_tokens[doc_id] = tokens
        for tok in tokens:
            df[tok] = df.get(tok, 0) + 1
    # Scoring TF-IDF (requête traitée comme un sac de termes)
    scores: List[Tuple[str, float]] = []
    for doc_id, data in candidates:
        texte = f"{(data.get('metadata') or {}).get('titre','')}\n{data.get('contenu','')}"
        toks = _tokenize(texte)
        if not toks:
            continue
        # TF
        tf: Dict[str, float] = {}
        for t in toks:
            tf[t] = tf.get(t, 0.0) + 1.0
        # Normaliser TF
        L = float(len(toks))
        if L > 0:
            for t in list(tf.keys()):
                tf[t] /= L
        # Score somme(tf*idf) pour les termes de la requête
        score = 0.0
        for qt in q_terms:
            idf = math.log((N + 1) / (1 + df.get(qt, 0))) + 1.0
            score += tf.get(qt, 0.0) * idf
        if score > 0:
            scores.append((doc_id, score))
    scores.sort(key=lambda x: x[1], reverse=True)
    return [doc_id for doc_id, _ in scores[:max(1, min(top_k, 10))]]


async def _embedding_rank(question: str, candidates: List[Tuple[str, Dict[str, Any]]], top_k: int) -> List[str]:
    """Classement par embeddings OpenAI si activé, sinon renvoie []."""
    if not (ENABLE_EMBEDDINGS and OPENAI_API_KEY):
        return []
    try:
        import aiohttp
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        async with aiohttp.ClientSession(headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as session:
            # Embedding de la question
            async with session.post("https://api.openai.com/v1/embeddings", json={"model": OPENAI_EMBEDDINGS_MODEL, "input": question}) as rq:
                qvec = (await rq.json()).get("data", [{}])[0].get("embedding")
            if not qvec:
                return []
            # Embeddings des documents (troncature pour budget)
            inputs = [f"{(d.get('metadata') or {}).get('titre','')}\n{d.get('contenu','')}"[:2000] for _, d in candidates]
            async with session.post("https://api.openai.com/v1/embeddings", json={"model": OPENAI_EMBEDDINGS_MODEL, "input": inputs}) as rd:
                data = await rd.json()
                vecs = [item.get("embedding") for item in data.get("data", [])]
            # Similarité cosine
            def cos(a, b):
                import math
                da = math.sqrt(sum(x*x for x in a)) or 1.0
                db = math.sqrt(sum(x*x for x in b)) or 1.0
                return sum(x*y for x, y in zip(a, b)) / (da * db)
            scored = []
            for (doc_id, _data), vec in zip(candidates, vecs):
                if vec:
                    scored.append((doc_id, cos(qvec, vec)))
            scored.sort(key=lambda x: x[1], reverse=True)
            return [doc_id for doc_id, _ in scored[:max(1, min(top_k, 10))]]
    except Exception as e:
        print(f"WARN: embeddings ranking disabled due to error: {e}")
        return []


@app.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    """
    Récupère les k meilleurs chunks, classements TF-IDF avec fallback embeddings, et synthétise une réponse courte.
    """
    try:
        question = request.question or ""
        if not question.strip():
            return QueryResponse(answer="", sources=[])

        candidates: List[Tuple[str, Dict[str, Any]]] = list(document_cache.items())
        if not candidates:
            return QueryResponse(answer="", sources=[])

        # 1) Essayer embeddings si activé, sinon TF-IDF
        ordered_ids: List[str] = await _embedding_rank(question, candidates, request.k)
        if not ordered_ids:
            ordered_ids = _tfidf_rank(question, candidates, request.k)

        sources = [
            Document(
                document_id=doc_id,
                contenu=document_cache[doc_id].get('contenu', ''),
                metadata=document_cache[doc_id].get('metadata', {})
            )
            for doc_id in ordered_ids if doc_id in document_cache
        ]

        # 2) Synthèse basique à partir des meilleures sources (premières lignes)
        snippets: List[str] = []
        for s in sources:
            first = (s.contenu or '').strip().split('\n')[0]
            if first:
                snippets.append(first[:200])
        answer = " ".join(snippets)[:800] if snippets else ""
        return QueryResponse(answer=answer, sources=sources)
    except Exception as e:
        print(f"ERREUR: Échec de la requête RAG - {e}")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue lors de la requête RAG.")


@app.get("/websearch", response_model=WebSearchResponse)
async def web_search(q: str, num: int = 5):
    """
    Proxy de recherche Web optionnel. Sans configuration, renvoie une liste vide.
    Fournisseurs possibles: SERPAPI (SEARCH_PROVIDER=serpapi, SEARCH_API_KEY)
    """
    try:
        q = (q or '').strip()
        if not q:
            return WebSearchResponse(query=q, results=[])
        if not (SEARCH_PROVIDER and SEARCH_API_KEY):
            return WebSearchResponse(query=q, results=[])
        # Implémentation minimale SERPAPI JSON
        if SEARCH_PROVIDER == 'serpapi':
            import httpx
            params = {"engine": "google", "q": q, "num": max(1, min(num, 10)), "api_key": SEARCH_API_KEY}
            r = httpx.get("https://serpapi.com/search.json", params=params, timeout=10)
            data = r.json()
            res = []
            for item in (data.get("organic_results") or [])[:params["num"]]:
                res.append({
                    "title": item.get("title"),
                    "link": item.get("link"),
                    "snippet": item.get("snippet"),
                })
            return WebSearchResponse(query=q, results=res)
        # Autres fournisseurs à ajouter ici
        return WebSearchResponse(query=q, results=[])
    except Exception as e:
        print(f"WARN: websearch error: {e}")
        return WebSearchResponse(query=q, results=[])


@app.get("/health")
def health_check():
    return {"status": "ok"}
