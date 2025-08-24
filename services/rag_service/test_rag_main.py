import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from services.rag_service.main import app

client = TestClient(app)


def test_ingest_endpoint_calls_index_with_document_uniquename():
    long_text = "\n\n".join(["Paragraphe "+str(i)+" sur les intégrales définies." for i in range(5)])
    payload = {
        "contenu": long_text,
        "metadata": {
            "titre": "Les intégrales définies",
            "matiere": "Mathématiques",
            "niveau": "Terminale"
        }
    }

    with patch('services.rag_service.main.rag_index') as mock_index:
        mock_index.ajouter_document.return_value = 'doc-1'
        response = client.post('/ingest', json=payload)
        assert response.status_code == 201
        assert mock_index.ajouter_document.call_count >= 1
        args, kwargs = mock_index.ajouter_document.call_args
        doc = args[0]
        assert hasattr(doc, 'contenu') and hasattr(doc, 'metadata')
        assert 'titre' in doc.metadata

    r_search = client.get('/search', params={"q": "intégrales"})
    assert r_search.status_code == 200
    data = r_search.json()
    assert data['count'] >= 1
    assert any('intégrales' in (d['metadata'].get('titre','')).lower() for d in data['documents'])

    r_query = client.post('/query', json={"question": "intégrales définies", "k": 2})
    assert r_query.status_code == 200
    qdata = r_query.json()
    assert 'answer' in qdata and 'sources' in qdata
    # Comme l'index est en mémoire simple, au moins 1 source devrait remonter
    assert len(qdata['sources']) >= 1
