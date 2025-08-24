import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Add the parent directory to the path to allow imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

client = TestClient(app)

@pytest.fixture
def mock_openai(monkeypatch):
    """Fixture to mock the OpenAI client and ensure API key is set."""
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    with patch('main.openai.chat.completions.create') as mock_create:
        # Configure the mock to return a MagicMock object for the response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = MagicMock()
        mock_response.choices[0].message.content = "Ceci est une réponse simulée."
        mock_create.return_value = mock_response
        yield mock_create

def test_chat_endpoint_builds_correct_system_prompt(mock_openai):
    """
    Tâche 2: Test de la Personnalité du "Professeur Particulier".
    Vérifie que le Master System Prompt est construit correctement.
    """
    # 1. Définir un contexte élève factice
    fake_student_context = {
        "profil": {"prenom": "Alex", "classe": "Terminale", "objectifs": ["Améliorer en maths"]},
        "mastery": [{"competence": "Equations", "theta": 0.4}],
        "historique": [{"role": "user", "content": "Bonjour"}],
        "documents": [{"titre": "Fiche sur les dérivées"}]
    }

    request_data = {
        "contexte_eleve": fake_student_context,
        "requete_actuelle": "Peux-tu m'expliquer les intégrales ?",
        "requete_type": "EXPLICATION"
    }

    # 2. Appeler l'endpoint /chat
    response = client.post("/chat", json=request_data)

    # 3. Vérifier la réponse et l'appel au mock
    assert response.status_code == 200
    assert "réponse simulée" in response.json()['response']

    # 4. Vérifier le contenu du prompt système envoyé à OpenAI
    mock_openai.assert_called_once()
    call_args, call_kwargs = mock_openai.call_args

    # Extraire le system prompt des messages envoyés
    system_prompt = ""
    for message in call_kwargs['messages']:
        if message['role'] == 'system':
            system_prompt = message['content']
            break

    # Vérifier des sections clés du prompt (règles et contexte)
    assert "ARIA" in system_prompt
    assert "coach pédagogique" in system_prompt
    assert '"prenom": "Alex"' in system_prompt  # Vérifie que les données JSON sont bien présentes
    assert '"competence": "Equations"' in system_prompt
    assert "Fiche sur les dérivées" in system_prompt
