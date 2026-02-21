#!/usr/bin/env python3
"""Patch RAG ingestor api.py with improvements:
1. Mount admin_api router
2. Mount metrics endpoint
3. Improve /search with subject/level/type filters
4. Add education content auto-classifier
5. Add /collections and /collections/{name}/stats endpoints
6. Improve /health with service status details
"""
import sys

API_PATH = "/srv/rag-local/src/ingestor/api.py"

with open(API_PATH, "r") as f:
    content = f.read()

patches_applied = 0

# ============================================================
# PATCH 1: Mount admin_api router + metrics endpoint
# ============================================================
old = 'app = FastAPI(title="RAG Ingestor API v2.2")'
new = '''app = FastAPI(title="RAG Ingestor API v2.3")

# --- MOUNT ADMIN API ROUTER ---
try:
    from admin_api import router as admin_router
    app.include_router(admin_router, prefix="/admin", tags=["admin"])
    logger.info("Admin API router mounted at /admin")
except ImportError:
    logger.warning("admin_api.py not found, /admin endpoints disabled")

# --- METRICS ENDPOINT ---
if METRICS_ENABLED:
    try:
        from prometheus_client import generate_latest, REGISTRY as PROM_REGISTRY
        @app.get("/metrics")
        def metrics_endpoint():
            data = generate_latest(PROM_REGISTRY)
            return Response(content=data, media_type=CONTENT_TYPE_LATEST)
        logger.info("Prometheus metrics endpoint mounted at /metrics")
    except Exception as e:
        logger.warning(f"Metrics endpoint disabled: {e}")'''

if old in content:
    content = content.replace(old, new)
    patches_applied += 1
    print("PATCH 1 OK: admin_api + metrics mounted")
else:
    print("PATCH 1 SKIP: app = FastAPI line not found (already patched?)")

# ============================================================
# PATCH 2: Improve /search with subject/level/type filters
# ============================================================
old_where = '''        where = {}
        if req.filters and req.filters.get("domain"):
             where["domain"] = req.filters.get("domain")

        res = coll.query(query_embeddings=[vec], n_results=req.k, where=where if where else None)
        
        hits = []
        ids = res['ids'][0]
        docs = res['documents'][0]
        metas = res['metadatas'][0]
        dists = res['distances'][0] if res['distances'] else [0]*len(ids)
        
        for i in range(len(ids)):
            hits.append({
                "id": ids[i],
                "score": dists[i],
                "metadata": metas[i],
                "document": docs[i]
            })
            
        return {"hits": hits}
    except Exception as e:
        raise HTTPException(500, str(e))'''

new_where = '''        # Build ChromaDB where filter from all metadata fields
        where_clauses = []
        if req.filters:
            for key in ("domain", "subject", "level", "type", "doc_type"):
                val = req.filters.get(key)
                if val and val not in ("N/A (Auto)", "mixed", ""):
                    where_clauses.append({key: val})

        where = None
        if len(where_clauses) == 1:
            where = where_clauses[0]
        elif len(where_clauses) > 1:
            where = {"$and": where_clauses}

        # Fetch more results than requested for post-filtering headroom
        fetch_k = min(req.k * 3, 50)
        res = coll.query(query_embeddings=[vec], n_results=fetch_k, where=where)

        hits = []
        ids = res["ids"][0] if res.get("ids") else []
        docs = res["documents"][0] if res.get("documents") else []
        metas = res["metadatas"][0] if res.get("metadatas") else []
        dists = res["distances"][0] if res.get("distances") else [0] * len(ids)

        for i in range(len(ids)):
            hits.append({
                "id": ids[i],
                "score": dists[i],
                "metadata": metas[i] if i < len(metas) else {},
                "document": docs[i] if i < len(docs) else "",
            })

        # Return only top-k after filtering
        hits = hits[:req.k]

        return {"hits": hits, "total_candidates": len(ids), "filters_applied": where}
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(500, str(e))'''

if old_where in content:
    content = content.replace(old_where, new_where)
    patches_applied += 1
    print("PATCH 2 OK: /search improved with multi-field filters")
else:
    print("PATCH 2 SKIP: old search block not found")

# ============================================================
# PATCH 3: Improve /ingest to auto-classify education content
# ============================================================
old_classify = '''        # Classify
        meta = req.metadata_hints or {}
        if meta.get("domain") == "mfai_web3":
             tags = classify_content_with_llm(docs[0].page_content, "mfai_web3")
             for d in docs: d.metadata.update(tags)'''

new_classify = '''        # Classify
        meta = req.metadata_hints or {}
        if meta.get("domain") == "mfai_web3":
             tags = classify_content_with_llm(docs[0].page_content, "mfai_web3")
             for d in docs: d.metadata.update(tags)
        elif meta.get("domain") == "education" and meta.get("subject") == "mixed":
             # Auto-classify education content by subject/level
             tags = classify_education_content(docs[0].page_content)
             for d in docs: d.metadata.update(tags)'''

