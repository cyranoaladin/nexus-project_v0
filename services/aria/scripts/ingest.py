from __future__ import annotations

import glob
import hashlib
import os
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

try:  # pragma: no cover - optional dependency for static analysis
    from qdrant_client import QdrantClient as _QdrantClient  # type: ignore[import]
    from qdrant_client.http import models as qm  # type: ignore[import]
except ImportError:  # pragma: no cover
    _QdrantClient = None
    qm = None  # type: ignore[assignment]

try:  # pragma: no cover - optional dependency for static analysis
    from sentence_transformers import SentenceTransformer as _SentenceTransformer  # type: ignore[import]
except ImportError:  # pragma: no cover
    _SentenceTransformer = None  # type: ignore[assignment]

if TYPE_CHECKING:  # pragma: no cover - typing helpers
    from qdrant_client import QdrantClient as QdrantClientType
    from sentence_transformers import SentenceTransformer as SentenceTransformerType
else:
    QdrantClientType = Any
    SentenceTransformerType = Any


def chunk_text(text: str, size: int = 800, overlap: int = 120) -> list[str]:
    chunks: list[str] = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + size])
        i += max(size - overlap, 1)
    return chunks


def load_text(fp: Path) -> str:
    with fp.open("r", encoding="utf-8") as stream:
        return stream.read()


def ensure_collection(client: QdrantClientType, collection: str, dim: int) -> None:
    if qm is None:  # pragma: no cover - runtime guard
        raise RuntimeError("qdrant-client models are required for ingestion")
    try:
        client.get_collection(collection)
    except Exception:
        client.recreate_collection(
            collection_name=collection,
            vectors_config=qm.VectorParams(size=dim, distance=qm.Distance.COSINE),
        )


def main() -> None:
    docs_dir = Path(os.getenv("ARIA_DOCS_DIR", "./corpus"))
    if not docs_dir.exists():
        print(f"[WARN] Le dossier {docs_dir} est vide")

    collection = os.getenv("QDRANT_COLLECTION", "aria_rag")
    if _QdrantClient is None or qm is None:
        raise RuntimeError("qdrant-client is required for ingestion")
    if _SentenceTransformer is None:
        raise RuntimeError("sentence-transformers is required for ingestion")

    client = cast(QdrantClientType, _QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333")))
    embedder = cast(
        SentenceTransformerType,
        _SentenceTransformer(os.getenv("EMB_MODEL", "BAAI/bge-m3")),
    )
    dim = embedder.get_sentence_embedding_dimension()

    ensure_collection(client, collection, dim)

    files = list(docs_dir.rglob("*.md"))
    for fp in files:
        text = load_text(fp)
        chunks = chunk_text(text)
        vectors = embedder.encode(chunks, normalize_embeddings=True)
        points = []
        for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
            pid = int(hashlib.md5(f"{fp}-{idx}".encode()).hexdigest()[:16], 16)
            points.append(
                qm.PointStruct(
                    id=pid,
                    vector=vector.tolist(),
                    payload={
                        "file": str(fp.relative_to(docs_dir)),
                        "text": chunk,
                    },
                )
            )
        client.upsert(collection, points=points)
        print(f"[INGEST] {fp} → {len(points)} chunks")


if __name__ == "__main__":  # pragma: no cover
    main()
