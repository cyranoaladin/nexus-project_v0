from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.factories import create_document_with_chunks


def _headers(role: str = "student", actor_id: str | None = None, student_id: str | None = None) -> dict[str, str]:
    headers = {"X-Role": role}
    if actor_id:
        headers["X-Actor-Id"] = actor_id
    if student_id:
        headers["X-Student-Id"] = student_id
    return headers


def test_rag_search_returns_hits(client: TestClient, db_session):
    document = create_document_with_chunks(
        db_session,
        meta={"title": "Analyse terminale"},
        chunks=[
            {
                "content": "Préparation bac — fonctions dérivées et étude de variations.",
                "meta": {"subject": "maths", "modality": "text"},
            }
        ],
    )

    response = client.get(
        "/rag/search",
        params={"q": "dérivées maths"},
        headers=_headers(actor_id=str(uuid.uuid4())),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["q"] == "dérivées maths"
    assert payload["hits"], "Expected at least one RAG hit"
    top_hit = payload["hits"][0]
    assert top_hit["document_id"] == str(document.id)
    assert "snippet" in top_hit and "dérivées" in top_hit["snippet"]
    assert 0.0 <= top_hit["score"] <= 1.0
    assert top_hit["metadata"].get("subject") == "maths"


def test_rag_search_filters_on_metadata(client: TestClient, db_session):
    create_document_with_chunks(
        db_session,
        meta={"title": "Mathématiques"},
        chunks=[{"content": "Limites et dérivées", "meta": {"subject": "maths"}}],
    )
    create_document_with_chunks(
        db_session,
        meta={"title": "Philosophie"},
        chunks=[{"content": "Les Lumières et Kant", "meta": {"subject": "philo"}}],
    )

    response = client.get(
        "/rag/search",
        params={"q": "Limites", "filters": "subject=maths"},
        headers=_headers(actor_id=str(uuid.uuid4())),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["hits"], "Expected filtered result"
    assert all(hit["metadata"].get("subject") == "maths" for hit in payload["hits"])


def test_rag_document_endpoint_returns_chunks(client: TestClient, db_session):
    document = create_document_with_chunks(
        db_session,
        meta={"title": "Programme NSI"},
        chunks=[{"content": "Python — structures de données", "meta": {"subject": "nsi"}}],
    )

    response = client.get(
        f"/rag/doc/{document.id}",
        headers=_headers(actor_id=str(uuid.uuid4())),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == str(document.id)
    assert payload["meta"].get("title") == "Programme NSI"
    assert payload["chunks"], "Document should expose chunks"
    chunk = payload["chunks"][0]
    assert chunk["content"].startswith("Python"), "Chunk content should be returned"


def test_rag_document_not_found(client: TestClient):
    response = client.get(
        f"/rag/doc/{uuid.uuid4()}",
        headers=_headers(actor_id=str(uuid.uuid4())),
    )

    assert response.status_code == 404