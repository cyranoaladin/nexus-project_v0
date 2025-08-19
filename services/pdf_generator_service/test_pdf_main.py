import pytest
from fastapi.testclient import TestClient
import os
from unittest.mock import patch, MagicMock

from services.pdf_generator_service.main import app

client = TestClient(app)

@pytest.fixture
def mock_compiler():
    captured_tex_content = [None]

    def mock_compile_function(tex_content, output_path):
        captured_tex_content[0] = tex_content
        return True, "Compilation successful"

    with patch('services.pdf_generator_service.main.GenerateurTemplatesLaTeX._compiler_avec_corrections_iteratives', side_effect=mock_compile_function) as mock:
        yield mock, captured_tex_content

def test_generate_endpoint_includes_student_name_in_tex(mock_compiler):
    mock_compile_method, captured_tex_content = mock_compiler

    student_name = "Marie Curie"
    request_data = {
        "contenu": "Ceci est le contenu du cours sur la radioactivité.",
        "type_document": "cours",
        "matiere": "Physique",
        "nom_fichier": "cours_radioactivite",
        "nom_eleve": student_name
    }

    response = client.post("/generate", json=request_data)

    assert response.status_code == 200
    assert response.json()['message'] == "PDF généré avec succès."

    expected_string = f"Document préparé pour {student_name} par l'Assistant IA ARIA"
    tex_content = captured_tex_content[0]
    if tex_content is None:
        out_dir = os.environ.get('OUTPUT_DIR') or os.path.abspath(os.path.join(os.path.dirname(__file__), 'generated_pdfs'))
        tex_path = os.path.join(out_dir, 'cours_radioactivite.tex')
        with open(tex_path, 'r', encoding='utf-8') as f:
            contents = f.read()
        assert expected_string in contents
    else:
        assert expected_string in tex_content


def test_correction_iterative_on_syntax_error_then_success():
    bad_content = "Section_invalide avec _ non échappé"
    data = {
        "contenu": bad_content,
        "type_document": "fiche_revision",
        "matiere": "Maths",
        "nom_fichier": "fiche_test",
        "nom_eleve": "Test Eleve"
    }

    call_count = {"n": 0}

    def compile_side_effect(tex_content, output_dir):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return False, "Erreur de compilation"
        assert "\\nonstopmode" in tex_content
        return True, "OK"

    fake_proc_fail = MagicMock(returncode=1, stdout='', stderr='err')
    fake_proc_ok = MagicMock(returncode=0, stdout='ok', stderr='')
    calls = {"n": 0}
    def subprocess_side_effect(*args, **kwargs):
        calls["n"] += 1
        return fake_proc_fail if calls["n"] == 1 else fake_proc_ok

    with patch('subprocess.run', side_effect=subprocess_side_effect):
        resp = client.post('/generate', json=data)
        assert resp.status_code == 200
        assert resp.json().get('url', '').endswith('.pdf')