if old_classify in content:
    content = content.replace(old_classify, new_classify)
    patches_applied += 1
    print("PATCH 3 OK: education auto-classify in /ingest")
else:
    print("PATCH 3 SKIP: old classify block not found")

# ============================================================
# PATCH 4: Add education classifier function
# ============================================================
old_bg = "# --- BACKGROUND TASKS (THE WORKERS) ---"
edu_classifier = '''# --- EDUCATION CONTENT CLASSIFIER ---
def classify_education_content(text_sample: str) -> dict:
    """Auto-classify pedagogical content by subject and level using LLM."""
    prompt = (
        "Tu es un expert en programmes scolaires francais (lycee).\\n"
        "Analyse le texte suivant et determine:\\n"
        "1. La matiere principale (maths, nsi, physique_chimie, francais, svt, ses)\\n"
        "2. Le niveau (seconde, premiere, terminale, superieur)\\n"
        "3. Le type de document (cours, exercice, sujet_bac, fiche_methode, programme_officiel)\\n"
        "\\nReponds UNIQUEMENT avec un JSON valide:\\n"
        '{"subject": "...", "level": "...", "doc_type": "..."}\\n\\n'
        "TEXTE:\\n" + text_sample[:2000]
    )
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": "llama3.2",
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1},
            },
            timeout=OLLAMA_REQUEST_TIMEOUT,
        )
        result = json.loads(r.json().get("response", "{}"))
        valid_subjects = {"maths", "nsi", "physique_chimie", "francais", "svt", "ses"}
        valid_levels = {"seconde", "premiere", "terminale", "superieur"}
        if result.get("subject") not in valid_subjects:
            result["subject"] = "unknown"
        if result.get("level") not in valid_levels:
            result["level"] = "unknown"
        return result
    except Exception as e:
        logger.warning(f"Education classification failed: {e}")
        return {"subject": "unknown", "level": "unknown", "doc_type": "unknown"}


# --- BACKGROUND TASKS (THE WORKERS) ---'''

if old_bg in content:
    content = content.replace(old_bg, edu_classifier, 1)
    patches_applied += 1
    print("PATCH 4 OK: education classifier function added")
else:
    print("PATCH 4 SKIP: background tasks marker not found")

# ============================================================
# PATCH 5: Improve /health + add /collections endpoints
# ============================================================
old_health = '''@app.get("/health")
def health(): return {"status": "healthy"}'''

new_health = '''@app.get("/health")
def health():
    """Health check with service status details."""
    chroma_ok = False
    ollama_ok = False
    chroma_collections = 0
    try:
        client = get_chroma_client()
        collections = client.list_collections()
        chroma_ok = True
        chroma_collections = len(collections)
    except Exception:
        pass
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        ollama_ok = r.status_code == 200
    except Exception:
        pass
    return {
        "status": "healthy" if chroma_ok and ollama_ok else "degraded",
        "chroma": {"ok": chroma_ok, "collections": chroma_collections},
        "ollama": {"ok": ollama_ok, "url": OLLAMA_URL},
        "embed_model": EMBED_MODEL,
        "collection_default": COLLECTION_NAME,
    }


@app.get("/collections")
def list_collections():
    """List all ChromaDB collections with document counts."""
    try:
        client = get_chroma_client()
        collections = client.list_collections()
        result = []
        for c in collections:
            result.append({"name": c.name, "count": c.count(), "metadata": c.metadata})
        return {"collections": result}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/collections/{name}/stats")
def collection_stats(name: str):
    """Get detailed stats for a collection: subjects, levels, types breakdown."""
    try:
        client = get_chroma_client()
        coll = client.get_collection(name)
        total = coll.count()
        if total == 0:
            return {"collection": name, "count": 0, "subjects": {}, "levels": {}, "types": {}}

        all_data = coll.get(include=["metadatas"])
        subjects = {}
        levels = {}
        types = {}
        sources = {}
        for meta in all_data["metadatas"]:
            s = meta.get("subject", "unknown")
            lvl = meta.get("level", "unknown")
            t = meta.get("type", "unknown")
            src = meta.get("source", "unknown")
            subjects[s] = subjects.get(s, 0) + 1
            levels[lvl] = levels.get(lvl, 0) + 1
            types[t] = types.get(t, 0) + 1
            sources[src] = sources.get(src, 0) + 1

        return {
            "collection": name,
            "count": total,
            "subjects": subjects,
            "levels": levels,
            "types": types,
            "sources": sources,
        }
    except Exception as e:
        raise HTTPException(500, str(e))'''

if old_health in content:
    content = content.replace(old_health, new_health)
    patches_applied += 1
    print("PATCH 5 OK: /health improved + /collections + /collections/{name}/stats added")
else:
    print("PATCH 5 SKIP: old health endpoint not found")

# Write result
with open(API_PATH, "w") as f:
    f.write(content)

print(f"\nDONE: {patches_applied}/5 patches applied to {API_PATH}")
